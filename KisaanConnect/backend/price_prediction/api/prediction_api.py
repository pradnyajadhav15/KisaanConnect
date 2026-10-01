"""
Crop price prediction API (mounted at /price-prediction in main.py).

Forecasts the typical mandi price one week after the latest data, using the
forecaster in models/forecaster.py and the recent state-level prices stored in
models/model_meta.json. Inputs the data doesn't cover get a clear 422 instead of a guess.
"""
import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from price_prediction.models import forecaster

# --------------------------------------------------
# PATHS + ARTIFACTS
# --------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_DIR = BASE_DIR / "models"
MODEL_PATH = MODEL_DIR / "crop_price_model.joblib"
META_PATH = MODEL_DIR / "model_meta.json"

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

# Confidence comes from how many of the last 7 days had mandi reports for this combination.
HIGH_CONFIDENCE_DAYS = 5
MEDIUM_CONFIDENCE_DAYS = 2


def _load_model():
    try:
        m = joblib.load(MODEL_PATH)
        print("Price model loaded")
        return m
    except Exception as e:
        print(f"Price model load failed: {e}")
        return None


def _load_meta() -> Dict[str, Any]:
    try:
        return json.loads(META_PATH.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"Model metadata load failed: {e}")
        return {"states": {}, "crop_rank": []}


model = _load_model()
meta = _load_meta()
COVERAGE: Dict[str, Dict[str, Dict[str, Dict[str, Any]]]] = meta.get("states", {})
CROP_RANK = {c: i for i, c in enumerate(meta.get("crop_rank", []))}
ERROR_BAND = meta.get("error_band", {"low": -0.15, "high": 0.15})


app = FastAPI(
    title="Crop Price Prediction API",
    description="One-week-ahead crop price forecasts for KisaanConnect, from AGMARKNET mandi prices",
    version="4.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------
# SCHEMAS
# --------------------------------------------------
class CropPriceInput(BaseModel):
    state:     str           = Field(..., min_length=1, description="e.g. Maharashtra, Gujarat")
    commodity: str           = Field(..., min_length=1, description="e.g. Onion, Tomato, Potato")
    variety:   Optional[str] = Field(None, description="Optional; defaults to the most reported variety in that state")
    quantity:  float         = Field(100, gt=0, description="Quantity in kg, only used for the total value shown")


class PricePredictionResponse(BaseModel):
    predicted_price_per_quintal: float
    price_per_kg:     float
    min_price_per_kg: float
    max_price_per_kg: float
    confidence:       str
    disclaimer:       str
    factors:          Dict[str, Any]


# --------------------------------------------------
# HELPERS
# --------------------------------------------------
def _match(name: str, options) -> Optional[str]:
    """Case- and space-insensitive lookup that returns the canonical spelling."""
    wanted = " ".join(name.split()).casefold()
    for option in options:
        if option.casefold() == wanted:
            return option
    return None


def _crops_for(state: str) -> List[str]:
    crops = COVERAGE.get(state, {})
    return sorted(crops, key=lambda c: (CROP_RANK.get(c, len(CROP_RANK)), c))


def _varieties_for(state: Optional[str], commodity: str) -> List[str]:
    """Most reported variety first."""
    counts: Dict[str, int] = {}
    states = [state] if state else list(COVERAGE)
    for s in states:
        for variety, stats in COVERAGE.get(s, {}).get(commodity, {}).items():
            counts[variety] = counts.get(variety, 0) + stats["rows"]
    return sorted(counts, key=lambda v: (-counts[v], v))


def _confidence(stats: Dict[str, Any]) -> str:
    days = stats.get("s7_days") or 0
    if stats.get("s7") is None:
        return "Low"
    if days >= HIGH_CONFIDENCE_DAYS:
        return "High"
    if days >= MEDIUM_CONFIDENCE_DAYS:
        return "Medium"
    return "Low"


def resolve_input(crop_input: CropPriceInput) -> Dict[str, str]:
    """Map the request onto a combination the data covers, or raise a 422 that says why not."""
    state = _match(crop_input.state, COVERAGE)
    if state is None:
        raise HTTPException(
            422,
            f"No price data for '{crop_input.state}'. Supported states: {', '.join(sorted(COVERAGE))}.",
        )

    commodity = _match(crop_input.commodity, COVERAGE[state])
    if commodity is None:
        suggestions = ", ".join(_crops_for(state)[:8])
        raise HTTPException(
            422,
            f"No recent '{crop_input.commodity}' prices for {state}. Try: {suggestions}.",
        )

    varieties = _varieties_for(state, commodity)
    if crop_input.variety:
        variety = _match(crop_input.variety, varieties)
        if variety is None:
            raise HTTPException(
                422,
                f"No '{crop_input.variety}' {commodity} prices for {state}. Available: {', '.join(varieties)}.",
            )
    else:
        variety = varieties[0]

    return {"state": state, "commodity": commodity, "variety": variety}


def forecast(combo: Dict[str, str], stats: Dict[str, Any]) -> Dict[str, Any]:
    """Run the forecaster on recent state-level prices; fall back to the latest known price."""
    if stats.get("s7") is None and stats.get("s30") is None:
        return {"price": float(stats["latest"]), "based_on": f"latest reports ({stats['latest_date']})"}

    row = pd.DataFrame([{
        **combo,
        "date": pd.Timestamp(meta["forecast_for"]),
        "s7": stats.get("s7"), "s7_days": stats.get("s7_days"), "s30": stats.get("s30"),
        "m7": np.nan, "m30": np.nan,
    }]).astype({"s7": float, "s7_days": float, "s30": float})
    price = float(forecaster.predict(model, row).iloc[0])
    return {"price": price, "based_on": "recent mandi prices"}


# --------------------------------------------------
# ROUTES
# --------------------------------------------------
@app.get("/health")
async def health_check():
    ready = model is not None and bool(COVERAGE)
    return {
        "status": "healthy" if ready else "unhealthy",
        "model_loaded": model is not None,
        "states": len(COVERAGE),
        "data_from": meta.get("date_from"),
        "data_to": meta.get("date_to"),
        "forecast_for": meta.get("forecast_for"),
    }


@app.get("/options")
async def get_options(state: Optional[str] = None):
    """All supported states, plus crops (for one state when ?state= is given, else the 30 most common)."""
    states = sorted(COVERAGE)
    if state:
        matched = _match(state, COVERAGE)
        if matched is None:
            raise HTTPException(404, f"No price data for '{state}'.")
        commodities = _crops_for(matched)
    else:
        commodities = meta.get("crop_rank", [])[:30]
    return {
        "states": states,
        "commodities": commodities,
        "data_from": meta.get("date_from"),
        "data_to": meta.get("date_to"),
    }


@app.get("/varieties")
async def get_varieties(commodity: str, state: Optional[str] = None):
    """Varieties for a crop, most reported first. Pass ?state= to limit to one state."""
    matched_state = _match(state, COVERAGE) if state else None
    if state and matched_state is None:
        raise HTTPException(404, f"No price data for '{state}'.")
    all_crops = {c for crops in COVERAGE.values() for c in crops}
    matched_crop = _match(commodity, all_crops) or commodity
    return {
        "commodity": matched_crop,
        "state": matched_state,
        "varieties": _varieties_for(matched_state, matched_crop),
    }


@app.get("/crops")
async def supported_crops():
    """Kept for backward compatibility with older frontend code."""
    return await get_options()


@app.post("/predict", response_model=PricePredictionResponse)
async def predict_price(crop_input: CropPriceInput):
    if model is None or not COVERAGE:
        raise HTTPException(503, "Model not loaded")

    combo = resolve_input(crop_input)
    stats = COVERAGE[combo["state"]][combo["commodity"]][combo["variety"]]

    try:
        result = forecast(combo, stats)
    except Exception:
        raise HTTPException(500, "Prediction failed. Please check your inputs and try again.")

    predicted = result["price"]
    if predicted <= 0 or not np.isfinite(predicted):
        raise HTTPException(422, "Model produced an invalid price for these inputs")

    # AGMARKNET prices are per quintal (100 kg). The range is where half of actual
    # mandi prices landed around the forecast when it was tested (see error_band in the meta).
    price_per_kg = round(predicted / 100, 2)
    low = predicted * float(np.exp(ERROR_BAND["low"]))
    high = predicted * float(np.exp(ERROR_BAND["high"]))
    last_week = stats.get("s7")

    return PricePredictionResponse(
        predicted_price_per_quintal=round(predicted, 2),
        price_per_kg=price_per_kg,
        min_price_per_kg=round(low / 100, 2),
        max_price_per_kg=round(high / 100, 2),
        confidence=_confidence(stats),
        disclaimer=(
            f"Forecast for the week of {meta.get('forecast_for')} from AGMARKNET mandi prices up to "
            f"{meta.get('date_to')}. Check today's local mandi rate before selling."
        ),
        factors={
            **combo,
            "quantity_kg": crop_input.quantity,
            "estimated_total_value": round(price_per_kg * crop_input.quantity, 2),
            "mandi_reports": stats["rows"],
            "last_week_price_per_kg": round(last_week / 100, 2) if last_week else None,
            "based_on": result["based_on"],
            "forecast_for": meta.get("forecast_for"),
            "data_window": f"{meta.get('date_from')} to {meta.get('date_to')}",
        },
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("prediction_api:app", host="0.0.0.0", port=8001, reload=True)
