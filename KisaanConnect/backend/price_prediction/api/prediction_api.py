import os
import sys
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional, Dict, Any, List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# --------------------------------------------------
# PATH SETUP
# --------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_DIR = BASE_DIR / "models"
DATA_PATH = BASE_DIR / "data" / "real_mandi_data.csv"

model_path           = MODEL_DIR / "crop_price_model.joblib"
feature_columns_path = MODEL_DIR / "feature_columns.joblib"

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

try:
    model = joblib.load(model_path)
    feature_columns = joblib.load(feature_columns_path)
    print("Model loaded successfully")
except Exception as e:
    print(f"Model load failed: {e}")
    model = None
    feature_columns = None

try:
    _reference_df = pd.read_csv(DATA_PATH)
except Exception as e:
    print(f"Reference data load failed: {e}")
    _reference_df = pd.DataFrame(columns=["State", "Commodity", "Variety", "Modal_x0020_Price"])


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(
    title="Crop Price Prediction API",
    description="ML-based crop price prediction for KisaanConnect, trained on real AGMARKNET mandi data",
    version="2.0.0",
    lifespan=lifespan
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
    state:     str            = Field(..., description="e.g. Gujarat, Punjab")
    commodity: str            = Field(..., description="e.g. Tomato, Onion, Potato")
    variety:   Optional[str]  = Field(None, description="Optional — defaults to most common variety for this commodity")
    quantity:  float          = Field(100, gt=0, description="Quantity in kg, used only to scale the total value shown")


class PricePredictionResponse(BaseModel):
    predicted_price_per_quintal: float
    price_per_kg:    float
    min_price_per_kg: float
    max_price_per_kg: float
    confidence:      str
    disclaimer:      str
    factors:         Dict[str, Any]


# --------------------------------------------------
# HELPERS
# --------------------------------------------------
def _default_variety(commodity: str) -> str:
    subset = _reference_df[_reference_df["Commodity"] == commodity]
    if subset.empty:
        return "Other"
    return subset["Variety"].mode().iloc[0]


def _sample_size_confidence(commodity: str, state: str) -> str:
    n = len(_reference_df[
        (_reference_df["Commodity"] == commodity) & (_reference_df["State"] == state)
    ])
    if n >= 5:
        return "High"
    if n >= 1:
        return "Medium"
    return "Low"


# --------------------------------------------------
# ROUTES
# --------------------------------------------------
@app.get("/health")
async def health_check():
    return {"status": "healthy" if model else "unhealthy", "model_loaded": model is not None}


@app.get("/options")
async def get_options():
    states = sorted(_reference_df["State"].dropna().unique().tolist())
    commodities = _reference_df["Commodity"].value_counts().head(30).index.tolist()
    return {"states": states, "commodities": commodities}


@app.get("/varieties")
async def get_varieties(commodity: str):
    subset = _reference_df[_reference_df["Commodity"] == commodity]
    varieties = sorted(subset["Variety"].dropna().unique().tolist())
    return {"commodity": commodity, "varieties": varieties}


@app.get("/crops")
async def supported_crops():
    """Kept for backward compatibility with older frontend code."""
    return await get_options()


@app.post("/predict", response_model=PricePredictionResponse)
async def predict_price(crop_input: CropPriceInput):
    if model is None:
        raise HTTPException(503, "Model not loaded")

    try:
        variety = crop_input.variety or _default_variety(crop_input.commodity)

        input_data = pd.DataFrame([{
            "State":     crop_input.state,
            "Commodity": crop_input.commodity,
            "Variety":   variety,
        }])

        predicted_price = float(model.predict(input_data)[0])
        if predicted_price <= 0 or not np.isfinite(predicted_price):
            raise HTTPException(422, "Model produced an invalid price for these inputs")

        # AGMARKNET prices are reported per quintal (100kg)
        price_per_kg = round(predicted_price / 100, 2)
        confidence = _sample_size_confidence(crop_input.commodity, crop_input.state)
        margin = {"High": 0.10, "Medium": 0.18, "Low": 0.28}.get(confidence, 0.20)
        min_price_per_kg = round(price_per_kg * (1 - margin), 2)
        max_price_per_kg = round(price_per_kg * (1 + margin), 2)

        return PricePredictionResponse(
            predicted_price_per_quintal=round(predicted_price, 2),
            price_per_kg=price_per_kg,
            min_price_per_kg=min_price_per_kg,
            max_price_per_kg=max_price_per_kg,
            confidence=confidence,
            disclaimer="Estimate based on real AGMARKNET mandi data (single-day sample, May 2025). Verify against today's local mandi rate before selling.",
            factors={
                "state": crop_input.state,
                "commodity": crop_input.commodity,
                "variety": variety,
                "quantity_kg": crop_input.quantity,
                "estimated_total_value": round(price_per_kg * crop_input.quantity, 2),
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, "Prediction failed. Please check your inputs and try again.")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("prediction_api:app", host="0.0.0.0", port=8001, reload=True)
