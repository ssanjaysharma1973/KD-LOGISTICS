"""
API Endpoints Testing Script
Test all Trips and Billing endpoints
"""

import requests
import json
import time
from datetime import datetime, timedelta

BASE_URL = "http://localhost:3000"

# Color codes for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
END = '\033[0m'

def print_result(test_name, success, response=None):
    """Print test result"""
    status = f"{GREEN}✓ PASSED{END}" if success else f"{RED}✗ FAILED{END}"
    print(f"\n[{status}] {test_name}")
    if response:
        try:
            print(f"Response: {json.dumps(response, indent=2)[:500]}")
        except:
            print(f"Response: {response}")

def test_trips_endpoints():
    """Test all trips endpoints"""
    print(f"\n{BLUE}{'='*60}{END}")
    print(f"{BLUE}Testing Trips Management API{END}")
    print(f"{BLUE}{'='*60}{END}")
    
    trip_id = None
    
    # 1. Get trip stats
    try:
        response = requests.get(f"{BASE_URL}/api/trips/stats")
        print_result("GET /api/trips/stats", response.status_code == 200, response.json())
    except Exception as e:
        print_result("GET /api/trips/stats", False, str(e))
    
    # 2. List trips
    try:
        response = requests.get(f"{BASE_URL}/api/trips/list")
        print_result("GET /api/trips/list", response.status_code == 200, response.json())
    except Exception as e:
        print_result("GET /api/trips/list", False, str(e))
    
    # 3. Create a new trip
    try:
        trip_data = {
            "vehicle_id": 1,
            "driver_id": 1,
            "origin": "Mumbai",
            "destination": "Bangalore",
            "load_type": "Electronics",
            "weight": 500,
            "distance": 1000,
            "status": "pending"
        }
        response = requests.post(f"{BASE_URL}/api/trips/add", json=trip_data)
        success = response.status_code == 201
        print_result("POST /api/trips/add", success, response.json())
        
        if success:
            trip_id = response.json()['trip']['id']
            print(f"  → Created trip ID: {trip_id}")
    except Exception as e:
        print_result("POST /api/trips/add", False, str(e))
    
    # 4. Get trip details
    if trip_id:
        try:
            response = requests.get(f"{BASE_URL}/api/trips/{trip_id}")
            print_result(f"GET /api/trips/{trip_id}", response.status_code == 200, response.json())
        except Exception as e:
            print_result(f"GET /api/trips/{trip_id}", False, str(e))
    
    # 5. Update trip status
    if trip_id:
        try:
            update_data = {
                "status": "in-progress",
                "started_at": datetime.now().isoformat()
            }
            response = requests.put(f"{BASE_URL}/api/trips/{trip_id}", json=update_data)
            print_result(f"PUT /api/trips/{trip_id}", response.status_code == 200, response.json())
        except Exception as e:
            print_result(f"PUT /api/trips/{trip_id}", False, str(e))
    
    # 6. Get trips by filter
    try:
        response = requests.get(f"{BASE_URL}/api/trips/list?status=in-progress")
        print_result("GET /api/trips/list?status=in-progress", response.status_code == 200, response.json())
    except Exception as e:
        print_result("GET /api/trips/list?status=in-progress", False, str(e))
    
    return trip_id

def test_billing_endpoints(trip_id=None):
    """Test all billing endpoints"""
    print(f"\n{BLUE}{'='*60}{END}")
    print(f"{BLUE}Testing Billing & Revenue Management API{END}")
    print(f"{BLUE}{'='*60}{END}")
    
    invoice_id = None
    
    # 1. Get billing stats
    try:
        response = requests.get(f"{BASE_URL}/api/billing/stats")
        print_result("GET /api/billing/stats", response.status_code == 200, response.json())
    except Exception as e:
        print_result("GET /api/billing/stats", False, str(e))
    
    # 2. Get revenue summary
    try:
        response = requests.get(f"{BASE_URL}/api/billing/revenue/summary")
        print_result("GET /api/billing/revenue/summary", response.status_code == 200, response.json())
    except Exception as e:
        print_result("GET /api/billing/revenue/summary", False, str(e))
    
    # 3. Get monthly revenue
    try:
        response = requests.get(f"{BASE_URL}/api/billing/revenue/monthly")
        print_result("GET /api/billing/revenue/monthly", response.status_code == 200, response.json())
    except Exception as e:
        print_result("GET /api/billing/revenue/monthly", False, str(e))
    
    # 4. List invoices
    try:
        response = requests.get(f"{BASE_URL}/api/billing/invoices")
        print_result("GET /api/billing/invoices", response.status_code == 200, response.json())
    except Exception as e:
        print_result("GET /api/billing/invoices", False, str(e))
    
    # 5. Create an invoice
    if trip_id:
        try:
            invoice_data = {
                "trip_id": trip_id,
                "vehicle_id": 1,
                "driver_id": 1,
                "amount": 5000,
                "status": "pending"
            }
            response = requests.post(f"{BASE_URL}/api/billing/invoices/add", json=invoice_data)
            success = response.status_code == 201
            print_result("POST /api/billing/invoices/add", success, response.json())
            
            if success:
                invoice_id = response.json()['invoice']['id']
                print(f"  → Created invoice ID: {invoice_id}")
        except Exception as e:
            print_result("POST /api/billing/invoices/add", False, str(e))
    
    # 6. Get invoice details
    if invoice_id:
        try:
            response = requests.get(f"{BASE_URL}/api/billing/invoices/{invoice_id}")
            print_result(f"GET /api/billing/invoices/{invoice_id}", response.status_code == 200, response.json())
        except Exception as e:
            print_result(f"GET /api/billing/invoices/{invoice_id}", False, str(e))
    
    # 7. Record payment
    if invoice_id:
        try:
            payment_data = {
                "amount": 2500,
                "payment_method": "bank_transfer",
                "reference_number": "TXN123456"
            }
            response = requests.post(
                f"{BASE_URL}/api/billing/invoices/{invoice_id}/pay",
                json=payment_data
            )
            print_result(f"POST /api/billing/invoices/{invoice_id}/pay", response.status_code == 200, response.json())
        except Exception as e:
            print_result(f"POST /api/billing/invoices/{invoice_id}/pay", False, str(e))
    
    # 8. Get filtered invoices
    try:
        response = requests.get(f"{BASE_URL}/api/billing/invoices?status=pending")
        print_result("GET /api/billing/invoices?status=pending", response.status_code == 200, response.json())
    except Exception as e:
        print_result("GET /api/billing/invoices?status=pending", False, str(e))
    
    return invoice_id

def main():
    """Run all tests"""
    print(f"\n{YELLOW}{'='*60}{END}")
    print(f"{YELLOW}Fleet Management ERP - API Testing Suite{END}")
    print(f"{YELLOW}{'='*60}{END}")
    print(f"Base URL: {BASE_URL}")
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Check if server is running
    try:
        response = requests.get(f"{BASE_URL}/api/health")
        if response.status_code != 200:
            print(f"\n{RED}✗ Server is not responding correctly{END}")
            return
    except requests.exceptions.ConnectionError:
        print(f"\n{RED}✗ Could not connect to server at {BASE_URL}{END}")
        print(f"  Make sure the backend server is running:")
        print(f"  cd backend && python app.py")
        return
    except Exception as e:
        print(f"\n{RED}✗ Error connecting to server: {e}{END}")
        return
    
    print(f"\n{GREEN}✓ Server is responding{END}")
    
    # Run tests
    trip_id = test_trips_endpoints()
    time.sleep(1)
    invoice_id = test_billing_endpoints(trip_id)
    
    # Summary
    print(f"\n{BLUE}{'='*60}{END}")
    print(f"{BLUE}Test Summary{END}")
    print(f"{BLUE}{'='*60}{END}")
    print(f"Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    if trip_id:
        print(f"\n{GREEN}✓ Successfully created test trip: #{trip_id}{END}")
    
    if invoice_id:
        print(f"{GREEN}✓ Successfully created test invoice: #{invoice_id}{END}")
    
    print(f"\n{YELLOW}For more information, see PHASE6_API_ENDPOINTS.md{END}\n")

if __name__ == "__main__":
    main()
