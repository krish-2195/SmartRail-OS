"""
Passenger Estimation Service
============================
Connects the ML model in passenger_estimation/ to the live simulation database.

For every active train and each of its 3 coaches, this service:
  1. Reads live train state from the trains table.
  2. Fetches real Ahmedabad weather from Open-Meteo (free, no API key).
  3. Checks Gujarat 2026 public holidays.
  4. Uses the train's scheduled departure time (not wall-clock).
  5. Predicts post-stop passenger count with the trained RandomForest.
  6. Derives estimated alighting and boarding counts.
  7. Computes confidence score using prediction variance across all estimators.
  8. Classifies risk_level based on predicted load vs max coach capacity.
  9. Persists one Estimation row per coach per train per tick.

Note: Passenger load prediction uses RandomForestRegressor with confidence estimation
via estimator variance. LSTM upgrade planned for Round 2 with real historical data.

Called from simulation_runner.py at the end of each simulation step.
"""

import logging
import sys
import os
import pickle
import warnings
from datetime import datetime, date, timedelta, timezone
from pathlib import Path
from typing import Optional
import httpx
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error

logger = logging.getLogger(__name__)

# ── Gujarat 2026 Public Holidays ─────────────────────────────────────────────
# Source: Gujarat government calendar + national holidays
GUJARAT_HOLIDAYS_2026: dict[str, str] = {
    "2026-01-14": "Uttarayan (Makar Sankranti)",
    "2026-01-26": "Republic Day",
    "2026-02-26": "Maha Shivaratri",
    "2026-03-17": "Holi",
    "2026-03-25": "Ram Navami",
    "2026-04-06": "Mahavir Jayanti",
    "2026-04-14": "Dr. Ambedkar Jayanti",
    "2026-04-18": "Good Friday",
    "2026-05-01": "Gujarat Foundation Day",
    "2026-05-12": "Buddha Purnima",
    "2026-06-27": "Eid ul-Adha",
    "2026-08-15": "Independence Day",
    "2026-08-16": "Janmashtami",
    "2026-09-05": "Ganesh Chaturthi",
    "2026-09-26": "Milad-un-Nabi",
    "2026-10-02": "Gandhi Jayanti / Navratri Begins",
    "2026-10-22": "Dussehra",
    "2026-10-29": "Diwali (Lakshmi Pujan)",
    "2026-10-30": "Diwali",
    "2026-10-31": "New Year (Vikram Samvat)",
    "2026-11-05": "Guru Nanak Jayanti",
    "2026-12-25": "Christmas",
}

# ── Open-Meteo API config (Ahmedabad) ─────────────────────────────────────────
_AHMEDABAD_LAT  = 23.0225
_AHMEDABAD_LON  = 72.5714
_WEATHER_URL = (
    f"https://api.open-meteo.com/v1/forecast"
    f"?latitude={_AHMEDABAD_LAT}&longitude={_AHMEDABAD_LON}"
    f"&current=temperature_2m,weathercode"
    f"&timezone=Asia%2FKolkata"
)

# WMO Weather Code → label (matches labels used during model training)
_WMO_TO_LABEL: dict[int, str] = {
    **{c: "Sunny"  for c in [0, 1]},
    **{c: "Cloudy" for c in [2, 3, 45, 48]},
    **{c: "Rainy"  for c in list(range(51, 68)) + list(range(71, 78)) + list(range(80, 83)) + [95, 96, 99]},
}

# ── Weather cache (refresh every 30 min / 1800 s) ─────────────────────────────
_weather_cache: dict = {}
_weather_cache_ts: Optional[datetime] = None
_CACHE_TTL_SECONDS = 1800


def _get_ahmedabad_weather() -> tuple[float, str]:
    """
    Fetch real-time Ahmedabad weather from Open-Meteo with 30-minute caching.
    Uses httpx with a strict 3-second timeout to prevent simulation delays.
    Returns (temperature_celsius, condition_label).
    Falls back to (32.0, 'Sunny') if the API is unreachable or times out.
    """
    global _weather_cache, _weather_cache_ts

    now = datetime.now(timezone.utc)
    if _weather_cache_ts and (now - _weather_cache_ts).total_seconds() < _CACHE_TTL_SECONDS:
        return _weather_cache.get("temp", 32.0), _weather_cache.get("condition", "Sunny")

    try:
        with httpx.Client(timeout=3.0) as client:
            resp = client.get(_WEATHER_URL)
            resp.raise_for_status()
            data = resp.json()
            temp      = float(data["current"]["temperature_2m"])
            wmo_code  = int(data["current"]["weathercode"])
            condition = _WMO_TO_LABEL.get(wmo_code, "Sunny")
            _weather_cache    = {"temp": temp, "condition": condition}
            _weather_cache_ts = now
            return temp, condition
    except Exception as exc:
        logger.warning(f"[EstimationService] Weather API failed ({exc}). Using cached or default fallback.")
        if _weather_cache:
            return _weather_cache.get("temp", 32.0), _weather_cache.get("condition", "Sunny")
        return 32.0, "Sunny"


async def _get_ahmedabad_weather_async() -> tuple[float, str]:
    """
    Non-blocking async helper to fetch real-time Ahmedabad weather using httpx.AsyncClient.
    """
    global _weather_cache, _weather_cache_ts

    now = datetime.now(timezone.utc)
    if _weather_cache_ts and (now - _weather_cache_ts).total_seconds() < _CACHE_TTL_SECONDS:
        return _weather_cache.get("temp", 32.0), _weather_cache.get("condition", "Sunny")

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(_WEATHER_URL)
            resp.raise_for_status()
            data = resp.json()
            temp      = float(data["current"]["temperature_2m"])
            wmo_code  = int(data["current"]["weathercode"])
            condition = _WMO_TO_LABEL.get(wmo_code, "Sunny")
            _weather_cache    = {"temp": temp, "condition": condition}
            _weather_cache_ts = now
            return temp, condition
    except Exception as exc:
        logger.warning(f"[EstimationService] Async Weather API failed ({exc}). Using cached or default fallback.")
        if _weather_cache:
            return _weather_cache.get("temp", 32.0), _weather_cache.get("condition", "Sunny")
        return 32.0, "Sunny"


def _holiday_info(check_date: date) -> tuple[bool, Optional[str]]:
    """Returns (is_holiday, festival_name) for the given date."""
    key = check_date.strftime("%Y-%m-%d")
    name = GUJARAT_HOLIDAYS_2026.get(key)
    return (name is not None), name


# ── Lazy ML model loader ───────────────────────────────────────────────────────
_model      = None
_encoders   = None
_known_stations: set[str] = set()

def _load_model():
    """
    Train (or re-use) the RandomForest model from metro.csv.
    Tries to load pre-trained pickle files from the cache directory first.
    If the cache files do not exist, it trains the model and caches it.
    """
    global _model, _encoders, _known_stations

    if _model is not None:
        return _model, _encoders

    # Locate the passenger_estimation directory
    project_root = Path(__file__).parent.parent.parent.parent.parent  # backend/../..
    est_dir = project_root / "passenger_estimation"
    model_pkl_path = est_dir / "model.pkl"
    encoders_pkl_path = est_dir / "encoders.pkl"
    csv_path = est_dir / "metro.csv"

    # Try loading cached pickle files first (takes <0.1 seconds)
    if model_pkl_path.exists() and encoders_pkl_path.exists():
        try:
            logger.info("[EstimationService] Loading pre-trained RandomForest model from cache...")
            with open(model_pkl_path, "rb") as f:
                _model = pickle.load(f)
            with open(encoders_pkl_path, "rb") as f:
                _encoders = pickle.load(f)
            _known_stations = set(_encoders["Station_ID"].classes_)
            logger.info("[EstimationService] Pre-trained model loaded successfully!")
            return _model, _encoders
        except Exception as exc:
            logger.warning(f"[EstimationService] Failed to load model cache: {exc}. Re-training...")

    if not csv_path.exists():
        logger.error(f"[EstimationService] metro.csv not found at {csv_path}")
        return None, None

    logger.info("[EstimationService] Training RandomForest from metro.csv (first-time only)...")

    df = pd.read_csv(csv_path, low_memory=False)
    df = df.sample(n=min(100_000, len(df)), random_state=42)
    df["Festival"] = df["Festival"].fillna("No_Festival").astype(str)
    df["Timestamp"] = pd.to_datetime(df["Timestamp"])
    df["Hour"]      = df["Timestamp"].dt.hour
    df["Minute"]    = df["Timestamp"].dt.minute
    df["Day"]       = df["Timestamp"].dt.day
    df["Month"]     = df["Timestamp"].dt.month
    df["DayOfWeek"] = df["Timestamp"].dt.dayofweek
    df["IsWeekend"] = (df["DayOfWeek"] >= 5).astype(int)

    categorical_columns = ["Station_ID", "Coach_Type", "Day_Type", "Weather", "Festival"]
    encoders = {}
    for col in categorical_columns:
        enc = LabelEncoder()
        df[col] = enc.fit_transform(df[col].astype(str))
        encoders[col] = enc

    features = [
        "Station_ID", "Coach_Type", "Temperature", "Delay_Minutes",
        "ETA_Minutes", "Day_Type", "Weather", "Festival",
        "Hour", "Minute", "Day", "Month", "DayOfWeek", "IsWeekend",
    ]
    X = df[features]
    y = df["Passengers"]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    rf = RandomForestRegressor(n_estimators=300, max_depth=20, min_samples_split=5,
                               random_state=42, n_jobs=-1)
    rf.fit(X_train, y_train)

    mae = mean_absolute_error(y_test, rf.predict(X_test))
    logger.info(f"[EstimationService] Model ready. MAE on test set: {mae:.1f} passengers")

    _model    = rf
    _encoders = encoders
    _known_stations = set(encoders["Station_ID"].classes_)

    # Cache model and encoders for subsequent runs
    try:
        logger.info("[EstimationService] Caching trained model and encoders to disk...")
        with open(model_pkl_path, "wb") as f:
            pickle.dump(_model, f)
        with open(encoders_pkl_path, "wb") as f:
            pickle.dump(_encoders, f)
        logger.info("[EstimationService] Caching completed successfully!")
    except Exception as exc:
        logger.warning(f"[EstimationService] Failed to cache model: {exc}")

    return _model, _encoders


# ── Coach roster (mirrors metro_engine) ───────────────────────────────────────
_COACHES = [
    {"id": "C1", "type": "GENERAL"},
    {"id": "C2", "type": "LADIES"},
    {"id": "C3", "type": "GENERAL"},
]
_COACH_CAPACITY = 400


# ── Main estimation function ───────────────────────────────────────────────────

def estimate_for_train_states(
    train_states: list[dict],
    now: datetime,
) -> list[dict]:
    """
    For every active train state, produce 3 estimation dicts (one per coach).

    Returns a list of dicts ready to be inserted into the estimations table.
    Returns [] if the ML model is not available.
    """
    model, encoders = _load_model()
    if model is None:
        return []

    temperature, weather_condition = _get_ahmedabad_weather()
    is_holiday, festival_name = _holiday_info(now.date())
    festival_label = festival_name if festival_name else "No_Festival"
    day_type = "Weekend" if now.weekday() >= 5 else "Weekday"

    # Handle unknown weather or festival labels the encoder hasn't seen
    weather_classes  = set(encoders["Weather"].classes_)
    festival_classes = set(encoders["Festival"].classes_)
    safe_weather     = weather_condition if weather_condition in weather_classes  else encoders["Weather"].classes_[0]
    safe_festival    = festival_label    if festival_label    in festival_classes else encoders["Festival"].classes_[0]
    safe_day_type    = day_type          if day_type          in set(encoders["Day_Type"].classes_) else encoders["Day_Type"].classes_[0]

    features_list = []
    coach_meta = []

    for t in train_states:
        if t.get("status") in ("NOT_IN_SERVICE", "WAITING_AT_TERMINAL"):
            continue

        train_id     = t["train_id"]
        line_id      = t.get("line_code", "BL")
        direction    = t.get("direction", "UP")
        cur_st_id    = t.get("current_station_id")
        cur_st_name  = t.get("current_station", "")
        nxt_st_id    = t.get("next_station_id")
        nxt_st_name  = t.get("next_station", "")
        journey_pct  = t.get("journey_completed_pct")
        cur_pos      = t.get("current_position")
        delay_min    = t.get("delay_minutes", 0) or 0
        eta_min      = t.get("eta_to_next_station_min", 3) or 3

        # Use the train's departure time, not wall-clock
        dep_time_str = t.get("departed_terminal_at")  # "HH:MM" from engine
        if dep_time_str:
            try:
                dep_h, dep_m = map(int, dep_time_str.split(":"))
                train_hour, train_minute = dep_h, dep_m
            except ValueError:
                train_hour, train_minute = now.hour, now.minute
        else:
            train_hour, train_minute = now.hour, now.minute

        train_day      = now.day
        train_month    = now.month
        train_day_of_w = now.weekday()
        is_weekend_int = int(train_day_of_w >= 5)

        # Safe station encoding
        safe_station = cur_st_id if cur_st_id in _known_stations else encoders["Station_ID"].classes_[0]
        enc_station  = int(encoders["Station_ID"].transform([safe_station])[0])
        enc_day_type = int(encoders["Day_Type"].transform([safe_day_type])[0])
        enc_weather  = int(encoders["Weather"].transform([safe_weather])[0])
        enc_festival = int(encoders["Festival"].transform([safe_festival])[0])

        coaches_state = t.get("coaches", [])

        for i, coach_def in enumerate(_COACHES):
            coach_id   = coach_def["id"]
            coach_type = coach_def["type"]  # GENERAL or LADIES

            # Current passengers from live engine state
            current_pax = 0
            if i < len(coaches_state):
                current_pax = coaches_state[i].get("current_passengers", 0)

            coach_label = "Ladies" if coach_type == "LADIES" else "General"
            safe_coach  = coach_label if coach_label in set(encoders["Coach_Type"].classes_) else encoders["Coach_Type"].classes_[0]
            enc_coach   = int(encoders["Coach_Type"].transform([safe_coach])[0])

            features_list.append({
                "Station_ID":    enc_station,
                "Coach_Type":    enc_coach,
                "Temperature":   temperature,
                "Delay_Minutes": delay_min,
                "ETA_Minutes":   max(1, int(eta_min)),
                "Day_Type":      enc_day_type,
                "Weather":       enc_weather,
                "Festival":      enc_festival,
                "Hour":          train_hour,
                "Minute":        train_minute,
                "Day":           train_day,
                "Month":         train_month,
                "DayOfWeek":     train_day_of_w,
                "IsWeekend":     is_weekend_int,
            })

            coach_meta.append({
                "train_id":                train_id,
                "line_id":                 line_id,
                "direction":               direction,
                "current_station_id":      cur_st_id,
                "current_station_name":    cur_st_name,
                "next_station_id":         nxt_st_id,
                "next_station_name":       nxt_st_name,
                "journey_pct":             journey_pct,
                "current_position":        cur_pos,
                "train_hour":              train_hour,
                "train_minute":            train_minute,
                "coach_id":                coach_id,
                "coach_type":              coach_type,
                "current_passengers":      current_pax,
            })

    if not features_list:
        return []

    input_df = pd.DataFrame(features_list)
    predictions = model.predict(input_df)
    
    # Confidence via estimator variance across all trees in the forest
    import numpy as np
    import warnings
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")  # suppress per-tree feature name warnings (harmless)
        estimator_preds = np.array([est.predict(input_df) for est in model.estimators_])  # shape: (n_trees, n_samples)
    pred_std = estimator_preds.std(axis=0)  # per-sample std deviation
    # Normalize std to confidence: low std = high confidence
    # Using a soft sigmoid-like inversion: confidence = 1 / (1 + std / capacity)
    confidence_scores = 1.0 / (1.0 + pred_std / _COACH_CAPACITY)

    results = []
    for idx, meta in enumerate(coach_meta):
        predicted_pax = int(round(float(predictions[idx])))
        predicted_pax = max(0, min(_COACH_CAPACITY, predicted_pax))
        
        # Confidence score: 0.0 - 1.0 (higher = more certain prediction)
        raw_confidence = float(confidence_scores[idx])
        confidence_score = round(min(1.0, max(0.0, raw_confidence)), 4)
        
        # Risk level: based on predicted load vs max capacity
        load_ratio = predicted_pax / _COACH_CAPACITY
        if load_ratio >= 0.90:
            risk_level = "CRITICAL"   # >= 90% full
        elif load_ratio >= 0.75:
            risk_level = "HIGH"       # 75-89% full
        elif load_ratio >= 0.50:
            risk_level = "MEDIUM"     # 50-74% full
        else:
            risk_level = "LOW"        # < 50% full

        current_pax = meta["current_passengers"]
        alighting  = max(0, current_pax - int(predicted_pax * 0.85))
        post_alight = max(0, current_pax - alighting)
        boarding   = max(0, predicted_pax - post_alight)
        boarding   = min(boarding, _COACH_CAPACITY - post_alight)  # can't exceed capacity
        next_pax   = post_alight + boarding

        results.append({
            "train_id":                meta["train_id"],
            "line_id":                 meta["line_id"],
            "direction":               meta["direction"],
            "current_station_id":      meta["current_station_id"],
            "current_station_name":    meta["current_station_name"],
            "next_station_id":         meta["next_station_id"],
            "next_station_name":       meta["next_station_name"],
            "journey_pct":             meta["journey_pct"],
            "current_position":        meta["current_position"],
            "train_date":              now.date(),
            "train_time":              f"{meta['train_hour']:02d}:{meta['train_minute']:02d}",
            "coach_id":                meta["coach_id"],
            "coach_type":              meta["coach_type"],
            "current_passengers":      current_pax,
            "estimated_alighting":     alighting,
            "estimated_boarding":      boarding,
            "estimated_next_passengers": next_pax,
            "confidence_score":        confidence_score,
            "risk_level":              risk_level,
            "weather":                 weather_condition,
            "temperature":             round(temperature, 1),
            "is_holiday":              is_holiday,
            "festival_name":           festival_name,
            "created_at":              now,
        })

    return results
