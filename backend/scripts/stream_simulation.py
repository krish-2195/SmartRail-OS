import csv
import json
import time
import requests
import argparse
from datetime import datetime
import os

API_URL = os.getenv("API_URL", "http://127.0.0.1:8000/api/v1/ingestion/events")

def stream_csv(csv_path: str, interval: float, max_events: int = 0):
    if not os.path.exists(csv_path):
        print(f"Error: CSV file not found at {csv_path}")
        return

    print(f"Starting simulation stream from {csv_path} to {API_URL}")
    print(f"Interval between events: {interval} seconds")
    
    events_sent = 0
    
    with open(csv_path, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            if max_events > 0 and events_sent >= max_events:
                break
                
            # Parse the CSV row into our SensorEvent payload format
            # Required columns from generate_data.py output:
            # Timestamp, Train_ID, Station_ID, Coach_ID, Passengers, Coach_Occupancy_Percentage, Delay_Minutes
            
            try:
                # Assuming the CSV has timestamp like "2025-01-01 00:00:00"
                # We'll use the current real time to simulate live data, or the CSV time
                # Let's use current time for the live simulation
                current_time = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
                
                payload = {
                    "timestamp": current_time,
                    "train_id": row["Train_ID"],
                    "station_id": row.get("Station_ID", None),
                    "event_type": "occupancy_update",
                    "coaches": [
                        {
                            "coach_id": row["Coach_ID"],
                            "passenger_count": int(float(row["Passengers"])),
                            "occupancy_percentage": float(row["Coach_Occupancy_Percentage"])
                        }
                    ],
                    "delay_minutes": int(float(row.get("Delay_Minutes", 0)))
                }
                
                # Send the POST request
                response = requests.post(API_URL, json=payload)
                
                if response.status_code == 202:
                    print(f"[{current_time}] Sent event for {row['Train_ID']} at {row.get('Station_ID', 'N/A')}")
                    events_sent += 1
                else:
                    print(f"Error sending event: {response.status_code} - {response.text}")
                    
            except Exception as e:
                print(f"Failed to process row or send request: {e}")
                
            # Sleep to simulate real-time stream
            time.sleep(interval)
            
    print(f"Stream completed. Total events sent: {events_sent}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Stream synthetic CSV data to the ingestion API.")
    parser.add_argument("--csv", type=str, default="../../SmartRail_AhmedabadMetro_1Year.csv", help="Path to the synthetic CSV file")
    parser.add_argument("--interval", type=float, default=1.0, help="Seconds to wait between sending each event")
    parser.add_argument("--limit", type=int, default=100, help="Maximum number of events to send (0 for unlimited)")
    
    args = parser.parse_args()
    stream_csv(args.csv, args.interval, args.limit)
