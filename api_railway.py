#!/usr/bin/env python
"""
Minimal Flask API for Atul Logistics - optimized for Railway with ProxyFix
"""
import os
import sys
import logging
from datetime import datetime
from flask import Flask, jsonify, request
try:
    from flask import Response
    from flask import make_response
except ImportError:
    try:
        from werkzeug.wrappers import Response
    except ImportError:
        Response = None
    def make_response(*args, **kwargs):
        if Response is not None:
            return Response(*args, **kwargs)
        raise ImportError("Neither flask.Response nor werkzeug.wrappers.Response is available.")
else:
    # If make_response is not available in flask, define a fallback
    if 'make_response' not in locals():
        def make_response(*args, **kwargs):
            if Response is not None:
                return Response(*args, **kwargs)
            raise ImportError("Neither flask.Response nor werkzeug.wrappers.Response is available.")
try:
    from werkzeug.middleware.proxy_fix import ProxyFix  # type: ignore
except Exception:
    # Fallback no-op ProxyFix for environments without werkzeug installed
    class ProxyFix:
        def __init__(self, app, **kwargs):
            self.app = app

        def __call__(self, environ, start_response):
            return self.app(environ, start_response)

# Ensure Flask is installed
try:
    import flask
except ImportError:
    raise ImportError("Flask is not installed. Please install it with 'pip install flask'.")

# Global OPTIONS handler for CORS preflight
# (Moved below app creation)

# Add /api/track/<vehicle_id> endpoint with mock track data
# (Moved below app creation)

# Setup logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s] %(message)s',
    stream=sys.stdout,
    force=True
)
logger = logging.getLogger(__name__)

PORT = int(os.getenv('PORT', 8080))
logger.info(f"[ATUL-LOGISTICS] PORT={PORT}")

# Create Flask app
# Ensure Flask is installed and app is a Flask instance
if not hasattr(Flask, 'route'):
    raise ImportError("Flask does not appear to be installed or is corrupted. Please reinstall Flask.")

try:
    app = Flask(__name__)  # type: ignore
except TypeError:
    # Some Flask-like environments may provide a callable that expects no positional args
    app = Flask()  # type: ignore
logger.info("[ATUL-LOGISTICS] Flask app created")


# Add /api/track/<vehicle_id> endpoint with real data from DB
import sqlite3
@app.route('/api/track/<vehicle_id>', methods=['GET'])  # type: ignore
def get_vehicle_track(vehicle_id):
    logger.info(f"[ROUTE] /api/track/{vehicle_id} called (real DB)")
    conn = sqlite3.connect('fleet_erp_backend_sqlite.db')
    cursor = conn.cursor()
    cursor.execute("""
        SELECT latitude, longitude, gps_time FROM gps_current
        WHERE vehicle_number = ? AND client_id = ?
        ORDER BY gps_time DESC LIMIT 20
    """, (vehicle_id, 'CLIENT_001'))
    rows = cursor.fetchall()
    conn.close()
    if rows:
        track = [
            {"lat": lat, "lng": lng, "ts": ts}
            for (lat, lng, ts) in rows
        ]
        return jsonify(track), 200
    else:
        return jsonify({'error': 'not found', 'detail': f'No track for vehicle {vehicle_id}'}), 404

# Global OPTIONS handler for CORS preflight
@app.route('/<path:path>', methods=['OPTIONS'])  # type: ignore
def options_handler(path):
    logger.info(f"[CORS] Preflight OPTIONS for /{path}")
    response = make_response(('', 200))
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, X-Tenant-ID'
    return response

# Add /api/updates endpoint after app is defined

@app.route('/api/updates', methods=['GET'])  # type: ignore
def get_updates():
    """Return a mock SSE stream for testing."""
    logger.info("[ROUTE] /api/updates (SSE) called")
    def event_stream():
        # Send a single event as a test, then close
        yield 'event: message\ndata: {"updates": [], "message": "No updates available (mock)"}\n\n'
    return Response(event_stream(), mimetype='text/event-stream')

# Add /api/vehicles endpoint with real data from DB
@app.route('/api/vehicles', methods=['GET'])  # type: ignore
def get_vehicles():
    """Return a list of vehicles for CLIENT_001 from DB."""
    logger.info("[ROUTE] /api/vehicles called (real DB)")
    conn = sqlite3.connect('fleet_erp_backend_sqlite.db')
    cursor = conn.cursor()
    cursor.execute("""
        SELECT vehicle_number, latitude, longitude, gps_time, client_id
        FROM gps_current WHERE client_id = ?
        ORDER BY gps_time DESC
    """, ('CLIENT_001',))
    rows = cursor.fetchall()
    conn.close()
    vehicles = [
        {
            "id": row[0],
            "number": row[0],
            "latitude": row[1],
            "longitude": row[2],
            "gps_time": row[3],
            "client_id": row[4]
        }
        for row in rows
    ]
    return jsonify({"vehicles": vehicles}), 200

# Add /api/config endpoint after app is defined
@app.route('/api/config', methods=['GET'])  # type: ignore
def get_config():
    """Return a mock config for frontend."""
    logger.info("[ROUTE] /api/config called")
    config = {
        "apiBaseUrl": "/api",
        "features": ["vehicles", "updates", "health"],
        "env": "development"
    }
    return jsonify(config), 200

# CRITICAL: Apply ProxyFix middleware for reverse proxy headers
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_port=1)  # type: ignore
logger.info("[ATUL-LOGISTICS] ProxyFix middleware applied for Railway proxy")

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
    """Simple text response."""
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

@app.route('/api/test', methods=['GET'])  # type: ignore
def test_route():
    """Test endpoint."""
    logger.info("[ROUTE] /api/test called")
    return jsonify({
        'message': 'Test endpoint working',
        'time': datetime.now().isoformat()
    }), 200


# Serve a blank favicon.ico to avoid 405 errors
@app.route('/favicon.ico', methods=['GET'])
def favicon():
    logger.info("[ROUTE] /favicon.ico called")
    # Return a 204 No Content for favicon requests
    return ('', 204)

@app.errorhandler(404)  # type: ignore
def not_found(e):
    logger.warning(f"[ERROR] 404: {e}")
    return jsonify({'error': 'not found'}), 404

# Catch-all for .well-known and other unknown paths to avoid 405
@app.route('/.well-known/<path:subpath>', methods=['GET'])
def well_known(subpath):
    logger.info(f"[ROUTE] /.well-known/{subpath} called")
    return jsonify({'error': 'not found'}), 404

@app.errorhandler(500)  # type: ignore
def server_error(e):
    logger.error(f"[ERROR] 500: {e}")
    return jsonify({'error': 'server error'}), 500

if __name__ == '__main__':
    logger.info(f"[STARTUP] Starting Flask server on 0.0.0.0:{PORT}")
    logger.info("[STARTUP] About to call app.run()")
    try:
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
