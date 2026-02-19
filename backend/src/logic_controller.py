import subprocess
import sys
import os

# --- New: Make paths explicit and robust ---
# This finds the absolute path to the 'backend' directory.
# __file__ is the path to this file (logic_controller.py)
# We go up two levels (from src/ to backend/) to get the root.
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def run_script(script_name, input_str=None):
    """
    Runs a Python script using a subprocess, ensuring the correct
    working directory and capturing output.
    """
    try:
        # Construct the full, absolute path to the script to run
        script_path = os.path.join(BACKEND_DIR, 'src', script_name)
        
        print(f"--- Running Subprocess ---")
        print(f"Script: {script_path}")
        print(f"Working Directory: {BACKEND_DIR}")
        print(f"Input provided: {'Yes' if input_str else 'No'}")

        # --- FIX: Create a clean environment that forces Python to use UTF-8 ---
        # This is the most reliable way to prevent UnicodeEncodeError on Windows.
        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"
        
        # Execute the script
        process = subprocess.run(
            [sys.executable, script_path],
            input=input_str,
            text=True,
            capture_output=True,
            check=True,  # This will raise an exception if the script fails
            cwd=BACKEND_DIR,  # IMPORTANT: Set the working directory
            encoding='utf-8', 
            errors='replace',
            env=env # Pass the modified environment to the subprocess
        )
        print(f"--- Subprocess Success ---")
        print(process.stdout)
        return True
    except subprocess.CalledProcessError as e:
        # This block catches errors from within the script itself
        print(f"--- Subprocess FAILED ---")
        print(f"Error running {script_name}:")
        print(f"Return Code: {e.returncode}")
        print("\n--- STDOUT ---")
        print(e.stdout)
        print("\n--- STDERR ---")
        print(e.stderr)
        return False
    except FileNotFoundError:
        print(f"Error: Script not found at {script_path}")
        return False


def run_full_simulation(location: str, critical_patients: int, stable_patients: int, scenario: int):
    """
    The main controller function that runs the entire simulation pipeline
    by executing the original scripts without modification.
    """
    # 1. Prepare the input string for step5_agent_logic.py
    # Each value is on a new line, mimicking the user pressing "Enter" each time.
    inputs = [
        str(location),
        str(critical_patients),
        str(stable_patients),
        str(scenario)
    ]
    input_string = "\n".join(inputs) + "\n"

    # 2. Run Step 5
    success_step5 = run_script("step5_agent_logic.py", input_string)
    if not success_step5:
        return False

    # 3. Run Step 6 (it doesn't require any input)
    success_step6 = run_script("step6_action_plan.py")
    if not success_step6:
        return False

    return True

