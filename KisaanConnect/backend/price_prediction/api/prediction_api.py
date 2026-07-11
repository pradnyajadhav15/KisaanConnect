import os
import sys
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional, Dict, Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# --------------------------------------------------
# PATH SETUP
# --------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_DIR = BASE_DIR / "models"

model_path           = MODEL_DIR / "crop_price_model.joblib"
feature_columns_path = MODEL_DIR / "feature_columns.joblib"

sys.path.append(str(BASE_DIR))

model = None
feature_columns = None

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")


@asynccontextmanager
async def lifespan(app: FastAPI):
    global model, feature_columns
    try:
        model = joblib.load(model_path)
        feature_columns = joblib.load(feature_columns_path)
        print("Model loaded successfully")
    except Exception as e:
        print(f"Model load failed: {e}")
        model = None
        feature_columns = None
    yield
    model = None
    feature_columns = None


app = FastAPI(
    title="Crop Price Prediction API",
    description="ML-based crop price prediction for KisaanConnect",
    version="1.0.0",
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
    crop_name:    str   = Field(..., description="e.g. Rice, Wheat, Potato")
    quantity:     float = Field(..., gt=0, description="Quantity in kg")
    season:       str   = Field(..., description="Kharif / Rabi / Zaid")
    region:       str   = Field(..., description="Region where crop is grown")
    rain_fall:    Optional[float] = Field(None, description="Rainfall in mm")
    temperature:  Optional[float] = Field(None, description="Temperature in °C")
    soil_quality: Optional[str]   = Field(None, description="High / Medium / Low")


class PricePredictionResponse(BaseModel):
    predicted_price: float
    price_per_kg:    float
    min_price:       float
    max_price:       float
    median_price:    float
    confidence:      str
    inputs_used:     int
    disclaimer:      str
    factors:         Dict[str, Any]


# --------------------------------------------------
# HELPERS
# --------------------------------------------------
def _data_completeness(rain_fall, temperature, soil_quality) -> str:
    """
    HONEST label: this reflects how COMPLETE the farmer's inputs are,
    NOT how accurate the prediction is. Naming it 'data completeness'
    rather than 'confidence' so it can't be mistaken for model certainty.
    """
    provided = sum(v is not None for v in [rain_fall, temperature, soil_quality])
    return {3: "High", 2: "Medium", 1: "Low", 0: "Low"}[provided]


def _range_from_model(price: float, completeness: str):
    """
    Range width. NOTE: this is a heuristic band, not a statistically
    derived prediction interval. See chat — a quantile/interval model
    is the real fix. Wider band when inputs are sparse, as a hedge.
    """
    margin = {"High": 0.10, "Medium": 0.15, "Low": 0.22}.get(completeness, 0.15)
    return round(price * (1 - margin), 2), round(price * (1 + margin), 2)


# --------------------------------------------------
# ROUTES
# --------------------------------------------------
@app.get("/health")
async def health_check():
    return {"status": "healthy" if model else "unhealthy", "model_loaded": model is not None}


@app.get("/crops")
async def supported_crops():
    return {
        "crops":   ["Rice", "Wheat", "Tomato", "Potato", "Onion", "Maize", "Sugarcane"],
        "seasons": ["Kharif", "Rabi", "Zaid"],
        "soil_quality": ["High", "Medium", "Low"]
    }


@app.post("/predict", response_model=PricePredictionResponse)
async def predict_price(crop_input: CropPriceInput):
    if model is None:
        raise HTTPException(503, "Model not loaded")

    try:
        input_data = pd.DataFrame([{
            "crop_name":    crop_input.crop_name,
            "quantity":     crop_input.quantity,
            "season":       crop_input.season,
            "region":       crop_input.region,
            "rain_fall":    crop_input.rain_fall   if crop_input.rain_fall   is not None else 0,
            "temperature":  crop_input.temperature if crop_input.temperature is not None else 0,
            "soil_quality": crop_input.soil_quality or "Medium",
        }])

        predicted_price = float(model.predict(input_data)[0])
        if predicted_price <= 0 or not np.isfinite(predicted_price):
            raise HTTPException(422, "Model produced an invalid price for these inputs")

        price_per_kg = round(predicted_price / crop_input.quantity, 2)
        completeness = _data_completeness(crop_input.rain_fall, crop_input.temperature, crop_input.soil_quality)
        min_price, max_price = _range_from_model(predicted_price, completeness)
        median_price = round((min_price + max_price) / 2, 2)
        inputs_used = sum(v is not None for v in
                          [crop_input.rain_fall, crop_input.temperature, crop_input.soil_quality])

        return PricePredictionResponse(
            predicted_price=round(predicted_price, 2),
            price_per_kg=price_per_kg,
            min_price=min_price,
            max_price=max_price,
            median_price=median_price,
            confidence=completeness,
            inputs_used=inputs_used,
            disclaimer="Estimate based on historical patterns. Verify against today's local mandi rate before selling.",
            factors={
                "crop_type": crop_input.crop_name,
                "quantity":  crop_input.quantity,
                "season":    crop_input.season,
                "region":    crop_input.region,
                "weather":   {"rain_fall": crop_input.rain_fall, "temperature": crop_input.temperature},
                "soil_quality": crop_input.soil_quality,
            }
        )

    except HTTPException:
        raise
    except Exception:
        # Don't leak internals to the client; log server-side instead.
        raise HTTPException(500, "Prediction failed. Please check your inputs and try again.")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("prediction_api:app", host="0.0.0.0", port=8001, reload=True)