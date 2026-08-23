# 🚇 MetroPulse — Ahmedabad Metro Simulation API (`data_api`)

> **Real-time Phase-1 Simulation Engine for Ahmedabad Metro (GMRC)**  
> High-fidelity transit simulation providing real-time train positions, station dwell dynamics, live boarding/alighting passenger counts, coach-level crowd distribution, and operational metrics.

---

## 📌 Table of Contents

1. [Overview & Architecture](#-overview--architecture)
2. [Network & Transit Model](#-network--transit-model)
3. [Simulation Physics & Mathematical Models](#-simulation-physics--mathematical-models)
   - [Schedule & Dwell Generation](#1-schedule--dwell-generation)
   - [Deterministic Reproducibility](#2-deterministic-reproducibility)
   - [Headway & Dispatch Engine](#3-headway--dispatch-engine)
   - [Occupancy & Passenger Dynamics](#4-occupancy--passenger-dynamics)
   - [Live Dwell Simulation (Boarding & Alighting)](#5-live-dwell-simulation-boarding--alighting)
   - [Coach-Level Crowd Distribution](#6-coach-level-crowd-distribution)
4. [File Structure](#-file-structure)
5. [API Reference & Endpoints](#-api-reference--endpoints)
   - [Health & Metadata](#1-health--metadata)
   - [Train Operations](#2-train-operations)
   - [Station Tracking](#3-station-tracking)
   - [Admin & System Summary](#4-admin--system-summary)
6. [Time Travel & Scenario Testing (`?sim_time`)](#-time-travel--scenario-testing-sim_time)
7. [Integration with SmartRail-OS](#-integration-with-smartrail-os)
8. [Quick Start & Usage](#-quick-start--usage)

---

## 🏗 Overview & Architecture

The `data_api` module (branded as **MetroPulse**) serves as the ground-truth simulation engine for the **SmartRail-OS** transit management platform.

### Core Capabilities:
- **FastAPI-powered REST API** with CORS enabled for frontend dashboards, mobile clients, and IoT microcontrollers.
- **Physical & Schedule Realism**: Follows official GMRC Phase-1 timetables, track lengths, station dwell times, and turnarounds.
- **Deterministic Simulation**: Eliminates random noise/jitter across concurrent API requests during the same minute while offering organic variance.
- **Coach-level Modeling**: Real-time passenger counts across General and Ladies coaches.
- **Station-level Prediction Engine**: Computes incoming train ETAs, expected boardings, and post-departure platform crowd changes.
- **Dual Consumption Model**: Can run as an independent microservice (`uvicorn main:app --port 8000`) or be imported directly as a Python domain service (`app.services.metro_engine`).

```
                    ┌─────────────────────────┐
                    │     Client / Web App    │
                    └───────────┬─────────────┘
                                │ HTTP / JSON
                                ▼
    ┌───────────────────────────────────────────────────────┐
    │                      data_api                         │
    │  ┌─────────────────┐         ┌─────────────────────┐  │
    │  │     main.py     │◄───────►│ metro_engine_shared │  │
    │  │  FastAPI Routes │         │  Simulation Engine  │  │
    │  └─────────────────┘         └──────────┬──────────┘  │
    └─────────────────────────────────────────┼─────────────┘
                                              │ In-Process
                                              ▼
                    ┌───────────────────────────────────────┐
                    │        SmartRail-OS Backend           │
                    │  (DataService, AI Estimator, WS Push) │
                    └───────────────────────────────────────┘
```

---

## 🗺 Network & Transit Model

The simulation faithfully models the two corridors of Ahmedabad Metro Phase-1:

### 1. Blue Line (East-West Corridor)
- **Terminals**: Vastral Gam (`BL01`) ↔ Thaltej Gam (`BL18`)
- **Length**: 20.40 km (18 Stations)
- **Active Fleet**: 11 Trains (6 UP direction, 5 DOWN direction)
- **Operating Hours**: 06:20 – 22:05
- **End-to-End Runtime**: UP: 45 min 19 sec | DOWN: 43 min 28 sec
- **Major Hubs / Busy Stations**: Kalupur Metro Station (`BL08`), Old High Court (`BL11`), S P Stadium (`BL12`), Gujarat University (`BL14`).

### 2. Red Line (North-South Corridor)
- **Terminals**: APMC (`RL01`) ↔ Motera Stadium (`RL15`)
- **Length**: 16.50 km (15 Stations)
- **Active Fleet**: 10 Trains (5 UP direction, 5 DOWN direction)
- **Operating Hours**: 06:20 – 22:09
- **End-to-End Runtime**: UP: 32 min 09 sec | DOWN: 31 min 50 sec
- **Major Hubs / Busy Stations**: Gandhigram (`RL06`), Old High Court (`RL07`), Sabarmati Rly Station (`RL12`), Motera Stadium (`RL15`).

---

## ⚙️ Simulation Physics & Mathematical Models

### 1. Schedule & Dwell Generation
The route between stations is generated with calibrated dwell and travel intervals:
$$\text{Total Dwell} = \sum_{i=1}^{N} \text{Dwell}(s_i)$$
$$\text{Total Travel Time} = \text{Runtime} - \text{Total Dwell}$$

- **Normal Station Dwell**: $30\text{ seconds}$
- **Busy Station Dwell**: $45\text{ seconds}$
- **Terminal Turnaround Dwell**: $180\text{ seconds } (3\text{ minutes})$
- **Inter-station Travel Time**: Distributed proportionally to the geographic distance between stations:
$$\text{Segment Travel Time} = \frac{\Delta \text{Distance}}{\text{Total Distance}} \times \text{Total Travel Time}$$

### 2. Deterministic Reproducibility
To ensure consistent results across multiple API calls at the same minute, pseudo-random noise is generated using an MD5 hash of the train identifier and current timestamp:
$$\text{Seed} = \text{MD5}\big(\text{train\_id} : \text{YYYYMMDDHHmm} : \text{salt}\big)$$
$$\text{Noise} = \Big(\frac{\text{Seed}_{16} \pmod{10000}}{10000.0} - 0.5\Big) \times 0.08 \quad (\pm 4\%)$$

### 3. Headway & Dispatch Engine
Train headway dynamically changes depending on peak hours and weekends:

| Line | Weekdays Peak (08:00-11:00, 17:00-20:00) | Weekdays Non-Peak | Weekends |
| :--- | :--- | :--- | :--- |
| **Blue Line (BL)** | **9 min** | **10 min** | **12 min** |
| **Red Line (RL)** | **10 min** | **12 min** | **12 min** |

### 4. Occupancy & Passenger Dynamics
Base occupancy factor $B(t)$ varies with the time of day:
- **Morning Peak (08:00 - 11:00)**: Centered at 09:00, base factor reaches up to $1.0$.
- **Evening Peak (17:00 - 20:00)**: Centered at 18:30, base factor reaches up to $0.95$.
- **Midday Valley (11:00 - 17:00)**: Base factor $\approx 0.25$.
- **Off-Peak / Night (<07:00, >21:00)**: Base factor $\approx 0.08$.

#### Route Position Modulation (Sine Distribution):
Passengers board towards the middle of the line and alight before terminal ends:
$$\text{Position Factor } P(x) = \sin\Big(\frac{\text{Station Index}}{\text{Total Stations} - 1} \times \pi\Big)$$
$$\text{Target Occupancy } = \min\big(1.0, B(t) \times P(x) \times \text{Station Boost}\big)$$
*(Busy stations apply a $1.25\times$ boost)*.

### 5. Live Dwell Simulation (Boarding & Alighting)
During a dwell at a station, the passenger count evolves dynamically:
```
Dwell Window: [0 ───────────────────── Halfway ───────────────────── Dwell End]
Phase:                 ALIGHTING                     BOARDING
Count:        Pre-Alight ──> Post-Alight     Post-Alight ──> Post-Boarding
```
- **Alighting Rate**: $30\%$ (Normal stations) or $45\%$ (Busy hubs).
- **In-Transit**: Train maintains steady post-boarding passenger count until arriving at the next station.

### 6. Coach-Level Crowd Distribution
Ahmedabad Metro trains consist of **3 coaches** with a total capacity of **1,200 passengers** (400 per coach):
- `C1`: **Coach 1 — General** (Capacity: 400)
- `C2`: **Coach 2 — Ladies** (Capacity: 400, models historic $70\%$ load factor)
- `C3`: **Coach 3 — General** (Capacity: 400)

#### Crowd Thresholds:
- **`EMPTY`**: Occupancy $< 35\%$
- **`MODERATE`**: $35\% \le \text{Occupancy} < 60\%$
- **`CROWDED`**: $60\% \le \text{Occupancy} < 85\%$
- **`VERY_CROWDED`**: $\text{Occupancy} \ge 85\%$

---

## 📂 File Structure

```
data_api/
├── main.py                   # FastAPI application, route handlers, query parsing
├── metro_engine.py           # Compatibility proxy exporting metro_engine_shared
├── metro_engine_shared.py    # Core simulation engine, timetable, physics & math
└── README.md                 # Complete documentation (this file)
```

---

## 📡 API Reference & Endpoints

Base URL: `http://localhost:8000` (Interactive docs: `/docs` or `/redoc`)

### 1. Health & Metadata
#### `GET /`
Returns system status, operating line summaries, and supported endpoints.

---

### 2. Train Operations

#### `GET /trains`
Returns the live state of all 21 trains across the network.
- **Query Parameters**:
  - `line`: Filter by `BL` or `RL`
  - `direction`: Filter by `UP` or `DOWN`
  - `status`: `AT_STATION`, `IN_TRANSIT`, `WAITING_AT_TERMINAL`
  - `crowd`: `EMPTY`, `MODERATE`, `CROWDED`, `VERY_CROWDED`
  - `sim_time`: Simulate time e.g., `09:15`

<details>
<summary><b>Sample Response (Click to Expand)</b></summary>

```json
{
  "timestamp": "2026-08-15 09:15:00",
  "total": 21,
  "filters_applied": {},
  "trains": [
    {
      "train_id": "BL-UP-03",
      "display_name": "Blue Line · Thaltej Gam",
      "line": "Blue Line",
      "line_code": "BL",
      "direction": "UP",
      "terminal_start": "Vastral Gam",
      "terminal_end": "Thaltej Gam",
      "status": "IN_TRANSIT",
      "current_station": "Old High Court",
      "current_station_id": "BL11",
      "previous_station": "Shahpur",
      "next_station": "S P Stadium",
      "next_station_id": "BL12",
      "journey_completed_pct": 58.4,
      "current_position": 59.2,
      "departed_terminal_at": "08:50",
      "arrived_at_station": null,
      "departs_station_at": "09:17",
      "eta_to_next_station_sec": 114,
      "eta_to_next_station_min": 1.9,
      "train_capacity": 1200,
      "train_current_passengers": 1024,
      "train_occupancy_pct": 85.3,
      "train_crowd_level": "VERY_CROWDED",
      "passenger_event": "IN_TRANSIT",
      "event_progress_pct": 100.0,
      "coaches": [
        {
          "coach_id": "C1",
          "coach_name": "Coach 1 — General",
          "coach_type": "GENERAL",
          "capacity": 400,
          "current_passengers": 379,
          "occupancy_pct": 94.8,
          "crowd_level": "VERY_CROWDED"
        },
        {
          "coach_id": "C2",
          "coach_name": "Coach 2 — Ladies",
          "coach_type": "LADIES",
          "capacity": 400,
          "current_passengers": 266,
          "occupancy_pct": 66.5,
          "crowd_level": "CROWDED"
        },
        {
          "coach_id": "C3",
          "coach_name": "Coach 3 — General",
          "coach_type": "GENERAL",
          "capacity": 400,
          "current_passengers": 379,
          "occupancy_pct": 94.8,
          "crowd_level": "VERY_CROWDED"
        }
      ],
      "timestamp": "2026-08-15 09:15:00"
    }
  ]
}
```
</details>

#### `GET /trains/line/{line_code}`
Filters trains strictly for a corridor (`BL` or `RL`).

#### `GET /trains/{train_id}`
Returns granular telemetry and status for an individual train (e.g. `BL-UP-01`, `RL-DO-04`).

---

### 3. Station Tracking

#### `GET /station/{station_name}`
Returns all upcoming and currently docked trains at a given station, sorted chronologically by ETA.

#### `GET /stations`
Returns complete station lists for both lines, including IDs, cumulative distance in km, and interchange station indicators.

#### `GET /stations/{line_code}`
Returns the full station catalog for `BL` or `RL`.

---

### 4. Admin & System Summary

#### `GET /summary`
Provides high-level system analytics for operations dispatchers, including fleet count, headway metrics, average crowd levels, overloaded trains ($\ge 85\%$), and automated dispatch suggestions.

---

## ⏱ Time Travel & Scenario Testing (`?sim_time`)

Every simulation endpoint supports the optional query parameter `?sim_time=HH:MM`. This allows testing how the network responds to various load conditions:

| Scenario | Example URL | Expected Behavior |
| :--- | :--- | :--- |
| **Morning Peak** | `/summary?sim_time=09:00` | High load, $>80\%$ occupancy, crowd alerts |
| **Midday Valley** | `/trains?sim_time=14:00` | Normal operations, $20-30\%$ occupancy |
| **Evening Rush** | `/station/Old%20High%20Court?sim_time=18:30` | Packed interchange, heavy boarding/alighting |
| **End of Service** | `/summary?sim_time=22:30` | Trains returning to terminals, `NOT_IN_SERVICE` |

---

## 🔗 Integration with SmartRail-OS

The `data_api` module is consumed by the wider SmartRail-OS platform in two ways:

1. **In-Process Python Adapter** (`backend/app/services/data_service.py`):  
   Calls `engine.all_trains()`, `get_station_feature_predictions()`, and `get_station_current_state()` directly, adapting the simulation output into standard Pydantic schemas and database models.
2. **REST Microservice**:  
   Enables independent deployment, allowing lightweight edge devices (e.g. ESP32 passenger counters or external displays) to query train and station status without touching the primary database backend.

---

## 🚀 Quick Start & Usage

### 1. Prerequisites
- Python 3.10+
- Dependencies: `fastapi`, `uvicorn`

### 2. Run Standalone Dev Server
```bash
# Navigate to data_api directory
cd data_api

# Start Uvicorn server on port 8000 with hot reload
uvicorn main:app --reload --port 8000
```

### 3. Verification & Testing
- Open [http://localhost:8000](http://localhost:8000) in your browser.
- Open [http://localhost:8000/docs](http://localhost:8000/docs) for the interactive Swagger UI.
- Test endpoint via cURL:
```bash
curl "http://localhost:8000/trains?line=BL&sim_time=09:30"
```
