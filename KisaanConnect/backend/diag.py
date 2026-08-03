import joblib, pandas as pd
from pathlib import Path

base = Path(__file__).resolve().parent
m = joblib.load(base / "price_prediction" / "models" / "crop_price_model.joblib")
df = pd.read_csv(base / "price_prediction" / "data" / "real_mandi_data.csv")

print("STATES IN DATA:")
print(df["State"].value_counts())
print()

state = df["State"].value_counts().index[0]
print(f"Predicting with a state that EXISTS in training: {state}")
print()

for c in ["Onion", "Banana", "Tomato", "Potato", "Brinjal", "Ginger(Green)"]:
    sub = df[(df.Commodity == c) & (df.State == state)]
    if sub.empty:
        print(f"{c:16} no rows for {state}")
        continue
    var = sub.Variety.mode()[0]
    X = pd.DataFrame([{"State": state, "Commodity": c, "Variety": var}])
    print(f"{c:16} pred={m.predict(X)[0]:8.0f}   actual_mean={sub['Modal_x0020_Price'].mean():8.0f}   n={len(sub)}")