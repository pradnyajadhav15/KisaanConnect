# KisaanConnect Backend

This is the backend for the KisaanConnect Farmer-to-Consumer Marketplace application. It provides APIs for crop price prediction using machine learning.

## Tech Stack

- **Framework**: FastAPI
- **Database**: SQLite
- **ML Library**: scikit-learn
- **Language**: Python 3.8+

## Directory Structure

```
backend/
├── price_prediction/         # Price prediction service
│   ├── api/                  # API endpoints
│   ├── data/                 # Data files
│   └── models/               # ML models
├── main.py                   # Main FastAPI application
├── requirements.txt          # Dependencies
├── train_price_model.py      # Script to train the model
└── run_app.bat               # Windows batch file to start the application
```

## Setup Instructions

### 1. Clone the repository

```bash
git clone <repository-url>
cd <repository-directory>/backend
```

### 2. Create a virtual environment (optional but recommended)

```bash
python -m venv venv
venv\Scripts\activate  # On Windows
source venv/bin/activate  # On Linux/Mac
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Train the price prediction model

```bash
python train_price_model.py
```

### 5. Start the server

```bash
python main.py
```

Or on Windows, you can run the batch file:

```bash
run_app.bat
```

## API Documentation

Once the server is running, you can access the API documentation at:

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Price Prediction API

The price prediction API provides endpoints to predict crop prices based on various factors.

### Endpoints

- **GET** `/price-prediction/health`: Health check endpoint
- **POST** `/price-prediction/predict`: Predicts crop price based on input parameters

### Example API Request

```json
POST /price-prediction/predict

{
  "crop_name": "Rice",
  "quantity": 100,
  "season": "Kharif",
  "region": "Punjab",
  "rain_fall": 250.5,
  "temperature": 30.2,
  "soil_quality": "High"
}
```

### Example API Response

```json
{
  "predicted_price": 3200.50,
  "price_per_kg": 32.01,
  "min_price": 2880.45,
  "max_price": 3520.55,
  "confidence": "High",
  "factors": {
    "crop_type": "Rice",
    "quantity": 100,
    "season": "Kharif",
    "region": "Punjab",
    "weather_conditions": {
      "rain_fall": 250.5,
      "temperature": 30.2
    },
    "soil_quality": "High"
  }
}
``` 