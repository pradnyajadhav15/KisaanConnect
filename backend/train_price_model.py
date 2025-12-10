#!/usr/bin/env python
"""
Train Crop Price Prediction Model

This script trains the crop price prediction model and saves it for inference.
Run this script before starting the API to ensure the model is available.
"""

import os
import sys

# ------------------------------
# Add project directory to path
# ------------------------------
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

# ------------------------------
# Import training function
# ------------------------------
from price_prediction.models.train_model import train_model

# ------------------------------
# Main execution
# ------------------------------
if __name__ == "__main__":
    print("=== Training Crop Price Prediction Model ===\n")
    
    # Train the model
    model, mae = train_model()
    
    # Output training results
    print("\n=== Training Completed ===")
    print(f"Mean Absolute Error (MAE) on test set: {mae:.2f}")
    print("\nModel has been saved. You can now start the API with:\n    python main.py")
