"""
Clients API routes for PIN-based authentication
"""
from flask import Blueprint, request, jsonify
from datetime import datetime
import sqlite3
import os

clients_bp = Blueprint('clients', __name__, url_prefix='/api/clients')

# Get absolute path to database
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BACKEND_DIR, 'fleet_erp_backend_sqlite.db')

def get_db():
    """Get database connection"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def ensure_clients_table():
    """Create clients table if it doesn't exist"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Create clients table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS clients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_code TEXT UNIQUE NOT NULL,
            pin TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            status TEXT DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Create client_vehicles mapping table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS client_vehicles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL,
            vehicle_number TEXT NOT NULL,
            model TEXT,
            status TEXT DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(client_id) REFERENCES clients(id)
        )
    ''')
    
    # Seed CLIENT_000
    cursor.execute("SELECT id FROM clients WHERE client_code = 'CLIENT_000'")
    if not cursor.fetchone():
        cursor.execute('''
            INSERT INTO clients (client_code, pin, name, status)
            VALUES (?, ?, ?, ?)
        ''', ('CLIENT_000', '000000', 'DevAdmin', 'active'))
        print("[INFO] CLIENT_000 (DevAdmin) created")
    
    # Seed CLIENT_001
    cursor.execute("SELECT id FROM clients WHERE client_code = 'CLIENT_001'")
    if not cursor.fetchone():
        cursor.execute('''
            INSERT INTO clients (client_code, pin, name, status)
            VALUES (?, ?, ?, ?)
        ''', ('CLIENT_001', '001999', 'Atul Logistics', 'active'))
        client_id = cursor.lastrowid
        vehicles = [
            ('999', 'Test Vehicle 999'),
            ('MH01AB1234', 'Tata 1109'),
            ('MH02XY5678', 'Ashok Leyland'),
            ('MH03CD9999', 'Mahindra Truck'),
        ]
        for vehicle_no, model in vehicles:
            cursor.execute('''
                INSERT INTO client_vehicles (client_id, vehicle_number, model, status)
                VALUES (?, ?, ?, ?)
            ''', (client_id, vehicle_no, model, 'active'))
        print("[INFO] CLIENT_001 (Atul Logistics) created with vehicles")
    
    conn.commit()
    conn.close()

@clients_bp.route('/get-by-pin', methods=['POST'])
def get_by_pin():
    """Get client and vehicles by PIN"""
    try:
        data = request.get_json()
        pin = data.get('pin', '').strip()
        
        if not pin:
            return jsonify({'error': 'PIN required'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Find client by PIN
        cursor.execute('''
            SELECT id, client_code, name FROM clients 
            WHERE pin = ? AND status = 'active'
        ''', (pin,))
        
        client = cursor.fetchone()
        
        if not client:
            conn.close()
            return jsonify({'error': 'Invalid PIN'}), 401
        
        client_dict = dict(client)
        
        # Get vehicles for this client
        cursor.execute('''
            SELECT id, vehicle_number, model, status FROM client_vehicles 
            WHERE client_id = ? AND status = 'active'
            ORDER BY vehicle_number
        ''', (client_dict['id'],))
        
        vehicles = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        return jsonify({
            'success': True,
            'client_id': client_dict['client_code'],
            'client_name': client_dict['name'],
            'vehicles': vehicles
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@clients_bp.route('/login', methods=['POST'])
def login():
    """Client login with client_code and PIN"""
    try:
        data = request.get_json()
        client_code = data.get('client_code', '').strip().upper()
        pin = data.get('pin', '').strip()
        
        if not client_code:
            return jsonify({'error': 'Client code required'}), 400
        if not pin:
            return jsonify({'error': 'PIN required'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Find client by code and PIN
        cursor.execute('''
            SELECT id, client_code, name, status FROM clients 
            WHERE client_code = ? AND pin = ?
        ''', (client_code, pin))
        
        client = cursor.fetchone()
        
        if not client:
            conn.close()
            return jsonify({'success': False, 'error': 'Invalid client code or PIN'}), 401
        
        if client['status'] != 'active':
            conn.close()
            return jsonify({'success': False, 'error': 'Client account is inactive'}), 403
        
        client_dict = dict(client)
        
        # Return client info for session
        conn.close()
        return jsonify({
            'success': True,
            'client': {
                'client_id': client_dict['client_code'],
                'client_code': client_dict['client_code'],
                'client_name': client_dict['name'],
                'name': client_dict['name'],
                'id': client_dict['id']
            }
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@clients_bp.route('', methods=['GET'])
def get_all_clients():
    """Get all clients for DevAdmin dashboard"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Get all clients
        cursor.execute('''
            SELECT id, client_code, pin, name, status FROM clients 
            ORDER BY id
        ''')
        
        clients = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        return jsonify({
            'success': True,
            'clients': clients
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@clients_bp.route('/<int:client_id>', methods=['PUT'])
def update_client(client_id):
    """Update a client's status or name"""
    try:
        data = request.get_json()
        conn = get_db()
        cursor = conn.cursor()
        
        # Get current client
        cursor.execute('SELECT * FROM clients WHERE id = ?', (client_id,))
        client = cursor.fetchone()
        
        if not client:
            conn.close()
            return jsonify({'success': False, 'error': 'Client not found'}), 404
        
        # Update only allowed fields
        updates = {}
        if 'status' in data:
            updates['status'] = data['status']
        if 'name' in data:
            updates['name'] = data['name']
        if 'pin' in data:
            updates['pin'] = data['pin']
        
        if updates:
            set_clause = ', '.join([f'{k} = ?' for k in updates.keys()])
            values = list(updates.values()) + [client_id]
            cursor.execute(f'UPDATE clients SET {set_clause} WHERE id = ?', values)
            conn.commit()
        
        conn.close()
        return jsonify({'success': True, 'message': 'Client updated'}), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# Initialize tables on import
ensure_clients_table()
