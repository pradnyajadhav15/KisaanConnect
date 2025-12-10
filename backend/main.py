import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
import sys

# --------------------------------------------------
# 1️⃣ PATH SETUP
# --------------------------------------------------
# Add backend directory to system path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))


# --------------------------------------------------
# 2️⃣ IMPORT MODULE ROUTERS
# --------------------------------------------------

# ✅ Price Prediction API
from price_prediction.api.prediction_api import app as price_prediction_app

# ✅ Authentication Router
from auth.auth_api import router as auth_router

# ✅ Farmer Dashboard Router (Optional)
try:
    from farmer.dashboard_api import router as farmer_router
    farmer_module_available = True
except ImportError:
    farmer_module_available = False

# ✅ Consumer Dashboard Router (Optional)
try:
    from consumer.dashboard_api import router as consumer_router
    consumer_module_available = True
except ImportError:
    consumer_module_available = False


# --------------------------------------------------
# 3️⃣ CREATE FASTAPI APP
# --------------------------------------------------
app = FastAPI(
    title="KisaanConnect API",
    description="Backend API for KisaanConnect - A Farmer to Consumer Marketplace",
    version="1.0.0"
)


# --------------------------------------------------
# 4️⃣ CORS CONFIGURATION
# --------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # For development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------
# 5️⃣ REGISTER ROUTERS
# --------------------------------------------------

# ✅ Authentication Routes
app.include_router(auth_router, prefix="/auth", tags=["authentication"])

# ✅ Price Prediction API
app.mount("/price-prediction", price_prediction_app)

# ✅ Farmer API (Only if available)
if farmer_module_available:
    app.include_router(farmer_router, prefix="/farmer", tags=["farmer"])

# ✅ Consumer API (Only if available)
if consumer_module_available:
    app.include_router(consumer_router, prefix="/consumer", tags=["consumer"])


# --------------------------------------------------
# 6️⃣ ROOT API ENDPOINT
# --------------------------------------------------
@app.get("/")
async def root():
    services = [
        {
            "name": "Authentication",
            "endpoint": "/auth",
            "description": "User authentication and registration"
        },
        {
            "name": "Price Prediction",
            "endpoint": "/price-prediction",
            "description": "ML-based crop price prediction"
        }
    ]

    if farmer_module_available:
        services.append({
            "name": "Farmer Dashboard",
            "endpoint": "/farmer",
            "description": "Farmer crop management and dashboard"
        })

    if consumer_module_available:
        services.append({
            "name": "Consumer Dashboard",
            "endpoint": "/consumer",
            "description": "Consumer marketplace and orders"
        })

    return {
        "message": "✅ Welcome to KisaanConnect API",
        "services": services
    }


# --------------------------------------------------
# 7️⃣ HEALTH CHECK API
# --------------------------------------------------
@app.get("/health")
async def health_check():
    return {"status": "✅ Healthy"}


# --------------------------------------------------
# 8️⃣ SERVER STARTUP
# --------------------------------------------------
if __name__ == "__main__":

    # ✅ Setup Database
    from auth.db_setup import create_tables, add_test_users
    create_tables()
    add_test_users()

    # ✅ Start Server
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
