#!/usr/bin/env python
"""
Train Crop Price Prediction Model
Run before starting the API: python train_price_model.py
"""

import sys
from pathlib import Path
import pandas as pd

sys.path.append(str(Path(__file__).resolve().parent))

from price_prediction.models.train_model import train_model, DATA_PATH


def looks_real_enough(path) -> tuple[bool, str]:
    """
    Cheap sanity gate. Real mandi data has a market/date and shows price
    variation within the same crop. Synthetic data usually doesn't.
    Not foolproof — just stops the most obvious 'demo data' from shipping.
    """
    if not Path(path).exists():
        return False, f"Dataset not found at {path}"
    df = pd.read_csv(path)
    has_market = any(c.lower() in ("market", "mandi", "apmc") for c in df.columns)
    has_date = any(c.lower() in ("date", "arrival_date", "price_date") for c in df.columns)
    # Within-crop price spread: real data varies a lot, synthetic barely moves.
    spread_ok = False
    if "crop" in df.columns and "price" in df.columns:
        rel = df.groupby("crop")["price"].std() / df.groupby("crop")["price"].mean()
        spread_ok = rel.median() > 0.15  # >15% within-crop variation
    reasons = []
    if not has_market: reasons.append("no market/mandi column")
    if not has_date:   reasons.append("no date column")
    if not spread_ok:  reasons.append("price barely varies within each crop (looks synthetic)")
    return (len(reasons) == 0), "; ".join(reasons) if reasons else "ok"


if __name__ == "__main__":
    print("=== Training Crop Price Prediction Model ===\n")

    ok, why = looks_real_enough(DATA_PATH)
    if not ok:
        print(f"WARNING: training data may not be production-grade — {why}.")
        print("This model will produce confident-looking but ungrounded prices.")
        resp = input("Train anyway? (y/N): ").strip().lower()
        if resp != "y":
            print("Aborted. Wire in real mandi data (Agmarknet) before training.")
            sys.exit(0)

    try:
        model, mae, r2 = train_model()
        print("\n=== Training Completed ===")
        print(f"  MAE : Rs.{mae:.2f}")
        print(f"  R2  : {r2:.4f}")
        print("\nRun the server with: python main.py")
    except FileNotFoundError as e:
        print(f"Dataset not found: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Training failed: {e}")
        sys.exit(1)