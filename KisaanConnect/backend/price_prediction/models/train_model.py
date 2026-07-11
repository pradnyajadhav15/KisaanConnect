import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

# --------------------------------------------------
# PATH SETUP
# --------------------------------------------------

BASE_DIR   = Path(__file__).resolve().parent.parent
DATA_DIR   = BASE_DIR / "data"
MODEL_DIR  = Path(__file__).resolve().parent

DATA_PATH  = DATA_DIR / "crop_price_prediction_200_records.csv"
MODEL_PATH = MODEL_DIR / "crop_price_model.joblib"
FEAT_PATH  = MODEL_DIR / "feature_columns.joblib"

TARGET_COL = "price"


# --------------------------------------------------
# TRAIN
# --------------------------------------------------

def train_model():
    # Load dataset
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Dataset not found at: {DATA_PATH}")

    data = pd.read_csv(DATA_PATH)
    print(f"Dataset loaded - shape: {data.shape}")
    print(data.head())
    print("\nMissing values:\n", data.isnull().sum())

    # Handle missing values (no inplace)
    for col in data.select_dtypes(include=["int64", "float64"]).columns:
        if data[col].isnull().any():
            data[col] = data[col].fillna(data[col].median())

    for col in data.select_dtypes(include=["object"]).columns:
        if data[col].isnull().any():
            data[col] = data[col].fillna(data[col].mode()[0])

    # Features & target
    if TARGET_COL not in data.columns:
        raise ValueError(f"Target column '{TARGET_COL}' not found. Columns: {data.columns.tolist()}")

    X = data.drop(columns=[TARGET_COL])
    y = data[TARGET_COL]

    numeric_cols     = X.select_dtypes(include=["int64", "float64"]).columns.tolist()
    categorical_cols = X.select_dtypes(include=["object"]).columns.tolist()

    print(f"\nNumeric features:     {numeric_cols}")
    print(f"Categorical features: {categorical_cols}")
    print(f"Target:               {TARGET_COL}")

    # Preprocessing
    preprocessor = ColumnTransformer([
        ("num", Pipeline([("scaler", StandardScaler())]),           numeric_cols),
        ("cat", Pipeline([("onehot", OneHotEncoder(handle_unknown="ignore"))]), categorical_cols),
    ])

    # Model pipeline
    model = Pipeline([
        ("preprocessor", preprocessor),
        ("regressor", RandomForestRegressor(
            n_estimators=100,
            random_state=42,
            n_jobs=-1          # use all CPU cores
        )),
    ])

    # Train / test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    print("\nTraining model...")
    model.fit(X_train, y_train)

    # Evaluate
    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    r2  = r2_score(y_test, y_pred)
    print(f"\nMAE : Rs.{mae:.2f}")
    print(f"R^2 : {r2:.4f}")

    # Feature importance
    try:
        ohe_features = (
            model.named_steps["preprocessor"]
                 .named_transformers_["cat"]
                 .named_steps["onehot"]
                 .get_feature_names_out(categorical_cols)
                 .tolist()
        )
        feature_names = numeric_cols + ohe_features
        importances   = model.named_steps["regressor"].feature_importances_
        top_indices   = np.argsort(importances)[::-1][:10]

        print("\nTop 10 feature importances:")
        for i in top_indices:
            print(f"  {feature_names[i]:30s}  {importances[i]:.4f}")
    except Exception as e:
        print(f"\nCould not compute feature importance: {e}")

    # Save model & feature columns
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    print(f"\nModel saved       -> {MODEL_PATH}")

    joblib.dump({"numeric_features": numeric_cols, "categorical_features": categorical_cols}, FEAT_PATH)
    print(f"Feature cols saved -> {FEAT_PATH}")

    return model, mae, r2


# --------------------------------------------------
# MAIN
# --------------------------------------------------

if __name__ == "__main__":
    model, mae, r2 = train_model()
    print("\nTraining complete")
