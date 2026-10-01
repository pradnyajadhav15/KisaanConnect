"""
The price forecaster: predicts a mandi's modal price one week ahead from recent prices.

It doesn't predict the price directly. It predicts how far the price will move from
the most recent known price (see features.reference_price), as a log ratio, and
multiplies back. That lets it follow trends that a fixed per-crop average can't.

Saved artifact (joblib): {"model": HistGradientBoostingRegressor, "categories": {...}}
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor

from price_prediction.features import category_levels, model_frame, reference_price


def build_model() -> HistGradientBoostingRegressor:
    return HistGradientBoostingRegressor(
        loss="absolute_error",      # median-style forecasts; matches how we score (MAE)
        max_iter=300,
        learning_rate=0.1,
        max_leaf_nodes=31,
        min_samples_leaf=100,
        categorical_features="from_dtype",
        early_stopping=False,
        random_state=42,
    )


def trainable_rows(df: pd.DataFrame) -> pd.DataFrame:
    ref, _ = reference_price(df)
    return df[ref.notna()]


def fit(df: pd.DataFrame) -> dict:
    """df must already have recent-price columns (features.add_recent_price_features)."""
    rows = trainable_rows(df)
    categories = category_levels(rows)
    ref, _ = reference_price(rows)
    y = np.log(rows["modal_price"].to_numpy()) - np.log(ref.to_numpy())
    model = build_model().fit(model_frame(rows, categories), y)
    return {"model": model, "categories": categories}


def predict(artifact: dict, df: pd.DataFrame) -> pd.Series:
    """Forecast price per row (Rs/quintal); NaN where there is no recent price to start from."""
    ref, _ = reference_price(df)
    out = pd.Series(np.nan, index=df.index)
    ok = ref.notna()
    if ok.any():
        X = model_frame(df[ok], artifact["categories"])
        out[ok] = ref[ok].to_numpy() * np.exp(artifact["model"].predict(X))
    return out
