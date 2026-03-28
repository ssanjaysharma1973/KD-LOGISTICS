"""
Vehicle API routes
"""
from flask import Blueprint, request, jsonify
from services.vehicle_service import vehicle_service
from utils.logger import setup_logger

logger = setup_logger(__name__)

vehicle_bp = Blueprint('vehicles', __name__, url_prefix='/api/vehicles')


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
