import pandas as pd

def latest_per_hospital(df: pd.DataFrame) -> pd.DataFrame:
    """
    Returns the latest record per hospital_id from the dataset.
    """
    return (
        df.sort_values("timestamp")
          .groupby("hospital_id")
          .tail(1)
          .reset_index(drop=True)
    )
