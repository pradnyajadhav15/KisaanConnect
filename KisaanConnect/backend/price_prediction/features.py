"""
Recent-price features shared by training, evaluation and the API.

Every feature only uses mandi reports from at least HORIZON_DAYS before the
target date, so a forecast for date d uses nothing that wasn't known on d - 7.

For a target row (a mandi report on date d) the features are:
  s7, s7_n   median price (and number of days with reports) for this
             state + crop + variety over the latest 7 days of reports, as of d - 7
  s30        the same, as of d - 30 ("last month's price")
  m7, m30    the same two, for this one mandi only

"As of d - 7" means: take the latest day with reports on or before d - 7 (at most
MAX_GAP_DAYS earlier), and use the median of the 7 days ending on that day.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

HORIZON_DAYS = 7          # forecasts are made one week ahead
MONTH_LAG_DAYS = 30       # "last month's price"
WINDOW_DAYS = 7           # each reading is a 7-day median
MAX_GAP_DAYS = 6          # a reading older than this (relative to its as-of date) is treated as missing

STATE_KEY = ["state", "commodity", "variety"]
MARKET_KEY = ["state", "market", "commodity", "variety"]

MODEL_FEATURES = [
    "ref_source", "log_ref", "s7_rel", "s30_rel", "m7_rel", "m30_rel",
    "s7_days", "month", "state", "commodity",
]
CATEGORICAL_FEATURES = ["ref_source", "state", "commodity"]
MAX_CATEGORIES = 250      # HistGradientBoosting allows at most 255 levels per categorical


def weekly_medians(df: pd.DataFrame, keys: list[str]) -> pd.DataFrame:
    """One row per key and reporting day: the median of daily medians over the 7 days ending that day."""
    daily = (
        df.groupby(keys + ["date"], observed=True, sort=False)["modal_price"]
        .median()
        .rename("price")
        .reset_index()
    )
    daily["kid"] = daily.groupby(keys, observed=True, sort=False).ngroup()
    daily = daily.sort_values(["kid", "date"]).reset_index(drop=True)
    rolled = daily.groupby("kid", sort=False).rolling(f"{WINDOW_DAYS}D", on="date")["price"]
    daily["week_median"] = rolled.median().to_numpy()
    daily["week_days"] = rolled.count().to_numpy()
    return daily


def value_as_of(targets: pd.DataFrame, weekly: pd.DataFrame, keys: list[str], lag_days: int) -> pd.DataFrame:
    """For each target row, the weekly reading as of (date - lag_days). Returns columns aligned to targets.index."""
    t = targets[keys + ["date"]].copy()
    t["_row"] = np.arange(len(t))
    t["asof"] = t["date"] - pd.Timedelta(days=lag_days)

    lookup = weekly[keys + ["kid"]].drop_duplicates(keys)
    t = t.merge(lookup, on=keys, how="left")
    found = t[t["kid"].notna()].copy()
    found["kid"] = found["kid"].astype(np.int64)

    w = weekly[["kid", "date", "week_median", "week_days"]].rename(columns={"date": "wdate"})
    merged = pd.merge_asof(
        found.sort_values("asof"),
        w.sort_values("wdate"),
        left_on="asof", right_on="wdate", by="kid",
        direction="backward", tolerance=pd.Timedelta(days=MAX_GAP_DAYS),
    )
    out = pd.DataFrame(index=np.arange(len(t)), columns=["week_median", "week_days"], dtype=float)
    out.loc[merged["_row"].to_numpy(), ["week_median", "week_days"]] = merged[["week_median", "week_days"]].to_numpy()
    out = out.sort_index()
    out.index = targets.index
    return out


def add_recent_price_features(df: pd.DataFrame, history: pd.DataFrame | None = None) -> pd.DataFrame:
    """Add s7, s7_days, s30, m7, m30 to df, looking prices up in history (defaults to df itself)."""
    history = df if history is None else history
    out = df.copy()
    for prefix, keys in (("s", STATE_KEY), ("m", MARKET_KEY)):
        weekly = weekly_medians(history, keys)
        week = value_as_of(out, weekly, keys, HORIZON_DAYS)
        month = value_as_of(out, weekly, keys, MONTH_LAG_DAYS)
        out[f"{prefix}7"] = week["week_median"].astype(float)
        out[f"{prefix}30"] = month["week_median"].astype(float)
        if prefix == "s":
            out["s7_days"] = week["week_days"].astype(float)
    return out


def reference_price(df: pd.DataFrame) -> tuple[pd.Series, pd.Series]:
    """The most recent price we know: mandi last week, else state last week, else mandi/state last month."""
    candidates = [df["m7"], df["s7"], df["m30"], df["s30"]]
    ref = candidates[0].copy()
    source = pd.Series(np.where(ref.notna(), 0, -1), index=df.index)
    for i, c in enumerate(candidates[1:], start=1):
        fill = ref.isna() & c.notna()
        ref[fill] = c[fill]
        source[fill] = i
    return ref, source


def last_week_baseline(df: pd.DataFrame) -> pd.Series:
    return df["m7"].fillna(df["s7"])


def last_month_baseline(df: pd.DataFrame) -> pd.Series:
    return df["m30"].fillna(df["s30"])


def model_frame(df: pd.DataFrame, categories: dict[str, list[str]]) -> pd.DataFrame:
    """Turn rows with recent-price columns into model inputs. Prices enter as log ratios to the reference."""
    ref, source = reference_price(df)
    log_ref = np.log(ref)
    X = pd.DataFrame(index=df.index)
    X["ref_source"] = pd.Categorical(source.clip(lower=0), categories=[0, 1, 2, 3])
    X["log_ref"] = log_ref
    for col in ["s7", "s30", "m7", "m30"]:
        X[f"{col}_rel"] = np.log(df[col]) - log_ref
    X["s7_days"] = df["s7_days"]
    X["month"] = df["date"].dt.month
    for col in ["state", "commodity"]:
        allowed = categories[col]
        values = df[col].where(df[col].isin(allowed), "Other")
        X[col] = pd.Categorical(values, categories=allowed + ["Other"])
    return X[MODEL_FEATURES]


def category_levels(df: pd.DataFrame) -> dict[str, list[str]]:
    """Most common states and crops get their own level; the rest share 'Other'."""
    return {
        col: df[col].value_counts().index[: MAX_CATEGORIES].tolist()
        for col in ["state", "commodity"]
    }
