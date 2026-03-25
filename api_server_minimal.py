#!/usr/bin/env python
"""
Minimal Flask API for Atul Logistics - for testing Railway connectivity
"""
import os
import sys
import sqlite3
import logging
from datetime import datetime
from flask import Flask, jsonify, request
try:
    # Import using importlib to avoid static analyzers complaining about missing packages.
    import importlib
    _dotenv = importlib.import_module('dotenv')
    load_dotenv = getattr(_dotenv, 'load_dotenv')
except Exception:
    # If python-dotenv is not installed, provide a no-op fallback so linting and runtime work without the package.
    def load_dotenv(*args, **kwargs):
        return False

try:
    from werkzeug.middleware.proxy_fix import ProxyFix  # type: ignore
except Exception:
    # Fallback no-op ProxyFix when werkzeug.middleware.proxy_fix is unavailable
    class ProxyFix:
        def __init__(self, app, x_for=0, x_proto=0, x_host=0, x_port=0, x_prefix=0):
            self.app = app
        def __call__(self, environ, start_response):
            return self.app(environ, start_response)

# Load environment variables
load_dotenv()

# Setup logging - CRITICAL for debugging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s] %(message)s',
    stream=sys.stdout,
    force=True
)
logger = logging.getLogger(__name__)

PORT = int(os.getenv('PORT', 8080))
logger.info(f"[STARTUP] PORT={PORT}")

# Load client configuration from .env
CLIENT_PROVIDER = os.getenv('CLIENT1_PROVIDER', '')
CLIENT_SYNC_INTERVAL = int(os.getenv('CLIENT1_SYNC_INTERVAL', 600))
logger.info(f"[CONFIG] CLIENT_PROVIDER={CLIENT_PROVIDER[:50]}...")
logger.info(f"[CONFIG] CLIENT_SYNC_INTERVAL={CLIENT_SYNC_INTERVAL}s")

# Database path
DB_PATH = os.getenv('DB_PATH', 'fleet_erp_backend_sqlite.db')
logger.info(f"[CONFIG] DB_PATH={os.path.abspath(DB_PATH)}")
# Create Flask app
app = Flask(__name__)  # type: ignore
app.wsgi_app = ProxyFix(app.wsgi_app)  # type: ignore
logger.info("[STARTUP] Flask app created")

@app.before_request  # type: ignore
def log_before_request():
    """Log every incoming request."""
    logger.info(f"[REQUEST_IN] {request.method} {request.path} from {request.remote_addr} | Host: {request.host}")
    return None

@app.after_request  # type: ignore
def log_after_request(response):
    """Log every outgoing response."""
    logger.info(f"[REQUEST_OUT] {request.method} {request.path} => {response.status_code}")
    response.headers['Server'] = 'AtulLogistics/1.0'
    # Add CORS headers for local development
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, X-Tenant-ID'
    return response

@app.route('/ping', methods=['GET'])  # type: ignore
def ping():
    """Simple text response for testing."""
    logger.info("[ROUTE] /ping called")
    return 'PONG', 200

@app.route('/', methods=['GET'])  # type: ignore
def index():
    """Root endpoint."""
    logger.info("[ROUTE] / called")
    return jsonify({
        'status': 'ok',
        'service': 'Atul Logistics API',
        'time': datetime.now().isoformat()
    }), 200

@app.route('/api/health', methods=['GET'])  # type: ignore
def health():
    """Health endpoint."""
    logger.info("[ROUTE] /api/health called")
    return jsonify({
        'status': 'healthy',
        'time': datetime.now().isoformat()
    }), 200

@app.route('/api/config', methods=['GET'])  # type: ignore
def get_config():
    """Return client configuration."""
    return jsonify({
        'provider': CLIENT_PROVIDER,
        'syncInterval': CLIENT_SYNC_INTERVAL,
        'dbPath': os.path.abspath(DB_PATH)
    }), 200

@app.route('/api/vehicles', methods=['GET', 'OPTIONS'])  # type: ignore
def get_vehicles():
    """Get all vehicles from database."""
    if request.method == 'OPTIONS':
        return '', 200
    
    try:
        # Check if database exists
        if not os.path.exists(DB_PATH):
            logger.warning(f"[DB] Database not found at {DB_PATH}, returning empty list")
            return jsonify([]), 200
        
        logger.info(f"[DB] Opening database at {DB_PATH}")
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Check what tables exist
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cursor.fetchall()]
        logger.info(f"[DB] Available tables: {tables}")
        
        # Try to fetch from gps_current table
        try:
            cursor.execute('SELECT * FROM gps_current ORDER BY vehicle_id')
            rows = cursor.fetchall()
            vehicles = [dict(row) for row in rows]
        except sqlite3.OperationalError as e:
            # Table doesn't exist yet, return empty list
            logger.warning(f"[DB] Error querying gps_current: {e}")
            vehicles = []
        
        conn.close()
        logger.info(f"[DB] Fetched {len(vehicles)} vehicles")
        return jsonify(vehicles), 200
    except Exception as e:
        logger.error(f"[ERROR] Error fetching vehicles: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/vehicles/<vehicle_id>', methods=['GET'])  # type: ignore
def get_vehicle(vehicle_id):
    """Get specific vehicle details."""
    try:
        if not os.path.exists(DB_PATH):
            return jsonify({'error': 'Vehicle not found'}), 404
        
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        try:
            cursor.execute('SELECT * FROM gps_current WHERE vehicle_id = ?', (vehicle_id,))
            row = cursor.fetchone()
            
            if not row:
                conn.close()
                return jsonify({'error': 'Vehicle not found'}), 404
            
            vehicle = dict(row)
            
            # Get track history for this vehicle
            cursor.execute('SELECT * FROM gps_track WHERE vehicle_id = ? ORDER BY timestamp DESC LIMIT 100', (vehicle_id,))
            track_rows = cursor.fetchall()
            vehicle['track_history'] = [dict(row) for row in track_rows]
        except sqlite3.OperationalError:
            conn.close()
            return jsonify({'error': 'Database tables not initialized'}), 500
        
        conn.close()
        return jsonify(vehicle), 200
    except Exception as e:
        logger.error(f"[ERROR] Error fetching vehicle {vehicle_id}: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/vehicles/track/<vehicle_id>', methods=['GET'])  # type: ignore
@app.route('/api/track', methods=['GET'])  # type: ignore
def get_vehicle_track(vehicle_id=None):
    """Get vehicle track history."""
    try:
        # Handle both /api/vehicles/track/<id> and /api/track?vehicleId=<id>
        if not vehicle_id:
            vehicle_id = request.args.get('vehicleId')
        
        if not vehicle_id:
            return jsonify({'error': 'vehicleId required'}), 400
        
        if not os.path.exists(DB_PATH):
            return jsonify([]), 200
        
        limit = request.args.get('limit', 100, type=int)
        
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        try:
            cursor.execute(
                'SELECT * FROM gps_track WHERE vehicle_id = ? ORDER BY timestamp DESC LIMIT ?',
                (vehicle_id, limit)
            )
            rows = cursor.fetchall()
            track = [dict(row) for row in rows]
        except sqlite3.OperationalError:
            track = []
        
        conn.close()
        logger.info(f"[DB] Fetched {len(track)} track points for vehicle {vehicle_id}")
        return jsonify(track), 200
    except Exception as e:
        logger.error(f"[ERROR] Error fetching track history: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/test', methods=['GET'])  # type: ignore
def test_route():
    """Test endpoint."""
    logger.info("[ROUTE] /api/test called")
    return jsonify({
        'message': 'Test endpoint working',
        'time': datetime.now().isoformat()
    }), 200

@app.errorhandler(404)  # type: ignore
def not_found(e):
    logger.warning(f"[ERROR] 404: {e}")
    return jsonify({'error': 'not found'}), 404

@app.errorhandler(500)  # type: ignore
def server_error(e):
    logger.error(f"[ERROR] 500: {e}")
    return jsonify({'error': 'server error'}), 500

if __name__ == '__main__':
    logger.info(f"[STARTUP] Starting Flask server on 0.0.0.0:{PORT}")
    logger.info("[STARTUP] About to call app.run()")
    try:
        logger.info("[STARTUP] Binding to IP 0.0.0.0")
        app.run(  # type: ignore
            host='0.0.0.0',
            port=PORT,
            debug=False,
            use_reloader=False,
            threaded=True
        )
    except Exception as e:
        logger.error(f"[STARTUP] Exception in app.run(): {e}", exc_info=True)
        sys.exit(1)