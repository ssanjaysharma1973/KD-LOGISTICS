"""
Validators for input data
"""
from typing import Dict, Any, List


def validate_vehicle_data(data: Dict[str, Any]) -> tuple[bool, List[str]]:
    """
    Validate vehicle data
    
    Returns:
        Tuple of (is_valid, error_messages)
    """
    errors = []
    
    if not data.get('vehicle_number'):
        errors.append('vehicle_number is required')
    
    if 'latitude' in data and data['latitude'] is not None:
        try:
            lat = float(data['latitude'])
            if not -90 <= lat <= 90:
                errors.append('latitude must be between -90 and 90')
        except (ValueError, TypeError):
            errors.append('latitude must be a valid number')
    
    if 'longitude' in data and data['longitude'] is not None:
        try:
            lon = float(data['longitude'])
            if not -180 <= lon <= 180:
                errors.append('longitude must be between -180 and 180')
        except (ValueError, TypeError):
            errors.append('longitude must be a valid number')
    
    return len(errors) == 0, errors


def validate_poi_data(data: Dict[str, Any]) -> tuple[bool, List[str]]:
    """Validate POI data"""
    errors = []
    
    if not data.get('poi_name'):
        errors.append('poi_name is required')
    
    if 'latitude' not in data or data['latitude'] is None:
        errors.append('latitude is required')
    elif not isinstance(data['latitude'], (int, float)):
        errors.append('latitude must be a number')
    
    if 'longitude' not in data or data['longitude'] is None:
        errors.append('longitude is required')
    elif not isinstance(data['longitude'], (int, float)):
        errors.append('longitude must be a number')
    
    return len(errors) == 0, errors
