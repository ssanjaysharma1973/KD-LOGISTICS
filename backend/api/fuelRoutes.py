"""
Fuel Control Module - Flask API Routes
Handles fuel planning, advances, transactions, approvals
"""
from flask import Blueprint, request, jsonify
from services.fuelService import FuelService
import os
from datetime import datetime

fuel_bp = Blueprint('fuel', __name__, url_prefix='/api/fuel')
fuel_service = FuelService()

# ============================================================================
# FUEL PLANNING ENDPOINTS
# ============================================================================

@fuel_bp.route('/plan/<int:trip_id>', methods=['POST'])
def plan_trip_fuel(trip_id):
    """
    Auto-plan fuel for a trip
    Calculates: fuel mode, limits, advance needed
    """
    try:
        # Get trip details
        conn = fuel_service.get_db()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, client_id, trip_no, km, vehicle_no FROM munshi_trips WHERE id = ?
        """, (trip_id,))
        trip = cursor.fetchone()
        
        if not trip:
            return jsonify({'error': 'Trip not found', 'status': 'error'}), 404
        
        trip_dict = dict(trip)
        trip_km = trip_dict.get('km', 0)
        
        # Get vehicle type
        cursor.execute("SELECT vehicle_type FROM vehicles WHERE vehicle_no = ?", (trip_dict['vehicle_no'],))
        vehicle = cursor.fetchone()
        vehicle_type = vehicle[0] if vehicle else '32ft'
        
        conn.close()
        
        # Get fuel policy
        policy = fuel_service.get_applicable_fuel_policy(
            trip_dict['client_id'],
            vehicle_type=vehicle_type,
            trip_type='frl'
        )
        
        # Calculate fuel budget
        fuel_budget = fuel_service.calculate_fuel_budget(
            trip_km, vehicle_type, 'loaded', policy
        )
        
        # Determine fuel limit
        rate_per_liter = 100  # Default rate (should come from config)
        fuel_limit_amount = fuel_budget['fuel_with_buffer_ltr'] * rate_per_liter
        
        # Update trip with fuel plan
        conn = fuel_service.get_db()
        cursor = conn.cursor()
        
        cursor.execute("""
            UPDATE munshi_trips 
            SET fuel_mode = ?,
                fuel_payment_responsibility = ?,
                expected_km = ?,
                expected_fuel_ltr = ?,
                fuel_limit_ltr = ?,
                fuel_limit_amount = ?,
                fuel_approval_status = ?
            WHERE id = ?
        """, (
            policy['fuel_mode'],
            policy['fuel_payment_responsibility'],
            trip_km,
            fuel_budget['expected_fuel_ltr'],
            fuel_budget['fuel_with_buffer_ltr'],
            fuel_limit_amount,
            'planned',
            trip_id
        ))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'trip_id': trip_id,
            'fuel_plan': {
                'fuel_mode': policy['fuel_mode'],
                'expected_fuel_ltr': fuel_budget['expected_fuel_ltr'],
                'fuel_with_buffer_ltr': fuel_budget['fuel_with_buffer_ltr'],
                'fuel_limit_ltr': fuel_budget['fuel_with_buffer_ltr'],
                'fuel_limit_amount': round(fuel_limit_amount, 2),
                'fuel_payment_responsibility': policy['fuel_payment_responsibility'],
                'max_advance': round(policy.get('max_advance_amount', 5000), 2)
            },
            'status': 'planned'
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e), 'status': 'error'}), 500


# ============================================================================
# FUEL ADVANCE ENDPOINTS
# ============================================================================

@fuel_bp.route('/advance/request', methods=['POST'])
def request_fuel_advance():
    """
    Driver requests fuel advance
    Payload: trip_id, driver_id, amount_requested, remarks
    """
    try:
        data = request.get_json()
        trip_id = data.get('trip_id')
        driver_id = data.get('driver_id')
        amount_requested = data.get('amount_requested')
        remarks = data.get('remarks', '')
        
        if not all([trip_id, driver_id, amount_requested]):
            return jsonify({'error': 'Missing required fields', 'status': 'error'}), 400
        
        # Get fuel limit from trip
        conn = fuel_service.get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT fuel_limit_amount FROM munshi_trips WHERE id = ?", (trip_id,))
        trip = cursor.fetchone()
        conn.close()
        
        if not trip:
            return jsonify({'error': 'Trip not found', 'status': 'error'}), 404
        
        fuel_limit = trip[0] or 5000
        
        result = fuel_service.create_fuel_advance_request(
            trip_id, driver_id, amount_requested, fuel_limit, remarks
        )
        
        return jsonify(result), 200 if result.get('status') != 'error' else 400
        
    except Exception as e:
        return jsonify({'error': str(e), 'status': 'error'}), 500


@fuel_bp.route('/advance/<int:advance_id>/approve', methods=['POST'])
def approve_fuel_advance(advance_id):
    """
    Munshi/Finance approves fuel advance
    Payload: approved_amount, approved_by
    """
    try:
        data = request.get_json()
        approved_amount = data.get('approved_amount')
        approved_by = data.get('approved_by', 'admin')
        
        if not approved_amount:
            return jsonify({'error': 'approved_amount required', 'status': 'error'}), 400
        
        result = fuel_service.approve_fuel_advance(advance_id, approved_amount, approved_by)
        
        return jsonify(result), 200 if result.get('status') != 'error' else 400
        
    except Exception as e:
        return jsonify({'error': str(e), 'status': 'error'}), 500


@fuel_bp.route('/advance/<int:advance_id>/issue', methods=['POST'])
def issue_fuel_advance(advance_id):
    """
    Finance issues approved advance to driver
    Payload: issued_amount, issue_mode (cash/upi/card), issued_by
    """
    try:
        data = request.get_json()
        issued_amount = data.get('issued_amount')
        issue_mode = data.get('issue_mode', 'cash')
        issued_by = data.get('issued_by', 'admin')
        
        if not issued_amount:
            return jsonify({'error': 'issued_amount required', 'status': 'error'}), 400
        
        result = fuel_service.issue_fuel_advance(advance_id, issued_amount, issue_mode, issued_by)
        
        return jsonify(result), 200 if result.get('status') != 'error' else 400
        
    except Exception as e:
        return jsonify({'error': str(e), 'status': 'error'}), 500


@fuel_bp.route('/advance/<int:advance_id>', methods=['GET'])
def get_fuel_advance(advance_id):
    """Get fuel advance details"""
    try:
        conn = fuel_service.get_db()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT * FROM trip_fuel_advances WHERE advance_id = ?
        """, (advance_id,))
        
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            return jsonify({'error': 'Advance not found', 'status': 'error'}), 404
        
        return jsonify(dict(row)), 200
        
    except Exception as e:
        return jsonify({'error': str(e), 'status': 'error'}), 500


# ============================================================================
# FUEL TRANSACTION ENDPOINTS
# ============================================================================

@fuel_bp.route('/transaction/create', methods=['POST'])
def create_fuel_transaction():
    """
    Record fuel transaction (driver uploads bill)
    Payload: trip_id, litres, amount, bill_number, location, remarks
    """
    try:
        data = request.get_json()
        trip_id = data.get('trip_id')
        litres = data.get('litres')
        amount = data.get('amount')
        bill_number = data.get('bill_number', '')
        location = data.get('location', '')
        remarks = data.get('remarks', '')
        
        if not all([trip_id, litres, amount]):
            return jsonify({'error': 'Missing required fields', 'status': 'error'}), 400
        
        # Get trip details
        conn = fuel_service.get_db()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT vehicle_no, driver_id FROM munshi_trips WHERE id = ?
        """, (trip_id,))
        trip = cursor.fetchone()
        
        if not trip:
            conn.close()
            return jsonify({'error': 'Trip not found', 'status': 'error'}), 404
        
        # Get vehicle ID
        cursor.execute("SELECT id FROM vehicles WHERE vehicle_no = ?", (trip[0],))
        vehicle = cursor.fetchone()
        conn.close()
        
        vehicle_id = vehicle[0] if vehicle else trip[0]
        driver_id = trip[1]
        
        result = fuel_service.record_fuel_transaction(
            trip_id, vehicle_id, driver_id, litres, amount,
            'driver_advance', bill_number, location, remarks
        )
        
        return jsonify(result), 200 if result.get('status') != 'error' else 400
        
    except Exception as e:
        return jsonify({'error': str(e), 'status': 'error'}), 500


@fuel_bp.route('/transaction/<int:txn_id>', methods=['GET'])
def get_fuel_transaction(txn_id):
    """Get fuel transaction details"""
    try:
        conn = fuel_service.get_db()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT * FROM fuel_transactions WHERE fuel_txn_id = ?
        """, (txn_id,))
        
        row = cursor.fetchone()
        conn.close()
        
        if not row:
            return jsonify({'error': 'Transaction not found', 'status': 'error'}), 404
        
        return jsonify(dict(row)), 200
        
    except Exception as e:
        return jsonify({'error': str(e), 'status': 'error'}), 500


# ============================================================================
# FUEL VARIANCE & ALERTS
# ============================================================================

@fuel_bp.route('/variance/<int:trip_id>', methods=['GET'])
def get_fuel_variance(trip_id):
    """Get fuel variance for trip"""
    try:
        result = fuel_service.calculate_fuel_variance(trip_id)
        return jsonify(result), 200 if result.get('status') != 'error' else 400
        
    except Exception as e:
        return jsonify({'error': str(e), 'status': 'error'}), 500


# ============================================================================
# FUEL DASHBOARD ENDPOINTS
# ============================================================================

@fuel_bp.route('/dashboard/pending-approvals', methods=['GET'])
def get_pending_fuel_approvals():
    """Get all pending fuel advance approvals"""
    try:
        client_id = request.args.get('client_id')
        
        results = fuel_service.get_pending_fuel_approvals(client_id)
        
        return jsonify({
            'count': len(results),
            'approvals': results,
            'status': 'success'
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e), 'status': 'error'}), 500


@fuel_bp.route('/dashboard/summary/<client_id>', methods=['GET'])
def get_fuel_dashboard_summary(client_id):
    """Get fuel dashboard summary for client"""
    try:
        summary = fuel_service.get_fuel_dashboard_summary(client_id)
        
        return jsonify({
            'summary': summary,
            'status': 'success'
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e), 'status': 'error'}), 500


@fuel_bp.route('/health', methods=['GET'])
def fuel_api_health():
    """Health check for fuel module"""
    return jsonify({'status': 'ok', 'module': 'fuel_control'}), 200
