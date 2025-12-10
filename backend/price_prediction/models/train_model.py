import os
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.metrics import mean_absolute_error
import joblib

# --------------------------------------------------
# 1️⃣ PATH SETUP
# --------------------------------------------------

current_dir = os.path.dirname(os.path.abspath(__file__))
data_dir = os.path.join(os.path.dirname(current_dir), 'data')
model_dir = current_dir

# --------------------------------------------------
# 2️⃣ TRAINING FUNCTION
# --------------------------------------------------

def train_model():
    # ------------------------
    # Load the dataset
    # ------------------------
    data_path = "D:/Devanshu/Projects/Farmer Consumer website/crop_price_prediction_200_records.csv"
    data = pd.read_csv(data_path)
    
    print("Dataset loaded successfully")
    print("Shape:", data.shape)
    print("First 5 rows:\n", data.head())
    print("Missing values:\n", data.isnull().sum())
    
    # ------------------------
    # Handle missing values
    # ------------------------
    numeric_cols = data.select_dtypes(include=['int64', 'float64']).columns
    categorical_cols = data.select_dtypes(include=['object']).columns
    
    for col in numeric_cols:
        if data[col].isnull().sum() > 0:
            data[col].fillna(data[col].median(), inplace=True)
    
    for col in categorical_cols:
        if data[col].isnull().sum() > 0:
            data[col].fillna(data[col].mode()[0], inplace=True)
    
    # ------------------------
    # Features & target
    # ------------------------
    X = data.drop('price', axis=1) if 'price' in data.columns else data.drop(data.columns[-1], axis=1)
    y = data['price'] if 'price' in data.columns else data[data.columns[-1]]
    
    print("\nFeatures & Target prepared")
    print("Numeric features:", numeric_cols.tolist())
    print("Categorical features:", categorical_cols.tolist())
    print("Target:", y.name)
    
    # ------------------------
    # Preprocessing pipelines
    # ------------------------
    numeric_transformer = Pipeline([
        ('scaler', StandardScaler())
    ])
    
    categorical_transformer = Pipeline([
        ('onehot', OneHotEncoder(handle_unknown='ignore'))
    ])
    
    preprocessor = ColumnTransformer([
        ('num', numeric_transformer, numeric_cols),
        ('cat', categorical_transformer, categorical_cols)
    ])
    
    # ------------------------
    # Model pipeline
    # ------------------------
    model = Pipeline([
        ('preprocessor', preprocessor),
        ('regressor', RandomForestRegressor(n_estimators=100, random_state=42))
    ])
    
    # ------------------------
    # Train-test split
    # ------------------------
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    # ------------------------
    # Train the model
    # ------------------------
    print("\nTraining the Random Forest model...")
    model.fit(X_train, y_train)
    
    # ------------------------
    # Evaluate the model
    # ------------------------
    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    print(f"\nModel Evaluation - Mean Absolute Error (MAE): {mae:.2f}")
    
    # ------------------------
    # Feature importance
    # ------------------------
    feature_names = numeric_cols.tolist() + list(
        model.named_steps['preprocessor']
             .named_transformers_['cat']
             .named_steps['onehot']
             .get_feature_names_out(categorical_cols)
    )
    
    importances = model.named_steps['regressor'].feature_importances_
    indices = np.argsort(importances)[::-1]
    
    print("\nTop 10 Feature Importances:")
    for i in range(min(10, len(feature_names))):
        try:
            print(f"{i+1}. {feature_names[indices[i]]}: {importances[indices[i]]:.4f}")
        except:
            print(f"{i+1}. Feature index error")
    
    # ------------------------
    # Save the model
    # ------------------------
    model_path = os.path.join(model_dir, 'crop_price_model.joblib')
    joblib.dump(model, model_path)
    print(f"\nModel saved to: {model_path}")
    
    # Save feature columns for inference
    feature_columns = {
        'numeric_features': numeric_cols.tolist(),
        'categorical_features': categorical_cols.tolist()
    }
    
    feature_columns_path = os.path.join(model_dir, 'feature_columns.joblib')
    joblib.dump(feature_columns, feature_columns_path)
    print(f"Feature columns saved to: {feature_columns_path}")
    
    return model, mae

# --------------------------------------------------
# 3️⃣ RUN TRAINING
# --------------------------------------------------

if __name__ == "__main__":
    model, mae = train_model()
    print("\n✅ Training completed successfully")
