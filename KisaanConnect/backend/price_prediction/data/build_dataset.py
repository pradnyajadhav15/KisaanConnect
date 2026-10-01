"""
Build the cleaned mandi price history used for training and evaluation.

Run from KisaanConnect/backend:
    python -m price_prediction.data.build_dataset            # use files already in data/raw/
    python -m price_prediction.data.build_dataset --download # also fetch the GitHub snapshot first

Inputs (put them in price_prediction/data/raw/, which is git-ignored):
  1. agmarknet_india_historical_prices_2024_2025.csv
       Kaggle: "Agmarknet India Commodity Prices (Oct'24 - Aug'25)" by Anish, CC BY-SA 4.0.
       8 states, 23 crops, 15 Aug 2024 - 14 Aug 2025. Manual download (needs a free Kaggle account).
  2. mandi_prices_snapshot.csv
       GitHub: herrrickshaw/agri-commodity-tracker, data/mandi_prices_snapshot.csv.
       Daily data.gov.in / AGMARKNET pulls for all states from Jul 2026 onwards (includes Maharashtra).
       Fetched automatically with --download.
  3. ../real_mandi_data.csv (optional)
       The original single-day data.gov.in pull (19 May 2025) the first model was trained on.

Output:
  price_prediction/data/mandi_history.csv.gz  - one row per (date, market, crop, variety, grade).
  Licensed CC BY-SA 4.0 because it includes the Kaggle data (see data/SOURCES.md).
"""
from __future__ import annotations

import argparse
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

import numpy as np
import pandas as pd

DATA_DIR = Path(__file__).resolve().parent
RAW_DIR = DATA_DIR / "raw"
OUTPUT_PATH = DATA_DIR / "mandi_history.csv.gz"

KAGGLE_FILE = RAW_DIR / "agmarknet_india_historical_prices_2024_2025.csv"
GITHUB_FILE = RAW_DIR / "mandi_prices_snapshot.csv"
LEGACY_FILE = DATA_DIR / "real_mandi_data.csv"
# Pinned to a commit so every rebuild gives the same data. To pick up newer days,
# replace the hash with the latest commit on that repo's main branch.
GITHUB_COMMIT = "9b81fb7986e9f7ce0974d11dd9af008c8effa8b6"
GITHUB_URL = (
    "https://raw.githubusercontent.com/herrrickshaw/agri-commodity-tracker/"
    f"{GITHUB_COMMIT}/data/mandi_prices_snapshot.csv"
)

COLUMNS = [
    "date", "state", "district", "market", "commodity", "variety", "grade",
    "min_price", "max_price", "modal_price", "source",
]
KEY = ["date", "state", "district", "market", "commodity", "variety", "grade"]

# Same state, different spellings across AGMARKNET exports.
STATE_ALIASES = {
    "Keralam": "Kerala",
    "Uttrakhand": "Uttarakhand",
    "Chattisgarh": "Chhattisgarh",
    "Pondicherry": "Puducherry",
    "NCT of Delhi": "Delhi",
}

# A modal price this far from the crop's overall median is almost always a unit
# or typing error (e.g. Rs/kg entered instead of Rs/quintal).
OUTLIER_FACTOR = 10


def _clean_text(s: pd.Series) -> pd.Series:
    return s.astype("string").str.strip().str.replace(r"\s+", " ", regex=True)


def _clean_market(s: pd.Series) -> pd.Series:
    """The 2026 portal writes 'Abohar APMC' / 'APMC ANAND'; older exports write 'Abohar'."""
    s = _clean_text(s)
    s = s.str.replace(r"^APMC\s+", "", regex=True, flags=re.IGNORECASE)
    s = s.str.replace(r"\s+APMC$", "", regex=True, flags=re.IGNORECASE)
    # 'ANAND' -> 'Anand', but leave mixed-case names like 'Anand(Veg,Yard,Anand)' alone
    return s.where(~s.str.isupper().fillna(False), s.str.title())


def load_kaggle(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, low_memory=False)
    df = df.rename(columns={
        "District Name": "district",
        "Market Name": "market",
        "Commodity": "commodity",
        "Variety": "variety",
        "Grade": "grade",
        "Min Price (Rs./Quintal)": "min_price",
        "Max Price (Rs./Quintal)": "max_price",
        "Modal Price (Rs./Quintal)": "modal_price",
        "Price Date": "date",
        "State": "state",
    })
    df["date"] = pd.to_datetime(df["date"], format="%d %b %Y", errors="coerce")
    df["source"] = "kaggle_2024_25"
    return df


def load_github(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, low_memory=False)
    df = df.rename(columns={"arrival_date": "date"})
    df["date"] = pd.to_datetime(df["date"], format="%d/%m/%Y", errors="coerce")
    df["source"] = "github_tracker_2026"
    return df


def load_legacy(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path)
    df = df.rename(columns={
        "State": "state", "District": "district", "Market": "market",
        "Commodity": "commodity", "Variety": "variety", "Grade": "grade",
        "Arrival_Date": "date",
        "Min_x0020_Price": "min_price", "Max_x0020_Price": "max_price",
        "Modal_x0020_Price": "modal_price",
    })
    df["date"] = pd.to_datetime(df["date"], format="%d/%m/%Y", errors="coerce")
    df["source"] = "datagovin_2025_05_19"
    return df


def clean(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    stats = {"rows_in": len(df)}
    df = df[COLUMNS].copy()

    for col in ["state", "district", "commodity", "variety", "grade"]:
        df[col] = _clean_text(df[col])
    df["market"] = _clean_market(df["market"])
    df["state"] = df["state"].replace(STATE_ALIASES)
    for col in ["min_price", "max_price", "modal_price"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    before = len(df)
    df = df.dropna(subset=["date", "state", "market", "commodity", "modal_price"])
    df["variety"] = df["variety"].fillna("Other")
    df["grade"] = df["grade"].fillna("FAQ")
    df["district"] = df["district"].fillna("")
    stats["dropped_missing"] = before - len(df)

    before = len(df)
    df = df[df["modal_price"] > 0]
    stats["dropped_zero_price"] = before - len(df)

    # A 0 in min/max means "not reported", not a real price.
    df.loc[df["min_price"] <= 0, "min_price"] = np.nan
    df.loc[df["max_price"] <= 0, "max_price"] = np.nan
    bad = (
        (df["min_price"] > df["max_price"])
        | (df["modal_price"] < df["min_price"])
        | (df["modal_price"] > df["max_price"])
    )
    stats["dropped_inconsistent_min_max"] = int(bad.sum())
    df = df[~bad]

    crop_median = df.groupby("commodity")["modal_price"].transform("median")
    outlier = (df["modal_price"] > crop_median * OUTLIER_FACTOR) | (
        df["modal_price"] < crop_median / OUTLIER_FACTOR
    )
    stats["dropped_outliers"] = int(outlier.sum())
    df = df[~outlier]

    # Same mandi, crop, variety and grade on the same day: keep one row.
    # Sources are concatenated newest-first, so the newest pull wins.
    before = len(df)
    df = df.drop_duplicates(subset=KEY, keep="first")
    stats["dropped_duplicates"] = before - len(df)

    df = df.sort_values(["state", "commodity", "market", "variety", "date"]).reset_index(drop=True)
    stats["rows_out"] = len(df)
    return df, stats


def download_github_snapshot(attempts: int = 3) -> None:
    """Download to a .part file and only replace the real file once it is complete."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    part = GITHUB_FILE.with_name(GITHUB_FILE.name + ".part")
    for attempt in range(1, attempts + 1):
        print(f"Downloading {GITHUB_URL} (attempt {attempt}/{attempts}) ...")
        try:
            urllib.request.urlretrieve(GITHUB_URL, part)
        except (urllib.error.URLError, OSError) as e:
            print(f"  failed: {e}")
            part.unlink(missing_ok=True)
            continue
        part.replace(GITHUB_FILE)
        print(f"Saved to {GITHUB_FILE}")
        return
    sys.exit(
        "Download failed. Open the URL above in a browser, save the file as "
        f"{GITHUB_FILE}, then run this script again without --download."
    )


def build() -> pd.DataFrame:
    frames = []
    if GITHUB_FILE.exists():
        frames.append(load_github(GITHUB_FILE))
    else:
        print(f"MISSING: {GITHUB_FILE.name} - run with --download (this source is the one with Maharashtra)")
    if LEGACY_FILE.exists():
        frames.append(load_legacy(LEGACY_FILE))
    if KAGGLE_FILE.exists():
        frames.append(load_kaggle(KAGGLE_FILE))
    else:
        print(f"MISSING: {KAGGLE_FILE.name} - optional, adds Aug 2024 - Aug 2025 history (see data/SOURCES.md)")
    if not frames:
        sys.exit("No source files found in price_prediction/data/raw/. See data/SOURCES.md.")

    df, stats = clean(pd.concat(frames, ignore_index=True))

    print("\n=== Cleaning summary ===")
    for k, v in stats.items():
        print(f"  {k:30s} {v:>10,}")
    print("\n=== Rows by source ===")
    print(df.groupby("source")["date"].agg(["count", "min", "max"]).to_string())
    print(f"\n  states: {df['state'].nunique()}  markets: {df['market'].nunique()}  "
          f"crops: {df['commodity'].nunique()}")
    mh = df[df["state"] == "Maharashtra"]
    print(f"  Maharashtra rows: {len(mh):,}  days: {mh['date'].nunique()}  crops: {mh['commodity'].nunique()}")
    return df


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--download", action="store_true", help="fetch the GitHub snapshot into data/raw/ first")
    args = parser.parse_args()

    if args.download:
        download_github_snapshot()

    df = build()
    out = df.copy()
    out["date"] = out["date"].dt.strftime("%Y-%m-%d")
    out.to_csv(OUTPUT_PATH, index=False, compression={"method": "gzip", "compresslevel": 9, "mtime": 0})
    size_mb = OUTPUT_PATH.stat().st_size / 1e6
    print(f"\nWrote {OUTPUT_PATH.name}: {len(out):,} rows, {size_mb:.1f} MB")


if __name__ == "__main__":
    main()
