import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import os
import traceback
import traceback
from datetime import datetime
import math

# Import the main controller function
from .logic_controller import run_full_simulation

# Import new modules
from .database import (
    init_db, get_all_hospitals, update_hospital_data, get_hospital, 
    create_incident, create_alert, get_alerts, delete_hospital, add_hospital,
    get_latest_incident, update_hospital_data, get_all_recent_alerts
)
from .simulation import simulation
from .ai_model import predict_congestion, train_model

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Initialize the Flask application
app = Flask(__name__)

# Allow requests from your Vercel app and local development server
CORS(app, origins=[
    "https://mumbai-hacks-five.vercel.app",
    "https://mumbai-hacks-karantulsanis-projects.vercel.app",
    "http://localhost:5173"
])

# Configuration
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))  # backend/src/
BACKEND_DIR = os.path.dirname(CURRENT_DIR)  # backend/
PLANS_DIR = os.getenv("PLANS_DIR", os.path.join(BACKEND_DIR, "plans"))

# Ensure plans directory exists
os.makedirs(PLANS_DIR, exist_ok=True)

logger.info(f"Current directory (src): {CURRENT_DIR}")
logger.info(f"Backend directory: {BACKEND_DIR}")
logger.info(f"Plans directory: {PLANS_DIR}")

# Initialize Database and Simulation
with app.app_context():
    init_db()
    simulation.start()

@app.route("/")
def index():
    """A simple route to check if the API is running."""
    return jsonify({
        "status": "AI Emergency Load Balancer API is running!",
        "version": "2.1.0",
        "timestamp": datetime.now().isoformat()
    }), 200


@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint to verify backend status."""
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "service": "HealthHive AI Load Balancer"
    }), 200

def calculate_distance(lat1, lon1, lat2, lon2):
    """
    Calculate the great circle distance between two points 
    on the earth (specified in decimal degrees)
    """
    # convert decimal degrees to radians 
    lon1, lat1, lon2, lat2 = map(math.radians, [lon1, lat1, lon2, lat2])

    # haversine formula 
    dlon = lon2 - lon1 
    dlat = lat2 - lat1 
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a)) 
    r = 6371 # Radius of earth in kilometers. Use 3956 for miles
    return c * r

# --- New Endpoints for AI Load Balancer (Refined) ---

@app.route("/api/hospitals", methods=["GET"])
def get_hospitals():
    """Get all hospital data including real-time status."""
    try:
        hospitals = get_all_hospitals()
        return jsonify(hospitals), 200
    except Exception as e:
        logger.error(f"Error fetching hospitals: {e}")
        return jsonify({"error": str(e)}), 500


CREDENTIALS_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dataset", "credentials.csv")

@app.route("/api/auth/login", methods=["POST"])
def api_login():
    """Authenticate a user against credentials.csv."""
    try:
        import csv
        data = request.get_json()
        username = (data.get("username") or "").strip()
        password = (data.get("password") or "").strip()
        role = (data.get("role") or "").strip()

        if not username or not password or not role:
            return jsonify({"error": "username, password, and role are required"}), 400

        if not os.path.exists(CREDENTIALS_PATH):
            return jsonify({"error": "Credentials file not found"}), 500

        with open(CREDENTIALS_PATH, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                if (row["username"].strip() == username and
                        row["password"].strip() == password and
                        row["role"].strip() == role):
                    return jsonify({
                        "role": row["role"].strip(),
                        "username": row["username"].strip(),
                        "hospital_id": row.get("hospital_id", "").strip() or None
                    }), 200

        return jsonify({"error": "Invalid credentials"}), 401
    except Exception as e:
        logger.error(f"Login error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/admin/hospitals", methods=["POST"])
def api_add_hospital():
    """Add a new hospital (System Admin)."""
    try:
        data = request.get_json()
        add_hospital(data)
        return jsonify({"message": "Hospital added successfully"}), 201
    except Exception as e:
        logger.error(f"Error adding hospital: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/admin/hospitals/<hospital_id>", methods=["DELETE"])
def api_delete_hospital(hospital_id):
    """Delete a hospital (System Admin)."""
    try:
        delete_hospital(hospital_id)
        return jsonify({"message": "Hospital deleted successfully"}), 200
    except Exception as e:
        logger.error(f"Error deleting hospital: {e}")
        return jsonify({"error": str(e)}), 500

CSV_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dataset", "hospital_data.csv")

def sync_hospital_to_csv(hospital_id, updates):
    """Write updated hospital fields back to hospital_data.csv."""
    try:
        import pandas as pd
        if not os.path.exists(CSV_PATH):
            logger.warning(f"CSV not found at {CSV_PATH}, skipping sync.")
            return
        df = pd.read_csv(CSV_PATH)
        mask = df['hospital_id'] == hospital_id
        if not mask.any():
            logger.warning(f"Hospital {hospital_id} not found in CSV.")
            return
        for field, val in updates.items():
            if field in df.columns:
                df.loc[mask, field] = val
        df.to_csv(CSV_PATH, index=False)
        logger.info(f"Synced hospital {hospital_id} to CSV: {updates}")
    except Exception as e:
        logger.error(f"CSV sync failed for {hospital_id}: {e}")

@app.route("/api/hospital/<hospital_id>/update", methods=["POST"])
def api_update_hospital(hospital_id):
    """Update hospital resources (Hospital Admin) and optionally sync to CSV."""
    try:
        data = request.get_json()
        should_sync_csv = data.pop("sync_csv", False)

        # Update DB
        update_hospital_data(hospital_id, data)

        # Optionally sync to CSV
        if should_sync_csv:
            sync_hospital_to_csv(hospital_id, data)

        return jsonify({"message": "Hospital updated successfully"}), 200
    except Exception as e:
        logger.error(f"Error updating hospital: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/admin/retrain", methods=["POST"])
def api_retrain_model():
    """Trigger model retraining (System Admin)."""
    try:
        train_model()
        return jsonify({"message": "Model retraining started"}), 200
    except Exception as e:
        logger.error(f"Error retraining model: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/predict/beds", methods=["GET"])
def api_predict_beds():
    """
    Return tomorrow's predicted bed availability for all hospitals.
    Reads from the static predictions.csv file generated by the data script.
    """
    try:
        current_dir = os.path.dirname(os.path.abspath(__file__)) # backend/src
        backend_dir = os.path.dirname(current_dir) # backend
        pred_csv = os.path.join(backend_dir, "dataset", "predictions.csv")
        
        results = []
        if os.path.exists(pred_csv):
            import csv
            with open(pred_csv, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    results.append({
                        "hospital_id": row['hospital_id'],
                        "hospital_name": row['hospital_name'],
                        "current_beds": int(row['current_beds']),
                        "predicted_beds": int(row['predicted_beds']),
                        "total_beds": int(row['total_beds'])
                    })
        else:
             # Fallback if CSV missing
            hospitals = get_all_hospitals()
            for h in hospitals:
                results.append({
                    "hospital_id": h['hospital_id'],
                    "hospital_name": h['hospital_name'],
                    "current_beds": h.get('bed_availability', 0),
                    "predicted_beds": h.get('bed_availability', 0), # No prediction fallback
                    "total_beds": h.get('total_beds', 100)
                })

        # Sort by predicted_beds descending (most available first)
        results.sort(key=lambda x: x['predicted_beds'], reverse=True)
        return jsonify(results), 200
    except Exception as e:
        logger.error(f"Error reading predictions: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/incidents", methods=["POST"])
def api_create_incident():
    """Report a new incident (Bystander/Patient)."""
    try:
        data = request.get_json()
        
        # Extract coordinates if available
        user_lat = data.get('latitude')
        user_lon = data.get('longitude')
        
        assigned_hospital_id = data.get('assigned_hospital_id')
        assigned_hospital_name = "Unknown"
        distance_km = 0.0

        # Logic to find nearest/best hospital
        if not assigned_hospital_id:
            hospitals = get_all_hospitals()
            
            # Filter out hospitals with 0 beds
            available_hospitals = [h for h in hospitals if h['bed_availability'] > 0]
            
            if not available_hospitals:
                # Fallback if ALL hospitals are full (should ideally trigger a different workflow)
                available_hospitals = hospitals
            
            # Calculate distances and scores if user location is provided
            if user_lat and user_lon:
                try:
                    user_lat = float(user_lat)
                    user_lon = float(user_lon)
                    
                    for h in available_hospitals:
                        # 1. Distance
                        dist = calculate_distance(user_lat, user_lon, h['latitude'], h['longitude'])
                        h['distance'] = dist
                        
                        # 2. Bed Score (Inverse: more beds = lower score)
                        # Add 1 to avoid division by zero, though we filtered > 0 already
                        bed_score = (1 / (h['bed_availability'] + 1)) * 10
                        
                        # 3. Status Penalty
                        status_penalty = 0
                        status = h.get('status', 'Green')
                        
                        # Logic: Allow Red hospitals if patient count is low (<= 2)
                        # If few patients, we can squeeze them in even if busy, if it's much closer.
                        is_small_incident = data.get('patient_count', 1) <= 2
                        
                        if status == 'Yellow':
                            status_penalty = 5
                        elif status == 'Red':
                            if is_small_incident:
                                status_penalty = 10 # Reduced penalty (similar to Yellow)
                            else:
                                status_penalty = 100 # Heavy penalty for larger groups
                            
                        # Total Score (Lower is better)
                        # User requested Distance weight = 70%
                        # We'll use 0.7 for distance and keep others as additive penalties
                        h['total_score'] = (dist * 0.7) + bed_score + status_penalty
                    
                    # Sort by Total Score
                    available_hospitals.sort(key=lambda x: x.get('total_score', float('inf')))
                    
                    # Pick the best one
                    best_hospital = available_hospitals[0]
                    assigned_hospital_id = best_hospital['hospital_id']
                    assigned_hospital_name = best_hospital['hospital_name']
                    distance_km = round(best_hospital['distance'], 1)
                    
                except (ValueError, TypeError):
                    # Fallback if coords are invalid
                    best_hospital = available_hospitals[0]
                    assigned_hospital_id = best_hospital['hospital_id']
                    assigned_hospital_name = best_hospital['hospital_name']
            else:
                # If no location, pick based on beds and status
                # Simple score: Beds - StatusPenalty (Higher is better here, so we invert logic or just sort)
                # Let's just sort by beds descending for now as fallback
                best_hospital = max(available_hospitals, key=lambda x: x['bed_availability'])
                assigned_hospital_id = best_hospital['hospital_id']
                assigned_hospital_name = best_hospital['hospital_name']

        # If assigned_hospital_id was passed in (e.g. manual selection), we still need name/distance
        elif assigned_hospital_id:
             hospital = get_hospital(assigned_hospital_id)
             if hospital:
                 assigned_hospital_name = hospital.get('hospital_name', 'Unknown')
                 if user_lat and user_lon:
                     try:
                         distance_km = round(calculate_distance(float(user_lat), float(user_lon), hospital['latitude'], hospital['longitude']), 1)
                     except:
                         pass

        create_incident({**data, 'assigned_hospital_id': assigned_hospital_id})
        
        # Trigger alert for the assigned hospital
        if assigned_hospital_id:
            alert_msg = f"New Incoming Patient! Severity: {data.get('severity', 'Unknown')}, Count: {data.get('patient_count', 1)}"
            severity = 'Critical' if data.get('severity') == 'Critical' else 'Warning'
            create_alert(assigned_hospital_id, alert_msg, severity)

        return jsonify({
            "message": "Incident reported successfully",
            "assigned_hospital_id": assigned_hospital_id,
            "assigned_hospital_name": assigned_hospital_name,
            "distance_km": distance_km
        }), 201
    except Exception as e:
        logger.error(f"Error creating incident: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/incidents/latest", methods=["GET"])
def api_get_latest_incident():
    """Get the most recent incident for the dispatcher map."""
    try:
        incident = get_latest_incident()
        if not incident:
            return jsonify(None), 200
        return jsonify(incident), 200
    except Exception as e:
        logger.error(f"Error fetching latest incident: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/hospital/<hospital_id>/alerts", methods=["GET"])
def api_get_alerts(hospital_id):
    """Get alerts for a specific hospital (Hospital Admin)."""
    try:
        alerts = get_alerts(hospital_id)
        return jsonify(alerts), 200
    except Exception as e:
        logger.error(f"Error fetching alerts: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/alerts/recent", methods=["GET"])
def api_get_all_recent_alerts():
    """Get recent alerts for all hospitals (Hospital Admin Dashboard)."""
    try:
        alerts = get_all_recent_alerts()
        return jsonify(alerts), 200
    except Exception as e:
        logger.error(f"Error fetching recent alerts: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/logs", methods=["GET"])
def get_logs():
    """Get system logs (mock implementation for demo)."""
    # In a real app, we'd read from a log file or DB table
    return jsonify([
        {"timestamp": datetime.now().isoformat(), "level": "INFO", "message": "System running normally"},
        {"timestamp": datetime.now().isoformat(), "level": "INFO", "message": "Simulation cycle completed"},
        {"timestamp": datetime.now().isoformat(), "level": "INFO", "message": "AI Model loaded successfully"}
    ]), 200

# ------------------------------------------

@app.route("/generate-plan", methods=["POST"])
def generate_plan():
    """
    Main API endpoint to generate an emergency action plan.
    """
    request_id = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    try:
        # Parse request data
        data = request.get_json()
        
        if not data:
            logger.warning(f"[{request_id}] No JSON data provided")
            return jsonify({
                "error": "No JSON data provided",
                "request_id": request_id
            }), 400
        
        logger.info(f"[{request_id}] Received request data: {json.dumps(data)}")

        # Extract and validate required fields
        location = data.get('location', '').strip()
        critical_patients = data.get('critical_patients')
        stable_patients = data.get('stable_patients')
        scenario = data.get('scenario')

        # Validation
        validation_errors = []
        
        if not location:
            validation_errors.append("location is required and cannot be empty")
        if critical_patients is None:
            validation_errors.append("critical_patients is required")
        elif not isinstance(critical_patients, int) or critical_patients < 0:
            validation_errors.append("critical_patients must be a non-negative integer")
            
        if stable_patients is None:
            validation_errors.append("stable_patients is required")
        elif not isinstance(stable_patients, int) or stable_patients < 0:
            validation_errors.append("stable_patients must be a non-negative integer")
            
        if scenario is None:
            validation_errors.append("scenario is required")
        elif not isinstance(scenario, int) or scenario not in [1, 2, 3, 4]:
            validation_errors.append("scenario must be an integer between 1 and 4")

        if validation_errors:
            logger.warning(f"[{request_id}] Validation failed: {validation_errors}")
            return jsonify({
                "error": "Validation failed",
                "details": validation_errors,
                "request_id": request_id
            }), 400

        # Run simulation
        logger.info(f"[{request_id}] Starting simulation...")
        success = run_full_simulation(
            location=location,
            critical_patients=critical_patients,
            stable_patients=stable_patients,
            scenario=str(scenario)
        )

        if not success:
            error_msg = "Backend simulation script failed to execute"
            logger.error(f"[{request_id}] ERROR: {error_msg}")
            return jsonify({
                "error": error_msg,
                "request_id": request_id
            }), 500

        # Read output file
        output_path = os.path.join(PLANS_DIR, "last_routing.json")
        
        if not os.path.exists(output_path):
            error_msg = f"Output file not found at {output_path}"
            logger.error(f"[{request_id}] ERROR: {error_msg}")
            return jsonify({
                "error": "Simulation ran but output file was not found",
                "details": error_msg,
                "request_id": request_id
            }), 500

        # Parse and return result
        with open(output_path, 'r', encoding='utf-8') as f:
            result_data = json.load(f)

        # Ensure proper structure
        if not isinstance(result_data, dict):
            result_data = {"action_plan": result_data}

        # Add metadata
        response = {
            **result_data,
            "request_id": request_id,
            "timestamp": datetime.now().isoformat(),
            "incident_summary": {
                "location": location,
                "critical_patients": critical_patients,
                "stable_patients": stable_patients,
                "total_patients": critical_patients + stable_patients,
                "scenario": scenario
            }
        }

        logger.info(f"[{request_id}] Successfully generated plan")
        
        return jsonify(response), 200

    except json.JSONDecodeError as e:
        error_msg = f"Invalid JSON format: {str(e)}"
        logger.error(f"[{request_id}] JSON Decode Error: {error_msg}")
        return jsonify({
            "error": error_msg,
            "request_id": request_id
        }), 400

    except Exception as e:
        error_msg = str(e)
        logger.error(f"[{request_id}] Unexpected Error: {error_msg}")
        logger.error(traceback.format_exc())
        return jsonify({
            "error": "An internal server error occurred",
            "details": error_msg if app.debug else None,
            "request_id": request_id
        }), 500


@app.route("/status", methods=["GET"])
def get_status():
    """Get system status and statistics."""
    try:
        plan_count = len([f for f in os.listdir(PLANS_DIR) if f.endswith('.json')])
        return jsonify({
            "status": "operational",
            "plans_generated": plan_count,
            "plans_directory": PLANS_DIR,
            "timestamp": datetime.now().isoformat()
        }), 200
    except Exception as e:
        logger.error(f"Status check failed: {e}")
        return jsonify({
            "status": "error",
            "error": str(e)
        }), 500


@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors."""
    return jsonify({
        "error": "Endpoint not found",
        "path": request.path,
        "method": request.method
    }), 404


@app.errorhandler(405)
def method_not_allowed(error):
    """Handle 405 errors."""
    return jsonify({
        "error": "Method not allowed",
        "path": request.path,
        "method": request.method
    }), 405


@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors."""
    logger.error(f"Internal Server Error: {error}")
    return jsonify({
        "error": "Internal server error",
        "message": str(error)
    }), 500


if __name__ == "__main__":
    logger.info("🚨 HealthHive AI Emergency Load Balancer API")
    logger.info(f"Starting server on http://localhost:5001")
    logger.info(f"Plans directory: {PLANS_DIR}")
    logger.info(f"Debug mode: {app.debug}")
    
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5001)), debug=False, use_reloader=False)
