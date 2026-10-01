"""Tests for the price prediction API (/price-prediction in the full app)."""
import pandas as pd
import pytest

from price_prediction.models import forecaster


def predict(client, **body):
    return client.post("/predict", json=body)


# ---------- health and options ----------

def test_health_reports_model_and_dates(client, meta):
    body = client.get("/health").json()
    assert body["status"] == "healthy"
    assert body["model_loaded"] is True
    assert body["states"] == len(meta["states"]) >= 20
    assert body["forecast_for"] == meta["forecast_for"]


def test_options_include_maharashtra(client):
    body = client.get("/options").json()
    assert "Maharashtra" in body["states"]
    assert body["states"] == sorted(body["states"])
    assert len(body["commodities"]) == 30


def test_options_for_a_state_list_only_its_crops(client, meta):
    crops = client.get("/options", params={"state": "maharashtra"}).json()["commodities"]
    assert set(crops) == set(meta["states"]["Maharashtra"])
    assert "Onion" in crops


@pytest.mark.parametrize("not_a_crop", ["Cow", "Ox", "She Buffalo", "Ghee", "Firewood"])
def test_non_crops_are_not_offered(client, not_a_crop):
    crops = client.get("/options", params={"state": "Maharashtra"}).json()["commodities"]
    assert not_a_crop not in crops


def test_options_unknown_state_is_404(client):
    assert client.get("/options", params={"state": "Atlantis"}).status_code == 404


def test_varieties_most_reported_first(client, meta):
    body = client.get("/varieties", params={"commodity": "onion", "state": "Maharashtra"}).json()
    rows = meta["states"]["Maharashtra"]["Onion"]
    assert body["commodity"] == "Onion"
    assert set(body["varieties"]) == set(rows)
    counts = [rows[v]["rows"] for v in body["varieties"]]
    assert counts == sorted(counts, reverse=True)


# ---------- successful predictions ----------

def test_predict_maharashtra_onion(client, meta):
    r = predict(client, state="Maharashtra", commodity="Onion", quantity=250)
    assert r.status_code == 200
    body = r.json()
    f = body["factors"]

    assert body["price_per_kg"] > 0
    assert body["min_price_per_kg"] <= body["price_per_kg"] <= body["max_price_per_kg"]
    assert body["predicted_price_per_quintal"] == pytest.approx(body["price_per_kg"] * 100, abs=1)
    assert f["estimated_total_value"] == pytest.approx(body["price_per_kg"] * 250, abs=0.01)
    assert body["confidence"] in {"High", "Medium", "Low"}
    assert meta["forecast_for"] in body["disclaimer"]
    assert f["state"] == "Maharashtra" and f["commodity"] == "Onion"
    assert f["variety"] == client.get("/varieties", params={"commodity": "Onion", "state": "Maharashtra"}).json()["varieties"][0]


def test_input_is_case_and_space_insensitive(client):
    a = predict(client, state="Maharashtra", commodity="Tomato").json()
    b = predict(client, state="  MAHARASHTRA ", commodity="tomato").json()
    assert a["price_per_kg"] == b["price_per_kg"]
    assert b["factors"]["state"] == "Maharashtra"


def test_explicit_variety_is_used(client, meta):
    variety = next(v for v, s in meta["states"]["Maharashtra"]["Onion"].items() if s["s7"] is not None)
    body = predict(client, state="Maharashtra", commodity="Onion", variety=variety).json()
    assert body["factors"]["variety"] == variety


def test_stale_combination_falls_back_to_latest_price(client, meta):
    stale = next(
        (
            (s, c, v, st)
            for s, crops in meta["states"].items()
            for c, varieties in crops.items()
            for v, st in varieties.items()
            if st["s7"] is None and st["s30"] is None
        ),
        None,
    )
    if stale is None:
        pytest.skip("every combination has recent prices in this data")
    state, crop, variety, stats = stale
    body = predict(client, state=state, commodity=crop, variety=variety).json()
    assert body["confidence"] == "Low"
    assert body["price_per_kg"] == pytest.approx(stats["latest"] / 100, abs=0.01)
    assert stats["latest_date"] in body["factors"]["based_on"]


def test_forecasts_stay_close_to_last_weeks_price(meta):
    """Guards against a broken model: one week ahead, prices rarely move more than 2x."""
    rows = [
        {"state": s, "commodity": c, "variety": v, "s7": st["s7"], "s7_days": st["s7_days"], "s30": st["s30"]}
        for s, crops in meta["states"].items()
        for c, varieties in crops.items()
        for v, st in varieties.items()
        if st["s7"] is not None
    ]
    df = pd.DataFrame(rows).assign(date=pd.Timestamp(meta["forecast_for"]), m7=float("nan"), m30=float("nan"))
    from price_prediction.api.prediction_api import model

    ratio = forecaster.predict(model, df) / df["s7"]
    assert ratio.notna().all()
    assert ratio.between(0.5, 2.0).mean() > 0.99


# ---------- inputs that must be refused ----------

def test_unknown_state_is_refused(client):
    r = predict(client, state="Atlantis", commodity="Onion")
    assert r.status_code == 422
    assert "Maharashtra" in r.json()["detail"]


def test_unknown_crop_is_refused_with_suggestions(client):
    r = predict(client, state="Maharashtra", commodity="Saffron")
    assert r.status_code == 422
    assert "Try:" in r.json()["detail"]


def test_unknown_variety_is_refused(client):
    r = predict(client, state="Maharashtra", commodity="Onion", variety="Purple Moon")
    assert r.status_code == 422
    assert "Available:" in r.json()["detail"]


@pytest.mark.parametrize("body", [
    {"state": "Maharashtra"},                                   # no crop
    {"commodity": "Onion"},                                     # no state
    {"state": "Maharashtra", "commodity": "Onion", "quantity": 0},
    {"state": "", "commodity": "Onion"},
    # the payload the old farmer dashboard used to send
    {"crop_name": "ONION", "category": "Vegetables", "center_state": "PUNE", "quantity": 100},
])
def test_invalid_requests_are_rejected(client, body):
    assert client.post("/predict", json=body).status_code == 422
