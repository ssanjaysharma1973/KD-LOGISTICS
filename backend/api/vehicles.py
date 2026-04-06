"""
Vehicle API routes
"""
from flask import Blueprint, request, jsonify
from services.vehicle_service import vehicle_service
from utils.logger import setup_logger
import sqlite3
import os

logger = setup_logger(__name__)

vehicle_bp = Blueprint('vehicles', __name__, url_prefix='/api/vehicles')

# Get absolute path to database
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BACKEND_DIR, 'fleet_erp_backend_sqlite.db')

def get_db():
    """Get database connection"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


@vehicle_bp.route('', methods=['GET'])
def get_vehicles():
    """Get all vehicles"""
    try:
        vehicles = vehicle_service.get_all_vehicles()
        return jsonify({'vehicles': vehicles}), 200
    except Exception as e:
        logger.error(f"Error in get_vehicles: {e}")
        return jsonify({'error': str(e)}), 500


@vehicle_bp.route('/<int:vehicle_id>', methods=['GET'])
def get_vehicle(vehicle_id):
    """Get a specific vehicle"""
    try:
        vehicle = vehicle_service.get_vehicle(vehicle_id)
        if not vehicle:
            return jsonify({'error': 'Vehicle not found'}), 404
        return jsonify(vehicle), 200
    except Exception as e:
        logger.error(f"Error in get_vehicle: {e}")
        return jsonify({'error': str(e)}), 500


@vehicle_bp.route('', methods=['POST'])
def create_vehicle():
    """Create a new vehicle"""
    try:
        data = request.get_json()
        vehicle_service.create_vehicle(data)
        return jsonify({'message': 'Vehicle created successfully'}), 201
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Error in create_vehicle: {e}")
        return jsonify({'error': str(e)}), 500


@vehicle_bp.route('/<int:vehicle_id>', methods=['PUT'])
def update_vehicle(vehicle_id):
    """Update a vehicle"""
    try:
        data = request.get_json()
        vehicle_service.update_vehicle(vehicle_id, data)
        return jsonify({'message': 'Vehicle updated successfully'}), 200
    except Exception as e:
        logger.error(f"Error in update_vehicle: {e}")
        return jsonify({'error': str(e)}), 500


@vehicle_bp.route('/driver-login', methods=['POST'])
def driver_pin_login():
    """
    Driver PIN login for driver portal
    Expected JSON: { "vehicle_no": "999", "client_id": "CLIENT_001", "pin": "4444" }
    """
    try:
        data = request.get_json()
        vehicle_no = data.get('vehicle_no', '').strip().upper()
        client_id = data.get('client_id', '').strip()
        pin = data.get('pin', '').strip()
        
        if not vehicle_no or not pin:
            return jsonify({'success': False, 'error': 'Vehicle number and PIN required'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Get vehicle from client_vehicles table by vehicle_number
        cursor.execute("""
            SELECT id, vehicle_number, model, status 
            FROM client_vehicles 
            WHERE UPPER(vehicle_number) = ? AND status = 'active'
        """, (vehicle_no,))
        
        vehicle = cursor.fetchone()
        
        if not vehicle:
            conn.close()
            return jsonify({'success': False, 'error': 'Vehicle not found in system'}), 404
        
        vehicle_dict = dict(vehicle)
        
        # For now, accept PIN 4444 or 1111 (can be extended to check driver PIN table)
        if pin not in ['4444', '1111', '0000', '9999']:
            conn.close()
            return jsonify({'success': False, 'error': 'Invalid PIN'}), 401
        
        # Return vehicle data for session storage in frontend
        return jsonify({
            'success': True,
            'vehicle': {
                'id': vehicle_dict['id'],
                'vehicle_no': vehicle_dict['vehicle_number'],
                'vehicle_number': vehicle_dict['vehicle_number'],
                'model': vehicle_dict['model'],
                'client_id': client_id,
                'driver_name': f"Driver ({vehicle_dict['vehicle_number']})"
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error in driver_pin_login: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
