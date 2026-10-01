"""
Time-based evaluation of crop price forecasts.

Every method forecasts a mandi's modal price one week ahead, using only data that
existed 7 days before the target date, and is trained only on dates before the
test period. Four methods are compared:

  last_month     price = the mandi's (else the state's) median price a month earlier
  last_week      price = the mandi's (else the state's) median price a week earlier
  static_model   the step-1 model: one average price per state + crop + variety,
                 learned from the 90 days before the test period (random forest)
  forecaster     models/forecaster.py: predicts the change from the latest known price

Run from KisaanConnect/backend:
    python -m price_prediction.evaluation.evaluate

Writes REPORT.md, per_crop.csv, per_market.csv and summary.json next to this file.
"""
from __future__ import annotations

import json
import sys
import time
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

from price_prediction import features as F
from price_prediction.models import forecaster

OUT_DIR = Path(__file__).resolve().parent
DATA_PATH = OUT_DIR.parent / "data" / "mandi_history.csv.gz"

SPLITS = [
    {"name": "2024-25", "label": "Aug 2024 - Aug 2025 (8 states, no Maharashtra)",
     "test_from": "2025-05-15", "test_to": "2025-08-14"},
    {"name": "2026", "label": "Jul - Sep 2026 (30 states, incl. Maharashtra)",
     "test_from": "2026-09-11", "test_to": "2026-09-24"},
]
METHODS = ["last_month", "last_week", "static_model", "forecaster"]
METHOD_NAMES = {
    "last_month": "Last month's price",
    "last_week": "Last week's price",
    "static_model": "Step-1 model (average per crop)",
    "forecaster": "New forecaster",
}
STATIC_WINDOW_DAYS = 90
MIN_GROUP_ROWS = 30
TABLE_ROWS = 15


def load() -> pd.DataFrame:
    df = pd.read_csv(DATA_PATH, parse_dates=["date"], low_memory=False)
    # The single-day May 2025 pull has no history around it, so it can't be forecast fairly.
    return df[df["source"] != "datagovin_2025_05_19"].reset_index(drop=True)


def fit_static_model(train: pd.DataFrame) -> Pipeline:
    """The step-1 approach, with fewer trees so evaluation runs in minutes (averages barely change)."""
    cols = F.STATE_KEY
    model = Pipeline([
        ("pre", ColumnTransformer([("cat", OneHotEncoder(handle_unknown="ignore"), cols)])),
        ("rf", RandomForestRegressor(n_estimators=30, min_samples_leaf=2, random_state=42, n_jobs=-1)),
    ])
    return model.fit(train[cols], train["modal_price"])


def run_split(df: pd.DataFrame, split: dict) -> pd.DataFrame:
    start, end = pd.Timestamp(split["test_from"]), pd.Timestamp(split["test_to"])
    train = df[df["date"] < start]
    test = df[(df["date"] >= start) & (df["date"] <= end)].copy()

    static_train = train[train["date"] >= start - pd.Timedelta(days=STATIC_WINDOW_DAYS)]
    seen = static_train.set_index(F.STATE_KEY).index.unique()

    test["last_week"] = F.last_week_baseline(test)
    test["last_month"] = F.last_month_baseline(test)
    keep = (
        test["last_week"].notna()
        & test["last_month"].notna()
        & test.set_index(F.STATE_KEY).index.isin(seen)
    )
    print(f"[{split['name']}] test rows {len(test):,}, comparable rows {int(keep.sum()):,}")
    test = test[keep].copy()

    t = time.time()
    test["static_model"] = fit_static_model(static_train).predict(test[F.STATE_KEY])
    print(f"[{split['name']}] static model done in {time.time() - t:.0f}s")

    t = time.time()
    artifact = forecaster.fit(train)
    test["forecaster"] = forecaster.predict(artifact, test)
    print(f"[{split['name']}] forecaster done in {time.time() - t:.0f}s")

    test["split"] = split["name"]
    return test


def summarize(rows: pd.DataFrame) -> dict:
    actual = rows["modal_price"]
    out = {"rows": int(len(rows)), "actual_median_kg": round(float(actual.median()) / 100, 2)}
    for m in METHODS:
        err = (rows[m] - actual).abs()
        out[f"{m}_mae_kg"] = round(float(err.mean()) / 100, 2)
        out[f"{m}_median_pct_error"] = round(float((err / actual).median() * 100), 1)
    out["forecaster_beats_last_week_pct"] = round(
        float(((rows["forecaster"] - actual).abs() < (rows["last_week"] - actual).abs()).mean() * 100), 1
    )
    return out


def group_table(rows: pd.DataFrame, by: list[str]) -> pd.DataFrame:
    actual = rows["modal_price"]
    errs = pd.DataFrame({m: (rows[m] - actual).abs() / 100 for m in METHODS})
    errs[by] = rows[by]
    g = errs.groupby(by, observed=True)
    table = g[METHODS].mean().round(2)
    table.insert(0, "rows", g.size())
    table.insert(1, "actual_median_kg", (rows.groupby(by, observed=True)["modal_price"].median() / 100).round(2))
    table["best"] = table[METHODS].idxmin(axis=1).map(METHOD_NAMES)
    return table[table["rows"] >= MIN_GROUP_ROWS].sort_values("rows", ascending=False).reset_index()


def md_table(df: pd.DataFrame, label_cols: list[str]) -> str:
    cols = label_cols + ["rows", "actual_median_kg"] + METHODS + ["best"]
    header = [c.replace("_", " ") for c in label_cols] + ["Reports", "Actual (Rs/kg)"] + [
        METHOD_NAMES[m] for m in METHODS] + ["Best"]
    lines = ["| " + " | ".join(header) + " |", "|" + "---|" * len(header)]
    for _, r in df[cols].iterrows():
        cells = [str(r[c]) for c in label_cols] + [f"{int(r['rows']):,}", f"{r['actual_median_kg']:.2f}"]
        best_val = min(r[m] for m in METHODS)
        cells += [f"**{r[m]:.2f}**" if r[m] == best_val else f"{r[m]:.2f}" for m in METHODS]
        cells.append(r["best"])
        lines.append("| " + " | ".join(cells) + " |")
    return "\n".join(lines)


def summary_table(summaries: dict) -> str:
    lines = ["| Test set | Reports | " + " | ".join(METHOD_NAMES[m] for m in METHODS) + " |",
             "|" + "---|" * (2 + len(METHODS))]
    for name, s in summaries.items():
        vals = [s[f"{m}_mae_kg"] for m in METHODS]
        best = min(vals)
        cells = [f"**{v:.2f}**" if v == best else f"{v:.2f}" for v in vals]
        lines.append(f"| {name} | {s['rows']:,} | " + " | ".join(cells) + " |")
    return "\n".join(lines)


def write_report(results: pd.DataFrame, summaries: dict) -> bool:
    mh = results[(results["split"] == "2026") & (results["state"] == "Maharashtra")]
    wins = all(
        summaries[s["label"]]["forecaster_mae_kg"] < summaries[s["label"]]["last_week_mae_kg"]
        for s in SPLITS
    )
    s26 = summaries[SPLITS[1]["label"]]
    smh = summaries["Maharashtra only (2026)"]
    crops_26 = group_table(results[results["split"] == "2026"], ["commodity"])
    crops_25 = group_table(results[results["split"] == "2024-25"], ["commodity"])
    crops_mh = group_table(mh, ["commodity"])
    markets_26 = group_table(results[results["split"] == "2026"], ["state", "market"])
    markets_mh = group_table(mh, ["market"])

    margins = [
        (1 - summaries[s["label"]]["forecaster_mae_kg"] / summaries[s["label"]]["last_week_mae_kg"]) * 100
        for s in SPLITS
    ]
    static_gain = (1 - s26["forecaster_mae_kg"] / s26["static_model_mae_kg"]) * 100
    if wins:
        verdict = (
            f"The new forecaster has the lowest error on both test sets, so it replaces the step-1 model in the app. "
            f"But the margin over \"last week's price\" is small ({margins[0]:.1f}% and {margins[1]:.1f}%), "
            f"which is within normal week-to-week variation"
        )
        if smh["forecaster_mae_kg"] >= smh["last_week_mae_kg"]:
            verdict += ", and in Maharashtra last week's price was slightly better over these two weeks"
        verdict += (
            f". The real improvement is using recent prices at all: the forecaster's error is "
            f"{static_gain:.0f}% lower than the step-1 model's."
        )
    else:
        verdict = "The new forecaster does **not** beat \"last week's price\" on every test set, so the app keeps the step-1 model."
    text = f"""# Crop price model evaluation

Generated {date.today().isoformat()} by `python -m price_prediction.evaluation.evaluate`.

## How the test works

Every method forecasts the price a mandi will report **one week ahead**, using only
prices that were already known 7 days before. Models learn only from dates before each
test period. Errors are the average gap between forecast and actual modal price
(mean absolute error), in **Rs per kg**. Lower is better.

| Method | What it does |
|---|---|
| {METHOD_NAMES['last_month']} | The mandi's median price a month earlier (the state's if that mandi had none) |
| {METHOD_NAMES['last_week']} | The mandi's median price a week earlier (the state's if that mandi had none) |
| {METHOD_NAMES['static_model']} | One average per state + crop + variety over the previous 90 days (the model from step 1) |
| {METHOD_NAMES['forecaster']} | Gradient boosting that predicts the change from the latest known price, using last week's and last month's prices (mandi and state), the month, state and crop |

Test sets:
- **{SPLITS[0]['label']}**: learn from data before {SPLITS[0]['test_from']}, test {SPLITS[0]['test_from']} to {SPLITS[0]['test_to']}.
- **{SPLITS[1]['label']}**: learn from everything before {SPLITS[1]['test_from']}, test {SPLITS[1]['test_from']} to {SPLITS[1]['test_to']}.

Only reports where every method can make a forecast are scored.

## Results

{summary_table(summaries)}

{verdict}

On the 2026 test set the forecaster is closer than "last week's price" for
{s26['forecaster_beats_last_week_pct']}% of reports ({smh['forecaster_beats_last_week_pct']}% in Maharashtra).
Typical (median) error: {s26['forecaster_median_pct_error']}% for the forecaster vs
{s26['last_week_median_pct_error']}% for last week's price.

## Maharashtra, by crop (2026 test)

{md_table(crops_mh.head(TABLE_ROWS), ['commodity'])}

## Maharashtra, by mandi (2026 test)

{md_table(markets_mh.head(TABLE_ROWS), ['market'])}

## All states, by crop (2026 test)

{md_table(crops_26.head(TABLE_ROWS), ['commodity'])}

## All states, by mandi (2026 test)

{md_table(markets_26.head(TABLE_ROWS), ['state', 'market'])}

## By crop (2024-25 test)

{md_table(crops_25.head(TABLE_ROWS), ['commodity'])}

Full tables (every crop and mandi with at least {MIN_GROUP_ROWS} reports): `per_crop.csv`, `per_market.csv`.

## Limits

- The 2026 test covers only two weeks ({SPLITS[1]['test_from']} to {SPLITS[1]['test_to']}), because the 2026 data starts on 21 Jul 2026.
- Maharashtra is only in the 2026 data; the 2024-25 data covers 8 other states.
- There is no data between Aug 2025 and Jul 2026, so the model has seen each month of the year at most once.
- In the app, forecasts are for the week after the latest data. If the data isn't refreshed, they get older.
"""
    (OUT_DIR / "REPORT.md").write_text(text, encoding="utf-8")

    per_crop = pd.concat([
        crops_25.assign(test_set="2024-25"), crops_26.assign(test_set="2026"),
        crops_mh.assign(test_set="2026 Maharashtra"),
    ])
    per_market = pd.concat([
        group_table(results[results["split"] == "2024-25"], ["state", "market"]).assign(test_set="2024-25"),
        markets_26.assign(test_set="2026"),
    ])
    per_crop.to_csv(OUT_DIR / "per_crop.csv", index=False)
    per_market.to_csv(OUT_DIR / "per_market.csv", index=False)
    (OUT_DIR / "summary.json").write_text(
        json.dumps({"forecaster_wins": wins, "test_sets": summaries}, indent=2), encoding="utf-8"
    )
    return wins


def main() -> None:
    t = time.time()
    df = load()
    df = F.add_recent_price_features(df)
    print(f"features ready in {time.time() - t:.0f}s")

    results = pd.concat([run_split(df, s) for s in SPLITS], ignore_index=True)
    summaries = {s["label"]: summarize(results[results["split"] == s["name"]]) for s in SPLITS}
    summaries["Maharashtra only (2026)"] = summarize(
        results[(results["split"] == "2026") & (results["state"] == "Maharashtra")]
    )
    wins = write_report(results, summaries)

    print(json.dumps(summaries, indent=1))
    print("forecaster wins:", wins)
    print(f"Wrote REPORT.md, per_crop.csv, per_market.csv, summary.json to {OUT_DIR}")


if __name__ == "__main__":
    sys.exit(main())
