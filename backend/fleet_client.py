"""
Fleet Management ERP - Python API Client
Easy-to-use Python client for interacting with the Fleet Management ERP APIs
"""

import requests
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any

class FleetManagementClient:
    """
    Python client for Fleet Management ERP API
    
    Usage:
        client = FleetManagementClient('http://localhost:3000')
        
        # Create a trip
        trip = client.create_trip(
            vehicle_id=1,
            driver_id=1,
            origin='Mumbai',
            destination='Bangalore'
        )
        
        # Get trips
        trips = client.get_trips(status='pending')
        
        # Create invoice
        invoice = client.create_invoice(
            trip_id=trip['id'],
            vehicle_id=1,
            driver_id=1,
            amount=5000
        )
        
        # Record payment
        client.record_payment(invoice['id'], 5000)
    """
    
    def __init__(self, base_url: str = 'http://localhost:3000'):
        """Initialize client with API base URL"""
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})
    
    # ==================== Trips Endpoints ====================
    
    def get_trips(self, status: Optional[str] = None, 
                  driver_id: Optional[int] = None,
                  vehicle_id: Optional[int] = None) -> List[Dict]:
        """
        Get list of trips with optional filters
        
        Args:
            status: Filter by status (pending, in-progress, completed)
            driver_id: Filter by driver
            vehicle_id: Filter by vehicle
        
        Returns:
            List of trip objects
        """
        params = {}
        if status:
            params['status'] = status
        if driver_id:
            params['driver_id'] = driver_id
        if vehicle_id:
            params['vehicle_id'] = vehicle_id
        
        response = self.session.get(
            f"{self.base_url}/api/trips/list",
            params=params
        )
        response.raise_for_status()
        return response.json()['trips']
    
    def create_trip(self, vehicle_id: int, driver_id: int, 
                    origin: str, destination: str,
                    load_type: str = '', weight: int = 0,
                    distance: int = 0, status: str = 'pending') -> Dict:
        """
        Create a new trip
        
        Args:
            vehicle_id: Vehicle ID
            driver_id: Driver ID
            origin: Starting location
            destination: Ending location
            load_type: Type of cargo
            weight: Cargo weight (kg)
            distance: Trip distance (km)
            status: Initial status
        
        Returns:
            Created trip object
        """
        data = {
            'vehicle_id': vehicle_id,
            'driver_id': driver_id,
            'origin': origin,
            'destination': destination,
            'load_type': load_type,
            'weight': weight,
            'distance': distance,
            'status': status
        }
        
        response = self.session.post(
            f"{self.base_url}/api/trips/add",
            json=data
        )
        response.raise_for_status()
        return response.json()['trip']
    
    def get_trip(self, trip_id: int) -> Dict:
        """Get trip details"""
        response = self.session.get(
            f"{self.base_url}/api/trips/{trip_id}"
        )
        response.raise_for_status()
        return response.json()['trip']
    
    def update_trip(self, trip_id: int, 
                    status: Optional[str] = None,
                    started_at: Optional[str] = None,
                    completed_at: Optional[str] = None,
                    notes: Optional[str] = None) -> Dict:
        """
        Update trip status or details
        
        Args:
            trip_id: Trip ID
            status: New status
            started_at: When trip started
            completed_at: When trip completed
            notes: Trip notes
        
        Returns:
            Updated trip object
        """
        data = {}
        if status:
            data['status'] = status
        if started_at:
            data['started_at'] = started_at
        if completed_at:
            data['completed_at'] = completed_at
        if notes:
            data['notes'] = notes
        
        response = self.session.put(
            f"{self.base_url}/api/trips/{trip_id}",
            json=data
        )
        response.raise_for_status()
        return response.json()['trip']
    
    def delete_trip(self, trip_id: int) -> bool:
        """Delete a trip"""
        response = self.session.delete(
            f"{self.base_url}/api/trips/{trip_id}"
        )
        response.raise_for_status()
        return response.json()['success']
    
    def get_trip_stats(self) -> Dict:
        """Get trip statistics"""
        response = self.session.get(
            f"{self.base_url}/api/trips/stats"
        )
        response.raise_for_status()
        return response.json()['stats']
    
    # ==================== Billing Endpoints ====================
    
    def get_invoices(self, status: Optional[str] = None,
                     vehicle_id: Optional[int] = None,
                     trip_id: Optional[int] = None) -> List[Dict]:
        """
        Get list of invoices with optional filters
        
        Args:
            status: Filter by status (pending, paid, overdue)
            vehicle_id: Filter by vehicle
            trip_id: Filter by trip
        
        Returns:
            List of invoice objects
        """
        params = {}
        if status:
            params['status'] = status
        if vehicle_id:
            params['vehicle_id'] = vehicle_id
        if trip_id:
            params['trip_id'] = trip_id
        
        response = self.session.get(
            f"{self.base_url}/api/billing/invoices",
            params=params
        )
        response.raise_for_status()
        return response.json()['invoices']
    
    def create_invoice(self, trip_id: int, vehicle_id: int,
                       driver_id: int, amount: float,
                       status: str = 'pending') -> Dict:
        """
        Create a new invoice
        
        Args:
            trip_id: Associated trip ID
            vehicle_id: Associated vehicle ID
            driver_id: Associated driver ID
            amount: Invoice amount
            status: Invoice status
        
        Returns:
            Created invoice object
        """
        data = {
            'trip_id': trip_id,
            'vehicle_id': vehicle_id,
            'driver_id': driver_id,
            'amount': amount,
            'status': status
        }
        
        response = self.session.post(
            f"{self.base_url}/api/billing/invoices/add",
            json=data
        )
        response.raise_for_status()
        return response.json()['invoice']
    
    def get_invoice(self, invoice_id: int) -> Dict:
        """Get invoice details with payment history"""
        response = self.session.get(
            f"{self.base_url}/api/billing/invoices/{invoice_id}"
        )
        response.raise_for_status()
        return response.json()['invoice']
    
    def record_payment(self, invoice_id: int, amount: float,
                      payment_method: str = 'cash',
                      reference_number: str = '',
                      notes: str = '') -> Dict:
        """
        Record a payment for an invoice
        
        Args:
            invoice_id: Invoice ID
            amount: Payment amount
            payment_method: Payment method
            reference_number: Payment reference
            notes: Payment notes
        
        Returns:
            Updated invoice object
        """
        data = {
            'amount': amount,
            'payment_method': payment_method,
            'reference_number': reference_number,
            'notes': notes
        }
        
        response = self.session.post(
            f"{self.base_url}/api/billing/invoices/{invoice_id}/pay",
            json=data
        )
        response.raise_for_status()
        return response.json()['invoice']
    
    def get_revenue_summary(self) -> Dict:
        """Get revenue summary"""
        response = self.session.get(
            f"{self.base_url}/api/billing/revenue/summary"
        )
        response.raise_for_status()
        return response.json()['summary']
    
    def get_monthly_revenue(self) -> List[Dict]:
        """Get monthly revenue breakdown (last 12 months)"""
        response = self.session.get(
            f"{self.base_url}/api/billing/revenue/monthly"
        )
        response.raise_for_status()
        return response.json()['revenue']
    
    def get_billing_stats(self) -> Dict:
        """Get billing statistics"""
        response = self.session.get(
            f"{self.base_url}/api/billing/stats"
        )
        response.raise_for_status()
        return response.json()['stats']
    
    # ==================== Utility Methods ====================
    
    def is_server_running(self) -> bool:
        """Check if server is running and responsive"""
        try:
            response = self.session.get(
                f"{self.base_url}/api/health",
                timeout=5
            )
            return response.status_code == 200
        except:
            return False
    
    def create_complete_trip_flow(self, vehicle_id: int, driver_id: int,
                                  origin: str, destination: str,
                                  distance: int = 1000,
                                  amount: float = 5000) -> Dict:
        """
        Complete workflow: Create trip, mark as completed, create invoice, record full payment
        
        Returns:
            Dictionary with trip, invoice, and payment details
        """
        # Create trip
        trip = self.create_trip(
            vehicle_id=vehicle_id,
            driver_id=driver_id,
            origin=origin,
            destination=destination,
            distance=distance,
            status='pending'
        )
        
        # Mark as in-progress
        self.update_trip(trip['id'], status='in-progress')
        
        # Mark as completed
        self.update_trip(
            trip['id'],
            status='completed',
            completed_at=datetime.now().isoformat()
        )
        
        # Create invoice
        invoice = self.create_invoice(
            trip_id=trip['id'],
            vehicle_id=vehicle_id,
            driver_id=driver_id,
            amount=amount
        )
        
        # Record full payment
        self.record_payment(
            invoice_id=invoice['id'],
            amount=amount,
            payment_method='bank_transfer'
        )
        
        return {
            'trip': trip,
            'invoice': invoice
        }


# ==================== Example Usage ====================

if __name__ == '__main__':
    # Initialize client
    client = FleetManagementClient('http://localhost:3000')
    
    # Check server
    if not client.is_server_running():
        print("❌ Error: Server is not running!")
        print("Start the server with: python app.py")
        exit(1)
    
    print("✓ Server is running\n")
    
    # Example 1: List trips
    print("=== Getting All Trips ===")
    trips = client.get_trips()
    print(f"Found {len(trips)} trips")
    
    # Example 2: Create a new trip
    print("\n=== Creating New Trip ===")
    trip = client.create_trip(
        vehicle_id=1,
        driver_id=1,
        origin='Mumbai',
        destination='Bangalore',
        distance=1000
    )
    print(f"Created trip: #{trip['id']}")
    
    # Example 3: Update trip status
    print("\n=== Updating Trip Status ===")
    client.update_trip(trip['id'], status='in-progress')
    print(f"Trip {trip['id']} updated to in-progress")
    
    # Example 4: Get trip statistics
    print("\n=== Trip Statistics ===")
    stats = client.get_trip_stats()
    print(f"Total trips: {stats['total']}")
    print(f"Completed: {stats['completed']}")
    
    # Example 5: Create invoice
    print("\n=== Creating Invoice ===")
    invoice = client.create_invoice(
        trip_id=trip['id'],
        vehicle_id=1,
        driver_id=1,
        amount=5000
    )
    print(f"Created invoice: #{invoice['id']}")
    
    # Example 6: Record payment
    print("\n=== Recording Payment ===")
    updated_invoice = client.record_payment(
        invoice_id=invoice['id'],
        amount=2500,
        payment_method='bank_transfer'
    )
    print(f"Recorded payment of ₹2500")
    print(f"Invoice status: {updated_invoice['status']}")
    
    # Example 7: Get revenue summary
    print("\n=== Revenue Summary ===")
    summary = client.get_revenue_summary()
    print(f"Total revenue: ₹{summary['total_revenue']}")
    print(f"Pending: ₹{summary['pending_amount']}")
    
    # Example 8: Complete workflow
    print("\n=== Complete Trip Workflow ===")
    result = client.create_complete_trip_flow(
        vehicle_id=2,
        driver_id=2,
        origin='Delhi',
        destination='Jaipur',
        distance=500,
        amount=3000
    )
    print(f"✓ Completed workflow for trip #{result['trip']['id']}")
    
    print("\n✓ All examples completed successfully!")
