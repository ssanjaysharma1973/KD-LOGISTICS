"""
Driver API routes with PIN-based authentication
"""
from flask import Blueprint, request, jsonify
import sqlite3
import os
from functools import wraps

driver_bp = Blueprint('drivers', __name__, url_prefix='/api/drivers')

# Get absolute path to database
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BACKEND_DIR, 'fleet_erp_backend_sqlite.db')

def get_db():
    """Get database connection"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def ensure_drivers_table():
    """Create drivers table if it doesn't exist"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS drivers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id TEXT,
            name TEXT NOT NULL,
            phone TEXT,
            license_number TEXT UNIQUE,
            vehicle_number TEXT,
            vehicle_id INTEGER,
            role TEXT DEFAULT 'driver',
            pin TEXT,
            status TEXT DEFAULT 'active',
            assigned_at TIMESTAMP,
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Create indices for faster lookups - wrap in try/except to handle existing columns
    try:
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_drivers_license 
            ON drivers(license_number)
        """)
    except:
        pass
    
    try:
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_drivers_vehicle 
            ON drivers(vehicle_number)
        """)
    except:
        pass
    
    try:
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_drivers_client 
            ON drivers(client_id)
        """)
    except:
        pass
    
    try:
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_drivers_role 
            ON drivers(role)
        """)
    except:
        pass
    
    conn.commit()
    conn.close()

# Ensure table exists on module load
ensure_drivers_table()

# ============================================================================
# DRIVER PIN LOGIN
# ============================================================================

@driver_bp.route('/login', methods=['POST'])
def driver_pin_login():
    """
    Driver login with PIN
    Expected JSON: { "driver_id": 999, "pin": "99" }
    or: { "vehicle_number": "MH01AB1234", "pin": "99" }
    """
    try:
        data = request.get_json()
        driver_id = data.get('driver_id')
        vehicle_number = data.get('vehicle_number')
        pin = data.get('pin', '').strip()
        
        if not pin or len(pin) < 2:
            return jsonify({'success': False, 'error': 'Invalid PIN'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Find driver by ID or vehicle number
        if driver_id:
            cursor.execute("""
                SELECT id, name, phone, license_number, vehicle_number, status 
                FROM drivers 
                WHERE id = ? AND status = 'active'
            """, (driver_id,))
        elif vehicle_number:
            cursor.execute("""
                SELECT id, name, phone, license_number, vehicle_number, status 
                FROM drivers 
                WHERE (vehicle_number = ? OR vehicle_number LIKE ?) AND status = 'active'
            """, (vehicle_number.upper(), f"%{vehicle_number.upper()}%"))
        else:
            conn.close()
            return jsonify({'success': False, 'error': 'Provide driver_id or vehicle_number'}), 400
        
        driver = cursor.fetchone()
        conn.close()
        
        if not driver:
            return jsonify({'success': False, 'error': 'Driver not found or inactive'}), 404
        
        # For now, accept any valid PIN (Phase 2: implement actual PIN verification)
        # In production, you'd compare hashed PIN here
        driver_dict = dict(driver)
        
        return jsonify({
            'success': True,
            'driver': {
                'id': driver_dict['id'],
                'name': driver_dict['name'],
                'phone': driver_dict['phone'],
                'vehicle_number': driver_dict['vehicle_number'],
                'license_number': driver_dict['license_number']
            }
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ============================================================================
# DRIVER CRUD OPERATIONS
# ============================================================================

@driver_bp.route('', methods=['GET'])
def list_drivers():
    """Get all drivers"""
    try:
        status = request.args.get('status', 'active')
        conn = get_db()
        cursor = conn.cursor()
        
        if status and status != 'all':
            cursor.execute("""
                SELECT id, name, phone, license_number, vehicle_number, status, 
                       created_at, updated_at
                FROM drivers 
                WHERE status = ?
                ORDER BY id DESC
            """, (status,))
        else:
            cursor.execute("""
                SELECT id, name, phone, license_number, vehicle_number, status,
                       created_at, updated_at
                FROM drivers 
                ORDER BY id DESC
            """)
        
        rows = cursor.fetchall()
        conn.close()
        
        drivers = [dict(row) for row in rows]
        return jsonify({'success': True, 'drivers': drivers}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@driver_bp.route('/<int:driver_id>', methods=['GET'])
def get_driver(driver_id):
    """Get driver by ID"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, name, phone, license_number, vehicle_number, status,
                   created_at, updated_at
            FROM drivers 
            WHERE id = ?
        """, (driver_id,))
        
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            return jsonify({'success': False, 'error': 'Driver not found'}), 404
        
        return jsonify({'success': True, 'driver': dict(row)}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@driver_bp.route('', methods=['POST'])
def create_driver():
    """Create a new driver"""
    try:
        data = request.get_json()
        name = data.get('name', '').strip()
        phone = data.get('phone', '').strip()
        license_number = data.get('license_number', '').strip()
        vehicle_number = data.get('vehicle_number', '').strip()
        pin = data.get('pin', '').strip()
        notes = data.get('notes', '').strip()
        
        if not name or not pin or len(pin) < 2:
            return jsonify({'success': False, 'error': 'Name and PIN (2+ digits) required'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                INSERT INTO drivers (name, phone, license_number, vehicle_number, pin, notes, status)
                VALUES (?, ?, ?, ?, ?, ?, 'active')
            """, (name, phone or None, license_number or None, 
                  vehicle_number.upper() if vehicle_number else None, pin, notes or None))
            
            driver_id = cursor.lastrowid
            conn.commit()
            conn.close()
            
            return jsonify({
                'success': True,
                'message': 'Driver created',
                'driver_id': driver_id
            }), 201
            
        except sqlite3.IntegrityError as e:
            conn.close()
            return jsonify({'success': False, 'error': 'License already exists'}), 409
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@driver_bp.route('/<int:driver_id>', methods=['PUT'])
def update_driver(driver_id):
    """Update driver info"""
    try:
        data = request.get_json()
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Build dynamic update query
        updates = []
        values = []
        
        fields = ['name', 'phone', 'license_number', 'vehicle_number', 'pin', 'notes', 'status']
        for field in fields:
            if field in data:
                value = data[field]
                if field == 'vehicle_number' and value:
                    value = value.upper()
                updates.append(f"{field} = ?")
                values.append(value if value else None)
        
        if not updates:
            conn.close()
            return jsonify({'success': False, 'error': 'No fields to update'}), 400
        
        updates.append("updated_at = CURRENT_TIMESTAMP")
        values.append(driver_id)
        
        query = f"UPDATE drivers SET {', '.join(updates)} WHERE id = ?"
        
        cursor.execute(query, values)
        conn.commit()
        
        if cursor.rowcount == 0:
            conn.close()
            return jsonify({'success': False, 'error': 'Driver not found'}), 404
        
        conn.close()
        return jsonify({'success': True, 'message': 'Driver updated'}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@driver_bp.route('/<int:driver_id>', methods=['DELETE'])
def delete_driver(driver_id):
    """Soft-delete driver (set status to inactive)"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute("""
            UPDATE drivers 
            SET status = 'inactive', updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        """, (driver_id,))
        
        conn.commit()
        
        if cursor.rowcount == 0:
            conn.close()
            return jsonify({'success': False, 'error': 'Driver not found'}), 404
        
        conn.close()
        return jsonify({'success': True, 'message': 'Driver deactivated'}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ============================================================================
# DRIVER REPORT ENDPOINTS
# ============================================================================

@driver_bp.route('/report', methods=['POST'])
def submit_driver_report():
    """Submit an issue report from driver"""
    try:
        data = request.get_json()
        vehicle_no = data.get('vehicle_no', '').strip().upper()
        driver_name = data.get('driver_name', '').strip()
        issue_type = data.get('issue_type', '').strip()
        description = data.get('description', '').strip()
        client_id = data.get('client_id', 'CLIENT_001').strip()
        
        if not vehicle_no or not issue_type or not description:
            return jsonify({'success': False, 'error': 'Vehicle, issue type, and description required'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Create reports table if not exists
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS driver_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                vehicle_no TEXT,
                driver_name TEXT,
                issue_type TEXT,
                description TEXT,
                client_id TEXT,
                status TEXT DEFAULT 'open',
                reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                resolved_at TIMESTAMP,
                admin_notes TEXT
            )
        """)
        
        cursor.execute("""
            INSERT INTO driver_reports (vehicle_no, driver_name, issue_type, description, client_id)
            VALUES (?, ?, ?, ?, ?)
        """, (vehicle_no, driver_name, issue_type, description, client_id))
        
        report_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Report submitted successfully',
            'report_id': report_id
        }), 201
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@driver_bp.route('/reports', methods=['GET'])
def get_driver_reports():
    """Get reports for a specific vehicle"""
    try:
        vehicle_no = request.args.get('vehicle_no', '').strip().upper()
        
        if not vehicle_no:
            return jsonify({'success': False, 'error': 'vehicle_no parameter required'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Create table if not exists
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS driver_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                vehicle_no TEXT,
                driver_name TEXT,
                issue_type TEXT,
                description TEXT,
                client_id TEXT,
                status TEXT DEFAULT 'open',
                reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                resolved_at TIMESTAMP,
                admin_notes TEXT
            )
        """)
        
        cursor.execute("""
            SELECT id, vehicle_no, driver_name, issue_type, description, status, reported_at, admin_notes
            FROM driver_reports
            WHERE vehicle_no = ?
            ORDER BY reported_at DESC
        """, (vehicle_no,))
        
        rows = cursor.fetchall()
        conn.close()
        
        reports = [dict(row) for row in rows]
        return jsonify(reports), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ============================================================================
# SEED TEST DATA
# ============================================================================

@driver_bp.route('/seed/test-data', methods=['POST'])
def seed_test_drivers():
    """Create test drivers for development"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        test_drivers = [
            ('Driver 999', '9876543210', 'DL999TEST', None, '99', 'Test driver for PIN login'),
            ('Atul Singh', '9123456789', 'DLAT001', 'MH01AB1234', '42', 'Senior driver'),
            ('Rajesh', '8765432109', 'DLRJ002', 'MH02XY5678', '88', 'Junior driver'),
        ]
        
        for name, phone, license, vehicle, pin, notes in test_drivers:
            try:
                cursor.execute("""
                    INSERT INTO drivers (name, phone, license_number, vehicle_number, pin, notes, status)
                    VALUES (?, ?, ?, ?, ?, ?, 'active')
                """, (name, phone, license, vehicle.upper() if vehicle else None, pin, notes))
            except sqlite3.IntegrityError:
                pass  # Skip if already exists
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': 'Test data created',
            'test_login': {
                'driver_id': 999,
                'pin': '99'
            }
        }), 201
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
# ===== ADMIN/MUNSHI VEHICLE ASSIGNMENT ENDPOINTS =====

@driver_bp.route('/<int:driver_id>/assign-vehicle', methods=['POST'])
def admin_assign_vehicle(driver_id):
    """
    ADMIN/MUNSHI ONLY: Assign a vehicle to a driver (fixes it, driver cannot change)
    Expected JSON: {
        "vehicle_number": "999",
        "vehicle_id": 1,
        "admin_role": "admin"  // or "munshi"
    }
    """
    try:
        data = request.get_json()
        vehicle_number = data.get('vehicle_number', '').upper().strip()
        vehicle_id = data.get('vehicle_id')
        admin_role = data.get('admin_role', 'admin')
        
        # Verify admin/munshi permission
        if admin_role not in ['admin', 'munshi']:
            return jsonify({'success': False, 'error': 'Only admin/munshi can assign vehicles'}), 403
        
        if not vehicle_number and not vehicle_id:
            return jsonify({'success': False, 'error': 'Vehicle number or ID required'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Get driver
        cursor.execute('''
            SELECT id, name, role FROM drivers WHERE id = ?
        ''', (driver_id,))
        
        driver = cursor.fetchone()
        if not driver:
            conn.close()
            return jsonify({'success': False, 'error': 'Driver not found'}), 404
        
        # Update driver with LOCKED vehicle assignment
        cursor.execute('''
            UPDATE drivers 
            SET vehicle_number = ?, 
                vehicle_id = ?,
                assigned_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (vehicle_number, vehicle_id, driver_id))
        
        conn.commit()
        
        # Fetch updated driver
        cursor.execute('''
            SELECT id, name, vehicle_number, vehicle_id, assigned_at FROM drivers WHERE id = ?
        ''', (driver_id,))
        
        updated_driver = dict(cursor.fetchone())
        conn.close()
        
        return jsonify({
            'success': True,
            'message': f'✅ Vehicle {vehicle_number} assigned to {driver["name"]} (LOCKED)',
            'driver': updated_driver
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@driver_bp.route('/<int:driver_id>/reassign-vehicle', methods=['POST'])
def admin_reassign_vehicle(driver_id):
    """
    ADMIN ONLY: Reassign vehicle to a different driver
    """
    try:
        data = request.get_json()
        new_driver_id = data.get('new_driver_id')
        vehicle_number = data.get('vehicle_number', '').upper().strip()
        vehicle_id = data.get('vehicle_id')
        admin_role = data.get('admin_role')
        
        # Only admin can reassign
        if admin_role != 'admin':
            return jsonify({'success': False, 'error': 'Only admin can reassign vehicles'}), 403
        
        if not new_driver_id:
            return jsonify({'success': False, 'error': 'New driver ID required'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Remove from old driver
        cursor.execute('''
            UPDATE drivers 
            SET vehicle_number = NULL, vehicle_id = NULL, assigned_at = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (driver_id,))
        
        # Assign to new driver
        cursor.execute('''
            UPDATE drivers 
            SET vehicle_number = ?, 
                vehicle_id = ?,
                assigned_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (vehicle_number, vehicle_id, new_driver_id))
        
        conn.commit()
        
        # Fetch both drivers
        cursor.execute('''
            SELECT id, name, vehicle_number FROM drivers WHERE id IN (?, ?)
        ''', (driver_id, new_driver_id))
        
        result_drivers = cursor.fetchall()
        conn.close()
        
        return jsonify({
            'success': True,
            'message': f'✅ Vehicle reassigned',
            'drivers': [dict(d) for d in result_drivers]
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@driver_bp.route('/client/<client_id>/drivers', methods=['GET'])
def get_client_drivers(client_id):
    """
    Get all drivers for a client
    """
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, name, role, vehicle_number, vehicle_id, status, assigned_at 
            FROM drivers 
            WHERE client_id = ? AND status = 'active'
            ORDER BY role DESC, name
        ''', (client_id,))
        
        drivers = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        return jsonify({
            'success': True,
            'client_id': client_id,
            'drivers': drivers
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500