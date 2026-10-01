"""
Train the crop price forecaster used by the app.

Data:     price_prediction/data/mandi_history.csv.gz (built by data/build_dataset.py)
Model:    models/forecaster.py, which forecasts a mandi price one week ahead from recent
          prices (see evaluation/REPORT.md for how it compares with simple rules)
Coverage: the app only offers state / crop / variety combinations reported in the last
          COVERAGE_WINDOW_DAYS of data

Outputs (both committed, both loaded by api/prediction_api.py):
  models/crop_price_model.joblib  {"model": ..., "categories": ...}
  models/model_meta.json          the combinations the app offers, with the recent prices
                                  the API feeds the model, plus the typical error range

Run from KisaanConnect/backend:
    python train_price_model.py
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(BASE_DIR.parent))

from price_prediction import features as F  # noqa: E402
from price_prediction.models import forecaster  # noqa: E402

DATA_PATH = BASE_DIR / "data" / "mandi_history.csv.gz"
MODEL_DIR = BASE_DIR / "models"
MODEL_PATH = MODEL_DIR / "crop_price_model.joblib"
META_PATH = MODEL_DIR / "model_meta.json"

COVERAGE_WINDOW_DAYS = 90
HOLDOUT_DAYS = 14          # used only to measure the error range shown in the app

# Training fails unless every state listed here has at least MIN_CROPS crops
# with at least MIN_ROWS_PER_CROP reports in the coverage window.
REQUIRED_STATES = ["Maharashtra"]
MIN_CROPS = 20
MIN_ROWS_PER_CROP = 30


def load_history(path: Path = DATA_PATH) -> pd.DataFrame:
    if not path.exists():
        sys.exit(f"{path} not found. Run: python -m price_prediction.data.build_dataset --download")
    df = pd.read_csv(path, parse_dates=["date"], low_memory=False)
    df = df.dropna(subset=F.STATE_KEY + ["modal_price"])
    # The single-day May 2025 pull has no surrounding history to learn trends from.
    return df[(df["modal_price"] > 0) & (df["source"] != "datagovin_2025_05_19")].reset_index(drop=True)


def check_coverage(recent: pd.DataFrame) -> list[str]:
    """Return a list of problems; empty means coverage is good enough to ship."""
    problems = []
    for state in REQUIRED_STATES:
        counts = recent.loc[recent["state"] == state, "commodity"].value_counts()
        covered = int((counts >= MIN_ROWS_PER_CROP).sum())
        if covered < MIN_CROPS:
            problems.append(f"{state}: only {covered} crops have {MIN_ROWS_PER_CROP}+ reports (need {MIN_CROPS})")
    return problems


def state_level_inputs(history: pd.DataFrame, combos: pd.DataFrame, target_date: pd.Timestamp) -> pd.DataFrame:
    """Recent state-level prices for each combo as the app will see them: a forecast for target_date."""
    rows = combos.copy()
    rows["date"] = target_date
    rows["market"] = "__state__"          # no mandi in an app request, so m7/m30 stay empty
    with_prices = F.add_recent_price_features(rows, history=history)
    return with_prices[F.STATE_KEY + ["s7", "s7_days", "s30"]]


def error_band(history: pd.DataFrame) -> dict:
    """Typical forecast error for state-level forecasts, measured on the last HOLDOUT_DAYS."""
    cutoff = history["date"].max() - pd.Timedelta(days=HOLDOUT_DAYS)
    train = history[history["date"] <= cutoff]
    test = history[history["date"] > cutoff].copy()
    # Score the way the app forecasts: from state-level prices only.
    test["m7"] = np.nan
    test["m30"] = np.nan
    test = test[test["s7"].notna() | test["s30"].notna()]
    pred = forecaster.predict(forecaster.fit(train), test)
    log_err = np.log(test["modal_price"] / pred).dropna()
    return {
        "low": round(float(log_err.quantile(0.25)), 4),
        "high": round(float(log_err.quantile(0.75)), 4),
        "measured_on": f"{(cutoff + pd.Timedelta(days=1)).date()} to {history['date'].max().date()}",
        "rows": int(len(log_err)),
        "median_abs_pct_error": round(float((np.exp(log_err.abs()) - 1).median() * 100), 1),
    }


def build_meta(history: pd.DataFrame, recent: pd.DataFrame, band: dict) -> dict:
    date_to = history["date"].max()
    target = date_to + pd.Timedelta(days=F.HORIZON_DAYS)

    counts = recent.groupby(F.STATE_KEY).size().rename("rows").reset_index()
    inputs = state_level_inputs(history, counts[F.STATE_KEY], target)

    weekly = F.weekly_medians(history, F.STATE_KEY)
    latest = (
        weekly.sort_values("date").groupby(F.STATE_KEY, observed=True).tail(1)
        [F.STATE_KEY + ["date", "week_median"]].rename(columns={"date": "latest_date", "week_median": "latest"})
    )
    combos = counts.merge(inputs, on=F.STATE_KEY, how="left").merge(latest, on=F.STATE_KEY, how="left")

    def num(v, digits=2):
        return None if pd.isna(v) else round(float(v), digits)

    states: dict = {}
    for r in combos.itertuples(index=False):
        states.setdefault(r.state, {}).setdefault(r.commodity, {})[r.variety] = {
            "rows": int(r.rows),
            "s7": num(r.s7),
            "s7_days": num(r.s7_days, 0),
            "s30": num(r.s30),
            "latest": num(r.latest),
            "latest_date": r.latest_date.strftime("%Y-%m-%d"),
        }

    return {
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sklearn_version": sklearn.__version__,
        "model": "forecaster: HistGradientBoostingRegressor on recent prices (see evaluation/REPORT.md)",
        "unit": "Rs/quintal",
        "history_from": history["date"].min().strftime("%Y-%m-%d"),
        "date_from": recent["date"].min().strftime("%Y-%m-%d"),
        "date_to": date_to.strftime("%Y-%m-%d"),
        "forecast_for": target.strftime("%Y-%m-%d"),
        "horizon_days": F.HORIZON_DAYS,
        "coverage_window_days": COVERAGE_WINDOW_DAYS,
        "train_rows": int(len(forecaster.trainable_rows(history))),
        "error_band": band,
        "crop_rank": recent["commodity"].value_counts().index.tolist(),
        "states": dict(sorted(states.items())),
    }


def train_model():
    history = F.add_recent_price_features(load_history())
    recent = history[history["date"] > history["date"].max() - pd.Timedelta(days=COVERAGE_WINDOW_DAYS)]
    print(f"History: {len(history):,} rows ({history['date'].min().date()} to {history['date'].max().date()})")

    problems = check_coverage(recent)
    if problems:
        raise RuntimeError("Coverage check failed:\n  " + "\n  ".join(problems))

    print("Measuring the error range on the last two weeks ...")
    band = error_band(history)
    print("Training on all history ...")
    artifact = forecaster.fit(history)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact, MODEL_PATH, compress=3)
    meta = build_meta(history, recent, band)
    META_PATH.write_text(json.dumps(meta, indent=1, ensure_ascii=False), encoding="utf-8")
    return artifact, meta


if __name__ == "__main__":
    _, meta = train_model()
    print(f"Saved {MODEL_PATH.name} and {META_PATH.name}")
