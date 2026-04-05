"""
Fuel Module - Business Logic & Services
Handles fuel planning, advances, transactions, approvals
"""
import sqlite3
from datetime import datetime, timedelta
from decimal import Decimal
import json

class FuelService:
    """Fuel management service"""
    
    def __init__(self, db_path='./fleet_erp_backend_sqlite.db'):
        self.db_path = db_path
    
    def get_db(self):
        """Get database connection"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn
    
    # ============================================================================
    # FUEL POLICY ENGINE
    # ============================================================================
    
    def get_applicable_fuel_policy(self, client_id, vehicle_type=None, vehicle_owner_type=None, trip_type='frl'):
        """
        Get fuel policy for a trip based on rules engine
        Priority: exact match > default match
        """
        conn = self.get_db()
        cursor = conn.cursor()
        
        # Try exact match first
        query = """
            SELECT * FROM fuel_policy_rules 
            WHERE client_id = ? 
            AND (vehicle_type = ? OR vehicle_type = 'any')
            AND (vehicle_owner_type = ? OR vehicle_owner_type = 'any')
            AND (trip_type = ? OR trip_type = 'any')
            AND active = 1
            ORDER BY 
                CASE WHEN vehicle_type != 'any' THEN 1 ELSE 2 END,
                CASE WHEN vehicle_owner_type != 'any' THEN 1 ELSE 2 END,
                CASE WHEN trip_type != 'any' THEN 1 ELSE 2 END
            LIMIT 1
        """
        
        cursor.execute(query, (client_id, vehicle_type, vehicle_owner_type, trip_type))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return dict(row)
        
        # Return default company policy
        return {
            'policy_id': 0,
            'fuel_mode': 'driver_advance',
            'fuel_payment_responsibility': 'company',
            'max_advance_amount': 5000,
            'max_advance_percent': 5,
            'expected_kmpl': 4.5,
            'buffer_percent': 10,
            'approval_required': 0
        }
    
    # ============================================================================
    # MILEAGE & FUEL CALCULATION
    # ============================================================================
    
    def get_expected_mileage(self, vehicle_type, load_condition='loaded', route_type='highway'):
        """Get expected KMPL based on vehicle & conditions"""
        conn = self.get_db()
        cursor = conn.cursor()
        
        query = """
            SELECT expected_kmpl FROM vehicle_mileage_rules
            WHERE vehicle_type = ?
            AND load_condition = ?
            AND (route_type = ? OR route_type = 'any')
            AND active = 1
            LIMIT 1
        """
        
        cursor.execute(query, (vehicle_type, load_condition, route_type))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return row[0]
        
        # Default fallback
        return 4.5 if load_condition == 'loaded' else 5.8
    
    def calculate_fuel_budget(self, trip_km, vehicle_type, load_condition, trip_policy):
        """
        Calculate fuel budget for a trip
        expected_fuel = trip_km / expected_kmpl + buffer
        """
        expected_kmpl = trip_policy.get('expected_kmpl', 4.5)
        buffer_percent = trip_policy.get('buffer_percent', 10)
        
        expected_fuel = trip_km / expected_kmpl
        fuel_with_buffer = expected_fuel * (1 + buffer_percent / 100)
        
        return {
            'expected_fuel_ltr': round(expected_fuel, 2),
            'fuel_with_buffer_ltr': round(fuel_with_buffer, 2),
            'buffer_percent': buffer_percent
        }
    
    # ============================================================================
    # FUEL ADVANCE MANAGEMENT
    # ============================================================================
    
    def create_fuel_advance_request(self, trip_id, driver_id, amount_requested, fuel_limit_amount, remarks=''):
        """Create a fuel advance request for trip"""
        conn = self.get_db()
        cursor = conn.cursor()
        
        # Check if advance already exists
        cursor.execute("SELECT advance_id FROM trip_fuel_advances WHERE trip_id = ?", (trip_id,))
        if cursor.fetchone():
            conn.close()
            return {'error': 'Advance already exists for this trip', 'status': 'error'}
        
        # Validate amount doesn't exceed limit
        if amount_requested > fuel_limit_amount * 1.2:  # Allow 20% overage with approval
            approval_required = True
        else:
            approval_required = False
        
        try:
            cursor.execute("""
                INSERT INTO trip_fuel_advances 
                (trip_id, driver_id, amount_requested, approval_status, remarks)
                VALUES (?, ?, ?, ?, ?)
            """, (trip_id, driver_id, amount_requested, 'requested', remarks))
            
            conn.commit()
            advance_id = cursor.lastrowid
            conn.close()
            
            return {
                'advance_id': advance_id,
                'trip_id': trip_id,
                'amount_requested': amount_requested,
                'approval_status': 'requested',
                'status': 'created'
            }
        except Exception as e:
            conn.close()
            return {'error': str(e), 'status': 'error'}
    
    def approve_fuel_advance(self, advance_id, approved_amount, approved_by=None):
        """Approve a fuel advance (munshi/admin)"""
        conn = self.get_db()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                UPDATE trip_fuel_advances 
                SET amount_approved = ?, approval_status = ?, issued_by = ?
                WHERE advance_id = ?
            """, (approved_amount, 'approved', approved_by, advance_id))
            
            conn.commit()
            conn.close()
            
            return {
                'advance_id': advance_id,
                'approval_status': 'approved',
                'amount_approved': approved_amount,
                'status': 'approved'
            }
        except Exception as e:
            conn.close()
            return {'error': str(e), 'status': 'error'}
    
    def issue_fuel_advance(self, advance_id, issued_amount, issue_mode='cash', issued_by=None):
        """Issue fuel advance to driver"""
        conn = self.get_db()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                UPDATE trip_fuel_advances 
                SET issued_amount = ?, issue_mode = ?, approval_status = ?, issued_at = ?, issued_by = ?
                WHERE advance_id = ?
            """, (issued_amount, issue_mode, 'issued', datetime.now().isoformat(), issued_by, advance_id))
            
            conn.commit()
            conn.close()
            
            return {
                'advance_id': advance_id,
                'issued_amount': issued_amount,
                'issue_mode': issue_mode,
                'issued_at': datetime.now().isoformat(),
                'status': 'issued'
            }
        except Exception as e:
            conn.close()
            return {'error': str(e), 'status': 'error'}
    
    # ============================================================================
    # FUEL TRANSACTION TRACKING
    # ============================================================================
    
    def record_fuel_transaction(self, trip_id, vehicle_id, driver_id, litres, amount, 
                               fuel_mode, bill_number=None, location='', remarks=''):
        """Record fuel transaction (bill entry)"""
        conn = self.get_db()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                INSERT INTO fuel_transactions 
                (trip_id, vehicle_id, driver_id, fuel_mode, litres, amount, 
                 bill_number, location, transaction_time, remarks, source)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (trip_id, vehicle_id, driver_id, fuel_mode, litres, amount,
                  bill_number, location, datetime.now().isoformat(), remarks, 'driver'))
            
            conn.commit()
            txn_id = cursor.lastrowid
            
            # Update trip's total_fuel_used
            cursor.execute("""
                UPDATE munshi_trips 
                SET total_fuel_used = total_fuel_used + ?
                WHERE id = ?
            """, (litres, trip_id))
            
            conn.commit()
            conn.close()
            
            return {
                'fuel_txn_id': txn_id,
                'trip_id': trip_id,
                'litres': litres,
                'amount': amount,
                'status': 'recorded'
            }
        except Exception as e:
            conn.close()
            return {'error': str(e), 'status': 'error'}
    
    # ============================================================================
    # FUEL VARIANCE & ALERTS
    # ============================================================================
    
    def calculate_fuel_variance(self, trip_id):
        """Calculate variance between expected and actual fuel"""
        conn = self.get_db()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT expected_fuel_ltr, total_fuel_used FROM munshi_trips WHERE id = ?
        """, (trip_id,))
        
        trip = cursor.fetchone()
        if not trip:
            conn.close()
            return {'error': 'Trip not found', 'status': 'error'}
        
        expected = trip[0] or 0
        actual = trip[1] or 0
        variance = (actual - expected) if expected > 0 else 0
        variance_percent = ((variance / expected) * 100) if expected > 0 else 0
        
        conn.close()
        
        return {
            'trip_id': trip_id,
            'expected_fuel': expected,
            'actual_fuel': actual,
            'variance_ltr': round(variance, 2),
            'variance_percent': round(variance_percent, 1),
            'status': 'high' if variance_percent > 15 else 'normal'
        }
    
    # ============================================================================
    # FUEL DASHBOARD QUERIES
    # ============================================================================
    
    def get_pending_fuel_approvals(self, client_id=None):
        """Get all pending fuel advance approvals"""
        conn = self.get_db()
        cursor = conn.cursor()
        
        if client_id:
            cursor.execute("""
                SELECT fa.*, mt.trip_no, mt.vehicle_no, d.name as driver_name, mt.from_poi_name, mt.to_poi_name
                FROM trip_fuel_advances fa
                JOIN munshi_trips mt ON fa.trip_id = mt.id
                JOIN drivers d ON fa.driver_id = d.id
                WHERE mt.client_id = ? AND fa.approval_status = 'requested'
                ORDER BY fa.created_at DESC
            """, (client_id,))
        else:
            cursor.execute("""
                SELECT fa.*, mt.trip_no, mt.vehicle_no, d.name as driver_name, mt.client_id
                FROM trip_fuel_advances fa
                JOIN munshi_trips mt ON fa.trip_id = mt.id
                JOIN drivers d ON fa.driver_id = d.id
                WHERE fa.approval_status = 'requested'
                ORDER BY fa.created_at DESC
            """)
        
        results = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        return results
    
    def get_fuel_dashboard_summary(self, client_id):
        """Get fuel dashboard summary for client"""
        conn = self.get_db()
        cursor = conn.cursor()
        
        # Pending approvals
        cursor.execute("""
            SELECT COUNT(*) FROM trip_fuel_advances 
            WHERE approval_status = 'requested'
        """)
        pending_approvals = cursor.fetchone()[0]
        
        # Total fuel issued today
        cursor.execute("""
            SELECT SUM(issued_amount) FROM trip_fuel_advances
            WHERE DATE(issued_at) = DATE('now') AND approval_status IN ('issued', 'settled')
        """)
        fuel_issued_today = cursor.fetchone()[0] or 0
        
        # High variance trips (>15%)
        cursor.execute("""
            SELECT COUNT(*) FROM munshi_trips
            WHERE client_id = ? AND fuel_variance > total_fuel_used * 0.15 AND total_fuel_used > 0
        """, (client_id,))
        high_variance_count = cursor.fetchone()[0]
        
        # Total outstanding driver advances
        cursor.execute("""
            SELECT SUM(issued_amount - COALESCE(bill_amount, 0)) FROM trip_fuel_advances
            WHERE settlement_status != 'settled' AND approved_by IS NOT NULL
        """)
        outstanding_advances = cursor.fetchone()[0] or 0
        
        conn.close()
        
        return {
            'pending_approvals': pending_approvals,
            'fuel_issued_today': round(fuel_issued_today, 2),
            'high_variance_trips': high_variance_count,
            'outstanding_driver_advances': round(outstanding_advances, 2)
        }


# ============================================================================
# Helper initialization
# ============================================================================

def init_fuel_service(db_path='./fleet_erp_backend_sqlite.db'):
    """Initialize fuel service"""
    return FuelService(db_path)
