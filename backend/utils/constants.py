"""
Backend constants and configuration
"""

# Database table names
VEHICLES_TABLE = 'vehicles'
POIS_TABLE = 'pois'
GPS_TRACKS_TABLE = 'gps_tracks'
SYNC_LOG_TABLE = 'sync_log'

# API endpoints
VEHICLES_ENDPOINT = '/api/vehicles'
POIS_ENDPOINT = '/api/pois'
ROUTES_ENDPOINT = '/api/routes'
SYNC_ENDPOINT = '/api/sync'

# POI configuration
POI_RADIUS_METERS = 1500
POI_CHECK_INTERVAL_MINUTES = 5

# GPS thresholds
GPS_STALE_HOURS = 24
GPS_CRITICAL_HOURS = 48
