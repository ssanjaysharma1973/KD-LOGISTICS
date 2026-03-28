"""
POI service - handles Point of Interest business logic
"""
from db.connection import db
from utils.logger import setup_logger
from utils.validators import validate_poi_data

logger = setup_logger(__name__)


class POIService:
    """Service for POI operations"""
    
    POIS_TABLE = 'pois'
    
    @staticmethod
    def get_all_pois():
        """Fetch all POIs"""
        try:
            query = f"SELECT * FROM {POIService.POIS_TABLE}"
            results = db.execute_query(query)
            return [dict(row) for row in results]
        except Exception as e:
            logger.error(f"Error fetching POIs: {e}")
            return []
    
    @staticmethod
    def get_poi(poi_id):
        """Fetch a single POI by ID"""
        try:
            query = f"SELECT * FROM {POIService.POIS_TABLE} WHERE id = ?"
            results = db.execute_query(query, (poi_id,))
            return dict(results[0]) if results else None
        except Exception as e:
            logger.error(f"Error fetching POI {poi_id}: {e}")
            return None
    
    @staticmethod
    def create_poi(poi_data):
        """Create a new POI"""
        is_valid, errors = validate_poi_data(poi_data)
        if not is_valid:
            raise ValueError(f"Invalid POI data: {', '.join(errors)}")
        
        try:
            query = f"""
                INSERT INTO {POIService.POIS_TABLE} 
                (poi_name, latitude, longitude, radius)
                VALUES (?, ?, ?, ?)
            """
            db.execute_update(query, (
                poi_data.get('poi_name'),
                poi_data.get('latitude'),
                poi_data.get('longitude'),
                poi_data.get('radius', 1500),
            ))
            logger.info(f"POI created: {poi_data.get('poi_name')}")
        except Exception as e:
            logger.error(f"Error creating POI: {e}")
            raise
    
    @staticmethod
    def update_poi(poi_id, poi_data):
        """Update an existing POI"""
        try:
            query = f"""
                UPDATE {POIService.POIS_TABLE} 
                SET poi_name=?, latitude=?, longitude=?, radius=?
                WHERE id = ?
            """
            db.execute_update(query, (
                poi_data.get('poi_name'),
                poi_data.get('latitude'),
                poi_data.get('longitude'),
                poi_data.get('radius'),
                poi_id,
            ))
            logger.info(f"POI updated: {poi_id}")
        except Exception as e:
            logger.error(f"Error updating POI {poi_id}: {e}")
            raise


poi_service = POIService()
