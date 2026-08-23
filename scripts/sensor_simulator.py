#!/usr/bin/env python3
"""
SmartRail OS — IoT Hardware Sensor & Telemetry Simulator
Simulates IR break-beam / optical passenger entry & exit sensors
for trains, coaches, and station turnstiles.

Usage:
  python3 sensor_simulator.py --station BL08 --occupancy 185
  python3 sensor_simulator.py --station "Old High Court" --coach "C1" --boarding 25 --alighting 10
  python3 sensor_simulator.py --rush-hour
"""

import argparse
import random
import sys
import time
import urllib.request
import json
from datetime import datetime

API_BASE = "http://localhost:8000"

def post_esp32_sensor(occupancy: int, station_id: str = "BL08", direction: str = "SYNC", in_delta: int = 0, out_delta: int = 0):
    url = f"{API_BASE}/api/v1/esp32/telemetry"
    payload = {
        "direction": direction,
        "in_delta": in_delta,
        "out_delta": out_delta,
        "occupancy": max(0, occupancy),
        "station_id": station_id,
        "coach_capacity": 400
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "User-Agent": "SmartRail-ESP32-Hardware/1.0"}
    )
    try:
        with urllib.request.urlopen(req, timeout=2.0) as resp:
            data = json.loads(resp.read().decode())
            return True, data
    except Exception as e:
        return False, str(e)

def post_telemetry_event(train_id: str, station_id: str, c1: int, c2: int, c3: int):
    url = f"{API_BASE}/api/v1/ingestion/events"
    payload = {
        "timestamp": datetime.now().isoformat(),
        "train_id": train_id,
        "station_id": station_id,
        "event_type": "occupancy_update",
        "coaches": [
            {"coach_id": "C1", "coach_type": "GENERAL", "passenger_count": c1, "occupancy_percentage": round((c1/400)*100, 1)},
            {"coach_id": "C2", "coach_type": "LADIES", "passenger_count": c2, "occupancy_percentage": round((c2/400)*100, 1)},
            {"coach_id": "C3", "coach_type": "GENERAL", "passenger_count": c3, "occupancy_percentage": round((c3/400)*100, 1)},
        ],
        "delay_minutes": 0
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "User-Agent": "SmartRail-Train-Gateway/1.0"}
    )
    try:
        with urllib.request.urlopen(req, timeout=2.0) as resp:
            return True, resp.status
    except Exception as e:
        return False, str(e)

def simulate_flow(station_id: str, start_occupancy: int, boarding: int, alighting: int, delay=0.4):
    print(f"\n🚆 [HARDWARE FLOW SIMULATION] Station: {station_id}")
    print(f"   Initial Occupancy: {start_occupancy} pax")
    print(f"   Deboarding: {alighting} pax | Boarding: {boarding} pax\n")

    current = start_occupancy

    # Alighting
    for i in range(1, alighting + 1):
        current = max(0, current - 1)
        ok, res = post_esp32_sensor(current, station_id)
        icon = "🟢" if ok else "🔴"
        print(f"   {icon} [EXIT  #{i:02d}/{alighting:02d}] Passenger departed turnstile -> Live Count: {current} pax")
        time.sleep(delay)

    # Boarding
    for i in range(1, boarding + 1):
        current += 1
        ok, res = post_esp32_sensor(current, station_id)
        icon = "🟢" if ok else "🔴"
        print(f"   {icon} [ENTRY #{i:02d}/{boarding:02d}] Passenger entered turnstile  -> Live Count: {current} pax")
        time.sleep(delay)

    # Sync telemetry event
    c2 = int(current * 0.25)
    c1 = int((current - c2) / 2)
    c3 = current - c2 - c1
    post_telemetry_event("ESP32_DEMO", station_id, c1, c2, c3)

    print(f"\n✅ Station {station_id} flow complete. Final verified occupancy: {current} pax\n")

def simulate_rush_hour(station_id: str = "BL08"):
    print(f"\n⚡ [LIVE HARDWARE SENSOR PULSE ACTIVE] Target Station: {station_id}")
    print("   Streaming real-time passenger break-beam IR triggers... (Ctrl+C to stop)\n")
    pax = 120
    try:
        while True:
            delta = random.choices([-2, -1, 1, 2, 3], weights=[0.15, 0.2, 0.3, 0.25, 0.1])[0]
            pax = max(10, min(390, pax + delta))
            ok, res = post_esp32_sensor(pax, station_id)
            ts = datetime.now().strftime("%H:%M:%S")
            print(f"[{ts}] IR Trigger @ {station_id} | Passenger Sensor Reading: {pax:03d}/400 ({round((pax/400)*100)}%) -> {'ACK 200' if ok else 'ERR'}")
            time.sleep(random.uniform(0.6, 1.8))
    except KeyboardInterrupt:
        print("\n🛑 Rush hour simulation stopped.")

def main():
    parser = argparse.ArgumentParser(description="SmartRail OS Hardware Sensor Simulator")
    parser.add_argument("--station", default="BL08", help="Station ID (e.g. BL08, BL01, RL01)")
    parser.add_argument("--occupancy", type=int, default=150, help="Initial or target occupancy")
    parser.add_argument("--boarding", type=int, default=15, help="Number of boarding passengers")
    parser.add_argument("--alighting", type=int, default=8, help="Number of alighting passengers")
    parser.add_argument("--rush-hour", action="store_true", help="Run continuous rush hour simulation")

    args = parser.parse_args()

    print("=" * 65)
    print("   SmartRail OS — IoT Hardware & Sensor Telemetry Gateway")
    print("=" * 65)

    if args.rush_hour:
        simulate_rush_hour(args.station)
    else:
        simulate_flow(args.station, args.occupancy, args.boarding, args.alighting)

if __name__ == "__main__":
    main()
