"""
Main Flask application entry point
"""
import os
from flask import Flask
from flask_cors import CORS

# Create Flask app
app = Flask(__name__)

# Enable CORS
cors_origins = os.getenv('CORS_ORIGINS', 'http://localhost:3000,http://localhost:5173').split(',')
CORS(app, origins=cors_origins)

# Try to register blueprints if modules exist
try:
    from api.vehicles import vehicle_bp
    app.register_blueprint(vehicle_bp)
except Exception as e:
    print(f"Warning: Could not load vehicles blueprint: {e}")

try:
    from api.vehicles_master_compat import vehicles_master_bp
    app.register_blueprint(vehicles_master_bp)
    print("[INFO] Vehicles Master Compatibility Module loaded successfully")
except Exception as e:
    print(f"Warning: Could not load vehicles-master compatibility routes: {e}")

try:
    from api.pois import poi_bp
    app.register_blueprint(poi_bp)
except Exception as e:
    print(f"Warning: Could not load pois blueprint: {e}")

try:
    from api.fuelRoutes import fuel_bp
    app.register_blueprint(fuel_bp)
    print("[INFO] Fuel Control Module loaded successfully")
except Exception as e:
    print(f"Warning: Could not load fuel routes: {e}")

try:
    from api.drivers import driver_bp
    app.register_blueprint(driver_bp)
    print("[INFO] Driver Management Module loaded successfully")
except Exception as e:
    print(f"Warning: Could not load driver routes: {e}")

try:
    from api.clients import clients_bp
    app.register_blueprint(clients_bp)
    print("[INFO] Client PIN Authentication Module loaded successfully")
except Exception as e:
    print(f"Warning: Could not load clients routes: {e}")

try:
    from api.munshis import munshi_bp
    app.register_blueprint(munshi_bp)
    print("[INFO] Munshi Management Module loaded successfully")
except Exception as e:
    print(f"Warning: Could not load munshi routes: {e}")

try:
    from api.admins import admin_bp
    app.register_blueprint(admin_bp)
    print("[INFO] Admin Authentication Module loaded successfully")
except Exception as e:
    print(f"Warning: Could not load admin routes: {e}")

try:
    from api.admin_pin_auth import admin_pin_bp
    app.register_blueprint(admin_pin_bp)
    print("[INFO] Admin PIN Authentication Module loaded successfully")
except Exception as e:
    print(f"Warning: Could not load admin PIN routes: {e}")

try:
    from api.ewayBillsRoutes import eway_bills_bp
    app.register_blueprint(eway_bills_bp)
    print("[INFO] E-Way Bills Hub Module loaded successfully")
except Exception as e:
    print(f"Warning: Could not load eway bills routes: {e}")

try:
    from api.ewb_sync import ewb_bp
    app.register_blueprint(ewb_bp)
    print("[INFO] E-Way Bills Sync Module loaded successfully")
except Exception as e:
    print(f"Warning: Could not load ewb sync routes: {e}")

try:
    from api.trips import trips_bp
    app.register_blueprint(trips_bp)
    print("[INFO] Trips Management Module loaded successfully")
except Exception as e:
    print(f"Warning: Could not load trips routes: {e}")

try:
    from api.trips_compat import trips_compat_bp
    app.register_blueprint(trips_compat_bp)
    print("[INFO] Trip Dispatches Compatibility Module loaded successfully")
except Exception as e:
    print(f"Warning: Could not load trip-dispatches compatibility routes: {e}")

try:
    from api.billing import billing_bp
    app.register_blueprint(billing_bp)
    print("[INFO] Billing & Revenue Management Module loaded successfully")
except Exception as e:
    print(f"Warning: Could not load billing routes: {e}")


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return {'status': 'ok'}, 200


# Global error handlers to return JSON instead of HTML
@app.errorhandler(404)
def not_found(e):
    """Return JSON for 404 errors"""
    from flask import jsonify
    return jsonify({'error': 'Not Found', 'status': 404}), 404


@app.errorhandler(500)
def server_error(e):
    """Return JSON for 500 errors"""
    from flask import jsonify
    import traceback
    return jsonify({'error': str(e), 'status': 500, 'traceback': traceback.format_exc()}), 500


if __name__ == '__main__':
    api_host = os.getenv('API_HOST', '0.0.0.0')
    api_port = int(os.getenv('API_PORT', 3000))
    api_debug = os.getenv('API_DEBUG', 'True').lower() == 'true'
    
    print(f"Starting server on {api_host}:{api_port}")
    app.run(
        host=api_host,
        port=api_port,
        debug=api_debug
    )
