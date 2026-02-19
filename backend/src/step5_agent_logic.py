import pandas as pd
import numpy as np
from pathlib import Path
from joblib import load
import math
import requests
from datetime import datetime
import os, json
from math import radians, sin, cos, sqrt, atan2
# NOTE: if you created a requests-based geocode helper earlier, this file expects geocode_location to exist.
# If you used geopy, keep that import and helper; otherwise keep your requests-based geocoder.
try:
    from geopy.geocoders import Nominatim  # optional; may not be installed
except Exception:
    Nominatim = None

# -----------------------------------------------------------------------------
# Paths & Config
# -----------------------------------------------------------------------------
DATA_PATH = Path("dataset/clean_snapshot.csv")
MODEL_PATH = Path("models/surge_multioutput_rf.joblib")
FEATURES_PATH = Path("models/surge_features.txt")

# Optional API keys (kept as placeholders)
TRAFFIC_API_KEY = os.getenv("TRAFFIC_API_KEY", "your_traffic_api_key")
WEATHER_API_KEY = os.getenv("WEATHER_API_KEY", "your_weather_api_key")

# -----------------------------------------------------------------------------
# Utilities
# -----------------------------------------------------------------------------
def latest_per_hospital(df: pd.DataFrame) -> pd.DataFrame:
    df = df.sort_values("timestamp")
    return df.groupby("hospital_id").tail(1).reset_index(drop=True)

def get_real_time_traffic(origin, destination):
    """Placeholder: returns a semi-realistic travel time in minutes.
    Replace with real API logic (Google, HERE, TomTom) when keys are available.
    """
    try:
        base_time = np.random.randint(8, 45)
        jitter = np.random.normal(0, 3)
        return max(5, int(base_time + jitter))
    except Exception:
        return max(5, np.random.randint(8, 45))

# -------------------------
# Geocoding + Distance helpers
# -------------------------
# If you prefer geopy, ensure it's installed (pip install geopy). Otherwise this file can still work
# if you include your earlier requests-based geocode_location helper. Below we provide a small fallback.

_GEOCODE_CACHE = Path("dataset/geocode_cache.json")

def _load_geocode_cache():
    if _GEOCODE_CACHE.exists():
        try:
            return json.loads(_GEOCODE_CACHE.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}

def _save_geocode_cache(cache):
    try:
        _GEOCODE_CACHE.parent.mkdir(parents=True, exist_ok=True)
        _GEOCODE_CACHE.write_text(json.dumps(cache, indent=2), encoding="utf-8")
    except Exception:
        pass

def geocode_location(address: str, city_hint: str = "Mumbai, India", sleep_sec: float = 0.8):
    """Geocode address using Nominatim (via geopy if available, otherwise direct HTTP).
    Caches results in dataset/geocode_cache.json to avoid rate limits.
    Returns (lat, lon) or (None, None) on failure.
    """
    if not address:
        return None, None

    q = address.strip()
    full_q = q if "mumbai" in q.lower() else f"{q}, {city_hint}"

    cache = _load_geocode_cache()
    if full_q in cache:
        rec = cache[full_q]
        return float(rec["lat"]), float(rec["lon"])

    # Try geopy first if installed
    if Nominatim is not None:
        try:
            geolocator = Nominatim(user_agent="hospital_routing")
            location = geolocator.geocode(full_q, timeout=10)
            if location:
                lat, lon = float(location.latitude), float(location.longitude)
                cache[full_q] = {"lat": lat, "lon": lon}
                _save_geocode_cache(cache)
                return lat, lon
        except Exception:
            pass

    # Fallback to direct HTTP request to Nominatim
    try:
        url = "https://nominatim.openstreetmap.org/search"
        headers = {"User-Agent": "MumbaiHacks/1.0 (contact:you@example.com)"}
        params = {"q": full_q, "format": "json", "limit": 1}
        resp = requests.get(url, params=params, headers=headers, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        if data:
            lat = float(data[0]["lat"])
            lon = float(data[0]["lon"])
            cache[full_q] = {"lat": lat, "lon": lon}
            _save_geocode_cache(cache)
            # polite pause (avoid throttle)
            try:
                import time
                time.sleep(sleep_sec)
            except Exception:
                pass
            return lat, lon
    except Exception:
        pass

    return None, None

def haversine_distance(lat1, lon1, lat2, lon2):
    """Compute haversine distance (km) between two lat/lon points."""
    R = 6371.0  # Earth radius in km
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return R * c  # km

def get_time_of_day_multiplier():
    """Return multiplier based on Indian traffic patterns (Mumbai typical)."""
    hour = datetime.now().hour
    if (hour >= 22 or hour < 6):        # Late night / early morning
        return 1.1
    if 6 <= hour < 8 or 9 <= hour < 10 or 15 <= hour < 17:
        return 1.5
    if 8 <= hour < 9 or 17 <= hour < 20:  # Peak hours
        return 2.0
    if 10 <= hour < 15 or 20 <= hour < 22:
        return 1.3
    return 1.3


def get_distance_factor(distance_km):
    """Extra scaling by distance for short/medium/long routes."""
    if distance_km < 3:
        return 1.3
    if distance_km < 10:
        return 1.6
    return 1.4

def adjust_eta(duration_minutes, distance_km, cap_multiplier=3.0):
    """Adjust ETA based on traffic multipliers."""
    tod_mul = get_time_of_day_multiplier()
    dist_mul = get_distance_factor(distance_km)
    multiplier = min(tod_mul * dist_mul, cap_multiplier)
    adjusted_minutes = math.ceil(duration_minutes * multiplier)
    return adjusted_minutes, round(multiplier, 2)

def estimate_travel_time_km(distance_km, speed_kmh=30.0):
    """Convert distance (km) into travel time (minutes) using an average speed."""
    if distance_km is None:
        return None
    return float((distance_km / max(speed_kmh, 1e-6)) * 60.0)

def build_travel_minutes_from_geo(latest_df: pd.DataFrame, incident_lat: float, incident_lon: float, speed_kmh=30.0):
    """
    Build two dicts:
      - travel_minutes: {hospital_id: minutes (adjusted for traffic)}
      - distances_km: {hospital_id: distance_km}
    Uses columns 'lat'/'lon' or 'latitude'/'longitude' if present; otherwise falls back to get_real_time_traffic.
    """
    travel_minutes = {}
    distances_km = {}
    for _, row in latest_df.iterrows():
        hid = row.get("hospital_id")
        lat = None
        lon = None

        # Try common column names for coordinates
        for c in ["lat", "latitude", "LAT", "Latitude"]:
            if c in row and pd.notnull(row[c]):
                lat = row[c]
                break
        for c in ["lon", "longitude", "LON", "Longitude"]:
            if c in row and pd.notnull(row[c]):
                lon = row[c]
                break

        try:
            if lat is not None and lon is not None:
                lat_f = float(lat)
                lon_f = float(lon)

                # 1️⃣ Calculate straight-line distance
                dist_km = haversine_distance(incident_lat, incident_lon, lat_f, lon_f)

                # 2️⃣ Estimate base travel time (at constant 30 km/h average)
                travel_min = estimate_travel_time_km(dist_km, speed_kmh=speed_kmh)

                # 3️⃣ Clip to reasonable range (3–240 min)
                travel_min = float(np.clip(travel_min, 3.0, 240.0))

                # 4️⃣ ✅ Adjust for Indian traffic (Mumbai typical)
                adjusted_min, multiplier = adjust_eta(travel_min, dist_km)

                # 5️⃣ Log the adjustment for debugging
                print(f"🚦 Hospital {hid}: {round(dist_km,2)} km → "
                      f"{travel_min:.1f} min × {multiplier} = {adjusted_min} min")

                # Use adjusted value
                travel_minutes[hid] = adjusted_min
                distances_km[hid] = dist_km

            else:
                # Fallback if coordinates missing
                travel_min = float(get_real_time_traffic("incident", str(hid)))
                dist_km = None
                travel_minutes[hid] = travel_min
                distances_km[hid] = dist_km

        except Exception as e:
            print(f"⚠️ Error computing travel time for hospital {hid}: {e}")
            travel_min = float(get_real_time_traffic("incident", str(hid)))
            dist_km = None
            travel_minutes[hid] = travel_min
            distances_km[hid] = dist_km

    return travel_minutes, distances_km

# -----------------------------------------------------------------------------
# Models & Features
# (unchanged from your existing code, preserved)
# -----------------------------------------------------------------------------
def load_model_and_features():
    """Load either 3 separate models or a single multi-output model."""
    ADM_MODEL_PATH = Path("models/adm_model.joblib")
    ICU_MODEL_PATH = Path("models/icu_model.joblib")
    VENT_MODEL_PATH = Path("models/vent_model.joblib")

    if ADM_MODEL_PATH.exists() and ICU_MODEL_PATH.exists() and VENT_MODEL_PATH.exists():
        print("Loading separate models...")
        adm_blob = load(ADM_MODEL_PATH)
        icu_blob = load(ICU_MODEL_PATH)
        vent_blob = load(VENT_MODEL_PATH)

        adm_model = adm_blob.get("model", adm_blob) if isinstance(adm_blob, dict) else adm_blob
        icu_model = icu_blob.get("model", icu_blob) if isinstance(icu_blob, dict) else icu_blob
        vent_model = vent_blob.get("model", vent_blob) if isinstance(vent_blob, dict) else vent_blob

        features = []
        if isinstance(adm_blob, dict):
            features = adm_blob.get("features", [])
        if not features:
            # sensible defaults if feature list not present in blob
            features = [
                'bed_occupancy_rate', 'icu_occupancy_rate', 'staff_utilization',
                'total_beds', 'occupied', 'icu_capa', 'icu_occup', 'icu_avail',
                'ventilator', 'ventilators_used', 'trauma_capacity', 'trauma_cases'
            ]

        class MultiModelWrapper:
            def __init__(self, adm_model, icu_model, vent_model):
                self.adm_model = adm_model
                self.icu_model = icu_model
                self.vent_model = vent_model

            def predict(self, X):
                try:
                    adm_pred = self.adm_model.predict(X)
                    icu_pred = self.icu_model.predict(X)
                    vent_pred = self.vent_model.predict(X)
                except Exception as e:
                    print(f"Model prediction failed, using fallback: {e}")
                    n = len(X)
                    adm_pred = np.maximum(0, np.random.normal(2, 1, n))
                    icu_pred = np.maximum(0, np.random.normal(1, 0.5, n))
                    vent_pred = np.maximum(0, np.random.normal(0.5, 0.3, n))

                # Add variation if any vector is all-zero
                if np.all(adm_pred == 0):
                    adm_pred = np.maximum(0, np.random.normal(2, 1, len(X)))
                if np.all(icu_pred == 0):
                    icu_pred = np.maximum(0, np.random.normal(1, 0.5, len(X)))
                if np.all(vent_pred == 0):
                    vent_pred = np.maximum(0, np.random.normal(0.5, 0.3, len(X)))

                return np.column_stack([adm_pred, icu_pred, vent_pred])

        return MultiModelWrapper(adm_model, icu_model, vent_model), features

    elif MODEL_PATH.exists():
        blob = load(MODEL_PATH)
        model = blob["model"]
        features = blob["features"]
        return model, features

    else:
        raise FileNotFoundError(
            "No models found. Please run step4_train.py first.\n"
            f"Looking for either: {MODEL_PATH} (multi-output) or the 3 separate models."
        )

# -----------------------------------------------------------------------------
# Scoring & Readiness (unchanged)
# -----------------------------------------------------------------------------
def compute_capacity_score(row: pd.Series) -> float:
    beds_total = max(float(row.get("total_beds", 1)), 1)
    beds_occ = float(row.get("occupied", 0))
    bed_free_ratio = max(0.0, 1.0 - (beds_occ / beds_total))

    staff_util = float(row.get("staff_utilization", 0.7))
    staff_room = max(0.0, 1.0 - staff_util)

    icu_occ = float(row.get("icu_occupancy_rate", 0.6))
    icu_room = max(0.1, 1.0 - icu_occ)

    trauma_cap = float(row.get("trauma_capacity", 5))
    trauma_util = min(1.0, float(row.get("trauma_cases", 0)) / max(1, trauma_cap))
    trauma_room = max(0.1, 1.0 - trauma_util)

    score = (
        10.0 * bed_free_ratio * 0.4 +
        10.0 * staff_room * 0.3 +
        10.0 * icu_room * 0.2 +
        10.0 * trauma_room * 0.1
    )
    return float(np.clip(score, 0, 10))

def compute_readiness_index(row):
    free_bed = 1 - row.get("bed_occupancy_rate", 1)
    free_bed = min(max(free_bed, 0), 1)

    icu_free_ratio = 0
    if row.get("icu_capa", 0) > 0:
        icu_free_ratio = row.get("icu_avail", 0) / row.get("icu_capa", 1)
        icu_free_ratio = min(max(icu_free_ratio, 0), 1)

    vent_free_ratio = 0
    if row.get("ventilator", 0) > 0:
        vent_free_ratio = (row.get("ventilator", 0) - row.get("ventilators_used", 0)) / row.get("ventilator", 1)
        vent_free_ratio = min(max(vent_free_ratio, 0), 1)

    staff_factor = 1 - row.get("staff_utilization", 0.7)
    staff_factor = min(max(staff_factor, 0), 1)

    trauma_cap = row.get("trauma_capacity", 5)
    trauma_used = row.get("trauma_cases", 0)
    trauma_factor = 1 - (trauma_used / max(1, trauma_cap))
    trauma_factor = min(max(trauma_factor, 0), 1)

    readiness = (
        0.3 * free_bed +
        0.25 * icu_free_ratio +
        0.15 * vent_free_ratio +
        0.2 * staff_factor +
        0.1 * trauma_factor
    )
    return readiness

def recommend_staff_and_supplies(row, pred_adm, pred_icu, pred_vent, critical_cases=0):
    base_staff = max(10, row.get("staff_avail", 20))
    PATIENTS_PER_DOCTOR = 6
    CRITICAL_PER_SPECIALIST = 2

    staff_avail = max(1, int(row.get("staff_avail", base_staff)))
    staff_capacity = staff_avail * PATIENTS_PER_DOCTOR

    total_predicted = pred_adm + critical_cases
    extra_doctors = max(0, math.ceil((total_predicted - staff_capacity) / PATIENTS_PER_DOCTOR))

    extra_specialists = max(0, math.ceil(critical_cases / CRITICAL_PER_SPECIALIST))

    icu_cap = int(row.get("icu_capa", 0))
    icu_occ = int(row.get("icu_occup", 0))
    icu_spare = max(0, icu_cap - icu_occ)
    icu_short = max(0, int(pred_icu - icu_spare))

    vent_total = int(row.get("ventilator", 0))
    vent_used = int(row.get("ventilators_used", 0))
    vent_spare = max(0, vent_total - vent_used)
    vent_short = max(0, int(pred_vent - vent_spare))

    oxygen_cylinders_req = int(max(0, math.ceil(pred_adm * 0.3 + critical_cases * 0.5)))
    blood_units_req = int(max(0, math.ceil(pred_adm * 0.2 + critical_cases * 2)))
    trauma_kits_req = int(max(0, math.ceil(critical_cases * 1.5)))

    urgency = "LOW"
    if pred_adm > staff_capacity * 1.5 or icu_short > 2 or vent_short > 1 or critical_cases > 3:
        urgency = "CRITICAL"
    elif pred_adm > staff_capacity * 1.2 or icu_short > 0 or vent_short > 0 or critical_cases > 0:
        urgency = "HIGH"
    elif pred_adm > staff_capacity:
        urgency = "MEDIUM"

    return {
        "extra_doctors": int(extra_doctors),
        "extra_specialists": int(extra_specialists),
        "icu_short": int(icu_short),
        "vent_short": int(vent_short),
        "oxygen_cylinders": int(oxygen_cylinders_req),
        "blood_units": int(blood_units_req),
        "trauma_kits": int(trauma_kits_req),
        "urgency": urgency,
    }

# -----------------------------------------------------------------------------
# Feature Matrix + Predictions
# -----------------------------------------------------------------------------
def build_feature_matrix(latest: pd.DataFrame, features):
    X = latest.copy()
    missing = [c for c in features if c not in X.columns]
    if missing:
        X = pd.concat([X, pd.DataFrame(0, index=X.index, columns=missing)], axis=1)
    return X[features].fillna(0)

def predict_surges(latest: pd.DataFrame):
    model, features = load_model_and_features()
    X = build_feature_matrix(latest, features)
    preds = model.predict(X)
    latest["pred_adm_next"] = preds[:, 0]
    latest["pred_icu_next"] = preds[:, 1]
    latest["pred_vent_next"] = preds[:, 2]
    return latest

# -----------------------------------------------------------------------------
# Scenario Simulation (single-incident)
# -----------------------------------------------------------------------------
def apply_scenario(critical: int, stable: int, scenario: str = "normal"):
    scenario = (scenario or "normal").strip().lower()
    if scenario == "accident":
        critical = int(round(critical * 2.0))
        stable = int(round(stable * 1.2))
    elif scenario == "outbreak":
        critical = int(round(critical * 3.0))
        stable = int(round(stable * 3.0))
    elif scenario in ("festival", "festival crowd", "festival_crowd"):
        critical = int(round(critical * 1.2))
        stable = int(round(stable * 1.4))
    # else: normal
    return critical, stable

# -----------------------------------------------------------------------------
# Routing (kept inside this file to avoid import conflicts)
# - updated to accept travel_minutes (dict) and distances (dict) via main()
# -----------------------------------------------------------------------------
def optimize_routing(latest, critical_patients, stable_patients, incident_location, travel_minutes: dict = None, distances: dict = None):
    df = latest.copy()

    # Predictions
    df = predict_surges(df)

    # Scores
    df["capacity_score"] = df.apply(compute_capacity_score, axis=1)
    df["readiness_index"] = df.apply(compute_readiness_index, axis=1)

    # travel_min comes from travel_minutes mapping if provided, otherwise fallback random
    if travel_minutes is None:
        travel_minutes = {hid: get_real_time_traffic(incident_location, hid) for hid in df["hospital_id"]}
    df["travel_min"] = df["hospital_id"].map(travel_minutes).astype(float).fillna(20.0)

    # Add distance_km if distances mapping provided
    if distances is not None:
        df["distance_km"] = df["hospital_id"].map(distances)
    else:
        df["distance_km"] = None

    df["total_score"] = (
        df["travel_min"] * 0.3 +
        df["pred_adm_next"] * 0.2 +
        (10 - df["capacity_score"]) * 0.3 +
        (1 - df["readiness_index"]) * 0.2
    )
    df = df.sort_values("total_score").reset_index(drop=True)

    # Capacity buckets
    MAX_CRITICAL_PER_HOSPITAL = 5
    MAX_STABLE_PER_HOSPITAL = 8

    df["trauma_cap_bucket"] = np.minimum(
        MAX_CRITICAL_PER_HOSPITAL,
        np.maximum(1, np.floor(df["trauma_capacity"] * 0.6)).astype(int)
    )
    df["general_cap_bucket"] = np.minimum(
        MAX_STABLE_PER_HOSPITAL,
        np.maximum(2, np.floor((df["total_beds"] - df["occupied"]) * 0.5)).astype(int)
    )

    df["assigned_critical"] = 0
    df["assigned_stable"] = 0

    # Distribute critical patients (prefer trauma-capable)
    trauma_hospitals = df[df["trauma_cap_bucket"] > 0].sort_values("total_score")
    remain_crit = int(critical_patients)

    for idx, row in trauma_hospitals.iterrows():
        if remain_crit <= 0:
            break
        can_take = int(min(row["trauma_cap_bucket"], remain_crit, 3))
        if can_take > 0:
            df.at[idx, "assigned_critical"] += can_take
            remain_crit -= can_take

    if remain_crit > 0:
        for idx, row in trauma_hospitals.iterrows():
            if remain_crit <= 0:
                break
            current_assigned = int(df.at[idx, "assigned_critical"])
            can_take_more = int(min(row["trauma_cap_bucket"] - current_assigned, remain_crit))
            if can_take_more > 0:
                df.at[idx, "assigned_critical"] += can_take_more
                remain_crit -= can_take_more

    if remain_crit > 0:
        other_hospitals = df[df["assigned_critical"] == 0].sort_values("total_score")
        for idx, row in other_hospitals.iterrows():
            if remain_crit <= 0:
                break
            can_take = int(min(2, remain_crit))
            if can_take > 0:
                df.at[idx, "assigned_critical"] += can_take
                remain_crit -= can_take

    # Distribute stable patients
    remain_stable = int(stable_patients)
    for idx, row in df.sort_values("total_score").iterrows():
        if remain_stable <= 0:
            break
        already = int(df.at[idx, "assigned_critical"] + df.at[idx, "assigned_stable"])
        avail = int(max(df.at[idx, "general_cap_bucket"] - already, 0))
        take = int(min(avail, remain_stable, 4))
        if take > 0:
            df.at[idx, "assigned_stable"] += take
            remain_stable -= take

    while remain_stable > 0:
        assigned_any = False
        for idx, row in df.sort_values("total_score").iterrows():
            if remain_stable <= 0:
                break
            already = int(df.at[idx, "assigned_critical"] + df.at[idx, "assigned_stable"])
            avail = int(max(df.at[idx, "general_cap_bucket"] - already, 0))
            if avail > 0:
                df.at[idx, "assigned_stable"] += 1
                remain_stable -= 1
                assigned_any = True
        if not assigned_any:
            print(f"⚠️  Warning: Could not assign {remain_stable} remaining stable patients")
            break

    # Recommendations per hospital
    recs = []
    for _, row in df.iterrows():
        recs.append(
            recommend_staff_and_supplies(
                row,
                pred_adm=row["pred_adm_next"],
                pred_icu=row["pred_icu_next"],
                pred_vent=row["pred_vent_next"],
                critical_cases=row["assigned_critical"],
            )
        )
    df["recommendation"] = recs

    # Ensure there's a standard hospital_name column for output (try several common fields)
    if "hospital_name" not in df.columns:
        for cand in ["name", "hospital", "facility_name", "hospital_name"]:
            if cand in df.columns:
                df["hospital_name"] = df[cand]
                break
        else:
            df["hospital_name"] = df["hospital_id"]  # fallback to id

    out = df[[
        "hospital_id", "hospital_name", "distance_km", "travel_min",
        "pred_adm_next","pred_icu_next","pred_vent_next",
        "capacity_score","readiness_index","total_score",
        "assigned_critical","assigned_stable","recommendation"
    ]].copy()

    out["assign_patients"] = out["assigned_critical"] + out["assigned_stable"]
    out = out[out["assign_patients"] > 0].reset_index(drop=True)

    scored = df[["hospital_id", "hospital_name", "travel_min","pred_adm_next","capacity_score","readiness_index","total_score"]].copy()
    return out, scored

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
def main():
    df = pd.read_csv(DATA_PATH, parse_dates=["timestamp"])
    latest = latest_per_hospital(df)

    # ---- Inputs ----
    incident_location = input("Enter incident location (e.g. Marine Drive): ")
    critical_patients = int(input("Enter number of critical patients: "))
    stable_patients = int(input("Enter number of stable patients: "))

    print("\nChoose scenario:")
    print("1. Normal")
    print("2. Accident (critical spike)")
    print("3. Outbreak (both up)")
    print("4. Festival Crowd (stable spike)")

    choice = input("Enter choice (1-4 or name): ").strip().lower()
    scenario_map = {"1": "normal", "2": "accident", "3": "outbreak", "4": "festival"}
    scenario = scenario_map.get(choice, choice if choice in {"normal","accident","outbreak","festival"} else "normal")

    # Apply scenario scaling
    scaled_crit, scaled_stable = apply_scenario(critical_patients, stable_patients, scenario)

    # ---- Geocode → travel minutes & distances mapping (preferred) ----
    incident_lat, incident_lon = geocode_location(incident_location)
    travel_minutes = None
    distances = None
    if incident_lat is not None and incident_lon is not None:
        travel_minutes, distances = build_travel_minutes_from_geo(latest, incident_lat, incident_lon, speed_kmh=30.0)

    # ---- Routing ----
    routing, scored = optimize_routing(latest, scaled_crit, scaled_stable, incident_location, travel_minutes, distances)

    # ---- Output ----
    print("🏥 AI Emergency Load Balancer - Optimized Routing (IMPROVED)")
    print("="*80)
    print(f"Incident Location: {incident_location}")
    print(f"Scenario: {scenario.capitalize()}")
    print(f"Patients (scaled): {scaled_crit} critical, {scaled_stable} stable")
    print("="*80)

    total_assigned_critical = 0
    total_assigned_stable = 0

    # routing is a DataFrame; print name + distance + travel
    for idx, row in routing.iterrows():
        hosp_name = row.get("hospital_name", row.get("hospital_id"))
        dist = row.get("distance_km")
        tmin = row.get("travel_min", None)
        if pd.isnull(dist):
            dist_str = "N/A"
        else:
            dist_str = f"{dist:.2f} km"
        if pd.isnull(tmin):
            tmin_str = "N/A"
        else:
            tmin_str = f"{tmin:.1f} min"

        print(f"\n🏥 Hospital {row['hospital_id']} - {hosp_name}")
        print(f"   Distance: {dist_str} | Travel time: {tmin_str}")
        print(f"   Predicted surge: ADM={row['pred_adm_next']:.1f}, ICU={row['pred_icu_next']:.1f}, VENT={row['pred_vent_next']:.1f}")
        print(f"   Assigned: {row['assigned_critical']} critical, {row['assigned_stable']} stable patients")
        rec = row["recommendation"]
        print(f"   Staffing: +{rec['extra_doctors']} doctors, +{rec['extra_specialists']} specialists")
        print(f"   Supplies: {rec['oxygen_cylinders']} oxygen, {rec['blood_units']} blood, {rec['trauma_kits']} trauma kits")
        print(f"   ICU/Vent shortfall: {rec['icu_short']}/{rec['vent_short']}")
        print(f"   Urgency: {rec['urgency']}")

        total_assigned_critical += row['assigned_critical']
        total_assigned_stable += row['assigned_stable']

    print(f"\n📊 SUMMARY:")
    print(f"   Hospitals used: {len(routing)}")
    print(f"   Critical patients assigned: {total_assigned_critical}/{scaled_crit}")
    print(f"   Stable patients assigned: {total_assigned_stable}/{scaled_stable}")

    print("\n" + "="*80)
    print("📊 Hospital Scoring (lower is better):")
    print(scored.to_string(index=False))

    # ---- Save JSON for Step 6 ----
    os.makedirs("plans", exist_ok=True)
    output = {
        "incident_location": incident_location,
        "scenario": scenario,
        "total_critical": scaled_crit,
        "total_stable": scaled_stable,
        "assignments": routing.to_dict(orient="records"),
        # --- FIX IS HERE: Add the scoring data to the JSON output ---
        "hospital_scores": scored.to_dict(orient="records"),
        "generated_at": datetime.now().isoformat(timespec="seconds"),
    }
    with open("plans/last_routing.json", "w") as f:
        json.dump(output, f, indent=2)

    print("💾 Saved routing → plans/last_routing.json")

if __name__ == "__main__":
    main()
