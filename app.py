import os
from dotenv import load_dotenv
import sys
import sqlite3
import subprocess
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_apscheduler import APScheduler

load_dotenv()
# Configuration
PORT = int(os.getenv('PORT', 8080))
DB = 'fleet_erp_backend_sqlite.db'

app = Flask(__name__)
CORS(app)
scheduler = APScheduler()


@app.route('/favicon.ico')
def favicon():
    return '', 204

@app.route('/')
def index():
    return "Atul Logistics ERP API is running."

def get_db_connection():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    return conn

def sync_gps_task():
    try:
        print("🕒 Scheduled Sync: Running update_gps_current_fresh.py...")
        subprocess.run([sys.executable, 'update_gps_current_fresh.py'], timeout=60)
        print("✅ Scheduled Sync: Complete.")
    except Exception as e:
        print(f"❌ Scheduled Sync Error: {e}")

@app.route('/api/health')
def health():
    return jsonify({'status': 'ok', 'service': 'Atul Logistics ERP'})

@app.route('/refresh-gps', methods=['GET'])
def manual_refresh():
    try:
        result = subprocess.run([
            sys.executable, 'update_gps_current_fresh.py'
        ], capture_output=True, text=True, timeout=60)
        if result.returncode == 0:
            return jsonify({"status": "success", "output": result.stdout})
        return jsonify({"status": "error", "error": result.stderr}), 500
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/clients')
def get_clients():
    clients = [
        {'id': 'CLIENT_001', 'name': 'Atul Logistics Main'},
        {'id': 'CLIENT_002', 'name': 'Reliance Petro'},
        {'id': 'CLIENT_003', 'name': 'Tata Steel'}
    ]
    return jsonify(clients)

@app.route('/api/vehicles')
def get_vehicles():
    client_id = request.args.get('clientId')
    if not client_id:
        return jsonify({'error': 'clientId is required'}), 400
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT vehicle_number, latitude, longitude, gps_time as last_seen, client_id
        FROM gps_current 
        WHERE client_id = ? 
        ORDER BY vehicle_number
    ''', (client_id,))
    vehicles = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify({'vehicles': vehicles, 'count': len(vehicles)})

@app.route('/api/track/<vehicle_id>')
def get_historical_track(vehicle_id):
    from_time = request.args.get('from')
    to_time = request.args.get('to')
    if not from_time or not to_time:
        return jsonify({'error': 'Time range (from/to) is required'}), 400
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT latitude, longitude, gps_time, speed 
        FROM gps_data 
        WHERE vehicle_number = ? 
        AND gps_time BETWEEN ? AND ?
        ORDER BY gps_time ASC
    ''', (vehicle_id, from_time, to_time))
    points = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return jsonify({"vehicle_id": vehicle_id, "points": points})

if __name__ == "__main__":
    # use_reloader=False prevents the scheduler from starting twice
    scheduler.add_job(id='sync_job', func=sync_gps_task, trigger='interval', minutes=5)
    scheduler.start()
    print(f"🚀 Atul Logistics Backend running on port {PORT}")
    app.run(host='0.0.0.0', port=PORT, debug=True, use_reloader=False)