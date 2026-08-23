# 🚀 SmartRail OS — Complete Master Startup Guide

This guide gives you the exact terminal commands and configurations to launch and test the entire SmartRail OS ecosystem:
1. **FastAPI Backend & Database Engine** (Port 8000)
2. **Machine Learning Model Training & Estimation Pipeline** (RandomForest Regressor)
3. **ESP32 IoT Sensor & Hardware Break-Beam Emulator** (Real-time passenger flow)
4. **Web Command Center Dashboard** (React + TanStack on Port 8080)
5. **Commuter Mobile App** (Flutter on Port 8082 / Android)

---

## ⚡ 1. FastAPI Backend & Simulation Engine (Terminal 1)

Runs the real-time kinematics engine, 24 circulating trains (`BL-01`..`BL-12`, `RL-01`..`RL-12`), SQLite database, and REST/WebSocket APIs on **Port 8000**.

```bash
cd backend

# 1. Install dependencies
pip install -r requirements.txt

# 2. Initialize and seed the database (33 stations, 4 routes, 24 rakes, 75 coaches)
python init_db.py

# 3. Start the Backend Server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

> 🌐 **Backend URL**: [http://localhost:8000](http://localhost:8000)  
> 📖 **Interactive Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)  
> 💚 **Health Check**: [http://localhost:8000/health](http://localhost:8000/health)

---

## 🧠 2. Machine Learning Estimation & Model Training

SmartRail OS includes a **RandomForest Regressor** trained on historical Ahmedabad Metro telemetry, Gujarat 2026 public holidays, and Open-Meteo live weather data.

### Option A: Retrain the ML Model & Update Serialized Artifacts
```bash
cd passenger_estimation

# 1. (Optional) Regenerate full 630,720-row synthetic dataset:
python3 generate_data.py

# 2. Train Random Forest model and save model.pkl & encoders.pkl:
python3 estimation.py
```

### Option B: Test Live Passenger Crowd Predictions
```bash
# 1. Get real-time crowd forecast for a station (e.g. Old High Court BL11):
curl http://localhost:8000/api/v1/stations/BL11/feature

# 2. Get network-wide multi-horizon crowd forecast (+5m, +15m, +30m):
curl http://localhost:8000/api/v1/analytics/crowd-forecast

# 3. Get hourly passenger inflow/outflow matrix:
curl http://localhost:8000/api/v1/analytics/hourly-flow
```

---

## 📡 3. ESP32 IoT Sensor & Hardware Break-Beam Emulator (Terminal 2)

Simulates optical IR break-beam passenger entry/exit sensors at turnstiles and coach doors.

```bash
# 1. Simulate passenger boarding & alighting flow at Old High Court (BL11):
python3 scripts/sensor_simulator.py --station BL11 --occupancy 220 --boarding 35 --alighting 15

# 2. Simulate continuous rush-hour passenger triggers:
python3 scripts/sensor_simulator.py --station BL11 --rush-hour
```

### Direct ESP32 Ingestion REST API:
```bash
# Inspect live ESP32 hardware state:
curl http://localhost:8000/api/v1/esp32/live

# Send entry turnstile pulse (+5 passengers):
curl -X POST http://localhost:8000/api/v1/esp32/event \
     -H "Content-Type: application/json" \
     -d '{"event_type": "ENTRY", "station_id": "BL11", "door_id": "D1", "count": 5}'

# Override live Coach C1 occupancy on the active train:
curl -X POST http://localhost:8000/api/v1/esp32/override \
     -H "Content-Type: application/json" \
     -d '{"occupancy": 310, "station_id": "BL11"}'

# Release ESP32 manual override back to simulation engine:
curl -X POST http://localhost:8000/api/v1/esp32/reset
```

---

## 💻 4. Web Command Center Dashboard (Terminal 3)

React + TanStack Router operational control room with live map tracking, coach heatmaps, and station PIDs on **Port 8080**.

```bash
cd smartrailos_web

# 1. Install frontend dependencies
npm install

# 2. Start the Vite development server
npm run dev
```

> 🖥️ **Web Dashboard**: [http://localhost:8080/dashboard](http://localhost:8080/dashboard)  
> 🚆 **Live 24-Train Map**: [http://localhost:8080/dashboard/live-trains](http://localhost:8080/dashboard/live-trains)  
> 📊 **Incoming Forecasts**: [http://localhost:8080/dashboard/incoming](http://localhost:8080/dashboard/incoming)

---

## 📱 5. Commuter Mobile App (Terminal 4)

Flutter passenger mobile app with journey planning, real-time coach occupancy, and station alerts on **Port 8082** or Android phone.

```bash
cd smartrailos_app

# 1. Fetch Flutter dependencies
flutter pub get

# 2. (Optional) If testing on physical Android device over USB:
~/Android/Sdk/platform-tools/adb reverse tcp:8000 tcp:8000

# 3. Launch on Web browser (Port 8082) or Emulator:
flutter run -d chrome --web-port 8082
```

> 📱 **Mobile Web Preview**: [http://localhost:8082](http://localhost:8082)

---

## 🧪 6. Automated Test Suite & Health Verification

Run all automated tests across backend, simulation math, and API contracts:

```bash
# Run full 23-test Pytest suite
cd backend
PYTHONPATH=. pytest tests/ -v

# Run individual feature tests:
PYTHONPATH=. pytest tests/test_api_contract.py -v     # API contracts & journey search
PYTHONPATH=. pytest tests/test_estimation.py -v       # ML model & confidence scoring
PYTHONPATH=. pytest tests/test_station_tables.py -v   # Real-time station tables
PYTHONPATH=. pytest tests/test_ingestion.py -v        # ESP32 & telemetry ingestion
PYTHONPATH=. pytest tests/test_train_prep.py -v       # Timetable transitions & siding
```

---

## 📂 Key Architecture & File Reference

| Component | Path | Description |
| :--- | :--- | :--- |
| **Physics & Timetable Engine** | `data_api/metro_engine_shared.py` | Continuous circulation math, dwell physics, and zero-collision timetable |
| **FastAPI Backend Server** | `backend/app/main.py` | REST API, WebSocket streams, and simulation runner |
| **Database (SQLite)** | `backend/smartrailos_dev.db` | 79 tables (33 stations, 24 trains, 66 station current/feature tables) |
| **Simulated Clock** | `backend/app/core/sim_clock.py` | Real-time ticking simulated clock with runtime override API |
| **ML Training Pipeline** | `passenger_estimation/estimation.py` | RandomForestRegressor training and serialization (`model.pkl`) |
| **Synthetic Dataset** | `passenger_estimation/data/metro.csv` | 630,720 rows with holidays, weather, anomalies, and coach segregation |
| **IoT Sensor Emulator** | `scripts/sensor_simulator.py` | Turnstile & coach break-beam pulse simulator |
| **React Web Dashboard** | `smartrailos_web/` | TanStack-powered operations dashboard |
| **Flutter Mobile App** | `smartrailos_app/` | Commuter cross-platform mobile application |
