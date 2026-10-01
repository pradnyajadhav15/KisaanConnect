"""
Train the crop price model.

Data:     price_prediction/data/mandi_history.csv.gz (built by data/build_dataset.py)
Window:   only the most recent TRAIN_WINDOW_DAYS of data, so predictions reflect
          current prices instead of a blend with last year's.
Features: state, commodity, variety (one-hot)
Target:   modal price, Rs per quintal

Outputs (both committed, both loaded by api/prediction_api.py):
  models/crop_price_model.joblib  the fitted pipeline
  models/model_meta.json          what the model has seen: states, crops, varieties,
                                  row counts, observed price ranges and the date range.
                                  The API uses it to refuse inputs the model never saw.

Run from KisaanConnect/backend:
    python train_price_model.py
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import pandas as pd
import sklearn
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_PATH = BASE_DIR / "data" / "mandi_history.csv.gz"
MODEL_DIR = BASE_DIR / "models"
MODEL_PATH = MODEL_DIR / "crop_price_model.joblib"
META_PATH = MODEL_DIR / "model_meta.json"

FEATURES = ["state", "commodity", "variety"]
TARGET = "modal_price"
TRAIN_WINDOW_DAYS = 90

# Training fails unless every state listed here has at least MIN_CROPS crops
# with at least MIN_ROWS_PER_CROP rows each. Add states here as the app grows.
REQUIRED_STATES = ["Maharashtra"]
MIN_CROPS = 20
MIN_ROWS_PER_CROP = 30

# 100 trees keeps the compressed model around 15 MB, safe for GitHub and Railway.
N_ESTIMATORS = 100


def load_training_window(path: Path = DATA_PATH, window_days: int = TRAIN_WINDOW_DAYS) -> pd.DataFrame:
    if not path.exists():
        sys.exit(f"{path} not found. Run: python -m price_prediction.data.build_dataset --download")
    df = pd.read_csv(path, parse_dates=["date"], low_memory=False)
    df = df.dropna(subset=FEATURES + [TARGET])
    df = df[df[TARGET] > 0]
    cutoff = df["date"].max() - pd.Timedelta(days=window_days)
    return df[df["date"] >= cutoff].copy()


def check_coverage(df: pd.DataFrame) -> list[str]:
    """Return a list of problems; empty means coverage is good enough to ship."""
    problems = []
    for state in REQUIRED_STATES:
        counts = df.loc[df["state"] == state, "commodity"].value_counts()
        covered = int((counts >= MIN_ROWS_PER_CROP).sum())
        if covered < MIN_CROPS:
            problems.append(
                f"{state}: only {covered} crops have {MIN_ROWS_PER_CROP}+ rows (need {MIN_CROPS})"
            )
    return problems


def build_pipeline() -> Pipeline:
    return Pipeline(steps=[
        ("preprocessor", ColumnTransformer(
            transformers=[("cat", OneHotEncoder(handle_unknown="ignore"), FEATURES)]
        )),
        ("regressor", RandomForestRegressor(
            n_estimators=N_ESTIMATORS,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1,
        )),
    ])


def build_meta(df: pd.DataFrame) -> dict:
    """Everything the API needs at runtime, so it never has to load the training data."""
    grouped = (
        df.groupby(FEATURES)[TARGET]
        .agg(rows="size", p25=lambda s: s.quantile(0.25), median="median", p75=lambda s: s.quantile(0.75))
        .reset_index()
    )
    states: dict = {}
    for row in grouped.itertuples(index=False):
        states.setdefault(row.state, {}).setdefault(row.commodity, {})[row.variety] = {
            "rows": int(row.rows),
            "p25": round(float(row.p25), 2),
            "median": round(float(row.median), 2),
            "p75": round(float(row.p75), 2),
        }

    # Crops ordered by how much data there is, so dropdowns show common crops first.
    crop_rank = df["commodity"].value_counts().index.tolist()

    return {
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sklearn_version": sklearn.__version__,
        "features": FEATURES,
        "target": TARGET,
        "unit": "Rs/quintal",
        "train_window_days": TRAIN_WINDOW_DAYS,
        "date_from": df["date"].min().strftime("%Y-%m-%d"),
        "date_to": df["date"].max().strftime("%Y-%m-%d"),
        "train_rows": int(len(df)),
        "crop_rank": crop_rank,
        "states": dict(sorted(states.items())),
    }


def train_model():
    df = load_training_window()
    print(f"Training rows: {len(df):,} ({df['date'].min().date()} to {df['date'].max().date()})")

    problems = check_coverage(df)
    if problems:
        raise RuntimeError("Coverage check failed:\n  " + "\n  ".join(problems))

    model = build_pipeline()
    model.fit(df[FEATURES], df[TARGET])

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH, compress=3)
    meta = build_meta(df)
    META_PATH.write_text(json.dumps(meta, indent=1, ensure_ascii=False), encoding="utf-8")
    return model, meta


if __name__ == "__main__":
    _, meta = train_model()
    print(f"Saved {MODEL_PATH.name} and {META_PATH.name}")
