"""
Compatibility endpoint for vehicles-master (old frontend format)
Maps to client_vehicles table in the database
"""
from flask import Blueprint, request, jsonify
import sqlite3
import os

vehicles_master_bp = Blueprint('vehicles_master', __name__, url_prefix='/api')

# Get absolute path to database
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BACKEND_DIR, 'fleet_erp_backend_sqlite.db')

def get_db():
    """Get database connection"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

@vehicles_master_bp.route('/vehicles-master', methods=['GET'])
def list_vehicles_master():
    """
    GET /api/vehicles-master?clientId=CLIENT_001
    Returns list of vehicles for a client
    """
    try:
        client_id = request.args.get('clientId', 'CLIENT_001')
        
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT 
                id, vehicle_number, vehicle_no, model, capacity, 
                status, registration_number, munshi_id, fuel_rate,
                created_at, updated_at
            FROM client_vehicles 
            WHERE client_id = ?
            ORDER BY vehicle_number ASC
        ''', (client_id,))
        
        rows = cursor.fetchall()
        vehicles = [dict(row) for row in rows]
        conn.close()
        
        return jsonify(vehicles)
    
    except Exception as e:
        print(f"Error fetching vehicles-master: {e}")
        return jsonify({'error': str(e)}), 500


@vehicles_master_bp.route('/vehicles-master/<int:vehicle_id>', methods=['GET'])
def get_vehicle_master(vehicle_id):
    """
    GET /api/vehicles-master/{id}
    Returns details for a specific vehicle
    """
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT 
                id, vehicle_number, vehicle_no, model, capacity, 
                status, registration_number, munshi_id, fuel_rate,
                created_at, updated_at
            FROM client_vehicles 
            WHERE id = ?
        ''', (vehicle_id,))
        
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            return jsonify({'error': 'Vehicle not found'}), 404
        
        return jsonify(dict(row))
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@vehicles_master_bp.route('/vehicles-master/<int:vehicle_id>', methods=['PUT'])
def update_vehicle_master(vehicle_id):
    """
    PUT /api/vehicles-master/{id}
    Update vehicle details
    """
    try:
        data = request.get_json()
        conn = get_db()
        cursor = conn.cursor()
        
        # Build update query
        updates = []
        values = []
        
        allowed_fields = ['vehicle_number', 'vehicle_no', 'model', 'capacity', 
                         'status', 'registration_number', 'fuel_rate']
        
        for field in allowed_fields:
            if field in data:
                updates.append(f'{field} = ?')
                values.append(data[field])
        
        if not updates:
            conn.close()
            return jsonify({'error': 'No fields to update'}), 400
        
        values.append(vehicle_id)
        query = f"UPDATE client_vehicles SET {', '.join(updates)} WHERE id = ?"
        cursor.execute(query, values)
        conn.commit()
        
        cursor.execute('''
            SELECT id, vehicle_number, vehicle_no, model, capacity, 
                   status, registration_number, munshi_id, fuel_rate
            FROM client_vehicles WHERE id = ?
        ''', (vehicle_id,))
        
        vehicle = dict(cursor.fetchone())
        conn.close()
        
        return jsonify({'success': True, 'vehicle': vehicle})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@vehicles_master_bp.route('/vehicles-master/<int:vehicle_id>', methods=['DELETE'])
def delete_vehicle_master(vehicle_id):
    """
    DELETE /api/vehicles-master/{id}
    Delete a vehicle
    """
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('DELETE FROM client_vehicles WHERE id = ?', (vehicle_id,))
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': 'Vehicle deleted'})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@vehicles_master_bp.route('/vehicles-master/<int:vehicle_id>/munshi', methods=['GET'])
def get_vehicle_munshi(vehicle_id):
    """
    GET /api/vehicles-master/{id}/munshi
    Get munshi assigned to vehicle
    """
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT munshi_id FROM client_vehicles WHERE id = ?
        ''', (vehicle_id,))
        
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            return jsonify({'error': 'Vehicle not found'}), 404
        
        return jsonify({'munshi_id': row['munshi_id']})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@vehicles_master_bp.route('/vehicles-master/<int:vehicle_id>/munshi', methods=['PUT'])
def set_vehicle_munshi(vehicle_id):
    """
    PUT /api/vehicles-master/{id}/munshi
    Assign munshi to vehicle
    """
    try:
        data = request.get_json()
        munshi_id = data.get('munshi_id')
        
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE client_vehicles SET munshi_id = ? WHERE id = ?
        ''', (munshi_id, vehicle_id))
        
        conn.commit()
        
        cursor.execute('''
            SELECT id, vehicle_number, munshi_id FROM client_vehicles WHERE id = ?
        ''', (vehicle_id,))
        
        vehicle = dict(cursor.fetchone())
        conn.close()
        
        return jsonify({'success': True, 'vehicle': vehicle})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@vehicles_master_bp.route('/vehicles-master/<int:vehicle_id>/fuel-rate', methods=['PUT'])
def set_vehicle_fuel_rate(vehicle_id):
    """
    PUT /api/vehicles-master/{id}/fuel-rate
    Set fuel rate for vehicle
    """
    try:
        data = request.get_json()
        fuel_rate = data.get('fuel_rate', 0)
        
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE client_vehicles SET fuel_rate = ? WHERE id = ?
        ''', (fuel_rate, vehicle_id))
        
        conn.commit()
        
        cursor.execute('''
            SELECT id, vehicle_number, fuel_rate FROM client_vehicles WHERE id = ?
        ''', (vehicle_id,))
        
        vehicle = dict(cursor.fetchone())
        conn.close()
        
        return jsonify({'success': True, 'vehicle': vehicle})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500
