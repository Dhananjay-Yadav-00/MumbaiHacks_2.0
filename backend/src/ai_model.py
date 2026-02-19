import lightgbm as lgb
import pandas as pd
import numpy as np
import os
import logging

logger = logging.getLogger(__name__)

MODEL_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models", "lgb_model.txt")
model = None

def train_model():
    """Train a simple LightGBM model on dummy data if no model exists."""
    global model
    
    # Generate dummy historical data
    logger.info("Training LightGBM model...")
    data = []
    for _ in range(1000):
        er = random.randint(0, 200)
        beds = random.randint(0, 100)
        amb = random.randint(0, 20)
        staff = random.randint(50, 150)
        hour = random.randint(0, 23)
        
        # Target: Future ER admissions (simple formula for demo)
        target = er * 0.8 + (100 - beds) * 0.5 + amb * 2 + (200 - staff) * 0.2
        if hour > 18 or hour < 6: # Night time surge
            target *= 1.1
            
        data.append([er, beds, amb, staff, hour, target])
        
    df = pd.DataFrame(data, columns=['er_admissions', 'bed_availability', 'ambulance_arrivals', 'staff_capacity', 'hour', 'target'])
    
    X = df.drop('target', axis=1)
    y = df['target']
    
    train_data = lgb.Dataset(X, label=y)
    params = {
        'objective': 'regression',
        'metric': 'rmse',
        'verbosity': -1
    }
    
    model = lgb.train(params, train_data, num_boost_round=100)
    
    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    model.save_model(MODEL_PATH)
    logger.info("Model trained and saved.")

def load_model():
    global model
    if os.path.exists(MODEL_PATH):
        model = lgb.Booster(model_file=MODEL_PATH)
        logger.info("Loaded existing LightGBM model.")
    else:
        train_model()

import random # Needed for training dummy data

def predict_congestion(hospital_data):
    """
    Predict congestion score based on hospital data.
    Returns a float representing predicted ER admissions.
    """
    global model
    if not model:
        load_model()
        
    # Extract features
    features = [
        hospital_data.get('er_admissions', 0),
        hospital_data.get('bed_availability', 0),
        hospital_data.get('ambulance_arrivals', 0),
        hospital_data.get('staff_capacity', 100),
        pd.Timestamp.now().hour # Current hour
    ]
    
    # Reshape for prediction
    prediction = model.predict([features])[0]
    return prediction
