# src/step2_simulate.py
import pandas as pd
import numpy as np
from pathlib import Path

CLEAN_DATA = Path("dataset/clean_snapshot.csv")

def get_live_hospital_status(hospital_id):
    df = pd.read_csv(CLEAN_DATA)
    df = df.sort_values("timestamp")
    row = df[df['hospital_id'] == hospital_id].iloc[-1]
    er = np.clip(float(row['bed_occupancy_rate']) + np.random.uniform(-0.03, 0.03), 0, 1)
    icu = np.clip(float(row['icu_occupancy_rate']) + np.random.uniform(-0.03, 0.03), 0, 1)
    staff = np.clip(float(row['staff_utilization']) + np.random.uniform(-0.03, 0.03), 0, 1)
    return {
        "hospital_id": hospital_id,
        "er_occupancy": er,
        "icu_occupancy": icu,
        "staff_utilization": staff,
        "timestamp": row['timestamp']
    }

def get_live_ambulance_locations():
    # Demo ambulance GPS locations
    return [
        {"id": "AMB1", "lat": 19.07, "lon": 72.87, "status": "enroute"},
        {"id": "AMB2", "lat": 19.10, "lon": 72.85, "status": "idle"}
    ]

def get_live_travel_times(incident_location, hospital_ids):
    # Simulate travel times (in minutes) for each hospital
    return {hid: int(np.random.randint(6, 30)) for hid in hospital_ids}

def simulate_surge_event(event="festival"):
    if event == "festival":
        return {"festival": 1, "outbreak": 0}
    elif event == "outbreak":
        return {"festival": 0, "outbreak": 1}
    else:
        return {"festival": 0, "outbreak": 0}

if __name__ == "__main__":
    df = pd.read_csv(CLEAN_DATA)
    print("Hospitals in snapshot:", df['hospital_id'].unique().tolist())
    print("Example travel times:", get_live_travel_times("Marine Drive", df['hospital_id'].unique()[:5]))
    print("Simulate festival:", simulate_surge_event("festival"))
