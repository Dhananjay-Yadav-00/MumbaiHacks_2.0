import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "hospital.db")

def check():
    if not os.path.exists(DB_PATH):
        print("DB does not exist.")
        return

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    
    # Get columns
    c.execute("PRAGMA table_info(hospital_load)")
    cols = [row['name'] for row in c.fetchall()]
    print(f"Columns: {cols}")
    
    if 'status' in cols:
        print("Status column exists.")
        c.execute("SELECT status, count(*) as cnt FROM hospital_load GROUP BY status")
        for row in c.fetchall():
            print(f"Status: {row['status']}, Count: {row['cnt']}")
    else:
        print("Status column MISSING.")

    conn.close()

if __name__ == "__main__":
    check()
