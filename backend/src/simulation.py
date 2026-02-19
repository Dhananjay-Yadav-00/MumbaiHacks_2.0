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

            # 4. Derive status from actual bed occupancy — consistent with frontend logic
            if changes:
                current_state = {**hospital, **changes}
                total_beds = current_state.get('total_beds') or 1
                avail_beds = current_state.get('bed_availability', 0)
                occ_pct = round(((total_beds - avail_beds) / total_beds) * 100)

                # Same thresholds used across the entire system
                if occ_pct >= 90:
                    changes['status'] = 'Red'
                elif occ_pct >= 70:
                    changes['status'] = 'Yellow'
                else:
                    changes['status'] = 'Green'

                update_hospital_data(hospital['hospital_id'], changes)
                logger.debug(f"Updated {hospital['hospital_name']}: occ={occ_pct}% status={changes['status']}")

simulation = HospitalSimulation()
