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


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return {'status': 'ok'}, 200


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
