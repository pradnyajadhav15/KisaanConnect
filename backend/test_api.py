"""
KisaanConnect API Test Script (updated for token-based, role-secured API)
Run after starting the server: python test_api.py
"""

import requests
import json
import uuid

BASE_URL = "http://localhost:8000"

farmer_token = None
consumer_token = None
farmer_id = None
consumer_id = None


# ------------------------------
# HELPERS
# ------------------------------
def print_title(title: str):
    print(f"\n{'='*50}\n{title}\n{'='*50}")

def print_result(label: str, response):
    status = "PASS" if response.ok else f"FAIL ({response.status_code})"
    print(f"[{status}] {label}")
    if not response.ok:
        print("       ", response.text[:200])

def auth(tok):
    return {"Authorization": f"Bearer {tok}"} if tok else {}


# ------------------------------
# HEALTH
# ------------------------------
def test_health():
    print_title("HEALTH CHECK")
    r = requests.get(f"{BASE_URL}/health")
    print_result("Health check", r)
    if r.ok:
        print("  ", json.dumps(r.json(), indent=2))


# ------------------------------
# AUTH
# ------------------------------
def test_auth():
    global farmer_token, consumer_token, farmer_id, consumer_id
    print_title("AUTH TESTS")

    # Register farmer -> capture token + real id
    fu = f"farmer_{uuid.uuid4().hex[:6]}"
    r = requests.post(f"{BASE_URL}/auth/register", json={
        "username": fu, "password": "test1234", "role": "farmer",
        "name": "Test Farmer", "email": f"{fu}@test.com"
    })
    print_result("Register farmer", r)
    if r.ok:
        farmer_token = r.json()["access_token"]
        me = requests.get(f"{BASE_URL}/auth/me", headers=auth(farmer_token))
        if me.ok:
            farmer_id = me.json()["id"]

    # Register consumer -> capture token + real id
    cu = f"consumer_{uuid.uuid4().hex[:6]}"
    r = requests.post(f"{BASE_URL}/auth/register", json={
        "username": cu, "password": "test1234", "role": "consumer",
        "name": "Test Consumer", "email": f"{cu}@test.com"
    })
    print_result("Register consumer", r)
    if r.ok:
        consumer_token = r.json()["access_token"]
        me = requests.get(f"{BASE_URL}/auth/me", headers=auth(consumer_token))
        if me.ok:
            consumer_id = me.json()["id"]

    # Profile check
    r = requests.get(f"{BASE_URL}/auth/me", headers=auth(farmer_token))
    print_result("Get /me (farmer)", r)

    # Negative test: no token should be rejected
    r = requests.get(f"{BASE_URL}/auth/me")
    print_result("Reject /me without token (expect 401)", 
                 type("X", (), {"ok": r.status_code == 401, "status_code": r.status_code, "text": r.text})())


# ------------------------------
# FARMER  (uses farmer_token; no IDs in body/URL)
# ------------------------------
def test_farmer():
    print_title("FARMER TESTS")
    h = auth(farmer_token)

    # Get my crops
    r = requests.get(f"{BASE_URL}/farmer/mine", headers=h)
    print_result("Get my crops", r)

    # Add crop (no farmer_id — comes from token)
    r = requests.post(f"{BASE_URL}/farmer/", headers=h, json={
        "name": "Carrots", "quantity": 75.5, "unit": "kg",
        "price_per_unit": 28.5, "description": "Fresh organic carrots",
        "location": "Karnataka", "available": True
    })
    print_result("Add crop", r)
    crop_id = r.json().get("id") if r.ok else None

    # Update crop (no farmer_id)
    if crop_id:
        r = requests.put(f"{BASE_URL}/farmer/{crop_id}", headers=h, json={
            "name": "Carrots", "quantity": 50.0, "unit": "kg",
            "price_per_unit": 30.0, "available": True
        })
        print_result("Update crop", r)

        # Negative test: consumer must NOT be able to edit a crop
        r = requests.put(f"{BASE_URL}/farmer/{crop_id}", headers=auth(consumer_token), json={
            "name": "Hacked", "quantity": 1, "unit": "kg",
            "price_per_unit": 1, "available": True
        })
        print_result("Block consumer editing crop (expect 403)",
                     type("X", (), {"ok": r.status_code == 403, "status_code": r.status_code, "text": r.text})())

        # Delete crop (no farmer_id query param now)
        r = requests.delete(f"{BASE_URL}/farmer/{crop_id}", headers=h)
        print_result("Delete crop", r)

    # Dashboard stats (no id)
    r = requests.get(f"{BASE_URL}/farmer/dashboard/stats", headers=h)
    print_result("Farmer dashboard stats", r)
    if r.ok:
        print("  ", json.dumps(r.json(), indent=2))


# ------------------------------
# CONSUMER  (uses consumer_token; server computes total + consumer_id)
# ------------------------------
def test_consumer():
    print_title("CONSUMER TESTS")
    h = auth(consumer_token)
    cart_id = str(uuid.uuid4())

    # Marketplace (public)
    r = requests.get(f"{BASE_URL}/consumer/marketplace")
    print_result("Get marketplace", r)
    products = r.json() if r.ok else []

    if not products:
        print("   No products — skipping cart/order tests")
        return

    product = products[0]

    # Add to cart
    r = requests.post(f"{BASE_URL}/consumer/cart", headers=h, json={
        "crop_id": product["id"], "quantity": 5, "cart_id": cart_id
    })
    print_result("Add to cart", r)

    # Get cart
    r = requests.get(f"{BASE_URL}/consumer/cart/{cart_id}", headers=h)
    print_result("Get cart", r)

    # Place order (NO consumer_id, NO total_amount — server derives both)
    r = requests.post(f"{BASE_URL}/consumer/orders", headers=h, json={
        "shipping_address": "123 Test Street, Mumbai",
        "cart_id": cart_id,
        "items": [{"crop_id": product["id"], "quantity": 5}]
    })
    print_result("Place order", r)
    order_id = r.json().get("order_id") if r.ok else None

    # Get order
    if order_id:
        r = requests.get(f"{BASE_URL}/consumer/orders/{order_id}", headers=h)
        print_result("Get order", r)

    # My orders (no id)
    r = requests.get(f"{BASE_URL}/consumer/orders/mine", headers=h)
    print_result("Get my orders", r)

    # Negative test: farmer must NOT be able to place an order
    r = requests.post(f"{BASE_URL}/consumer/orders", headers=auth(farmer_token), json={
        "shipping_address": "x", "cart_id": cart_id,
        "items": [{"crop_id": product["id"], "quantity": 1}]
    })
    print_result("Block farmer placing order (expect 403)",
                 type("X", (), {"ok": r.status_code == 403, "status_code": r.status_code, "text": r.text})())

    # Dashboard stats (no id)
    r = requests.get(f"{BASE_URL}/consumer/dashboard/stats", headers=h)
    print_result("Consumer dashboard stats", r)
    if r.ok:
        print("  ", json.dumps(r.json(), indent=2))


# ------------------------------
# PRICE PREDICTION
# ------------------------------
def test_price_prediction():
    print_title("PRICE PREDICTION TESTS")

    r = requests.get(f"{BASE_URL}/price-prediction/health")
    print_result("Prediction health", r)

    r = requests.post(f"{BASE_URL}/price-prediction/predict", json={
        "crop_name": "Rice", "quantity": 100,
        "season": "Kharif", "region": "Punjab",
        "rain_fall": 250.5, "temperature": 30.2, "soil_quality": "High"
    })
    print_result("Predict price", r)
    if r.ok:
        d = r.json()
        print(f"   Predicted: Rs.{d['predicted_price']}  Range: Rs.{d['min_price']}-{d['max_price']}  ({d.get('confidence')})")


# ------------------------------
# MAIN
# ------------------------------
if __name__ == "__main__":
    test_health()
    test_auth()
    test_farmer()
    test_consumer()
    test_price_prediction()
    print_title("ALL TESTS DONE")