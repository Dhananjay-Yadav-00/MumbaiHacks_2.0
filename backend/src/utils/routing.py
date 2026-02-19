import pandas as pd
import os
import glob
import sys
from pathlib import Path

# Add the 'src' directory to the Python path to find step5_agent_logic
# This makes the import work correctly when called from app.py
sys.path.append(str(Path(__file__).resolve().parent.parent))

# Import the correct, powerful functions from your agent logic file
from step5_agent_logic import (
    optimize_routing,
    latest_per_hospital,
    geocode_location,
    build_travel_minutes_from_geo,
    apply_scenario,
)

def run_routing(location: str, critical: int, stable: int, scenario: str):
    """
    Main entrypoint called by app.py to generate an optimal hospital routing plan.
    - Loads hospital data
    - Calls the AI agent's optimize_routing()
    - Returns assignment results as a JSON-serializable dictionary
    """
    base = os.path.dirname(__file__)

    # We need the cleaned data for the agent, not the raw data
    dataset_path = os.path.normpath(os.path.join(base, "..", "dataset", "clean_snapshot.csv"))

    if not os.path.exists(dataset_path):
        raise FileNotFoundError(f"Cleaned dataset not found at {dataset_path}. Please run step1_load_and_clean.py first.")

    print(f"✅ Using cleaned hospital dataset: {dataset_path}")
    df = pd.read_csv(dataset_path, parse_dates=["timestamp"])
    latest_df = latest_per_hospital(df)

    # 1. Apply scenario scaling to patient numbers
    scaled_crit, scaled_stable = apply_scenario(critical, stable, scenario)

    # 2. Geocode the incident location to get coordinates
    print(f"🌍 Geocoding incident location: {location}...")
    incident_lat, incident_lon = geocode_location(location)
    travel_minutes = None
    distances = None

    if incident_lat is None or incident_lon is None:
        print(f"⚠️ Geocoding failed for '{location}'. Falling back to random travel times.")
    else:
        print(f"📍 Geocoded successfully: ({incident_lat}, {incident_lon})")
        # 3. Build travel time and distance maps for all hospitals from the incident location
        travel_minutes, distances = build_travel_minutes_from_geo(latest_df, incident_lat, incident_lon)

    # 4. Call the actual AI routing optimization logic from step5
    print("🧠 Running AI optimization...")
    routing_plan, scored_hospitals = optimize_routing(
        latest_df,
        scaled_crit,
        scaled_stable,
        location,
        travel_minutes,
        distances
    )
    print("✅ Routing plan generated.")

    # 5. Format the final output dictionary to be sent as JSON
    output = {
        "incident_location": location,
        "scenario": scenario,
        "total_critical": scaled_crit,
        "total_stable": scaled_stable,
        "assignments": routing_plan.to_dict(orient="records"),
        "scored_hospitals": scored_hospitals.to_dict(orient="records"),
    }

    # IMPORTANT: Return the output so Flask can send it to the frontend
    return output