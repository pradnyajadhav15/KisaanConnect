"""
Train crop price prediction model on real AGMARKNET mandi data.
Inputs: State, Market, Commodity, Variety
Target: Modal_Price (the settled/typical price on that day)
"""
import pandas as pd
import numpy as np
import joblib
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_PATH = BASE_DIR / "data" / "real_mandi_data.csv"
MODEL_DIR = BASE_DIR / "models"

CATEGORICAL_FEATURES = ["State", "Commodity", "Variety"]
NUMERIC_FEATURES = []  # none for now — real data has no reliable numeric predictor besides categoricals
TARGET = "Modal_x0020_Price"


def train_model():
    df = pd.read_csv(DATA_PATH)

    # Basic cleaning
    df = df.dropna(subset=CATEGORICAL_FEATURES + [TARGET])
    df = df[df[TARGET] > 0]

    X = df[CATEGORICAL_FEATURES]
    y = df[TARGET]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    preprocessor = ColumnTransformer(
        transformers=[
            ("cat", OneHotEncoder(handle_unknown="ignore"), CATEGORICAL_FEATURES),
        ]
    )

    model = Pipeline(steps=[
        ("preprocessor", preprocessor),
        ("regressor", RandomForestRegressor(
            n_estimators=200,
            max_depth=12,
            random_state=42,
            n_jobs=-1,
        )),
    ])

    model.fit(X_train, y_train)

    preds = model.predict(X_test)
    mae = mean_absolute_error(y_test, preds)
    r2 = r2_score(y_test, preds)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_DIR / "crop_price_model.joblib")
    joblib.dump(CATEGORICAL_FEATURES, MODEL_DIR / "feature_columns.joblib")

    return model, mae, r2


if __name__ == "__main__":
    model, mae, r2 = train_model()
    print(f"MAE: Rs.{mae:.2f}")
    print(f"R2: {r2:.4f}")