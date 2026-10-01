# Crop price model evaluation

Generated 2026-10-01 by `python -m price_prediction.evaluation.evaluate`.

## How the test works

Every method forecasts the price a mandi will report **one week ahead**, using only
prices that were already known 7 days before. Models learn only from dates before each
test period. Errors are the average gap between forecast and actual modal price
(mean absolute error), in **Rs per kg**. Lower is better.

| Method | What it does |
|---|---|
| Last month's price | The mandi's median price a month earlier (the state's if that mandi had none) |
| Last week's price | The mandi's median price a week earlier (the state's if that mandi had none) |
| Step-1 model (average per crop) | One average per state + crop + variety over the previous 90 days (the model from step 1) |
| New forecaster | Gradient boosting that predicts the change from the latest known price, using last week's and last month's prices (mandi and state), the month, state and crop |

Test sets:
- **Aug 2024 - Aug 2025 (8 states, no Maharashtra)**: learn from data before 2025-05-15, test 2025-05-15 to 2025-08-14.
- **Jul - Sep 2026 (30 states, incl. Maharashtra)**: learn from everything before 2026-09-11, test 2026-09-11 to 2026-09-24.

Only reports where every method can make a forecast are scored.

## Results

| Test set | Reports | Last month's price | Last week's price | Step-1 model (average per crop) | New forecaster |
|---|---|---|---|---|---|
| Aug 2024 - Aug 2025 (8 states, no Maharashtra) | 279,951 | 5.98 | 3.61 | 9.17 | **3.55** |
| Jul - Sep 2026 (30 states, incl. Maharashtra) | 94,844 | 9.72 | 5.47 | 11.61 | **5.42** |
| Maharashtra only (2026) | 2,970 | 8.91 | **5.09** | 9.97 | 5.21 |

The new forecaster has the lowest error on both test sets, so it replaces the step-1 model in the app. But the margin over "last week's price" is small (1.7% and 0.9%), which is within normal week-to-week variation, and in Maharashtra last week's price was slightly better over these two weeks. The real improvement is using recent prices at all: the forecaster's error is 53% lower than the step-1 model's.

On the 2026 test set the forecaster is closer than "last week's price" for
35.1% of reports (43.0% in Maharashtra).
Typical (median) error: 5.3% for the forecaster vs
5.2% for last week's price.

## Maharashtra, by crop (2026 test)

| commodity | Reports | Actual (Rs/kg) | Last month's price | Last week's price | Step-1 model (average per crop) | New forecaster | Best |
|---|---|---|---|---|---|---|---|
| Onion | 129 | 39.00 | 12.23 | **3.47** | 11.53 | 6.02 | Last week's price |
| Tomato | 122 | 12.00 | 2.61 | **2.15** | 3.89 | 2.23 | Last week's price |
| Brinjal | 114 | 19.00 | 7.18 | 4.10 | 7.81 | **3.93** | New forecaster |
| Bhindi(Ladies Finger) | 111 | 22.50 | 6.65 | **3.81** | 7.14 | 3.83 | Last week's price |
| Green Chilli | 107 | 27.50 | 9.24 | 4.94 | 9.18 | **4.91** | New forecaster |
| Cucumbar(Kheera) | 97 | 17.50 | 4.62 | 3.52 | 5.52 | **3.47** | New forecaster |
| Cabbage | 94 | 10.00 | 3.69 | **1.82** | 4.69 | 1.87 | Last week's price |
| Wheat | 94 | 26.82 | 1.74 | 1.11 | 3.03 | **1.08** | New forecaster |
| Cauliflower | 89 | 15.00 | 3.98 | 3.27 | 5.82 | **3.17** | New forecaster |
| Bitter gourd | 80 | 22.50 | 7.84 | 3.95 | 6.61 | **3.85** | New forecaster |
| Potato | 78 | 11.00 | 1.23 | 1.22 | 2.88 | **1.16** | New forecaster |
| Ginger(Green) | 72 | 90.00 | 19.91 | 12.72 | 21.08 | **12.13** | New forecaster |
| Black Gram(Urd Beans)(Whole) | 64 | 83.38 | 10.32 | **5.82** | 7.88 | 6.34 | Last week's price |
| Bottle gourd | 64 | 14.25 | 3.98 | **2.68** | 6.67 | 2.77 | Last week's price |
| Green Gram(Moong)(Whole) | 63 | 92.50 | 16.66 | **8.13** | 11.58 | 8.25 | Last week's price |

## Maharashtra, by mandi (2026 test)

| market | Reports | Actual (Rs/kg) | Last month's price | Last week's price | Step-1 model (average per crop) | New forecaster | Best |
|---|---|---|---|---|---|---|---|
| Pune | 336 | 30.00 | 5.29 | **2.87** | 8.63 | 3.04 | Last week's price |
| Mumbai | 288 | 35.00 | 11.66 | **3.09** | 11.85 | 3.51 | Last week's price |
| Pune(Moshi) | 243 | 35.00 | 10.26 | 8.26 | 10.93 | **8.15** | New forecaster |
| Chattrapati Sambhajinagar | 142 | 23.00 | 12.97 | 7.89 | 13.75 | **7.88** | New forecaster |
| Bhusaval | 139 | 20.00 | 10.34 | **4.52** | 9.98 | 4.72 | Last week's price |
| Nagpur | 126 | 28.75 | 8.26 | **5.25** | 13.68 | 5.45 | Last week's price |
| Rahata | 112 | 20.00 | 13.33 | **7.00** | 13.09 | 7.02 | Last week's price |
| Shrirampur | 103 | 20.00 | 10.83 | 8.13 | 13.44 | **7.67** | New forecaster |
| Pune(Pimpri) | 92 | 25.00 | 6.09 | 3.62 | 5.29 | **3.58** | New forecaster |
| Akola | 84 | 59.55 | 8.15 | 6.68 | 8.95 | **6.51** | New forecaster |
| Kamthi | 68 | 23.50 | 8.11 | 6.58 | 10.58 | **6.34** | New forecaster |
| Ratnagiri (Nachane) | 61 | 25.00 | 10.20 | **4.66** | 10.82 | 4.74 | Last week's price |
| Mangal Wedha | 59 | 22.00 | 8.16 | **4.40** | 11.28 | 4.48 | Last week's price |
| Akluj | 57 | 25.00 | 11.25 | 6.55 | 10.80 | **6.26** | New forecaster |
| Karjat | 53 | 40.00 | 8.31 | 4.24 | 4.99 | **3.85** | New forecaster |

## All states, by crop (2026 test)

| commodity | Reports | Actual (Rs/kg) | Last month's price | Last week's price | Step-1 model (average per crop) | New forecaster | Best |
|---|---|---|---|---|---|---|---|
| Tomato | 3,360 | 25.00 | 5.32 | **2.82** | 5.20 | 2.87 | Last week's price |
| Brinjal | 3,266 | 32.50 | 6.46 | 4.08 | 8.12 | **4.00** | New forecaster |
| Potato | 2,998 | 18.00 | 2.74 | 1.73 | 4.82 | **1.71** | New forecaster |
| Onion | 2,988 | 53.00 | 15.52 | **4.14** | 13.34 | 5.06 | Last week's price |
| Bhindi(Ladies Finger) | 2,910 | 32.00 | 5.81 | 3.70 | 6.84 | **3.68** | New forecaster |
| Green Chilli | 2,825 | 46.00 | 8.91 | **5.94** | 9.24 | 5.99 | Last week's price |
| Bitter gourd | 2,468 | 46.00 | 6.56 | 4.24 | 8.25 | **4.21** | New forecaster |
| Bottle gourd | 2,445 | 19.00 | 3.47 | **2.16** | 5.18 | 2.17 | Last week's price |
| Banana | 2,431 | 46.00 | 4.76 | 2.95 | 8.63 | **2.90** | New forecaster |
| Cabbage | 2,218 | 27.50 | 4.42 | 2.32 | 6.20 | **2.30** | New forecaster |
| Pumpkin | 2,137 | 18.00 | 2.49 | 1.48 | 4.03 | **1.46** | New forecaster |
| Cauliflower | 2,087 | 34.00 | 5.41 | 3.35 | 7.36 | **3.32** | New forecaster |
| Cucumbar(Kheera) | 1,891 | 30.00 | 6.06 | 3.88 | 7.79 | **3.78** | New forecaster |
| Ridgeguard(Tori) | 1,833 | 40.00 | 6.69 | **3.32** | 8.07 | 3.36 | Last week's price |
| Raddish | 1,783 | 27.50 | 3.90 | 2.35 | 5.73 | **2.34** | New forecaster |

## All states, by mandi (2026 test)

| state | market | Reports | Actual (Rs/kg) | Last month's price | Last week's price | Step-1 model (average per crop) | New forecaster | Best |
|---|---|---|---|---|---|---|---|---|
| Tamil Nadu | Anna nagar(Uzhavar Sandhai ) | 616 | 53.00 | 13.27 | **8.67** | 16.97 | 8.80 | Last week's price |
| Tamil Nadu | Tiruvannamalai(Uzhavar Sandhai ) | 559 | 52.00 | 10.05 | 6.00 | 14.55 | **5.81** | New forecaster |
| Tamil Nadu | Hosur(Uzhavar Sandhai ) | 552 | 47.50 | 19.61 | 13.55 | 24.37 | **13.14** | New forecaster |
| Tamil Nadu | Thathakapatti(Uzhavar Sandhai ) | 534 | 45.00 | 14.88 | **8.99** | 15.54 | 9.53 | Last week's price |
| Tamil Nadu | RSPuram(Uzhavar Sandhai ) | 528 | 47.50 | 10.81 | 5.72 | 13.33 | **5.62** | New forecaster |
| Tamil Nadu | Chokkikulam(Uzhavar Sandhai ) | 526 | 52.50 | 11.40 | 5.48 | 14.81 | **5.05** | New forecaster |
| Tamil Nadu | Mettupalayam(Uzhavar Sandhai ) | 508 | 47.50 | 9.44 | 4.32 | 14.39 | **4.26** | New forecaster |
| Tamil Nadu | Anaiyur(Uzhavar Sandhai ) | 498 | 55.00 | 12.49 | 6.15 | 15.75 | **6.07** | New forecaster |
| Tamil Nadu | Hasthampatti(Uzhavar Sandhai ) | 493 | 42.50 | 7.60 | 4.61 | 12.12 | **4.55** | New forecaster |
| Tamil Nadu | Theni(Uzhavar Sandhai ) | 484 | 53.25 | 11.68 | **6.16** | 18.08 | 6.40 | Last week's price |
| Tamil Nadu | KKNagar(Uzhavar Sandhai ) | 479 | 56.00 | 14.76 | 7.90 | 17.25 | **7.81** | New forecaster |
| Tamil Nadu | Sooramangalam(Uzhavar Sandhai ) | 474 | 39.00 | 10.03 | **5.20** | 13.22 | 5.64 | Last week's price |
| Tamil Nadu | Singanallur(Uzhavar Sandhai ) | 472 | 50.00 | 13.12 | 6.69 | 15.13 | **6.11** | New forecaster |
| Tamil Nadu | Palanganatham(Uzhavar Sandhai ) | 472 | 55.00 | 13.79 | 7.05 | 16.60 | **6.79** | New forecaster |
| Tamil Nadu | Ammapet(Uzhavar Sandhai ) | 471 | 43.50 | 9.99 | 6.97 | 10.69 | **6.56** | New forecaster |

## By crop (2024-25 test)

| commodity | Reports | Actual (Rs/kg) | Last month's price | Last week's price | Step-1 model (average per crop) | New forecaster | Best |
|---|---|---|---|---|---|---|---|
| Brinjal | 29,212 | 18.00 | 5.34 | **3.46** | 7.53 | 3.48 | Last week's price |
| Green Chilli | 27,600 | 31.50 | 11.16 | 6.12 | 13.38 | **6.01** | New forecaster |
| Bhindi(Ladies Finger) | 23,515 | 20.00 | 7.85 | 4.56 | 11.03 | **4.44** | New forecaster |
| Mustard | 19,991 | 62.00 | 3.32 | 1.78 | 6.21 | **1.65** | New forecaster |
| Wheat | 19,855 | 25.00 | 0.50 | **0.32** | 1.29 | 0.33 | Last week's price |
| Soyabean | 14,562 | 41.95 | 1.93 | 1.47 | 2.56 | **1.45** | New forecaster |
| Garlic | 14,320 | 62.00 | 7.69 | **5.53** | 15.17 | 5.61 | Last week's price |
| Cabbage | 13,957 | 15.00 | 3.75 | **2.25** | 6.82 | 2.27 | Last week's price |
| Ginger(Green) | 13,930 | 40.78 | 5.54 | 4.12 | 9.56 | **4.03** | New forecaster |
| Apple | 13,193 | 112.50 | 18.05 | 10.29 | 29.30 | **9.80** | New forecaster |
| Cauliflower | 12,471 | 26.00 | 7.32 | 4.74 | 13.26 | **4.58** | New forecaster |
| Maize | 11,745 | 21.05 | 1.26 | **0.82** | 1.69 | **0.82** | Last week's price |
| Banana | 9,369 | 27.50 | 1.67 | 1.22 | 3.90 | **1.18** | New forecaster |
| Mango | 8,293 | 33.40 | 15.46 | 7.14 | 24.02 | **6.89** | New forecaster |
| Lentil(Masur)(Whole) | 7,740 | 64.05 | 2.79 | 2.13 | 4.12 | **2.06** | New forecaster |

Full tables (every crop and mandi with at least 30 reports): `per_crop.csv`, `per_market.csv`.

## Limits

- The 2026 test covers only two weeks (2026-09-11 to 2026-09-24), because the 2026 data starts on 21 Jul 2026.
- Maharashtra is only in the 2026 data; the 2024-25 data covers 8 other states.
- There is no data between Aug 2025 and Jul 2026, so the model has seen each month of the year at most once.
- In the app, forecasts are for the week after the latest data. If the data isn't refreshed, they get older.
