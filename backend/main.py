import os
import sys
from pathlib import Path

# --------------------------------------------------
# LOAD ENV FIRST — before any import that reads env vars (e.g. JWT_SECRET)
# --------------------------------------------------
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent / ".env")

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

# --------------------------------------------------
# PATH SETUP
# --------------------------------------------------
sys.path.append(str(Path(__file__).resolve().parent))

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

# --------------------------------------------------
# IMPORT ROUTERS
# --------------------------------------------------
from auth.auth_api import router as auth_router
from price_prediction.api.prediction_api import app as price_prediction_app

farmer_router = None
consumer_router = None
ai_router = None
ai_assistant_router = None

try:
    from farmer.dashboard_api import router as farmer_router
except ImportError as e:
    print(f"Farmer module not loaded: {e}")

try:
    from consumer.dashboard_api import router as consumer_router
except ImportError as e:
    print(f"Consumer module not loaded: {e}")

try:
    from ai.crop_health_api import router as ai_router
except ImportError as e:
    print(f"AI crop-health module not loaded: {e}")

try:
    from ai.assistant_api import router as ai_assistant_router
except ImportError as e:
    print(f"AI assistant module not loaded: {e}")


# --------------------------------------------------
# LIFESPAN — DB setup on startup
# --------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    from auth.db_setup import create_tables, add_test_users
    create_tables()
    add_test_users()
    print("Database ready")
    yield


# --------------------------------------------------
# APP
# --------------------------------------------------
app = FastAPI(
    title="KisaanConnect API",
    description="Backend API for KisaanConnect — Farmer to Consumer Marketplace",
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
# ROUTERS
# --------------------------------------------------
app.include_router(auth_router, prefix="/auth", tags=["Authentication"])
app.mount("/price-prediction", price_prediction_app)

if farmer_router:
    app.include_router(farmer_router, prefix="/farmer", tags=["Farmer"])

if consumer_router:
    app.include_router(consumer_router, prefix="/consumer", tags=["Consumer"])

if ai_router:
    app.include_router(ai_router, prefix="/ai", tags=["AI"])

if ai_assistant_router:
    app.include_router(ai_assistant_router, prefix="/ai", tags=["AI"])


# --------------------------------------------------
# ROOT
# --------------------------------------------------
@app.get("/")
async def root():
    services = [
        {"name": "Authentication",    "endpoint": "/auth",             "status": "ok"},
        {"name": "Price Prediction",  "endpoint": "/price-prediction", "status": "ok"},
        {"name": "Farmer Dashboard",  "endpoint": "/farmer",   "status": "ok" if farmer_router   else "unavailable"},
        {"name": "Consumer Dashboard","endpoint": "/consumer", "status": "ok" if consumer_router else "unavailable"},
        {"name": "AI Crop Health",    "endpoint": "/ai",       "status": "ok" if ai_router       else "unavailable"},
        {"name": "AI Assistant",      "endpoint": "/ai",       "status": "ok" if ai_assistant_router else "unavailable"},
    ]
    return {"message": "Welcome to KisaanConnect API", "services": services}


# --------------------------------------------------
# HEALTH CHECK
# --------------------------------------------------
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "modules": {
            "auth":             True,
            "price_prediction": True,
            "farmer":           farmer_router is not None,
            "consumer":         consumer_router is not None,
            "ai_crop_health":   ai_router is not None,
            "ai_assistant":     ai_assistant_router is not None,
        }
    }


# --------------------------------------------------
# RUN
# --------------------------------------------------
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)