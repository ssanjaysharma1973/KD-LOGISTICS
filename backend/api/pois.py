"""
POI API routes
"""
from flask import Blueprint, request, jsonify
from services.poi_service import poi_service
from utils.logger import setup_logger

logger = setup_logger(__name__)

poi_bp = Blueprint('pois', __name__, url_prefix='/api/pois')


@poi_bp.route('', methods=['GET'])
def get_pois():
    """Get all POIs"""
    try:
        pois = poi_service.get_all_pois()
        return jsonify(pois), 200
    except Exception as e:
        logger.error(f"Error in get_pois: {e}")
        return jsonify({'error': str(e)}), 500


@poi_bp.route('/<int:poi_id>', methods=['GET'])
def get_poi(poi_id):
    """Get a specific POI"""
    try:
        poi = poi_service.get_poi(poi_id)
        if not poi:
            return jsonify({'error': 'POI not found'}), 404
        return jsonify(poi), 200
    except Exception as e:
        logger.error(f"Error in get_poi: {e}")
        return jsonify({'error': str(e)}), 500


@poi_bp.route('', methods=['POST'])
def create_poi():
    """Create a new POI"""
    try:
        data = request.get_json()
        poi_service.create_poi(data)
        return jsonify({'message': 'POI created successfully'}), 201
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Error in create_poi: {e}")
        return jsonify({'error': str(e)}), 500


@poi_bp.route('/<int:poi_id>', methods=['PUT'])
def update_poi(poi_id):
    """Update a POI"""
    try:
        data = request.get_json()
        poi_service.update_poi(poi_id, data)
        return jsonify({'message': 'POI updated successfully'}), 200
    except Exception as e:
        logger.error(f"Error in update_poi: {e}")
        return jsonify({'error': str(e)}), 500
