"""Tests for the recent-price features and the dataset cleaning rules."""
import numpy as np
import pandas as pd
import pytest

from price_prediction import features as F
from price_prediction.data.build_dataset import COLUMNS, clean


def daily_prices(prices: dict, state="Maharashtra", market="Pune", crop="Onion", variety="Red"):
    """One report per day: {"2026-09-01": 2000, ...}"""
    return pd.DataFrame([
        {"date": pd.Timestamp(d), "state": state, "market": market, "commodity": crop,
         "variety": variety, "modal_price": float(p)}
        for d, p in prices.items()
    ])


def features_on(df, day):
    target = df[df["date"] == pd.Timestamp(day)]
    return F.add_recent_price_features(target, history=df).iloc[0]


# ---------- recent-price features ----------

def test_last_week_price_is_the_median_of_the_week_seven_days_earlier():
    days = pd.date_range("2026-09-01", "2026-09-20")
    df = daily_prices({d: 1000 + 10 * i for i, d in enumerate(days)})
    row = features_on(df, "2026-09-20")
    # As of 13 Sep, the 7 days are 7..13 Sep -> prices 1060..1120, median 1090
    assert row["s7"] == 1090
    assert row["m7"] == 1090
    assert row["s7_days"] == 7


def test_no_look_ahead_future_prices_do_not_change_features():
    days = pd.date_range("2026-08-01", "2026-09-20")
    df = daily_prices({d: 1000 for d in days})
    before = features_on(df, "2026-09-20")

    changed = df.copy()
    recent = changed["date"] > pd.Timestamp("2026-09-13")   # anything after d - 7
    changed.loc[recent, "modal_price"] = 99999
    after = features_on(changed, "2026-09-20")

    for col in ["s7", "s30", "m7", "m30", "s7_days"]:
        assert before[col] == after[col], col


def test_last_month_price_uses_data_from_thirty_days_earlier():
    days = pd.date_range("2026-08-01", "2026-09-20")
    prices = {d: (500 if d <= pd.Timestamp("2026-08-21") else 2000) for d in days}
    row = features_on(daily_prices(prices), "2026-09-20")
    assert row["s30"] == 500        # as of 21 Aug
    assert row["s7"] == 2000        # as of 13 Sep


def test_old_readings_count_as_missing():
    # Last report on 1 Sep; as of 13 Sep that is 12 days old (> MAX_GAP_DAYS)
    df = daily_prices({"2026-09-01": 1000, "2026-09-20": 1200})
    row = features_on(df, "2026-09-20")
    assert np.isnan(row["s7"]) and np.isnan(row["m7"])


def test_state_price_fills_in_when_the_mandi_has_no_history():
    days = pd.date_range("2026-09-01", "2026-09-20")
    other_mandi = daily_prices({d: 1500 for d in days}, market="Nashik")
    new_mandi = daily_prices({"2026-09-20": 1600}, market="Lasalgaon")
    df = pd.concat([other_mandi, new_mandi], ignore_index=True)

    row = F.add_recent_price_features(df[df["market"] == "Lasalgaon"], history=df).iloc[0]
    assert np.isnan(row["m7"])
    assert row["s7"] == 1500
    ref, source = F.reference_price(pd.DataFrame([row]))
    assert ref.iloc[0] == 1500 and source.iloc[0] == 1     # 1 = state, last week


# ---------- dataset cleaning ----------

def raw_rows(rows):
    base = {"date": pd.Timestamp("2026-09-01"), "state": "Maharashtra", "district": "Pune", "market": "Pune APMC",
            "commodity": "Onion", "variety": "Red", "grade": "FAQ",
            "min_price": 1000.0, "max_price": 3000.0, "modal_price": 2000.0, "source": "test"}
    return pd.DataFrame([{**base, **r} for r in rows])[COLUMNS]


def test_clean_unifies_names():
    out, _ = clean(raw_rows([
        {"commodity": "Lentil (Masur)(Whole)", "state": "Keralam", "market": "APMC Kochi"},
        {"commodity": "Arhar (Tur/Red Gram)(Whole)", "market": "Pune APMC"},
    ]))
    assert set(out["commodity"]) == {"Lentil(Masur)(Whole)", "Red gram/Arhar/Tur(whole)"}
    assert "Kerala" in set(out["state"])
    assert set(out["market"]) == {"Kochi", "Pune"}


@pytest.mark.parametrize("crop", ["Cow", "She Buffalo", "Ghee", "Firewood", "Mustard Oil"])
def test_clean_drops_non_crops(crop):
    out, stats = clean(raw_rows([{"commodity": crop}, {"commodity": "Onion"}]))
    assert list(out["commodity"]) == ["Onion"]
    assert stats["dropped_non_crops"] == 1


def test_clean_drops_bad_prices_and_duplicates():
    out, stats = clean(raw_rows([
        {"modal_price": 0.0},                                    # zero price
        {"modal_price": 5000.0, "max_price": 3000.0, "variety": "A"},   # modal above max
        {"variety": "B"},
        {"variety": "B"},                                        # duplicate
    ]))
    assert stats["dropped_zero_price"] == 1
    assert stats["dropped_inconsistent_min_max"] == 1
    assert stats["dropped_duplicates"] == 1
    assert len(out) == 1
