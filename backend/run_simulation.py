import asyncio
import httpx
import os
import random
from datetime import datetime

API_BASE_URL = os.getenv("API_BASE_URL", "http://127.0.0.1:8000").rstrip("/")

async def simulate():
    print(f"Starting IoT simulation... pushing random spikes to {API_BASE_URL} every 5 seconds.")
    
    stations = ["BL01", "BL02", "BL03", "RL10", "RL11", "RL12"]
    trains = ["BL-UP-01", "BL-DO-02", "RL-UP-01", "RL-DO-01"]
    
    urls = [
        f"{API_BASE_URL}/api/v1/ingestion/events",
        "http://127.0.0.1:8000/api/v1/ingestion/events",
        "http://localhost:8000/api/v1/ingestion/events",
    ]
    # Deduplicate while preserving order
    target_urls = list(dict.fromkeys(urls))

    async with httpx.AsyncClient(timeout=5.0) as client:
        while True:
            station = random.choice(stations)
            train = random.choice(trains)
            
            # 70% chance of normal load, 30% chance of massive surge
            if random.random() > 0.3:
                p_count = random.randint(20, 100)
                occ = random.uniform(5.0, 25.0)
            else:
                p_count = random.randint(300, 380)
                occ = random.uniform(75.0, 95.0)
            
            payload = {
                "timestamp": datetime.now().isoformat(),
                "train_id": train,
                "station_id": station,
                "event_type": "occupancy_update",
                "coaches": [
                    {"coach_id": "C1", "passenger_count": p_count, "occupancy_percentage": int(occ)},
                    {"coach_id": "C2", "passenger_count": int(p_count * 0.5), "occupancy_percentage": int(occ * 0.5)},
                    {"coach_id": "C3", "passenger_count": p_count, "occupancy_percentage": int(occ)}
                ],
                "delay_minutes": random.randint(0, 5)
            }
            
            sent = False
            for target_url in target_urls:
                try:
                    res = await client.post(target_url, json=payload)
                    if res.status_code == 202:
                        print(f"[{datetime.now().time()}] Pushed event for Train {train} at Station {station} ({target_url}) - Occupancy: {occ:.1f}%")
                        sent = True
                        break
                except Exception:
                    continue
            
            if not sent:
                print(f"[{datetime.now().time()}] Failed to push event to endpoints: {target_urls}")
                
            await asyncio.sleep(5)

if __name__ == "__main__":
    try:
        asyncio.run(simulate())
    except KeyboardInterrupt:
        print("Simulation stopped.")
