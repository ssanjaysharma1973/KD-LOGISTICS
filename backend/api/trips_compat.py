"""
Compatibility endpoint for trip-dispatches (old frontend format)
Maps new Phase 6 trips table to old trip-dispatches format
"""
from flask import Blueprint, request, jsonify
from datetime import datetime
import sqlite3
import os
import json

trips_compat_bp = Blueprint('trips_compat', __name__, url_prefix='/api')

# Get absolute path to database
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BACKEND_DIR, 'fleet_erp_backend_sqlite.db')

def get_db():
    """Get database connection"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

@trips_compat_bp.route('/trip-dispatches', methods=['GET'])
def get_trip_dispatches():
    """
    GET /api/trip-dispatches
    Returns trips in old format for frontend compatibility
    """
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        munshi_id = request.args.get('munshiId')
        
        # Join trips with vehicles and drivers to get full details
        query = '''
            SELECT 
                t.id,
                t.id as job_card_number,
                v.vehicle_number,
                d.name as driver_name,
                d.phone as driver_phone,
                t.origin,
                t.destination,
                t.status,
                t.load_type,
                t.weight,
                t.distance,
                t.created_at as created_date,
                t.started_at as dispatch_date,
                t.completed_at,
                t.notes,
                v.id as vehicle_id,
                d.id as driver_id
            FROM trips t
            LEFT JOIN client_vehicles v ON t.vehicle_id = v.id
            LEFT JOIN drivers d ON t.driver_id = d.id
            WHERE 1=1
        '''
        
        params = []
        if munshi_id:
            query += ' AND d.munshi_id = ?'
            params.append(munshi_id)
        
        query += ' ORDER BY t.created_at DESC'
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        # Convert to dict format, ensuring notes field has metadata
        trips = []
        for row in rows:
            trip_dict = dict(row)
            
            # Parse existing notes or create new metadata
            try:
                notes_meta = json.loads(row['notes']) if row['notes'] else {}
            except:
                notes_meta = {}
            
            # Ensure required metadata fields
            if not notes_meta.get('from_location'):
                notes_meta['from_location'] = row['origin'] or ''
            if not notes_meta.get('to_location'):
                notes_meta['to_location'] = row['destination'] or ''
            if not notes_meta.get('munshi_name'):
                notes_meta['munshi_name'] = munshi_id or ''
            
            # Store as JSON string
            trip_dict['notes'] = json.dumps(notes_meta)
            trip_dict['job_card_number'] = str(row['job_card_number']).zfill(6)  # Format JCN
            
            trips.append(trip_dict)
        
        conn.close()
        return jsonify({'trips': trips, 'success': True})
    
    except Exception as e:
        print(f"Error fetching trip-dispatches: {e}")
        return jsonify({'error': str(e), 'trips': []}), 500


@trips_compat_bp.route('/trip-dispatches/<trip_id>/stops', methods=['GET'])
def get_trip_stops(trip_id):
    """
    GET /api/trip-dispatches/{id}/stops
    Returns mock stop data for trip
    """
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Get trip details
        cursor.execute('''
            SELECT t.*, v.vehicle_number, d.driver_name
            FROM trips t
            LEFT JOIN client_vehicles v ON t.vehicle_id = v.id
            LEFT JOIN drivers d ON t.driver_id = d.id
            WHERE t.id = ?
        ''', (trip_id,))
        
        trip = cursor.fetchone()
        conn.close()
        
        if not trip:
            return jsonify({'error': 'Trip not found'}), 404
        
        trip_dict = dict(trip)
        
        # Create mock stops based on origin/destination
        stops = [
            {
                'id': 1,
                'trip_id': trip_id,
                'poi_name': trip_dict.get('origin', 'Origin'),
                'stop_type': 'from',
                'stop_status': 'departed',
                'arrived_at': trip_dict.get('created_at'),
                'departed_at': trip_dict.get('started_at'),
                'dwell_minutes': 0,
                'dist_km': 0
            },
            {
                'id': 2,
                'trip_id': trip_id,
                'poi_name': trip_dict.get('destination', 'Destination'),
                'stop_type': 'to',
                'stop_status': 'pending' if trip_dict.get('status') != 'completed' else 'departed',
                'arrived_at': trip_dict.get('completed_at'),
                'departed_at': None,
                'dwell_minutes': None,
                'dist_km': trip_dict.get('distance', 0)
            }
        ]
        
        vehicle_info = {
            'vehicle_no': trip_dict.get('vehicle_number'),
            'speed': 0,
            'gps_time': trip_dict.get('started_at')
        }
        
        return jsonify({'stops': stops, 'vehicle': vehicle_info})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@trips_compat_bp.route('/trip-dispatches', methods=['POST'])
def create_trip_dispatch():
    """
    POST /api/trip-dispatches
    Create a new trip dispatch
    """
    try:
        data = request.get_json()
        conn = get_db()
        cursor = conn.cursor()
        
        # Extract metadata
        notes_meta = {
            'from_location': data.get('from_location', ''),
            'to_location': data.get('to_location', ''),
            'munshi_name': data.get('munshi_name', ''),
            'load_type': data.get('load_type', ''),
        }
        
        cursor.execute('''
            INSERT INTO trips (
                vehicle_id, driver_id, origin, destination, 
                load_type, weight, status, distance, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            data.get('vehicle_id'),
            data.get('driver_id'),
            data.get('from_location', ''),
            data.get('to_location', ''),
            data.get('load_type', ''),
            data.get('weight', 0),
            'started',  # Default to started for dispatches
            data.get('distance', 0),
            json.dumps(notes_meta)
        ))
        
        trip_id = cursor.lastrowid
        conn.commit()
        
        cursor.execute('''
            SELECT t.*, v.vehicle_number, d.driver_name
            FROM trips t
            LEFT JOIN client_vehicles v ON t.vehicle_id = v.id
            LEFT JOIN drivers d ON t.driver_id = d.id
            WHERE t.id = ?
        ''', (trip_id,))
        
        trip = dict(cursor.fetchone())
        trip['job_card_number'] = str(trip['id']).zfill(6)
        
        conn.close()
        return jsonify({'success': True, 'trip': trip}), 201
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@trips_compat_bp.route('/trip-dispatches/<int:trip_id>', methods=['GET'])
def get_single_dispatch(trip_id):
    """GET /api/trip-dispatches/{id}"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT t.*, v.vehicle_number, d.driver_name
            FROM trips t
            LEFT JOIN client_vehicles v ON t.vehicle_id = v.id
            LEFT JOIN drivers d ON t.driver_id = d.id
            WHERE t.id = ?
        ''', (trip_id,))
        
        trip = cursor.fetchone()
        conn.close()
        
        if not trip:
            return jsonify({'error': 'Trip not found'}), 404
        
        trip_dict = dict(trip)
        trip_dict['job_card_number'] = str(trip_dict['id']).zfill(6)
        return jsonify(trip_dict)
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@trips_compat_bp.route('/trip-dispatches/<int:trip_id>', methods=['PUT'])
def update_dispatch(trip_id):
    """PUT /api/trip-dispatches/{id}"""
    try:
        data = request.get_json()
        conn = get_db()
        cursor = conn.cursor()
        
        # Build update query dynamically
        updates = []
        values = []
        
        if 'status' in data:
            updates.append('status = ?')
            values.append(data['status'])
            
            # Update timestamps based on status
            if data['status'] == 'in_transit':
                updates.append('started_at = ?')
                values.append(datetime.now().isoformat())
            elif data['status'] == 'completed':
                updates.append('completed_at = ?')
                values.append(datetime.now().isoformat())
        
        if not updates:
            conn.close()
            return jsonify({'error': 'No fields to update'}), 400
        
        values.append(trip_id)
        query = f"UPDATE trips SET {', '.join(updates)} WHERE id = ?"
        cursor.execute(query, values)
        conn.commit()
        
        cursor.execute('''
            SELECT t.*, v.vehicle_no, d.driver_name
            FROM trips t
            LEFT JOIN client_vehicles v ON t.vehicle_id = v.id
            LEFT JOIN drivers d ON t.driver_id = d.id
            WHERE t.id = ?
        ''', (trip_id,))
        
        trip = dict(cursor.fetchone())
        trip['job_card_number'] = str(trip['id']).zfill(6)
        conn.close()
        
        return jsonify({'success': True, 'trip': trip})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@trips_compat_bp.route('/trip-dispatches/<int:trip_id>', methods=['DELETE'])
def delete_dispatch(trip_id):
    """DELETE /api/trip-dispatches/{id}"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('DELETE FROM trips WHERE id = ?', (trip_id,))
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': 'Trip deleted'})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@trips_compat_bp.route('/trip-dispatches/<int:trip_id>/status', methods=['POST'])
def update_trip_status(trip_id):
    """POST /api/trip-dispatches/{id}/status"""
    try:
        data = request.get_json()
        conn = get_db()
        cursor = conn.cursor()
        
        status = data.get('status', 'in_transit')
        
        # Update status and set timestamps
        update_data = {'status': status}
        
        if status == 'in_transit':
            update_data['started_at'] = datetime.now().isoformat()
        elif status == 'completed':
            update_data['completed_at'] = datetime.now().isoformat()
        
        columns = ', '.join([f'{k} = ?' for k in update_data.keys()])
        values = list(update_data.values())
        values.append(trip_id)
        
        cursor.execute(f'UPDATE trips SET {columns} WHERE id = ?', values)
        conn.commit()
        
        cursor.execute('''
            SELECT t.*, v.vehicle_no, d.driver_name
            FROM trips t
            LEFT JOIN client_vehicles v ON t.vehicle_id = v.id
            LEFT JOIN drivers d ON t.driver_id = d.id
            WHERE t.id = ?
        ''', (trip_id,))
        
        trip = dict(cursor.fetchone())
        trip['job_card_number'] = str(trip['id']).zfill(6)
        conn.close()
        
        return jsonify({'success': True, 'trip': trip})
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500
