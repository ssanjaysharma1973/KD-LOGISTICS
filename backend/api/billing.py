"""
Billing & Revenue Management API - Handle invoices, payments, and revenue tracking
"""
from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
import sqlite3
import os
import json

billing_bp = Blueprint('billing', __name__, url_prefix='/api/billing')

# Get absolute path to database
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BACKEND_DIR, 'fleet_erp_backend_sqlite.db')

def get_db():
    """Get database connection"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def ensure_billing_tables():
    """Create billing tables if they don't exist"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS invoices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            trip_id INTEGER NOT NULL,
            vehicle_id INTEGER NOT NULL,
            driver_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            status TEXT DEFAULT 'pending',
            issue_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            due_date TIMESTAMP,
            paid_date TIMESTAMP,
            payment_method TEXT,
            notes TEXT,
            FOREIGN KEY(trip_id) REFERENCES trips(id),
            FOREIGN KEY(vehicle_id) REFERENCES client_vehicles(id),
            FOREIGN KEY(driver_id) REFERENCES drivers(id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS revenue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            month TEXT NOT NULL,
            total_trips INTEGER,
            total_revenue REAL,
            vehicle_revenue REAL,
            driver_commission REAL,
            operational_cost REAL,
            net_profit REAL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_id INTEGER NOT NULL,
            amount REAL NOT NULL,
            payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            payment_method TEXT,
            reference_number TEXT,
            notes TEXT,
            FOREIGN KEY(invoice_id) REFERENCES invoices(id)
        )
    ''')
    
    conn.commit()
    conn.close()

# Ensure tables exist on module load
ensure_billing_tables()

@billing_bp.route('/invoices', methods=['GET'])
def list_invoices():
    """Get all invoices with optional filtering"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        status = request.args.get('status')
        vehicle_id = request.args.get('vehicle_id')
        trip_id = request.args.get('trip_id')
        
        query = 'SELECT * FROM invoices WHERE 1=1'
        params = []
        
        if status:
            query += ' AND status = ?'
            params.append(status)
        if vehicle_id:
            query += ' AND vehicle_id = ?'
            params.append(vehicle_id)
        if trip_id:
            query += ' AND trip_id = ?'
            params.append(trip_id)
        
        query += ' ORDER BY issue_date DESC'
        
        cursor.execute(query, params)
        invoices = [dict(row) for row in cursor.fetchall()]
        
        conn.close()
        return jsonify({'success': True, 'invoices': invoices})
    except Exception as err:
        return jsonify({'success': False, 'message': str(err)}), 500

@billing_bp.route('/invoices/add', methods=['POST'])
def create_invoice():
    """Create a new invoice"""
    try:
        data = request.get_json()
        
        required = ['trip_id', 'vehicle_id', 'driver_id', 'amount']
        if not all(field in data for field in required):
            return jsonify({'success': False, 'message': 'Missing required fields'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Calculate due date (30 days from issue)
        issue_date = datetime.now()
        due_date = issue_date + timedelta(days=30)
        
        cursor.execute('''
            INSERT INTO invoices (
                trip_id, vehicle_id, driver_id, amount, status, due_date
            ) VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            data['trip_id'],
            data['vehicle_id'],
            data['driver_id'],
            data['amount'],
            data.get('status', 'pending'),
            due_date
        ))
        
        invoice_id = cursor.lastrowid
        conn.commit()
        
        cursor.execute('SELECT * FROM invoices WHERE id = ?', (invoice_id,))
        invoice = dict(cursor.fetchone())
        
        conn.close()
        return jsonify({'success': True, 'message': 'Invoice created', 'invoice': invoice}), 201
    except Exception as err:
        return jsonify({'success': False, 'message': str(err)}), 500

@billing_bp.route('/invoices/<int:invoice_id>', methods=['GET'])
def get_invoice(invoice_id):
    """Get invoice details"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM invoices WHERE id = ?', (invoice_id,))
        invoice = cursor.fetchone()
        
        if not invoice:
            conn.close()
            return jsonify({'success': False, 'message': 'Invoice not found'}), 404
        
        # Get payment history
        cursor.execute('SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC', (invoice_id,))
        payments = [dict(row) for row in cursor.fetchall()]
        
        conn.close()
        
        invoice_data = dict(invoice)
        invoice_data['payments'] = payments
        
        return jsonify({'success': True, 'invoice': invoice_data})
    except Exception as err:
        return jsonify({'success': False, 'message': str(err)}), 500

@billing_bp.route('/invoices/<int:invoice_id>/pay', methods=['POST'])
def pay_invoice(invoice_id):
    """Record payment for an invoice"""
    try:
        data = request.get_json()
        
        if 'amount' not in data:
            return jsonify({'success': False, 'message': 'Payment amount required'}), 400
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Check invoice exists
        cursor.execute('SELECT * FROM invoices WHERE id = ?', (invoice_id,))
        invoice = cursor.fetchone()
        
        if not invoice:
            conn.close()
            return jsonify({'success': False, 'message': 'Invoice not found'}), 404
        
        # Record payment
        cursor.execute('''
            INSERT INTO payments (
                invoice_id, amount, payment_method, reference_number, notes
            ) VALUES (?, ?, ?, ?, ?)
        ''', (
            invoice_id,
            data['amount'],
            data.get('payment_method', 'cash'),
            data.get('reference_number', ''),
            data.get('notes', '')
        ))
        
        # Update invoice status if fully paid
        cursor.execute('SELECT SUM(amount) FROM payments WHERE invoice_id = ?', (invoice_id,))
        total_paid = cursor.fetchone()[0] or 0
        
        if total_paid >= invoice['amount']:
            cursor.execute('''
                UPDATE invoices 
                SET status = 'paid', paid_date = ? 
                WHERE id = ?
            ''', (datetime.now(), invoice_id))
        
        conn.commit()
        
        cursor.execute('SELECT * FROM invoices WHERE id = ?', (invoice_id,))
        updated_invoice = dict(cursor.fetchone())
        
        conn.close()
        return jsonify({'success': True, 'message': 'Payment recorded', 'invoice': updated_invoice})
    except Exception as err:
        return jsonify({'success': False, 'message': str(err)}), 500

@billing_bp.route('/revenue/summary', methods=['GET'])
def revenue_summary():
    """Get revenue summary"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Total revenue
        cursor.execute('SELECT SUM(amount) as total FROM invoices WHERE status = "paid"')
        total_revenue = cursor.fetchone()['total'] or 0
        
        # Current month revenue
        current_month = datetime.now().strftime('%Y-%m')
        cursor.execute('''
            SELECT SUM(amount) as total FROM invoices 
            WHERE status = "paid" 
            AND strftime('%Y-%m', issue_date) = ?
        ''', (current_month,))
        month_revenue = cursor.fetchone()['total'] or 0
        
        # Pending invoices
        cursor.execute('SELECT COUNT(*) as count, SUM(amount) as total FROM invoices WHERE status = "pending"')
        pending = dict(cursor.fetchone())
        
        # Overdue invoices
        cursor.execute('''
            SELECT COUNT(*) as count, SUM(amount) as total FROM invoices 
            WHERE status = "pending" AND due_date < ?
        ''', (datetime.now(),))
        overdue = dict(cursor.fetchone())
        
        conn.close()
        
        summary = {
            'total_revenue': total_revenue,
            'month_revenue': month_revenue,
            'pending_invoices': pending['count'] or 0,
            'pending_amount': pending['total'] or 0,
            'overdue_invoices': overdue['count'] or 0,
            'overdue_amount': overdue['total'] or 0
        }
        
        return jsonify({'success': True, 'summary': summary})
    except Exception as err:
        return jsonify({'success': False, 'message': str(err)}), 500

@billing_bp.route('/revenue/monthly', methods=['GET'])
def monthly_revenue():
    """Get monthly revenue breakdown"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT 
                strftime('%Y-%m', issue_date) as month,
                COUNT(*) as trips,
                SUM(amount) as revenue,
                COUNT(CASE WHEN status = "paid" THEN 1 END) as paid_trips,
                SUM(CASE WHEN status = "paid" THEN amount ELSE 0 END) as paid_amount
            FROM invoices
            GROUP BY month
            ORDER BY month DESC
            LIMIT 12
        ''')
        
        revenue_data = [dict(row) for row in cursor.fetchall()]
        conn.close()
        
        return jsonify({'success': True, 'revenue': revenue_data})
    except Exception as err:
        return jsonify({'success': False, 'message': str(err)}), 500

@billing_bp.route('/stats', methods=['GET'])
def billing_stats():
    """Get billing statistics"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT 
                COUNT(*) as total_invoices,
                SUM(CASE WHEN status = "paid" THEN 1 ELSE 0 END) as paid,
                SUM(CASE WHEN status = "pending" THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = "overdue" THEN 1 ELSE 0 END) as overdue,
                SUM(CASE WHEN status = "paid" THEN amount ELSE 0 END) as paid_amount,
                SUM(CASE WHEN status = "pending" THEN amount ELSE 0 END) as pending_amount,
                AVG(amount) as avg_invoice
            FROM invoices
        ''')
        
        stats = dict(cursor.fetchone())
        conn.close()
        
        return jsonify({'success': True, 'stats': stats})
    except Exception as err:
        return jsonify({'success': False, 'message': str(err)}), 500
