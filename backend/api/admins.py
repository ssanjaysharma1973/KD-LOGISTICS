"""
Admin Authentication - For Client Admin and System Admin
"""
from flask import Blueprint, request, jsonify
from datetime import datetime
import sqlite3
import os

admin_bp = Blueprint('admins', __name__, url_prefix='/api/admins')

# Get absolute path to database
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BACKEND_DIR, 'fleet_erp_backend_sqlite.db')

def get_db():
    """Get database connection"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def ensure_admins_table():
    """Create admins table if not exists"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id TEXT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT NOT NULL,
            email TEXT,
            role TEXT,
            admin_type TEXT DEFAULT 'client_admin',
            status TEXT DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_admins_username ON admins(username)
    ''')
    
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_admins_client ON admins(client_id)
    ''')
    
    conn.commit()
    conn.close()

@admin_bp.route('/login', methods=['POST'])
def admin_login():
    """
    Admin/Developer login
    Expected JSON: { "username": "admin", "password": "admin123" }
    """
    try:
        data = request.get_json()
        username = data.get('username', '').strip()
        password = data.get('password', '').strip()
        
        if not username or not password:
            return jsonify({'success': False, 'error': 'Username and password required'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Find admin by username
        cursor.execute('''
            SELECT id, client_id, name, email, role, admin_type, status
            FROM admins
            WHERE username = ? AND password = ? AND status = 'active'
            LIMIT 1
        ''', (username, password))  # Note: In production, use proper password hashing
        
        admin = cursor.fetchone()
        conn.close()
        
        if not admin:
            return jsonify({'success': False, 'error': 'Invalid credentials'}), 401
        
        admin_dict = dict(admin)
        
        if admin_dict['admin_type'] == 'system_admin':
            permissions = [
                'create_client', 'edit_client', 'delete_client',
                'create_admin', 'create_munshi', 'create_driver',
                'assign_vehicle', 'reassign_vehicle',
                'approve_fuel', 'reject_fuel',
                'view_all_clients', 'view_reports'
            ]
        else:  # client_admin
            permissions = [
                'create_munshi', 'create_driver', 'edit_driver',
                'assign_vehicle', 'reassign_vehicle',
                'approve_fuel', 'reject_fuel',
                'view_drivers', 'view_fuel_data', 'view_reports'
            ]
        
        return jsonify({
            'success': True,
            'admin': admin_dict,
            'permissions': permissions
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@admin_bp.route('/<client_id>/create-driver', methods=['POST'])
def admin_create_driver(client_id):
    """
    ADMIN: Create a new driver
    Expected JSON: { "name": "John", "phone": "9999999999", "license_number": "DL123" }
    """
    try:
        data = request.get_json()
        name = data.get('name', '').strip()
        phone = data.get('phone', '').strip()
        license_number = data.get('license_number', '').strip()
        
        if not name:
            return jsonify({'success': False, 'error': 'Driver name required'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Insert driver
        cursor.execute('''
            INSERT INTO drivers (client_id, name, phone, license_number, role, status)
            VALUES (?, ?, ?, ?, 'driver', 'active')
        ''', (client_id, name, phone, license_number if license_number else None))
        
        conn.commit()
        driver_id = cursor.lastrowid
        
        # Get created driver
        cursor.execute('''
            SELECT id, name, phone, license_number FROM drivers WHERE id = ?
        ''', (driver_id,))
        
        driver = dict(cursor.fetchone())
        conn.close()
        
        return jsonify({
            'success': True,
            'message': f'✅ Driver {name} created',
            'driver': driver
        }), 201
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@admin_bp.route('/<client_id>/create-munshi', methods=['POST'])
def admin_create_munshi(client_id):
    """
    ADMIN: Create a new munshi
    Expected JSON: { "name": "Atul", "email": "atul@example.com", "phone": "9999999999", "pin": "999" }
    """
    try:
        data = request.get_json()
        name = data.get('name', '').strip()
        email = data.get('email', '').strip()
        phone = data.get('phone', '').strip()
        pin = data.get('pin', '999').strip()
        
        if not name:
            return jsonify({'success': False, 'error': 'Munshi name required'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                INSERT INTO munshis (client_id, name, email, phone, pin, role, status)
                VALUES (?, ?, ?, ?, ?, 'munshi', 'active')
            ''', (client_id, name, email if email else None, phone if phone else None, pin))
            
            conn.commit()
            munshi_id = cursor.lastrowid
            
            # Get created munshi
            cursor.execute('''
                SELECT id, name, email, phone FROM munshis WHERE id = ?
            ''', (munshi_id,))
            
            munshi = dict(cursor.fetchone())
            conn.close()
            
            return jsonify({
                'success': True,
                'message': f'✅ Munshi {name} created with PIN {pin}',
                'munshi': munshi
            }), 201
            
        except sqlite3.IntegrityError:
            conn.close()
            return jsonify({'success': False, 'error': 'Email already exists'}), 409
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@admin_bp.route('/<client_id>/drivers', methods=['GET'])
def admin_get_drivers(client_id):
    """
    ADMIN: Get all drivers for management
    """
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, name, phone, license_number, vehicle_number, vehicle_id, 
                   status, assigned_at
            FROM drivers
            WHERE client_id = ? AND role = 'driver'
            ORDER BY status DESC, name
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

@admin_bp.route('/<client_id>/munshis', methods=['GET'])
def admin_get_munshis(client_id):
    """
    ADMIN: Get all munshis for management
    """
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, name, email, phone, status, created_at
            FROM munshis
            WHERE client_id = ?
            ORDER BY created_at DESC
        ''', (client_id,))
        
        munshis = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        return jsonify({
            'success': True,
            'client_id': client_id,
            'munshi_count': len(munshis),
            'munshis': munshis
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# Initialize tables on import
ensure_admins_table()
