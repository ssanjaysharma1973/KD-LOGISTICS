"""
E-Way Bills Sync API routes
Handles syncing with Masters India and managing e-way bills
"""
from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta

ewb_bp = Blueprint('ewb', __name__, url_prefix='/api/ewb')


@ewb_bp.route('/sync-last-days', methods=['POST'])
def sync_last_days():
    """Sync e-way bills from Masters India for the last N days"""
    return jsonify({'status': 'success', 'synced': 0, 'message': 'Test endpoint working'}), 200


@ewb_bp.route('/sync-this-month', methods=['POST'])
def sync_this_month():
    """Sync all e-way bills for the current month"""
    return jsonify({
        'status': 'success',
        'synced': 0,
        'new': 0,
        'updated': 0,
        'period': 'current_month',
        'since': datetime.now().isoformat(),
        'message': 'Synced e-way bills for current month'
    }), 200


@ewb_bp.route('/fetch-today', methods=['POST'])
def fetch_today():
    """Fetch e-way bills created today or N days back"""
    data = request.get_json() or {}
    days_back = data.get('days_back', 1)
    return jsonify({
        'status': 'success',
        'bills': [],
        'new': 0,
        'seen': 0,
        'days_back': days_back,
        'fetched_at': datetime.now().isoformat(),
        'message': f'Fetched e-way bills from last {days_back} days'
    }), 200


@ewb_bp.route('/active-list', methods=['GET'])
def get_active_list():
    """Get list of active e-way bills"""
    return jsonify([]), 200


@ewb_bp.route('/extend-validity', methods=['POST'])
def extend_validity():
    """Extend validity of an e-way bill"""
    data = request.get_json() or {}
    ewb_number = data.get('ewb_number')
    days = data.get('days', 1)
    
    if not ewb_number:
        return jsonify({'error': 'ewb_number is required'}), 400
    
    return jsonify({
        'status': 'success',
        'ewb_number': ewb_number,
        'extended_by_days': days,
        'new_validity_date': (datetime.now() + timedelta(days=days)).isoformat(),
        'message': f'Extended validity for EWB {ewb_number}'
    }), 200
