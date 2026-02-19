# src/utils/location_utils.py
from __future__ import annotations
import math, json, time, os
from pathlib import Path
import requests

# Simple local cache to avoid repeat geocoding + respect rate limits
CACHE_PATH = Path("dataset/geocode_cache.json")
CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = os.getenv("NOMINATIM_UA", "MumbaiHacks/1.0 (contact: youremail@example.com)")

def geocode_location(query: str, city_hint: str = "Mumbai, India", sleep_sec: float = 1.0) -> tuple[float, float]:
    """
    Geocode a free-text address into (lat, lon) using OpenStreetMap Nominatim.
    Adds ', Mumbai, India' if user didn't specify a city. Caches results locally.
    """
    q = (query or "").strip()
    full_q = q if "mumbai" in q.lower() else f"{q}, {city_hint}"

    # Load cache
    cache = {}
    if CACHE_PATH.exists():
        try:
            cache = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
        except Exception:
            cache = {}

    if full_q in cache:
        lat, lon = cache[full_q]["lat"], cache[full_q]["lon"]
        return float(lat), float(lon)

    params = {"q": full_q, "format": "json", "limit": 1}
    headers = {"User-Agent": USER_AGENT}

    try:
        resp = requests.get(NOMINATIM_URL, params=params, headers=headers, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        if not data:
            raise ValueError(f"No geocoding result for: {full_q}")
        lat, lon = float(data[0]["lat"]), float(data[0]["lon"])

        # Update cache
        cache[full_q] = {"lat": lat, "lon": lon}
        CACHE_PATH.write_text(json.dumps(cache, indent=2), encoding="utf-8")

        # Be polite with the free API
        time.sleep(sleep_sec)
        return lat, lon

    except Exception:
        # Fallback = Mumbai city center
        return 19.0760, 72.8777


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Great-circle distance (km) between two WGS84 points.
    """
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def km_to_travel_min(distance_km: float, traffic: str = "normal") -> float:
    """
    Convert kms to minutes using simple average speed by traffic level.
    Mumbai-ish heuristics:
      - heavy: 18 km/h
      - normal: 24 km/h
      - light: 32 km/h
    """
    speeds = {"heavy": 18.0, "normal": 24.0, "light": 32.0}
    v = speeds.get(traffic, 24.0)
    minutes = (distance_km / max(v, 1e-6)) * 60.0
    # floor at 4 min to account for pickup/turnarounds
    return max(4.0, minutes)
