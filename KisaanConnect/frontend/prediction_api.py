try:
    model = joblib.load(model_path)
    feature_columns = joblib.load(feature_columns_path)
    print("Model loaded successfully")
except Exception as e:
    print(f"Model load failed: {e}")
    model = None
    feature_columns = None


async def lifespan(app: FastAPI):
    yield