#!/usr/bin/env python
"""
Train the crop price prediction model.

Run from KisaanConnect/backend:
    python -m price_prediction.data.build_dataset --download   # only when the data changes
    python train_price_model.py
"""
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent))

from price_prediction.models.train_model import REQUIRED_STATES, train_model


if __name__ == "__main__":
    print("=== Training Crop Price Prediction Model ===\n")
    try:
        _, meta = train_model()
    except RuntimeError as e:
        print(f"\nTraining stopped: {e}")
        sys.exit(1)

    print("\n=== Training Completed ===")
    print(f"  Data window : {meta['date_from']} to {meta['date_to']}")
    print(f"  Rows        : {meta['train_rows']:,}")
    print(f"  States      : {len(meta['states'])}")
    for state in REQUIRED_STATES:
        crops = meta["states"].get(state, {})
        rows = sum(v["rows"] for varieties in crops.values() for v in varieties.values())
        print(f"  {state:12s}: {len(crops)} crops, {rows:,} rows")
    print("\nRun the server with: python main.py")
