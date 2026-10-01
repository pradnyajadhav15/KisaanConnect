"""
End-to-end tests for login, crop listings, cart and orders, against a real PostgreSQL.

They need a throwaway database, which they wipe and recreate:
    TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kisaan_test pytest
GitHub Actions starts one automatically (see .github/workflows/ci.yml). Without
TEST_DATABASE_URL these tests are skipped. As a safety net they refuse to run
against anything that isn't on this machine, so a real (e.g. Neon) database is never wiped.
"""
import os
from pathlib import Path
from urllib.parse import urlparse

import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent
TEST_DB = os.environ.get("TEST_DATABASE_URL")

pytestmark = pytest.mark.skipif(not TEST_DB, reason="set TEST_DATABASE_URL to a throwaway local PostgreSQL")


@pytest.fixture(scope="module")
def api():
    host = urlparse(TEST_DB).hostname
    if host not in (None, "localhost", "127.0.0.1"):
        pytest.fail(f"Refusing to wipe a database on '{host}'. Use a local throwaway PostgreSQL.")

    import psycopg2

    with psycopg2.connect(TEST_DB) as conn, conn.cursor() as cur:
        cur.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
        cur.execute((BACKEND_DIR / "setup_database.sql").read_text(encoding="utf-8"))

    os.environ["DATABASE_URL"] = TEST_DB
    os.environ["JWT_SECRET"] = "test-only-secret-at-least-32-bytes-long"
    os.environ.pop("SENDGRID_API_KEY", None)

    from fastapi.testclient import TestClient
    import main

    return TestClient(main.app)


_counter = iter(range(10_000))


def register(api, role, prefix=None):
    username = f"{prefix or role}{next(_counter)}"
    r = api.post("/auth/register", json={"username": username, "password": "secret123", "role": role})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="module")
def farmer(api):
    return register(api, "farmer")


@pytest.fixture(scope="module")
def farmer2(api):
    return register(api, "farmer")


@pytest.fixture(scope="module")
def consumer(api):
    return register(api, "consumer")


@pytest.fixture(scope="module")
def consumer2(api):
    return register(api, "consumer")


def add_crop(api, headers, name="Onion", quantity=10, price=30, **extra):
    r = api.post("/farmer/", headers=headers, json={
        "name": name, "quantity": quantity, "unit": "kg", "price_per_unit": price, **extra,
    })
    assert r.status_code == 200, r.text
    return r.json()


def stock_of(api, crop_id):
    return api.get(f"/farmer/{crop_id}").json()["quantity"]


def place_order(api, headers, items, cart_id=None):
    return api.post("/consumer/orders", headers=headers, json={
        "shipping_address": "Kini Village, Akkalkot", "phone": "9876543210",
        "items": [{"crop_id": c, "quantity": q} for c, q in items], "cart_id": cart_id,
    })


# ---------- accounts ----------

def test_register_returns_a_working_token(api):
    r = api.post("/auth/register", json={"username": "asha", "password": "secret123", "role": "farmer"})
    assert r.status_code == 200
    body = r.json()
    assert body["role"] == "farmer" and body["username"] == "asha"

    me = api.get("/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"}).json()
    assert me["username"] == "asha" and me["role"] == "farmer"


def test_duplicate_username_is_rejected(api):
    api.post("/auth/register", json={"username": "ravi", "password": "secret123", "role": "consumer"})
    r = api.post("/auth/register", json={"username": "ravi", "password": "other123", "role": "consumer"})
    assert r.status_code == 400


@pytest.mark.parametrize("body", [
    {"username": "sam", "password": "secret123", "role": "admin"},    # can't sign up as admin
    {"username": "sam", "password": "123", "role": "farmer"},         # password too short
    {"username": "ab", "password": "secret123", "role": "farmer"},    # username too short
])
def test_register_validates_input(api, body):
    assert api.post("/auth/register", json=body).status_code == 422


def test_login_with_json_and_with_form(api):
    api.post("/auth/register", json={"username": "meera", "password": "secret123", "role": "consumer"})
    assert api.post("/auth/login/user", json={"username": "meera", "password": "secret123"}).status_code == 200
    assert api.post("/auth/login", data={"username": "meera", "password": "secret123"}).status_code == 200


@pytest.mark.parametrize("username,password", [("meera", "wrong-pass"), ("nobody", "secret123")])
def test_bad_login_is_401(api, username, password):
    api.post("/auth/register", json={"username": "meera", "password": "secret123", "role": "consumer"})
    assert api.post("/auth/login/user", json={"username": username, "password": password}).status_code == 401


@pytest.mark.parametrize("headers", [{}, {"Authorization": "Bearer not-a-real-token"}])
def test_protected_routes_need_a_valid_token(api, headers):
    assert api.get("/auth/me", headers=headers).status_code == 401
    assert api.get("/consumer/orders/mine", headers=headers).status_code == 401


# ---------- crop listings ----------

def test_farmer_creates_and_updates_own_crop(api, farmer):
    crop = add_crop(api, farmer, name="Tomato", quantity=50, price=12)
    r = api.put(f"/farmer/{crop['id']}", headers=farmer, json={
        "name": "Tomato", "quantity": 40, "unit": "kg", "price_per_unit": 14,
    })
    assert r.status_code == 200
    assert r.json()["price_per_unit"] == 14
    assert crop["id"] in [c["id"] for c in api.get("/farmer/mine", headers=farmer).json()]


def test_consumer_cannot_list_crops(api, consumer):
    r = api.post("/farmer/", headers=consumer, json={"name": "X", "quantity": 1, "unit": "kg", "price_per_unit": 1})
    assert r.status_code == 403


def test_farmer_cannot_touch_another_farmers_crop(api, farmer, farmer2):
    crop = add_crop(api, farmer)
    body = {"name": "Mine now", "quantity": 1, "unit": "kg", "price_per_unit": 1}
    assert api.put(f"/farmer/{crop['id']}", headers=farmer2, json=body).status_code == 404
    assert api.delete(f"/farmer/{crop['id']}", headers=farmer2).status_code == 404
    assert stock_of(api, crop["id"]) == 10


def test_marketplace_hides_unavailable_crops(api, farmer):
    shown = add_crop(api, farmer, name="Brinjal")
    hidden = add_crop(api, farmer, name="Garlic", available=False)
    ids = [c["id"] for c in api.get("/consumer/marketplace").json()]
    assert shown["id"] in ids and hidden["id"] not in ids


# ---------- cart ----------

def test_cart_adds_items_and_respects_stock(api, farmer, consumer):
    crop = add_crop(api, farmer, quantity=10, price=30)
    r = api.post("/consumer/cart", headers=consumer, json={"crop_id": crop["id"], "quantity": 3})
    assert r.status_code == 200
    cart_id = r.json()["cart_id"]

    cart = api.get(f"/consumer/cart/{cart_id}", headers=consumer).json()
    assert cart["total"] == 90

    too_many = api.post("/consumer/cart", headers=consumer, json={"crop_id": crop["id"], "quantity": 8, "cart_id": cart_id})
    assert too_many.status_code == 400


# ---------- orders ----------

def test_order_takes_stock_and_clears_the_cart(api, farmer, consumer):
    crop = add_crop(api, farmer, quantity=10, price=30)
    cart_id = api.post("/consumer/cart", headers=consumer, json={"crop_id": crop["id"], "quantity": 4}).json()["cart_id"]

    r = place_order(api, consumer, [(crop["id"], 4)], cart_id=cart_id)
    assert r.status_code == 200, r.text
    assert r.json()["total_amount"] == 120
    assert stock_of(api, crop["id"]) == 6
    assert api.get(f"/consumer/cart/{cart_id}", headers=consumer).json()["items"] == []


def test_cannot_order_more_than_is_left(api, farmer, consumer, consumer2):
    crop = add_crop(api, farmer, quantity=5)
    assert place_order(api, consumer, [(crop["id"], 5)]).status_code == 200
    assert stock_of(api, crop["id"]) == 0
    assert place_order(api, consumer2, [(crop["id"], 1)]).status_code in (400, 404)


def test_only_consumers_can_order_and_orders_need_items(api, farmer, consumer):
    crop = add_crop(api, farmer)
    assert place_order(api, farmer, [(crop["id"], 1)]).status_code == 403
    assert place_order(api, consumer, []).status_code == 400


def test_one_order_cannot_mix_farmers(api, farmer, farmer2, consumer):
    a, b = add_crop(api, farmer), add_crop(api, farmer2)
    assert place_order(api, consumer, [(a["id"], 1), (b["id"], 1)]).status_code == 400
    assert stock_of(api, a["id"]) == 10 and stock_of(api, b["id"]) == 10


def test_orders_are_private(api, farmer, farmer2, consumer, consumer2):
    crop = add_crop(api, farmer)
    order_id = place_order(api, consumer, [(crop["id"], 2)]).json()["order_id"]

    assert order_id in [o["id"] for o in api.get("/consumer/orders/mine", headers=consumer).json()["orders"]]
    assert order_id not in [o["id"] for o in api.get("/consumer/orders/mine", headers=consumer2).json()["orders"]]
    assert api.get(f"/consumer/orders/{order_id}", headers=consumer2).status_code == 403
    assert api.get(f"/consumer/orders/{order_id}", headers=farmer2).status_code == 403
    assert api.get(f"/consumer/orders/{order_id}", headers=farmer).status_code == 200


# ---------- farmer order management ----------

def test_farmer_sees_order_and_moves_it_to_delivered(api, farmer, consumer):
    crop = add_crop(api, farmer, name="Pomegranate", quantity=10, price=80)
    order_id = place_order(api, consumer, [(crop["id"], 3)]).json()["order_id"]

    orders = {o["id"]: o for o in api.get("/farmer/orders", headers=farmer).json()["orders"]}
    row = orders[order_id]
    assert row["status"] == "pending"
    assert row["crop_name"] == "Pomegranate" and row["quantity"] == 3 and row["unit"] == "kg"
    assert row["unit_price"] == 80 and row["total_amount"] == 240
    assert row["consumerName"]

    status = lambda s: api.patch(f"/farmer/orders/{order_id}/status", headers=farmer, json={"status": s})
    assert status("delivered").status_code == 400      # must be accepted first
    assert status("accepted").json()["status"] == "accepted"
    assert status("delivered").json()["status"] == "delivered"
    assert status("pending").status_code == 400        # can't go backwards


def test_rejecting_an_order_puts_stock_back(api, farmer, consumer):
    crop = add_crop(api, farmer, quantity=10)
    order_id = place_order(api, consumer, [(crop["id"], 7)]).json()["order_id"]
    assert stock_of(api, crop["id"]) == 3

    r = api.patch(f"/farmer/orders/{order_id}/status", headers=farmer, json={"status": "rejected"})
    assert r.status_code == 200
    assert stock_of(api, crop["id"]) == 10


def test_farmer_order_endpoints_are_private(api, farmer, farmer2, consumer):
    crop = add_crop(api, farmer)
    order_id = place_order(api, consumer, [(crop["id"], 1)]).json()["order_id"]

    assert order_id not in [o["id"] for o in api.get("/farmer/orders", headers=farmer2).json()["orders"]]
    r = api.patch(f"/farmer/orders/{order_id}/status", headers=farmer2, json={"status": "accepted"})
    assert r.status_code == 404
    assert api.get("/farmer/orders", headers=consumer).status_code == 403


def test_sold_out_listing_still_loads(api, farmer, consumer):
    """Regression: a crop at quantity 0 used to crash /farmer/mine and /farmer/{id}."""
    crop = add_crop(api, farmer, quantity=2)
    assert place_order(api, consumer, [(crop["id"], 2)]).status_code == 200
    assert api.get(f"/farmer/{crop['id']}").status_code == 200
    mine = api.get("/farmer/mine", headers=farmer)
    assert mine.status_code == 200
    assert {c["id"]: c["quantity"] for c in mine.json()}[crop["id"]] == 0
    assert crop["id"] not in [c["id"] for c in api.get("/consumer/marketplace").json()]


# ---------- security and monitoring ----------

def test_repeated_failed_logins_are_blocked(api):
    from auth import login_limiter

    login_limiter.reset()
    api.post("/auth/register", json={"username": "kiran", "password": "secret123", "role": "farmer"})
    login = lambda pw: api.post("/auth/login/user", json={"username": "kiran", "password": pw})

    for _ in range(login_limiter.MAX_FAILURES_PER_USERNAME):
        assert login("wrong-pass").status_code == 401
    blocked = login("secret123")                     # even the right password waits
    assert blocked.status_code == 429
    assert "Retry-After" in blocked.headers
    login_limiter.reset()


def test_a_successful_login_resets_the_count(api):
    from auth import login_limiter

    login_limiter.reset()
    api.post("/auth/register", json={"username": "neha", "password": "secret123", "role": "consumer"})
    login = lambda pw: api.post("/auth/login/user", json={"username": "neha", "password": pw})

    for _ in range(login_limiter.MAX_FAILURES_PER_USERNAME - 1):
        login("wrong-pass")
    assert login("secret123").status_code == 200
    for _ in range(login_limiter.MAX_FAILURES_PER_USERNAME - 1):
        assert login("wrong-pass").status_code == 401
    login_limiter.reset()


def test_unknown_usernames_still_run_a_full_password_check(api, monkeypatch):
    """Without this, 'no such user' answers instantly and reveals which usernames exist."""
    from auth import auth_api

    seen = []
    real = auth_api.verify_password
    monkeypatch.setattr(auth_api, "verify_password", lambda pw, h: seen.append(h) or real(pw, h))
    assert auth_api.authenticate_user("no-such-user", "whatever") is False
    assert seen == [auth_api.DUMMY_HASH] and ":" in auth_api.DUMMY_HASH


def test_responses_carry_request_id_and_security_headers(api):
    r = api.get("/health")
    assert len(r.headers["X-Request-ID"]) >= 8
    assert r.headers["X-Content-Type-Options"] == "nosniff"
    assert r.headers["X-Frame-Options"] == "DENY"
    assert api.get("/health", headers={"X-Request-ID": "trace-123"}).headers["X-Request-ID"] == "trace-123"


def test_unexpected_errors_return_a_request_id(api):
    def boom():
        raise RuntimeError("simulated bug")

    api.app.add_api_route("/__test_boom", boom)
    r = api.get("/__test_boom")
    assert r.status_code == 500
    body = r.json()
    assert body["request_id"] == r.headers["X-Request-ID"]
    assert "simulated bug" not in r.text                  # internals are logged, not shown
