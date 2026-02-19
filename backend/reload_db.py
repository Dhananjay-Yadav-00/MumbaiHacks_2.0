import sqlite3
import pandas as pd
import os
from datetime import datetime

# Setup paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DS_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(DS_DIR, "backend", "hospital.db")
CSV_PATH = os.path.join(DS_DIR, "backend", "dataset", "hospital_data.csv")

def reload_db():
    print(f"Checking paths: {DB_PATH}, {CSV_PATH}")
    if not os.path.exists(CSV_PATH):
        print(f"CSV not found at {CSV_PATH}")
        return

    print(f"Reloading DB from CSV...")
    
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    # Clean table
    try:
        c.execute("DELETE FROM hospital_load")
        conn.commit()
        print("Cleared existing data.")
    except Exception as e:
        print(f"Error clearing table: {e}")
        return

    # Load CSV
    try:
        df = pd.read_csv(CSV_PATH)
        print(f"Loaded {len(df)} rows from CSV.")
        
        for _, row in df.iterrows():
            c.execute('''
                INSERT INTO hospital_load (
                    hospital_id, hospital_name, latitude, longitude, 
                    er_admissions, bed_availability, ambulance_arrivals, staff_capacity, total_beds, status, timestamp
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                row['hospital_id'], row['hospital_name'], row['latitude'], row['longitude'],
                row.get('er_admissions', 0), row.get('bed_availability', 0), 
                row.get('ambulance_arrivals', 0), row.get('staff_capacity', 100), 
                row.get('total_beds', 100), row.get('status', 'Green'), datetime.now()
            ))
        conn.commit()
        print("Inserted new data.")
        
        c.execute("SELECT status, count(*) FROM hospital_load GROUP BY status")
        counts = c.fetchall()
        print("Updated counts:")
        for status, count in counts:
            print(f"  {status}: {count}")
            
    except Exception as e:
        print(f"Error Loading data: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    reload_db()
