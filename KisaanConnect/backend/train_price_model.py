#!/usr/bin/env python
"""
Train the crop price forecaster.

Run from KisaanConnect/backend:
    python -m price_prediction.data.build_dataset --download   # only when the data changes
    python train_price_model.py
    python -m price_prediction.evaluation.evaluate             # optional: refresh evaluation/REPORT.md
"""
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent))

from price_prediction.models.train_model import REQUIRED_STATES, train_model


if __name__ == "__main__":
    print("=== Training Crop Price Forecaster ===\n")
    try:
        _, meta = train_model()
    except RuntimeError as e:
        print(f"\nTraining stopped: {e}")
        sys.exit(1)

    band = meta["error_band"]
    print("\n=== Training Completed ===")
    print(f"  Latest data     : {meta['date_to']} (forecasts are for {meta['forecast_for']})")
    print(f"  Training rows   : {meta['train_rows']:,}")
    print(f"  States offered  : {len(meta['states'])}")
    print(f"  Typical error   : {band['median_abs_pct_error']}% (measured {band['measured_on']})")
    for state in REQUIRED_STATES:
        crops = meta["states"].get(state, {})
        rows = sum(v["rows"] for varieties in crops.values() for v in varieties.values())
        print(f"  {state:15s} : {len(crops)} crops, {rows:,} reports")
    print("\nRun the server with: python main.py")
