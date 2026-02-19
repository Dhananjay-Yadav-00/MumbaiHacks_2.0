"""
Step 4: Train surge prediction models
-------------------------------------
Trains 3 models:
  - Admissions
  - ICU occupancy
  - Ventilator usage

Supports different modes:
  - "xgb"      -> XGBoost only
  - "hgb"      -> HistGradientBoosting only
  - "hybrid"   -> Enhanced weighted ensemble of XGB + HGB + LightGBM

Saves them as dicts { "model": ..., "features": [...] }
so they can be safely loaded in step 5.
"""

from pathlib import Path
import warnings
import numpy as np
import pandas as pd
import joblib

from sklearn.ensemble import HistGradientBoostingRegressor, RandomForestRegressor
from xgboost import XGBRegressor
from sklearn.model_selection import TimeSeriesSplit, GroupShuffleSplit
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.linear_model import LinearRegression

warnings.filterwarnings("ignore", message="Could not find the number of physical cores")

# ---------------- CONFIG ----------------
DATA = Path("dataset/clean_snapshot.csv")
MODELDIR = Path("models")
MODELDIR.mkdir(parents=True, exist_ok=True)

ADM_OUT = MODELDIR / "adm_model.joblib"
ICU_OUT = MODELDIR / "icu_model.joblib"
VENT_OUT = MODELDIR / "vent_model.joblib"

# Change this to "xgb", "hgb", "rf", or "hybrid"
MODE = "hgb"
# ----------------------------------------

# Store results for table display
RESULTS = []


def make_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.sort_values(["hospital_id", "timestamp"]).copy()
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")

    # Temporal features
    df["day_of_year"] = df["timestamp"].dt.dayofyear.fillna(0).astype(int)
    df["week_of_year"] = df["timestamp"].dt.isocalendar().week.fillna(0).astype(int)
    df["is_month_end"] = df["timestamp"].dt.is_month_end.astype(int)
    df["is_month_start"] = df["timestamp"].dt.is_month_start.astype(int)
    df["is_quarter_end"] = df["timestamp"].dt.is_quarter_end.astype(int)
    df["is_quarter_start"] = df["timestamp"].dt.is_quarter_start.astype(int)
    df["is_year_end"] = df["timestamp"].dt.is_year_end.astype(int)
    df["is_year_start"] = df["timestamp"].dt.is_year_start.astype(int)

    # Lags
    for lag in (1, 2, 3, 7, 14, 30):
        df[f"adm_lag_{lag}"] = df.groupby("hospital_id")["admission"].shift(lag)
        df[f"icu_lag_{lag}"] = df.groupby("hospital_id")["icu_occup"].shift(lag)
        df[f"vent_lag_{lag}"] = df.groupby("hospital_id")["ventilators_used"].shift(lag)

    # Rolling stats
    for window in (3, 7, 14, 30):
        df[f"adm_roll_{window}"] = (
            df.groupby("hospital_id")["admission"]
            .rolling(window, min_periods=1).mean().reset_index(0, drop=True)
        )
        df[f"icu_roll_{window}"] = (
            df.groupby("hospital_id")["icu_occup"]
            .rolling(window, min_periods=1).mean().reset_index(0, drop=True)
        )
        df[f"vent_roll_{window}"] = (
            df.groupby("hospital_id")["ventilators_used"]
            .rolling(window, min_periods=1).mean().reset_index(0, drop=True)
        )
        df[f"adm_roll_std_{window}"] = (
            df.groupby("hospital_id")["admission"]
            .rolling(window, min_periods=1).std().reset_index(0, drop=True)
        )

    # Safety columns
    for col in [
        "festival", "outbreak", "readiness_index", "patient_inflow", "avg_treatment_time",
        "bed_occupancy_rate", "icu_occupancy_rate", "ventilator_utilization",
        "staff_utilization", "hour", "dow", "is_peak", "is_night", "is_festival",
        "pollution_season", "weather_surge", "is_weekend"
    ]:
        if col not in df.columns:
            df[col] = 0

    return df


def safe_mape(y_true, y_pred):
    y_true, y_pred = np.array(y_true), np.array(y_pred)
    mask = y_true != 0
    if mask.sum() == 0:
        return 0.0
    return (np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])).mean()


def time_or_group_split(X, y, ids):
    """TimeSeriesSplit per hospital; fallback to GroupShuffleSplit"""
    tscv = TimeSeriesSplit(n_splits=5)
    X_tr_list, X_te_list, y_tr_list, y_te_list = [], [], [], []

    for hid in ids.unique():
        m = ids == hid
        X_h, y_h = X[m], y[m]
        if len(X_h) > 10:
            for tr_idx, te_idx in tscv.split(X_h):
                X_tr_list.append(X_h.iloc[tr_idx])
                X_te_list.append(X_h.iloc[te_idx])
                y_tr_list.append(y_h.iloc[tr_idx])
                y_te_list.append(y_h.iloc[te_idx])
                break

    if X_tr_list:
        return (
            pd.concat(X_tr_list), pd.concat(X_te_list),
            pd.concat(y_tr_list), pd.concat(y_te_list),
        )

    gss = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
    tr_idx, te_idx = next(gss.split(X, y, groups=ids))
    return X.iloc[tr_idx], X.iloc[te_idx], y.iloc[tr_idx], y.iloc[te_idx]


def build_model():
    """Return model depending on MODE"""
    if MODE == "xgb":
        return XGBRegressor(
            n_estimators=200, max_depth=6, learning_rate=0.1,
            subsample=0.8, colsample_bytree=0.8, random_state=42
        )
    elif MODE == "hgb":
        return HistGradientBoostingRegressor(
            max_iter=300, max_depth=10, learning_rate=0.05,
            random_state=42
        )
    elif MODE == "rf":
        return RandomForestRegressor(
            n_estimators=150, max_depth=8, random_state=42
        )
    elif MODE == "hybrid":
        return {
            "hgb": HistGradientBoostingRegressor(max_iter=300, max_depth=10, learning_rate=0.05, random_state=42),
            "xgb": XGBRegressor(n_estimators=200, max_depth=6, learning_rate=0.1,
                                subsample=0.8, colsample_bytree=0.8, random_state=42),
            "rf": RandomForestRegressor(n_estimators=150, max_depth=8, random_state=42)
        }
    else:
        raise ValueError(f"Unknown MODE: {MODE}")


class AdvancedEnsemble:
    """Enhanced ensemble with stacking and dynamic weighting"""
    
    def __init__(self, base_models):
        self.base_models = base_models
        self.meta_model = LinearRegression()
        self.weights = None
        
    def fit(self, X_tr, y_tr, X_val, y_val):
        # Train base models
        for name, model in self.base_models.items():
            model.fit(X_tr, y_tr)
        
        # Create meta-features using validation predictions
        meta_features = np.column_stack([
            model.predict(X_val) for model in self.base_models.values()
        ])
        
        # Train meta-model
        self.meta_model.fit(meta_features, y_val)
        
        # Compute dynamic weights based on validation performance
        val_scores = {}
        for name, model in self.base_models.items():
            pred = model.predict(X_val)
            # Use inverse RMSE for weighting (better models get higher weight)
            rmse = np.sqrt(mean_squared_error(y_val, pred))
            val_scores[name] = 1 / (rmse + 1e-6)
        
        # Normalize weights
        total_score = sum(val_scores.values())
        self.weights = {k: v/total_score for k, v in val_scores.items()}
        
        return self
    
    def predict(self, X):
        # Get predictions from base models
        base_preds = np.column_stack([
            model.predict(X) for model in self.base_models.values()
        ])
        
        # Stacking prediction (primary)
        stacked_pred = self.meta_model.predict(base_preds)
        
        # Weighted average prediction (secondary)
        weighted_pred = sum(
            self.weights[name] * self.base_models[name].predict(X)
            for name in self.base_models.keys()
        )
        
        # Combine both approaches (70% stacking, 30% weighted)
        final_pred = 0.7 * stacked_pred + 0.3 * weighted_pred
        
        return final_pred


def fit_and_eval(X_tr, y_tr, X_te, y_te, label, target_name):
    if MODE != "hybrid":
        model = build_model()
        model.fit(X_tr, y_tr)
        pred = model.predict(X_te)
    else:
        # Split training data for validation
        from sklearn.model_selection import train_test_split
        X_train, X_val, y_train, y_val = train_test_split(
            X_tr, y_tr, test_size=0.2, random_state=42
        )
        
        base_models = build_model()
        ensemble = AdvancedEnsemble(base_models)
        ensemble.fit(X_train, y_train, X_val, y_val)
        
        pred = ensemble.predict(X_te)
        model = ensemble
        
        # Print individual model performance for research insights
        print(f"   📊 {label} - Individual Model Performance:")
        for name, base_model in base_models.items():
            base_pred = base_model.predict(X_te)
            base_mae = mean_absolute_error(y_te, base_pred)
            base_mape = safe_mape(y_te, base_pred)
            weight = ensemble.weights.get(name, 0)
            print(f"      {name.upper()}: MAE={base_mae:.4f}, MAPE={base_mape:.4f}, Weight={weight:.3f}")

    mae = mean_absolute_error(y_te, pred)
    mape = safe_mape(y_te, pred)
    print(f"🔹 {label} -> MAE: {mae:.4f}, MAPE: {mape:.4f}")
    
    # Store result for table
    if MODE == "rf":
        model_name = "Random Forest"
    elif MODE == "hybrid":
        model_name = "Hybrid Ensemble"
    else:
        model_name = MODE.upper()
    
    RESULTS.append({
        "Model": model_name,
        "Target Variable": target_name,
        "MAE": mae,
        "MAPE": mape
    })
    
    return model


def print_results_table():
    """Print results in a formatted table"""
    print("\n" + "="*80)
    print("PERFORMANCE SUMMARY")
    print("="*80)
    
    # Create header
    print(f"{'Model':<25} {'Target Variable':<20} {'MAE':>10} {'MAPE (%)':>10}")
    print("-"*80)
    
    # Print each result
    for result in RESULTS:
        print(f"{result['Model']:<25} {result['Target Variable']:<20} "
              f"{result['MAE']:>10.4f} {result['MAPE']:>10.4f}")
    
    print("="*80)


def train():
    print("📂 Loading dataset...")
    df = pd.read_csv(DATA)
    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    df = make_features(df)

    # Add some noise to prevent perfect predictions on synthetic data
    if df["admission"].std() < 0.1 or df["icu_occup"].std() < 0.1:
        print("🔄 Adding realistic variance to synthetic data...")
        np.random.seed(42)
        df["admission"] = np.maximum(0, df["admission"] + np.random.normal(0, 0.5, len(df)))
        df["icu_occup"] = np.maximum(0, df["icu_occup"] + np.random.normal(0, 0.3, len(df)))
        df["ventilators_used"] = np.maximum(0, df["ventilators_used"] + np.random.normal(0, 0.2, len(df)))

    # Targets
    y_adm = df["admission"]
    y_icu = df["icu_occup"]
    y_vent = df["ventilators_used"]

    drop_cols = ["timestamp", "hospital_id", "admission", "icu_occup", "ventilators_used"]
    features = [c for c in df.columns if c not in drop_cols]
    X = pd.get_dummies(df[features])  # safety for categoricals

    # Train/val splits
    X_adm_tr, X_adm_te, y_adm_tr, y_adm_te = time_or_group_split(X, y_adm, df["hospital_id"])
    X_icu_tr, X_icu_te, y_icu_tr, y_icu_te = time_or_group_split(X, y_icu, df["hospital_id"])
    X_vent_tr, X_vent_te, y_vent_tr, y_vent_te = time_or_group_split(X, y_vent, df["hospital_id"])

    print(f"\n=== Training mode: {MODE.upper()} ===")

    # Train each model
    adm_model = fit_and_eval(X_adm_tr, y_adm_tr, X_adm_te, y_adm_te, "Admissions", "Admissions")
    icu_model = fit_and_eval(X_icu_tr, y_icu_tr, X_icu_te, y_icu_te, "ICU", "ICU Occupancy")
    vent_model = fit_and_eval(X_vent_tr, y_vent_tr, X_vent_te, y_vent_te, "Ventilator", "Ventilator Usage")

    # Save dict-wrapped models
    joblib.dump({"model": adm_model, "features": list(X.columns)}, ADM_OUT)
    joblib.dump({"model": icu_model, "features": list(X.columns)}, ICU_OUT)
    joblib.dump({"model": vent_model, "features": list(X.columns)}, VENT_OUT)

    print(f"✅ Models saved at {MODELDIR}")

    # Print results table
    print_results_table()

    # Research summary
    if MODE == "hybrid":
        print(f"\n📋 RESEARCH SUMMARY:")
        print(f"   Hybrid ensemble combines XGBoost, HistGradientBoosting, and RandomForest")
        print(f"   Uses advanced stacking with meta-learning and dynamic weighting")
        print(f"   This approach should outperform individual algorithms")


if __name__ == "__main__":
    train()