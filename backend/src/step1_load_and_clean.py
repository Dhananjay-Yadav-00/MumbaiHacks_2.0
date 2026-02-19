# src/step1_load_and_clean.py
import pandas as pd
import numpy as np
from pathlib import Path
import holidays

DATA = Path("dataset/hospital_data.csv")
OUT  = Path("dataset/clean_snapshot.csv")
OUT.parent.mkdir(parents=True, exist_ok=True)

def load_and_clean():
    df = pd.read_csv(DATA)
    df.columns = df.columns.str.strip().str.lower()

    # timestamp
    if "date" in df.columns:
        df["timestamp"] = pd.to_datetime(df["date"], dayfirst=True, errors="coerce")
    elif "timestamp" in df.columns:
        df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    else:
        df["timestamp"] = pd.date_range("2025-01-01", periods=len(df), freq="H")

    # ensure key columns exist
    num_cols = [
        "total_beds","occupied","available",
        "icu_capa","icu_occup","icu_avail",
        "ventilator","ventilators_used",
        "staff_avail","patient_inflow","avg_treatment_time",
        "emergency","admission","discharges"
    ]
    for c in num_cols:
        if c not in df.columns:
            df[c] = 0

    # ensure flags exist
    for f in ["festival","outbreak"]:
        if f not in df.columns:
            df[f] = 0

    # Make sure hospital_id exists (needed for pollution season)
    if "hospital_id" not in df.columns:
        df["hospital_id"] = "GEN"  # generic fallback

    # Add Indian festival detection
    years = [int(y) for y in df['timestamp'].dt.year.dropna().unique()]
    if years:  # only if we have valid years
        in_holidays = holidays.India(years=years)
        df["is_festival"] = df["timestamp"].dt.date.isin(in_holidays).astype(int)
    else:
        df["is_festival"] = 0

    # Season detection
    df['month'] = df['timestamp'].dt.month.fillna(0).astype(int)
    df['season'] = df['month'].apply(lambda x: 'Winter' if x in [12,1,2] else 
                                    'Summer' if x in [3,4,5] else
                                    'Monsoon' if x in [6,7,8,9] else 'Post-Monsoon')
    
    # Pollution season (Oct-Nov in North India)
    df['pollution_season'] = (
        (df['month'].isin([10, 11])) & 
        (df['hospital_id'].astype(str).str.contains('DEL|UP|PUN|HR', na=False))
    ).astype(int)

    # occupancy/utilization rates
    df["bed_occupancy_rate"] = df["occupied"] / df["total_beds"].clip(lower=1)
    df["icu_occupancy_rate"] = df["icu_occup"] / df["icu_capa"].clip(lower=1)
    df["ventilator_utilization"] = df["ventilators_used"] / df["ventilator"].clip(lower=1)
    
    # staff utilization: if value is a fraction keep, else scale
    df["staff_utilization"] = df["staff_avail"].copy()
    df.loc[df["staff_utilization"] > 1.5, "staff_utilization"] = (
        df.loc[df["staff_utilization"] > 1.5, "staff_utilization"] / 100.0
    )
    df["staff_utilization"] = df["staff_utilization"].clip(0, 1)

    # normalize other rates to 0..1
    for c in ["bed_occupancy_rate","icu_occupancy_rate","ventilator_utilization"]:
        df[c] = df[c].fillna(0).clip(0, 1)

    # time features
    df["hour"] = df["timestamp"].dt.hour.fillna(0).astype(int)
    df["dow"] = df["timestamp"].dt.dayofweek.fillna(0).astype(int)
    df["is_night"] = df["hour"].isin([22,23,0,1,2,3,4,5]).astype(int)
    df["is_peak"] = df["hour"].isin([9,10,11,18,19,20]).astype(int)
    df["is_weekend"] = df["dow"].isin([5,6]).astype(int)

    # synthetic / derived rolling features
    df = df.sort_values(["hospital_id","timestamp"])
    df["rolling_admissions_7"] = (
        df.groupby("hospital_id")["admission"].rolling(7, min_periods=1).mean().reset_index(0,drop=True)
    )
    df["rolling_icu_7"] = (
        df.groupby("hospital_id")["icu_occup"].rolling(7, min_periods=1).mean().reset_index(0,drop=True)
    )
    df["rolling_vent_7"] = (
        df.groupby("hospital_id")["ventilators_used"].rolling(7, min_periods=1).mean().reset_index(0,drop=True)
    )

    # Surge factor (festival/outbreak/weather/pollution)
    df["weather"] = df.get("weather", "").astype(str)
    df["weather_surge"] = df["weather"].str.contains("Foggy|Smog|Cold|Pollution", na=False).astype(int)
    
    # Enhanced surge factor with festivals and pollution
    df["surge_factor"] = (
        1 +
        0.3*df["festival"].astype(int) + 
        0.5*df["outbreak"].astype(int) + 
        0.15*df["weather_surge"] +
        0.2*df["is_festival"] +
        0.1*df["pollution_season"]
    )

    # Wait-time target (existing logic) but adjust by surge_factor
    base = 10
    noise = np.random.normal(0, 3, size=len(df))
    df["wait_time_min"] = (
        base
        + 50 * df["bed_occupancy_rate"]
        + 35 * df["staff_utilization"]
        + 25 * df["icu_occupancy_rate"]
        + 0.15 * df["avg_treatment_time"].fillna(45)
        + 0.3  * df["patient_inflow"].fillna(15)
        + 6    * df["is_peak"]
        + noise
    ).clip(lower=1) * df["surge_factor"]

    # readiness index (0..1)
    free_bed_ratio = (1 - df["bed_occupancy_rate"]).clip(0,1)
    staff_slack = (1 - df["staff_utilization"]).clip(0,1)
    icu_free = (1 - df["icu_occupancy_rate"]).clip(0,1)
    vent_free = (1 - df["ventilator_utilization"]).clip(0,1)
    df["readiness_index"] = (free_bed_ratio + staff_slack + icu_free + vent_free) / 4.0
    df["readiness_index"] = df["readiness_index"].fillna(0).clip(0,1)
    
    # Add specialized capacity indicators
    df["trauma_capacity"] = (df["total_beds"] * 0.1).astype(int)  # Assume 10% beds can handle trauma
    df["icu_capacity"] = df["icu_capa"]
    df["ventilator_capacity"] = df["ventilator"]

    df.to_csv(OUT, index=False)
    print(f"✅ Clean snapshot saved -> {OUT.resolve()}")
    return df

if __name__ == "__main__":
    load_and_clean()
