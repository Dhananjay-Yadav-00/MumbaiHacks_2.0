import time
import random
import threading
import logging
from .database import get_all_hospitals, update_hospital_data, get_incoming_patient_count
from .ai_model import predict_congestion

logger = logging.getLogger(__name__)

class HospitalSimulation:
    def __init__(self, interval=5):
        self.interval = interval
        self.running = False
        self.thread = None

    def start(self):
        if not self.running:
            self.running = True
            self.thread = threading.Thread(target=self._run_loop, daemon=True)
            self.thread.start()
            logger.info("Hospital simulation started.")

    def stop(self):
        self.running = False
        if self.thread:
            self.thread.join()
            logger.info("Hospital simulation stopped.")

    def _run_loop(self):
        while self.running:
            try:
                self._simulate_step()
                time.sleep(self.interval)
            except Exception as e:
                if "no such table" in str(e):
                    logger.warning("Database not ready yet, waiting...")
                    time.sleep(2) # Wait longer if DB is missing
                else:
                    logger.error(f"Error in simulation loop: {e}")
                    time.sleep(self.interval)

    def _simulate_step(self):
        hospitals = get_all_hospitals()
        
        for hospital in hospitals:
            # Simulate random changes
            changes = {}
            
            # Get real incoming patients count (from last 60 mins)
            incoming_patients = get_incoming_patient_count(hospital['hospital_id'])
            
            # 1. Random Admissions/Discharges
            if random.random() < 0.2: # Reduced to 20% chance
                change = random.randint(-1, 2) # Smaller fluctuation (-1 to +2)
                new_admissions = max(0, hospital['er_admissions'] + change)
                changes['er_admissions'] = new_admissions
                
            # 2. Bed Availability changes
            if 'er_admissions' in changes:
                diff = changes['er_admissions'] - hospital['er_admissions']
                potential_beds = hospital['bed_availability'] - diff
                
                min_beds = incoming_patients
                # Start with at least 5 beds in pool if possible
                new_beds = max(min_beds, min(hospital['total_beds'], potential_beds))
                changes['bed_availability'] = new_beds
                
            # 3. Ambulance Arrivals
            if random.random() < 0.1: # Reduced to 10%
                new_ambulances = max(0, hospital['ambulance_arrivals'] + random.randint(-1, 1))
                changes['ambulance_arrivals'] = new_ambulances

            # 4. Update Status based on AI Prediction
            if changes:
                # Merge current state with changes for prediction
                current_state = {**hospital, **changes}
                predicted_load = predict_congestion(current_state)
                
                # REVISED THRESHOLDS for Realism (Previous: 100/150 were too low)
                if predicted_load > 180: 
                    changes['status'] = 'Red'
                elif predicted_load > 120:
                    changes['status'] = 'Yellow'
                else:
                    changes['status'] = 'Green'
                
                update_hospital_data(hospital['hospital_id'], changes)
                logger.debug(f"Updated {hospital['hospital_name']}: {changes}")

simulation = HospitalSimulation()
