import csv
import random
import os

# Set seeds for reproducibility
random.seed(42)

# Set seeds for reproducibility
random.seed(42)

# Use absolute path relative to this script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR = os.path.join(BASE_DIR, 'dataset')
os.makedirs(DATASET_DIR, exist_ok=True)
HOSPITAL_FILE = os.path.join(DATASET_DIR, 'hospital_data.csv')
PREDICTION_FILE = os.path.join(DATASET_DIR, 'predictions.csv')

# 46 Hospital Names (mixture of real Mumbai names + generic)
HOSPITALS = [
    "KEM Hospital", "Sion Hospital", "Tata Memorial Hospital", "Lilavati Hospital", 
    "Nanavati Hospital", "Breach Candy Hospital", "Jaslok Hospital", "P.D. Hinduja Hospital",
    "Kokilaben Dhirubhai Ambani Hospital", "Dr L H Hiranandani Hospital", "Fortis Hospital Mulund",
    "Sir J.J. Group of Hospitals", "H.N. Reliance Foundation Hospital", "Wockhardt Hospital",
    "Global Hospital", "Saifee Hospital", "Holy Family Hospital", "Cooper Hospital",
    "SevenHills Hospital", "Bombay Hospital", "Hinduja Healthcare Surgical", "Holy Spirit Hospital",
    "K.J. Somaiya Hospital", "Kohinoor Hospital", "Masina Hospital", "Prince Aly Khan Hospital",
    "S.L. Raheja Hospital", "St. Elizabeth's Hospital", "Sushrusha Hospital", "Wadia Hospital",
    "Bhabha Hospital", "Shatabdi Hospital", "Rajawadi Hospital", "V.N. Desai Hospital",
    "Lifeline Medicare Hospital", "Siddharth Hospital", "SRV Hospital", "Kapadia Multispeciality Hospital",
    "Suvidha Hospital", "Apollo Hospitals Navi Mumbai", "MGM Hospital Vashi", "D Y Patil Hospital",
    "Fortis Hiranandani Hospital Vashi", "Reliance Hospital Kopar Khairane", "Terna Speciality Hospital",
    "Cloudnine Hospital Vashi"
]

# Shuffle to randomize which hospital gets which status
random.shuffle(HOSPITALS)

# Target Distribution
TOTAL = len(HOSPITALS) # 46
COUNT_CRITICAL = int(TOTAL * 0.30) # ~14
COUNT_BUSY = int(TOTAL * 0.30)     # ~14
COUNT_NORMAL = TOTAL - COUNT_CRITICAL - COUNT_BUSY # ~18

print(f"Generating data for {TOTAL} hospitals.")
print(f"Target: {COUNT_CRITICAL} Critical, {COUNT_BUSY} Busy, {COUNT_NORMAL} Normal")

data = []
predictions = []

def generate_hospital(name, status, idx):
    # Base capacities
    total_beds = random.randint(100, 300)
    total_icu = int(total_beds * random.uniform(0.10, 0.20)) # 10-20% are ICU
    
    # Occupancy based on Status
    if status == 'Red': # Critical
        # Beds > 90% OR ICU > 95%
        bed_occ_pct = random.uniform(0.91, 0.99)
        icu_occ_pct = random.uniform(0.85, 0.99) 
        if random.random() < 0.5: icu_occ_pct = random.uniform(0.96, 1.0) # Force ICU critical often
        
        staff_status = 'shortage' if random.random() < 0.6 else 'limited'
        alerts = random.randint(2, 4)
        
    elif status == 'Yellow': # Busy
        # Beds 70-90% OR ICU 75-95%
        bed_occ_pct = random.uniform(0.70, 0.89)
        icu_occ_pct = random.uniform(0.70, 0.94)
        
        staff_status = 'limited' if random.random() < 0.7 else 'adequate'
        alerts = random.randint(0, 2)
        
    else: # Green / Normal
        # Beds < 70% AND ICU < 75%
        bed_occ_pct = random.uniform(0.30, 0.65)
        icu_occ_pct = random.uniform(0.10, 0.70)
        
        staff_status = 'adequate'
        alerts = 0

    # Calculate metrics
    occ_beds = int(total_beds * bed_occ_pct)
    occ_icu = int(total_icu * icu_occ_pct)
    avail_beds = total_beds - occ_beds
    # Ensure available beds calculation is safe
    if avail_beds < 0: avail_beds = 0
    if occ_beds > total_beds: occ_beds = total_beds

    # Staffing
    # Approx 1 staff for every 2-3 beds total capacity
    staff_total = int(total_beds * random.uniform(0.4, 0.6)) 
    doctors = int(staff_total * 0.25)
    nurses = int(staff_total * 0.55)
    support = staff_total - doctors - nurses
    on_leave = int(staff_total * random.uniform(0.02, 0.08))

    # Reduce effective staff if shortage/limited
    # (Just strictly writing fields, "staff_capacity" usually means total entries on roster)
    
    # Lat/Lon (Mumbai approximated bounds)
    # Center around 19.0760, 72.8777 with spread
    lat = 19.0 + random.uniform(0.00, 0.15)
    lon = 72.8 + random.uniform(0.00, 0.15)
    
    # ER & Ambulance
    if status == 'Red':
        er_admits = random.randint(15, 40)
        ambulance = random.randint(5, 12)
    elif status == 'Yellow':
        er_admits = random.randint(5, 15)
        ambulance = random.randint(2, 6)
    else:
        er_admits = random.randint(0, 5)
        ambulance = random.randint(0, 2)

    # PREDICTIONS (for tomorrow) -- realistic drift
    # If critical, likely to stay high or drop slightly
    # If normal, random fluctuation
    pred_change = random.uniform(-0.15, 0.15)
    pred_beds_tomorrow = int(total_beds * (bed_occ_pct + pred_change))
    # clamp
    pred_beds_tomorrow = max(0, min(total_beds, pred_beds_tomorrow))
    
    # Store predictions
    # We want predicted_beds to be the OCCUPIED amount or AVAILABLE? 
    # Usually predictions are for "Occupancy" or "Availability". 
    # Let's say we predict *Available Beds* as that's what user cares about.
    # So if `pred_beds_tomorrow` was occupancy, available = Total - Occ
    pred_avail = total_beds - pred_beds_tomorrow
    predictions.append({
        'hospital_id': f"H{str(idx+1).zfill(3)}",
        'hospital_name': name,
        'current_beds': avail_beds,
        'predicted_beds': pred_avail,
        'total_beds': total_beds
    })

    return {
        'hospital_id': f"H{str(idx+1).zfill(3)}",
        'hospital_name': name,
        'latitude': round(lat, 4),
        'longitude': round(lon, 4),
        'er_admissions': er_admits,
        'bed_availability': avail_beds,
        'ambulance_arrivals': ambulance,
        'staff_capacity': staff_total,
        'total_beds': total_beds,
        'status': status,
        # Extra fields for richer dashboards (implied usage in frontend)
        'total_icu': total_icu,
        'occupied_icu': occ_icu,
        'doctors': doctors,
        'nurses': nurses,
        'support': support,
        'on_leave': on_leave,
        'alerts_count': alerts,
        'staff_status': staff_status
    }

# Generate Data
for i in range(COUNT_CRITICAL):
    data.append(generate_hospital(HOSPITALS.pop(), 'Red', len(data)))
    
for i in range(COUNT_BUSY):
    data.append(generate_hospital(HOSPITALS.pop(), 'Yellow', len(data)))
    
for i in range(len(HOSPITALS)): # Remaining are normal
    data.append(generate_hospital(HOSPITALS.pop(), 'Green', len(data)))

# Shuffle rows so status isn't clustered
random.shuffle(data)

# Write Hospital Data
with open(HOSPITAL_FILE, 'w', newline='', encoding='utf-8') as f:
    # All keys from first record
    fieldnames = list(data[0].keys())
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(data)

print(f"Successfully wrote {len(data)} hospitals to {HOSPITAL_FILE}")

# Write Predictions
with open(PREDICTION_FILE, 'w', newline='', encoding='utf-8') as f:
    fieldnames = ['hospital_id', 'hospital_name', 'current_beds', 'predicted_beds', 'total_beds']
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(predictions)

print(f"Successfully wrote predictions to {PREDICTION_FILE}")
