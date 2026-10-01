# Price data sources

`build_dataset.py` combines three sources into `mandi_history.csv.gz`
(one row per date, mandi, crop, variety and grade; prices in Rs per quintal).
The raw files live in `raw/`, which is git-ignored.

| Source | Period | Coverage | How to get it | Licence |
|---|---|---|---|---|
| [herrrickshaw/agri-commodity-tracker](https://github.com/herrrickshaw/agri-commodity-tracker) `data/mandi_prices_snapshot.csv` (daily AGMARKNET pulls via data.gov.in) | 21 Jul 2026 to 24 Sep 2026 | 30 states incl. Maharashtra | `python -m price_prediction.data.build_dataset --download` (pinned to commit `9b81fb7`) | Underlying prices are Government of India open data ([GODL-India](https://www.data.gov.in/Godl)); the repo has no licence file of its own |
| Kaggle: *Agmarknet India Commodity Prices (Oct'24 to Aug'25)* by Anish | 15 Aug 2024 to 14 Aug 2025 | 8 states (no Maharashtra), 23 crops | Manual download (free Kaggle account), save as `raw/agmarknet_india_historical_prices_2024_2025.csv` | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| data.gov.in "Current Daily Price of Various Commodities" (the original single-day pull) | 19 May 2025 | 16 states | Already in this folder as `real_mandi_data.csv` | [GODL-India](https://www.data.gov.in/Godl) |

All prices originate from [AGMARKNET](https://agmarknet.gov.in/), Directorate of Marketing & Inspection,
Ministry of Agriculture & Farmers Welfare, Government of India.

## Licence of `mandi_history.csv.gz`

Because it includes the Kaggle data, `mandi_history.csv.gz` is shared under
**CC BY-SA 4.0**. Changes made to the sources: columns renamed to one schema,
state spellings unified (e.g. Keralam to Kerala), "APMC" removed from market names,
crop names unified (e.g. "Lentil (Masur)" and "Lentil(Masur)"), livestock, fish, fuel,
fodder and processed goods removed, rows with zero, inconsistent or 10x-off prices
dropped, and duplicates removed.

## What the model uses

`models/train_model.py` trains the forecaster on all of the 2024-25 and 2026 data
(the single-day May 2025 pull is left out because it has no history around it).
The app only offers state / crop / variety combinations reported in the last 90 days,
which today means the 2026 data. `evaluation/evaluate.py` tests the model on both periods.
