"""
Admin PIN-based authentication for devadmin users
"""
from flask import Blueprint, request, jsonify
import sqlite3
import os
from datetime import datetime

admin_pin_bp = Blueprint('admin_pin', __name__, url_prefix='/api/admin-pin')

# Get absolute path to database
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BACKEND_DIR, 'fleet_erp_backend_sqlite.db')

# Initialize the PIN column when module loads
try:
    def ensure_admin_pin_table():
        """Ensure admin_pins table exists with PIN authentication"""
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Check if PIN column exists in admins table
        cursor.execute("PRAGMA table_info(admins)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'pin' not in columns:
            try:
                cursor.execute('ALTER TABLE admins ADD COLUMN pin TEXT')
                print("[INFO] Added PIN column to admins table")
            except Exception as e:
                print(f"[INFO] PIN column check: {e}")
        
        conn.commit()
        conn.close()
    
    ensure_admin_pin_table()
except Exception as e:
    print(f"[WARNING] Could not initialize admin PIN table: {e}")

@admin_pin_bp.route('/login', methods=['POST'])
def admin_pin_login():
    """
    Admin login with PIN (for devadmin users)
    Request: { "username": "devadmin", "pin": "001999" }
    """
    try:
        data = request.get_json()
        username = data.get('username', '').strip()
        pin = data.get('pin', '').strip()
        
        print(f"[DEBUG] Login attempt: username='{username}', pin='{pin}'")
        
        if not username or not pin:
            return jsonify({'error': 'Username and PIN required'}), 400
        
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Lookup admin by username and PIN
        cursor.execute('''
            SELECT id, username, name, admin_type, status, client_id
            FROM admins
            WHERE username = ? AND pin = ? AND status = 'active'
        ''', (username, pin))
        
        admin = cursor.fetchone()
        conn.close()
        
        print(f"[DEBUG] Query result: {admin}")
        
        if not admin:
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Return admin details with role
        return jsonify({
            'success': True,
            'admin_id': admin['id'],
            'username': admin['username'],
            'name': admin['name'],
            'role': admin['admin_type'],
            'client_id': admin['client_id'],
            'portal': 'admin_pin'
        }), 200
    
    except Exception as e:
        print(f"[ERROR] Login error: {e}")
        return jsonify({'error': str(e)}), 500

@admin_pin_bp.route('/create-pin-admin', methods=['POST'])
def create_pin_admin():
    """
    Create a new admin with PIN authentication
    Request: { "username": "devadmin", "pin": "001999", "name": "Dev Admin", "admin_type": "system_admin" }
    """
    data = request.get_json()
    username = data.get('username', '').strip()
    pin = data.get('pin', '').strip()
    name = data.get('name', '').strip()
    admin_type = data.get('admin_type', 'system_admin')  # system_admin or client_admin
    
    if not username or not pin or not name:
        return jsonify({'error': 'Username, PIN, and name required'}), 400
    
    if len(pin) < 3:
        return jsonify({'error': 'PIN must be at least 3 digits'}), 400
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Check if username already exists
        cursor.execute("SELECT id FROM admins WHERE username = ?", (username,))
        if cursor.fetchone():
            return jsonify({'error': 'Username already exists'}), 409
        
        # Insert new PIN-based admin
        cursor.execute('''
            INSERT INTO admins (client_id, username, password, pin, name, admin_type, status)
            VALUES (?, ?, ?, ?, ?, ?, 'active')
        ''', (None, username, 'pin-based', pin, name, admin_type))
        
        conn.commit()
        admin_id = cursor.lastrowid
        conn.close()
        
        return jsonify({
            'success': True,
            'message': f'Admin {username} created with PIN {pin}',
            'admin_id': admin_id,
            'username': username,
            'pin': pin
        }), 201
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_pin_bp.route('/list-pin-admins', methods=['GET'])
def list_pin_admins():
    """Get all PIN-based admin users"""
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, username, name, admin_type, status, pin
            FROM admins
            WHERE pin IS NOT NULL
            ORDER BY created_at DESC
        ''')
        
        admins = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        return jsonify({'admins': admins}), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500
