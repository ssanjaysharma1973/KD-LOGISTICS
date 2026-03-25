#!/usr/bin/env python3
"""
Simple Python HTTP server for Atul Logistics GPS API
Uses built-in http.server for robustness and compatibility
"""
import http.server
import socketserver
import json
import sqlite3
import os
import sys
import threading
import time
from datetime import datetime
from pathlib import Path
import urllib.parse
from typing import Tuple, Any, Dict

# Configuration - Render-safe
try:
    PORT = int(os.getenv('PORT', '8080'))
except:
    PORT = 8080

DB_PATH = os.getenv('DB_PATH', 'fleet_erp_backend_sqlite.db')

print(f"[STARTUP] PORT={PORT}, DB_PATH={DB_PATH}", file=sys.stderr)

class APIHandler(http.server.SimpleHTTPRequestHandler):
    """Handle HTTP requests for the GPS API"""
    
    def do_GET(self) -> None:
        """Handle GET requests"""
        # Parse path and query string
        parsed_path = urllib.parse.urlparse(self.path)
        path = parsed_path.path
        
        # Log request
        print(f"[{datetime.now().isoformat()}] GET {path}")
        
        if path == '/api/health':
            self.send_json_response(200, {'status': 'healthy', 'timestamp': datetime.now().isoformat()})
        
        elif path == '/api/test':
            self.send_json_response(200, {'message': 'Python API is working!', 'time': datetime.now().isoformat()})
        
        elif path == '/ping':
            self.send_json_response(200, {'pong': True, 'timestamp': datetime.now().isoformat()})
        
        elif path == '/':
            self.send_json_response(200, {'service': 'Atul Logistics API', 'version': '1.0.0', 'runtime': 'Python http.server'})
        
        elif path == '/api/vehicles':
            self.send_vehicles()
        
        elif path.startswith('/api/vehicles/'):
            vehicle_id = path.split('/')[-1]
            self.send_vehicle_by_id(vehicle_id)
        
        elif path == '/api/sync/status':
            self.send_sync_status()
        
        else:
            self.send_json_response(404, {'error': 'Not found', 'path': path})
    
    def do_OPTIONS(self) -> None:
        """Handle CORS preflight requests"""
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()
    
    def send_json_response(self, status_code: int, data: Dict[str, Any]) -> None:
        """Send JSON response with CORS headers"""
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))
    
    def send_cors_headers(self) -> None:
        """Add CORS headers to response"""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    
    def send_vehicles(self) -> None:
        """Send list of vehicles from database"""
        try:
            if not os.path.exists(DB_PATH):
                self.send_json_response(200, {'vehicles': [], 'count': 0, 'message': 'Database not initialized yet. Sync worker will create it.'})
                return
            
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT vehicle_number, MAX(gps_time) as last_seen
                FROM gps_current
                GROUP BY vehicle_number
                ORDER BY vehicle_number
            ''')
            
            rows = cursor.fetchall()
            vehicles = [dict(row) for row in rows]
            conn.close()
            
            self.send_json_response(200, {'vehicles': vehicles, 'count': len(vehicles)})
        
        except Exception as e:
            print(f"Error fetching vehicles: {e}")
            self.send_json_response(500, {'error': str(e)})
    
    def send_vehicle_by_id(self, vehicle_id: str) -> None:
        """Send specific vehicle details"""
        try:
            if not os.path.exists(DB_PATH):
                self.send_json_response(404, {'error': 'Vehicle not found'})
                return
            
            conn = sqlite3.connect(DB_PATH)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT * FROM gps_current
                WHERE vehicle_number = ?
                ORDER BY gps_time DESC
                LIMIT 1
            ''', (vehicle_id,))
            
            row = cursor.fetchone()
            conn.close()
            
            if row:
                self.send_json_response(200, dict(row))
            else:
                self.send_json_response(404, {'error': 'Vehicle not found', 'vehicle_number': vehicle_id})
        
        except Exception as e:
            print(f"Error fetching vehicle {vehicle_id}: {e}")
            self.send_json_response(500, {'error': str(e)})
    
    def send_sync_status(self) -> None:
        """Send synchronization status"""
        try:
            if not os.path.exists(DB_PATH):
                self.send_json_response(200, {'status': 'waiting_for_sync', 'message': 'Database will be created on first sync', 'last_sync': None})
                return
            
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            
            cursor.execute('SELECT COUNT(*) FROM gps_current')
            current_count = cursor.fetchone()[0]
            
            cursor.execute('SELECT COUNT(*) FROM gps_live_data')
            live_count = cursor.fetchone()[0]
            
            cursor.execute('SELECT MAX(gps_time) FROM gps_current')
            last_sync = cursor.fetchone()[0]
            
            conn.close()
            
            self.send_json_response(200, {
                'status': 'operational',
                'current_positions': current_count,
                'live_data_records': live_count,
                'last_sync': last_sync
            })
        
        except Exception as e:
            print(f"Error getting sync status: {e}")
            self.send_json_response(500, {'error': str(e)})
    
    def log_message(self, format: str, *args) -> None:
        """Suppress default logging"""
        pass


def run_server():
    """Start the HTTP server"""
    handler = APIHandler
    try:
        print(f"[STARTUP] Starting server on 0.0.0.0:{PORT}", file=sys.stderr)
        with socketserver.TCPServer(('0.0.0.0', PORT), handler) as httpd:
            print(f"[STARTUP] Server listening on 0.0.0.0:{PORT}", file=sys.stderr)
            print(f"[STARTUP] Health check: http://localhost:{PORT}/api/health", file=sys.stderr)
            print(f"[STARTUP] Database: {DB_PATH}", file=sys.stderr)
            sys.stderr.flush()
            sys.stdout.flush()
            httpd.serve_forever()
    except Exception as e:
        print(f"[ERROR] Failed to start server: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        raise


if __name__ == '__main__':
    print(f"[STARTUP] Starting Atul Logistics API", file=sys.stderr)
    try:
        run_server()
    except KeyboardInterrupt:
        print("\n[SHUTDOWN] Server stopped", file=sys.stderr)
    except Exception as e:
        print(f"[FATAL] {e}", file=sys.stderr)
        sys.exit(1)
