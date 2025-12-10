"""
KisaanConnect API Test Script
Run this script after starting the server to test various API endpoints.
This script covers health checks, farmer dashboard, and consumer dashboard.
"""

import requests
import json
import uuid

# ------------------------------
# Configuration
# ------------------------------
BASE_URL = "http://localhost:8000"


# ------------------------------
# Helper Functions
# ------------------------------
def print_title(title: str):
    print("\n" + "="*len(title))
    print(title)
    print("="*len(title))


def print_json(data, limit=None):
    """Pretty-print JSON. Optionally limit list output"""
    if isinstance(data, list) and limit:
        print(json.dumps(data[:limit], indent=4))
    else:
        print(json.dumps(data, indent=4))
    print()


# ------------------------------
# Health Check
# ------------------------------
def test_health():
    print_title("TESTING HEALTH ENDPOINT")
    response = requests.get(f"{BASE_URL}/health")
    print_json(response.json())


# ------------------------------
# Farmer Dashboard Tests
# ------------------------------
def test_farmer_dashboard():
    print_title("TESTING FARMER DASHBOARD")
    
    # 1. Get all crops
    response = requests.get(f"{BASE_URL}/farmer")
    all_crops = response.json()
    print("All crops (first 2 shown):")
    print_json(all_crops, limit=2)
    
    # 2. Add a new crop
    new_crop = {
        "name": "Carrots",
        "quantity": 75.5,
        "unit": "kg",
        "price_per_unit": 28.5,
        "description": "Fresh organic carrots",
        "location": "Karnataka",
        "available": True
    }
    response = requests.post(f"{BASE_URL}/farmer", json=new_crop)
    created_crop = response.json()
    print("Created crop:")
    print_json(created_crop)
    
    # 3. Get dashboard stats
    response = requests.get(f"{BASE_URL}/farmer/dashboard/stats")
    stats = response.json()
    print("Farmer dashboard stats:")
    print_json(stats)


# ------------------------------
# Consumer Dashboard Tests
# ------------------------------
def test_consumer_dashboard():
    print_title("TESTING CONSUMER DASHBOARD")
    
    # 1. Get marketplace products
    response = requests.get(f"{BASE_URL}/consumer/marketplace")
    products = response.json()
    print(f"Marketplace products available: {len(products)}")
    
    if not products:
        print("No products available in marketplace. Skipping further tests.")
        return
    
    # 2. Create a cart
    cart_id = str(uuid.uuid4())
    print(f"Created cart with ID: {cart_id}")
    
    # 3. Add item to cart
    cart_item = {
        "crop_id": products[0]["id"],
        "quantity": 5,
        "cart_id": cart_id,
        "unit_price": products[0]["price_per_unit"]
    }
    response = requests.post(f"{BASE_URL}/consumer/cart", json=cart_item)
    added_item = response.json()
    print("Added item to cart:")
    print_json(added_item)
    
    # 4. Retrieve cart items
    response = requests.get(f"{BASE_URL}/consumer/cart/{cart_id}")
    cart_contents = response.json()
    print("Cart items:")
    print_json(cart_contents)
    
    # 5. Create an order
    order = {
        "total_amount": added_item["quantity"] * added_item["unit_price"],
        "status": "pending",
        "shipping_address": "123 Test Street, Test City",
        "items": [added_item]
    }
    response = requests.post(f"{BASE_URL}/consumer/orders", json=order)
    created_order = response.json()
    print("Created order:")
    print_json(created_order)
    
    # 6. Get consumer dashboard stats
    response = requests.get(f"{BASE_URL}/consumer/dashboard/stats")
    stats = response.json()
    print("Consumer dashboard stats:")
    print_json(stats)


# ------------------------------
# Main Execution
# ------------------------------
if __name__ == "__main__":
    test_health()
    test_farmer_dashboard()
    test_consumer_dashboard()
    
    print_title("ALL TESTS COMPLETED")
