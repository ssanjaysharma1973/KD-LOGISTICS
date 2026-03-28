"""
Utility functions for math operations (Haversine, distance calculations)
"""
import math


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate distance between two points on Earth in meters
    
    Args:
        lat1, lon1: First point coordinates
        lat2, lon2: Second point coordinates
    
    Returns:
        Distance in meters
    """
    def to_rad(x):
        return x * math.pi / 180
    
    R = 6371000  # Earth radius in meters
    d_lat = to_rad(lat2 - lat1)
    d_lon = to_rad(lon2 - lon1)
    
    a = (math.sin(d_lat / 2) ** 2 +
         math.cos(to_rad(lat1)) * math.cos(to_rad(lat2)) *
         math.sin(d_lon / 2) ** 2)
    
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in kilometers"""
    return haversine(lat1, lon1, lat2, lon2) / 1000


def is_within_radius(
    lat1: float, lon1: float, lat2: float, lon2: float, radius_meters: float
) -> bool:
    """Check if point 2 is within radius of point 1"""
    return haversine(lat1, lon1, lat2, lon2) <= radius_meters
