"""
Trips Management API - Create, track, and manage transportation trips
"""
from flask import Blueprint, request, jsonify
from datetime import datetime
import sqlite3
import os

trips_bp = Blueprint('trips', __name__, url_prefix='/api/trips')

# Get absolute path to database
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BACKEND_DIR, 'fleet_erp_backend_sqlite.db')

def get_db():
    """Get database connection"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def ensure_trips_table():
    """Create trips table if it doesn't exist"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS trips (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vehicle_id INTEGER NOT NULL,
            driver_id INTEGER NOT NULL,
            origin TEXT NOT NULL,
            destination TEXT NOT NULL,
            load_type TEXT,
            weight INTEGER,
            distance INTEGER,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            started_at TIMESTAMP,
            completed_at TIMESTAMP,
            eta TIMESTAMP,
            notes TEXT,
            FOREIGN KEY(vehicle_id) REFERENCES client_vehicles(id),
            FOREIGN KEY(driver_id) REFERENCES drivers(id)
        )
    ''')
    
    conn.commit()
    conn.close()

# Ensure table exists on module load
ensure_trips_table()

@trips_bp.route('/list', methods=['GET'])
def list_trips():
    """Get all trips with optional filtering"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        status = request.args.get('status')
        driver_id = request.args.get('driver_id')
        vehicle_id = request.args.get('vehicle_id')
        
        query = 'SELECT * FROM trips WHERE 1=1'
        params = []
        
        if status:
            query += ' AND status = ?'
            params.append(status)
        if driver_id:
            query += ' AND driver_id = ?'
            params.append(driver_id)
        if vehicle_id:
            query += ' AND vehicle_id = ?'
            params.append(vehicle_id)
        
        query += ' ORDER BY created_at DESC'
        
        cursor.execute(query, params)
        trips = [dict(row) for row in cursor.fetchall()]
        
        conn.close()
        return jsonify({'success': True, 'trips': trips})
    except Exception as err:
        return jsonify({'success': False, 'message': str(err)}), 500

@trips_bp.route('/add', methods=['POST'])
def add_trip():
    """Create a new trip"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required = ['vehicle_id', 'driver_id', 'origin', 'destination']
        if not all(field in data for field in required):
            return jsonify({'success': False, 'message': 'Missing required fields'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO trips (
                vehicle_id, driver_id, origin, destination, 
                load_type, weight, status, distance
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            data.get('vehicle_id'),
            data.get('driver_id'),
            data.get('origin'),
            data.get('destination'),
            data.get('load_type', ''),
            data.get('weight', 0),
            data.get('status', 'pending'),
            data.get('distance', 0)
        ))
        
        trip_id = cursor.lastrowid
        conn.commit()
        
        cursor.execute('SELECT * FROM trips WHERE id = ?', (trip_id,))
        trip = dict(cursor.fetchone())
        
        conn.close()
        return jsonify({'success': True, 'message': 'Trip created', 'trip': trip}), 201
    except Exception as err:
        return jsonify({'success': False, 'message': str(err)}), 500

@trips_bp.route('/<int:trip_id>', methods=['GET'])
def get_trip(trip_id):
    """Get trip details"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM trips WHERE id = ?', (trip_id,))
        trip = cursor.fetchone()
        
        conn.close()
        
        if not trip:
            return jsonify({'success': False, 'message': 'Trip not found'}), 404
        
        return jsonify({'success': True, 'trip': dict(trip)})
    except Exception as err:
        return jsonify({'success': False, 'message': str(err)}), 500

@trips_bp.route('/<int:trip_id>', methods=['PUT'])
def update_trip(trip_id):
    """Update trip status or details"""
    try:
        data = request.get_json()
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Build update query
        updates = []
        params = []
        
        if 'status' in data:
            updates.append('status = ?')
            params.append(data['status'])
        
        if 'completed_at' in data:
            updates.append('completed_at = ?')
            params.append(data['completed_at'])
        
        if 'started_at' in data:
            updates.append('started_at = ?')
            params.append(data['started_at'])
        
        if 'notes' in data:
            updates.append('notes = ?')
            params.append(data['notes'])
        
        if not updates:
            return jsonify({'success': False, 'message': 'No fields to update'}), 400
        
        params.append(trip_id)
        query = f"UPDATE trips SET {', '.join(updates)} WHERE id = ?"
        
        cursor.execute(query, params)
        conn.commit()
        
        cursor.execute('SELECT * FROM trips WHERE id = ?', (trip_id,))
        trip = dict(cursor.fetchone())
        
        conn.close()
        return jsonify({'success': True, 'message': 'Trip updated', 'trip': trip})
    except Exception as err:
        return jsonify({'success': False, 'message': str(err)}), 500

@trips_bp.route('/<int:trip_id>', methods=['DELETE'])
def delete_trip(trip_id):
    """Delete a trip"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('DELETE FROM trips WHERE id = ?', (trip_id,))
        conn.commit()
        
        conn.close()
        return jsonify({'success': True, 'message': 'Trip deleted'})
    except Exception as err:
        return jsonify({'success': False, 'message': str(err)}), 500

@trips_bp.route('/stats', methods=['GET'])
def trip_stats():
    """Get trip statistics"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'in-progress' THEN 1 ELSE 0 END) as active,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                COALESCE(SUM(distance), 0) as total_distance,
                COALESCE(SUM(weight), 0) as total_weight
            FROM trips
        ''')
        
        stats = dict(cursor.fetchone())
        conn.close()
        
        return jsonify({'success': True, 'stats': stats})
    except Exception as err:
        return jsonify({'success': False, 'message': str(err)}), 500
