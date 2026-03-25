#!/usr/bin/env python
"""
Flask API server for Atul Logistics GPS tracking.
Serves React frontend requests and runs GPS sync in background.
Designed to work with Gunicorn WSGI server on Railway.
"""
import os
import sys
import sqlite3
import json
import logging
from datetime import datetime
from threading import Thread
from typing import Any
from flask import Flask, jsonify, request
try:
    from flask_cors import CORS as _FlaskCORS
    CORS = _FlaskCORS
except Exception:
    # flask_cors not available; provide a minimal no-op fallback that
    # can be instantiated and will add permissive CORS headers if an app is provided.
    class _NoOpCORS:
        def __init__(self, app=None, **kwargs):
            if app is not None:
                @app.after_request
                def _add_cors_headers(response):
                    response.headers['Access-Control-Allow-Origin'] = '*'
                    response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS'
                    response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
                    return response
    CORS = _NoOpCORS
import requests
from sync_worker import GPSSyncWorker

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)

# Database path
DB_PATH = 'fleet_erp_backend_sqlite.db'
PORT = int(os.getenv('PORT', 8080))

logger.info(f"[CONFIG] Using PORT: {PORT}")

# Create Flask app (must be at module level for Gunicorn)
app: Any = Flask(__name__)
CORS(app)  # Allows cross-origin requests from Vercel

# GPS Sync worker instance (module-level)
sync_worker = None

def init_database():
    """Initialize database and create tables if they don't exist."""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Create gps_current table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS gps_current (
                vehicle_id TEXT PRIMARY KEY,
                vehicle_number TEXT,
                latitude REAL,
                longitude REAL,
                gps_time TEXT,
                client_id TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create gps_track table for history
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS gps_track (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                vehicle_id TEXT,
                vehicle_number TEXT,
                latitude REAL,
                longitude REAL,
                gps_time TEXT,
                client_id TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (vehicle_id) REFERENCES gps_current(vehicle_id)
            )
        ''')
        
        conn.commit()
        conn.close()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")

# GPS Sync worker instance
sync_worker = None

@app.after_request
def add_response_headers(response):
    """Add headers for proper proxying through Railway."""
    response.headers['Connection'] = 'keep-alive'
    response.headers['Content-Type'] = 'application/json; charset=utf-8'
    return response

@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint."""
    logger.info("Health check requested")
    response = jsonify({'status': 'ok', 'timestamp': datetime.now().isoformat()})
    response.status_code = 200
    return response

@app.route('/api/vehicles', methods=['GET'])
def get_vehicles():
    """Get all vehicles from database."""
    try:
        client_id = request.args.get('tenantId', 'CLIENT_001')
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM gps_current ORDER BY vehicle_id')
        rows = cursor.fetchall()
        
        vehicles = [dict(row) for row in rows]
        conn.close()
        
        return jsonify({'success': True, 'data': vehicles}), 200
    except Exception as e:
        logger.error(f"Error fetching vehicles: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/vehicles/<vehicle_id>', methods=['GET'])
def get_vehicle(vehicle_id):
    """Get specific vehicle details."""
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM gps_current WHERE vehicle_id = ?', (vehicle_id,))
        row = cursor.fetchone()
        
        if not row:
            conn.close()
            return jsonify({'success': False, 'error': 'Vehicle not found'}), 404
        
        vehicle = dict(row)
        
        # Get track history for this vehicle
        cursor.execute('SELECT * FROM gps_track WHERE vehicle_id = ? ORDER BY timestamp DESC LIMIT 100', (vehicle_id,))
        track_rows = cursor.fetchall()
        vehicle['track_history'] = [dict(row) for row in track_rows]
        
        conn.close()
        return jsonify({'success': True, 'data': vehicle}), 200
    except Exception as e:
        logger.error(f"Error fetching vehicle {vehicle_id}: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/vehicles/track/<vehicle_id>', methods=['GET'])
def get_vehicle_track(vehicle_id):
    """Get vehicle track history."""
    try:
        limit = request.args.get('limit', 100, type=int)
        
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        cursor.execute(
            'SELECT * FROM gps_track WHERE vehicle_id = ? ORDER BY timestamp DESC LIMIT ?',
            (vehicle_id, limit)
        )
        rows = cursor.fetchall()
        
        track = [dict(row) for row in rows]
        conn.close()
        
        return jsonify({'success': True, 'data': track}), 200
    except Exception as e:
        logger.error(f"Error fetching track history: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/sync/status', methods=['GET'])
def sync_status():
    """Get sync worker status."""
    try:
        if sync_worker:
            return jsonify({
                'success': True,
                'data': {
                    'running': sync_worker.is_running(),
                    'last_sync': sync_worker.last_sync_time,
                    'sync_interval': sync_worker.interval
                }
            }), 200
        else:
            return jsonify({'success': False, 'error': 'Sync worker not initialized'}), 500
    except Exception as e:
        logger.error(f"Error getting sync status: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/sync/trigger', methods=['POST'])
def trigger_sync():
    """Manually trigger GPS sync."""
    try:
        if sync_worker:
            sync_worker.sync_now()
            return jsonify({'success': True, 'message': 'Sync triggered'}), 200
        else:
            return jsonify({'success': False, 'error': 'Sync worker not initialized'}), 500
    except Exception as e:
        logger.error(f"Error triggering sync: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/', methods=['GET'])
def index():
    """Root endpoint."""
    logger.info("Root endpoint requested")
    response = jsonify({
        'service': 'Atul Logistics API',
        'status': 'running',
        'timestamp': datetime.now().isoformat(),
        'endpoints': {
            '/api/health': 'Health check',
            '/api/vehicles': 'Get all vehicles',
        }
    })
    response.status_code = 200
    return response

@app.route('/ping', methods=['GET'])
def ping():
    """Simple text ping endpoint for debugging."""
    return 'pong', 200

@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors."""
    logger.warning(f"404 Not Found: {request.path}")
    return jsonify({'error': 'Not found', 'path': request.path}), 404

@app.before_request
def log_request():
    """Log incoming requests."""
    logger.info(f"[REQUEST] {request.method} {request.path}")

def start_sync_worker():
    """Initialize and start the GPS sync worker."""
    global sync_worker
    try:
        api_url = os.getenv('CLIENT1_PROVIDER', '')
        if not api_url:
            logger.warning("CLIENT1_PROVIDER not set, sync worker disabled")
            return
        
        interval = int(os.getenv('CLIENT1_SYNC_INTERVAL', 600))
        
        sync_worker = GPSSyncWorker(
            api_url=api_url,
            interval=interval,
            client_id='CLIENT_001',
            db_path=DB_PATH
        )
        
        # Start sync in background thread
        sync_worker.start()
        logger.info(f"GPS sync worker started (interval: {interval}s)")
    except Exception as e:
        logger.error(f"Failed to start sync worker: {e}")

if __name__ == '__main__':
    logger.info(f"[MAIN] Starting Atul Logistics API server on port {PORT}")
    logger.info(f"[MAIN] Binding to: 0.0.0.0:{PORT}")
    
    # Initialize database before starting server
    try:
        init_database()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
    
    # Start sync worker
    try:
        start_sync_worker()
        logger.info("GPS sync worker started")
    except Exception as e:
        logger.error(f"Failed to start sync worker: {e}")
    
    # Run Flask app
    try:
        app.run(
            host='0.0.0.0',
            port=PORT,
            debug=False,
            threaded=True,
            use_reloader=False
        )
    except Exception as e:
        logger.error(f"Failed to start Flask app: {e}", exc_info=True)
else:
    # When imported by other modules (e.g., gunicorn)
    logger.info("API module imported - initializing...")
    try:
        init_database()
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
    try:
        if os.getenv('START_SYNC_WORKER', 'true').lower() == 'true':
            start_sync_worker()
            logger.info("GPS sync worker started (import path)")
        else:
            logger.info("START_SYNC_WORKER=false, sync worker disabled")
    except Exception as e:
        logger.error(f"Failed to start sync worker (import path): {e}")
