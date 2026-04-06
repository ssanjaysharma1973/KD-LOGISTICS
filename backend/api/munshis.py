"""
Munshi API - For approving fuel requests and assigning vehicles
"""
from flask import Blueprint, request, jsonify
from datetime import datetime
import sqlite3
import os

munshi_bp = Blueprint('munshis', __name__, url_prefix='/api/munshis')

# Get absolute path to database
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BACKEND_DIR, 'fleet_erp_backend_sqlite.db')

def get_db():
    """Get database connection"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def ensure_munshis_table():
    """Create munshis table if not exists"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS munshis (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id TEXT NOT NULL,
            name TEXT NOT NULL,
            email TEXT UNIQUE,
            phone TEXT,
            pin TEXT NOT NULL,
            role TEXT DEFAULT 'munshi',
            status TEXT DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_munshis_client ON munshis(client_id)
    ''')
    
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_munshis_email ON munshis(email)
    ''')
    
    conn.commit()
    conn.close()

@munshi_bp.route('/login', methods=['POST'])
def munshi_login():
    """
    Munshi login with email/phone + PIN
    Expected JSON: { "identifier": "atul@example.com", "pin": "999" }
    """
    try:
        data = request.get_json()
        identifier = data.get('identifier', '').strip()
        pin = data.get('pin', '').strip()
        
        if not identifier or not pin:
            return jsonify({'success': False, 'error': 'Email/Phone and PIN required'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Find munshi by email or phone
        cursor.execute('''
            SELECT id, client_id, name, email, phone, role, status
            FROM munshis
            WHERE (email = ? OR phone = ?) AND pin = ? AND status = 'active'
            LIMIT 1
        ''', (identifier, identifier, pin))
        
        munshi = cursor.fetchone()
        conn.close()
        
        if not munshi:
            return jsonify({'success': False, 'error': 'Invalid credentials'}), 401
        
        munshi_dict = dict(munshi)
        return jsonify({
            'success': True,
            'munshi': munshi_dict,
            'permissions': ['approve_fuel', 'assign_vehicle', 'view_drivers', 'view_fuel_data']
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@munshi_bp.route('/<client_id>/pending-requests', methods=['GET'])
def get_pending_fuel_requests(client_id):
    """
    Get all pending fuel requests for a client (awaiting munshi approval)
    """
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, driver_id, trip_id, requested_amount, request_date, status
            FROM fuel_transactions
            WHERE client_id = ? AND status = 'pending_approval'
            ORDER BY request_date DESC
        ''', (client_id,))
        
        requests = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        return jsonify({
            'success': True,
            'pending_count': len(requests),
            'requests': requests
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@munshi_bp.route('/<client_id>/approve-fuel', methods=['POST'])
def approve_fuel_request(client_id):
    """
    MUNSHI: Approve a fuel advance request
    Expected JSON: { "request_id": 1, "munshi_id": 1, "remarks": "Approved" }
    """
    try:
        data = request.get_json()
        request_id = data.get('request_id')
        munshi_id = data.get('munshi_id')
        remarks = data.get('remarks', '')
        
        if not request_id or not munshi_id:
            return jsonify({'success': False, 'error': 'Request ID and Munshi ID required'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Update fuel transaction status
        cursor.execute('''
            UPDATE fuel_transactions
            SET status = 'approved_by_munshi',
                approved_by_munshi_id = ?,
                approved_date = ?,
                remarks = ?,
                updated_at = ?
            WHERE id = ? AND client_id = ?
        ''', (munshi_id, datetime.now(), remarks, datetime.now(), request_id, client_id))
        
        conn.commit()
        
        if cursor.rowcount == 0:
            conn.close()
            return jsonify({'success': False, 'error': 'Request not found'}), 404
        
        # Get updated request
        cursor.execute('''
            SELECT id, driver_id, requested_amount, status FROM fuel_transactions
            WHERE id = ?
        ''', (request_id,))
        
        updated = dict(cursor.fetchone())
        conn.close()
        
        return jsonify({
            'success': True,
            'message': '✅ Fuel request approved',
            'request': updated
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@munshi_bp.route('/<client_id>/assign-vehicle', methods=['POST'])
def munshi_assign_vehicle(client_id):
    """
    MUNSHI: Assign a vehicle to a driver
    Expected JSON: { "driver_id": 1, "vehicle_id": 1, "munshi_id": 1 }
    """
    try:
        data = request.get_json()
        driver_id = data.get('driver_id')
        vehicle_id = data.get('vehicle_id')
        munshi_id = data.get('munshi_id')
        
        if not driver_id or not vehicle_id:
            return jsonify({'success': False, 'error': 'Driver ID and Vehicle ID required'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Get vehicle number
        cursor.execute('''
            SELECT vehicle_number FROM client_vehicles
            WHERE id = ? AND client_id = ?
        ''', (vehicle_id, client_id))
        
        vehicle = cursor.fetchone()
        if not vehicle:
            conn.close()
            return jsonify({'success': False, 'error': 'Vehicle not found'}), 404
        
        vehicle_number = vehicle[0]
        
        # Update driver
        cursor.execute('''
            UPDATE drivers
            SET vehicle_id = ?,
                vehicle_number = ?,
                assigned_at = ?,
                updated_at = ?
            WHERE id = ? AND client_id = ?
        ''', (vehicle_id, vehicle_number, datetime.now(), datetime.now(), driver_id, client_id))
        
        conn.commit()
        
        if cursor.rowcount == 0:
            conn.close()
            return jsonify({'success': False, 'error': 'Driver not found'}), 404
        
        conn.close()
        
        return jsonify({
            'success': True,
            'message': f'✅ Vehicle {vehicle_number} assigned to driver {driver_id}'
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@munshi_bp.route('/<client_id>/drivers', methods=['GET'])
def get_client_drivers_for_munshi(client_id):
    """
    MUNSHI: Get all drivers in their client
    """
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, name, phone, license_number, vehicle_number, vehicle_id, 
                   role, status, assigned_at
            FROM drivers
            WHERE client_id = ? AND status = 'active' AND role = 'driver'
            ORDER BY name
        ''', (client_id,))
        
        drivers = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        return jsonify({
            'success': True,
            'client_id': client_id,
            'driver_count': len(drivers),
            'drivers': drivers
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# Initialize tables on import
ensure_munshis_table()
