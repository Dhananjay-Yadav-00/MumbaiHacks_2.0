import sqlite3
import pandas as pd
import os
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "hospital.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initialize the database with the hospital_load table and initial data."""
    conn = get_db_connection()
    c = conn.cursor()
    
    # Create table
    c.execute('''
        CREATE TABLE IF NOT EXISTS hospital_load (
            hospital_id TEXT PRIMARY KEY,
            hospital_name TEXT,
            latitude REAL,
            longitude REAL,
            timestamp DATETIME,
            er_admissions INTEGER,
            bed_availability INTEGER,
            ambulance_arrivals INTEGER,
            staff_capacity INTEGER,
            total_beds INTEGER,
            status TEXT DEFAULT 'Green'
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS incidents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            location TEXT,
            latitude REAL,
            longitude REAL,
            patient_count INTEGER,
            severity TEXT,
            booking_type TEXT,
            assigned_hospital_id TEXT,
            timestamp DATETIME
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hospital_id TEXT,
            message TEXT,
            severity TEXT,
            timestamp DATETIME,
            read BOOLEAN DEFAULT 0
        )
    ''')
    
    # Check if data exists
    c.execute('SELECT count(*) FROM hospital_load')
    if c.fetchone()[0] == 0:
        logger.info("Initializing database...")
        
        csv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dataset", "hospital_data.csv")
        
        if os.path.exists(csv_path):
            logger.info(f"Loading data from {csv_path}")
            df = pd.read_csv(csv_path)
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
        else:
            logger.info("CSV not found, using dummy data...")
            # Real Mumbai Hospitals Data (Fallback)
            hospitals = [
                ("H001", "KEM Hospital", 19.002, 72.842, 50, 20, 5, 80, 100),
                ("H002", "Sion Hospital", 19.046, 72.860, 30, 40, 2, 90, 80),
                ("H003", "Tata Memorial Hospital", 19.003, 72.845, 80, 5, 10, 70, 120),
                ("H004", "Lilavati Hospital", 19.051, 72.829, 40, 30, 3, 85, 90),
                ("H005", "Nanavati Hospital", 19.096, 72.840, 60, 15, 6, 75, 110),
                ("H006", "Breach Candy Hospital", 18.972, 72.804, 25, 50, 1, 95, 70),
                ("H007", "Jaslok Hospital", 18.971, 72.809, 70, 10, 8, 65, 130),
                ("H008", "P.D. Hinduja Hospital", 19.033, 72.838, 90, 2, 12, 60, 150),
                ("H009", "Kokilaben Dhirubhai Ambani Hospital", 19.131, 72.822, 35, 35, 4, 88, 85),
                ("H010", "Dr L H Hiranandani Hospital", 19.119, 72.917, 55, 18, 7, 78, 105),
                ("H011", "Fortis Hospital Mulund", 19.161, 72.943, 45, 25, 5, 82, 95),
                ("H012", "Sir J.J. Group of Hospitals", 18.962, 72.834, 20, 60, 0, 98, 60),
            ]
            
            for h in hospitals:
                c.execute('''
                    INSERT INTO hospital_load (
                        hospital_id, hospital_name, latitude, longitude, 
                        er_admissions, bed_availability, ambulance_arrivals, staff_capacity, total_beds, timestamp
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], h[8], datetime.now()))
            
        conn.commit()
        
    conn.close()

def get_all_hospitals():
    conn = get_db_connection()
    hospitals = conn.execute('SELECT * FROM hospital_load').fetchall()
    conn.close()
    return [dict(h) for h in hospitals]

def update_hospital_data(hospital_id, data):
    conn = get_db_connection()
    query = 'UPDATE hospital_load SET timestamp = ?'
    params = [datetime.now()]
    
    for key, value in data.items():
        if key in ['er_admissions', 'bed_availability', 'ambulance_arrivals', 'staff_capacity', 'total_beds', 'status']:
            query += f', {key} = ?'
            params.append(value)
            
    query += ' WHERE hospital_id = ?'
    params.append(hospital_id)
    
    conn.execute(query, params)
    conn.commit()
    conn.close()

def get_hospital(hospital_id):
    conn = get_db_connection()
    hospital = conn.execute('SELECT * FROM hospital_load WHERE hospital_id = ?', (hospital_id,)).fetchone()
    conn.close()
    return dict(hospital) if hospital else None

def create_incident(data):
    conn = get_db_connection()
    c = conn.cursor()
    c.execute('''
        INSERT INTO incidents (location, latitude, longitude, patient_count, severity, booking_type, assigned_hospital_id, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (data['location'], data.get('latitude'), data.get('longitude'), data['patient_count'], data['severity'], data['booking_type'], data.get('assigned_hospital_id'), datetime.now()))
    incident_id = c.lastrowid
    conn.commit()
    conn.close()
    return incident_id

def get_latest_incident():
    conn = get_db_connection()
    incident = conn.execute('SELECT * FROM incidents ORDER BY timestamp DESC LIMIT 1').fetchone()
    conn.close()
    return dict(incident) if incident else None

def get_incoming_patient_count(hospital_id, minutes=60):
    conn = get_db_connection()
    # SQLite datetime comparison: datetime('now', '-60 minutes')
    # We need to sum patient_count
    query = '''
        SELECT SUM(patient_count) as total 
        FROM incidents 
        WHERE assigned_hospital_id = ? 
        AND timestamp >= datetime('now', ?)
    '''
    # SQLite modifier string
    time_modifier = f'-{minutes} minutes'
    
    result = conn.execute(query, (hospital_id, time_modifier)).fetchone()
    conn.close()
    return result['total'] if result['total'] else 0

def create_alert(hospital_id, message, severity):
    conn = get_db_connection()
    conn.execute('''
        INSERT INTO alerts (hospital_id, message, severity, timestamp)
        VALUES (?, ?, ?, ?)
    ''', (hospital_id, message, severity, datetime.now()))
    conn.commit()
    conn.close()

def get_alerts(hospital_id):
    conn = get_db_connection()
    alerts = conn.execute('SELECT * FROM alerts WHERE hospital_id = ? ORDER BY timestamp DESC LIMIT 10', (hospital_id,)).fetchall()
    conn.close()
    return [dict(a) for a in alerts]

def get_all_recent_alerts(limit=50):
    conn = get_db_connection()
    alerts = conn.execute('SELECT * FROM alerts ORDER BY timestamp DESC LIMIT ?', (limit,)).fetchall()
    conn.close()
    return [dict(a) for a in alerts]

def delete_hospital(hospital_id):
    conn = get_db_connection()
    conn.execute('DELETE FROM hospital_load WHERE hospital_id = ?', (hospital_id,))
    conn.commit()
    conn.close()

def add_hospital(data):
    conn = get_db_connection()
    conn.execute('''
        INSERT INTO hospital_load (
            hospital_id, hospital_name, latitude, longitude, 
            er_admissions, bed_availability, ambulance_arrivals, staff_capacity, total_beds, timestamp
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (data['hospital_id'], data['hospital_name'], data['latitude'], data['longitude'], 
          data.get('er_admissions', 0), data.get('bed_availability', 50), 
          data.get('ambulance_arrivals', 0), data.get('staff_capacity', 100), 
          data.get('total_beds', 100), datetime.now()))
    conn.commit()
    conn.close()
