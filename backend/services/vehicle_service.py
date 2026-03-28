"""
Vehicle service - handles vehicle business logic
"""
from db.connection import db
from utils.logger import setup_logger
from utils.validators import validate_vehicle_data

logger = setup_logger(__name__)


class VehicleService:
    """Service for vehicle operations"""
    
    VEHICLES_TABLE = 'vehicles'
    
    @staticmethod
    def get_all_vehicles():
        """Fetch all vehicles"""
        try:
            query = f"SELECT * FROM {VehicleService.VEHICLES_TABLE}"
            results = db.execute_query(query)
            return [dict(row) for row in results]
        except Exception as e:
            logger.error(f"Error fetching vehicles: {e}")
            return []
    
    @staticmethod
    def get_vehicle(vehicle_id):
        """Fetch a single vehicle by ID"""
        try:
            query = f"SELECT * FROM {VehicleService.VEHICLES_TABLE} WHERE id = ?"
            results = db.execute_query(query, (vehicle_id,))
            return dict(results[0]) if results else None
        except Exception as e:
            logger.error(f"Error fetching vehicle {vehicle_id}: {e}")
            return None
    
    @staticmethod
    def create_vehicle(vehicle_data):
        """Create a new vehicle"""
        is_valid, errors = validate_vehicle_data(vehicle_data)
        if not is_valid:
            raise ValueError(f"Invalid vehicle data: {', '.join(errors)}")
        
        try:
            query = f"""
                INSERT INTO {VehicleService.VEHICLES_TABLE} 
                (vehicle_number, driver, status, latitude, longitude, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """
            db.execute_update(query, (
                vehicle_data.get('vehicle_number'),
                vehicle_data.get('driver'),
                vehicle_data.get('status', 'available'),
                vehicle_data.get('latitude'),
                vehicle_data.get('longitude'),
                vehicle_data.get('updated_at'),
            ))
            logger.info(f"Vehicle created: {vehicle_data.get('vehicle_number')}")
        except Exception as e:
            logger.error(f"Error creating vehicle: {e}")
            raise
    
    @staticmethod
    def update_vehicle(vehicle_id, vehicle_data):
        """Update an existing vehicle"""
        try:
            query = f"""
                UPDATE {VehicleService.VEHICLES_TABLE} 
                SET vehicle_number=?, driver=?, status=?, latitude=?, longitude=?, updated_at=?
                WHERE id = ?
            """
            db.execute_update(query, (
                vehicle_data.get('vehicle_number'),
                vehicle_data.get('driver'),
                vehicle_data.get('status'),
                vehicle_data.get('latitude'),
                vehicle_data.get('longitude'),
                vehicle_data.get('updated_at'),
                vehicle_id,
            ))
            logger.info(f"Vehicle updated: {vehicle_id}")
        except Exception as e:
            logger.error(f"Error updating vehicle {vehicle_id}: {e}")
            raise


vehicle_service = VehicleService()
