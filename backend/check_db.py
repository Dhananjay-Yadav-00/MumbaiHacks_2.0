import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "hospital.db")

def check_db():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    try:
        # Check table info
        c.execute("PRAGMA table_info(hospital_load)")
        columns = c.fetchall()
        print("Columns in hospital_load:")
        for col in columns:
            print(dict(col))

        # Check data
        c.execute("SELECT * FROM hospital_load LIMIT 5")
        rows = c.fetchall()
        print(f"\nTotal rows: {len(rows)} (showing first 5)")
        for row in rows:
            print(dict(row))
            
        # Check specific status counts
        c.execute("SELECT status, COUNT(*) FROM hospital_load GROUP BY status")
        counts = c.fetchall()
        print("\nStatus counts:")
        for count in counts:
            print(dict(count))

    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    check_db()
