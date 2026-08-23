import re

with open("backend/app/db/seeder.py", "r", encoding="utf-8") as f:
    code = f.read()

# Replace the entire default_alerts definition with clean definition
pattern = r"default_alerts = \[.*?\]\s*for alert in default_alerts:"
replacement = '''default_alerts = [
        Alert(
            id="alt-emg-01",
            alert_type=AlertType.PLATFORM_CONGESTION,
            severity=SeverityLevel.CRITICAL,
            title="Critical Crowd Surge at Old High Court",
            message="Platform 1 & 2 crowd exceeds 850 passengers. Immediate turnstile metering recommended.",
            station_id="BL11",
            train_id=None,
            created_at=now - timedelta(minutes=15),
            resolved_at=now - timedelta(minutes=5),
            payload={"acknowledged": True},
        ),
        Alert(
            id="alt-wrn-02",
            alert_type=AlertType.PREDICTION_ALERT,
            severity=SeverityLevel.HIGH,
            title="Train Capacity Warning (BL-UP-03)",
            message="Train BL-UP-03 coach 3 approaching 92% critical occupancy near Kalupur Metro Station.",
            station_id="BL08",
            train_id="BL-UP-03",
            created_at=now - timedelta(minutes=25),
            resolved_at=now - timedelta(minutes=10),
            payload={"acknowledged": True},
        ),
        Alert(
            id="alt-dly-03",
            alert_type=AlertType.TRAIN_DELAY,
            severity=SeverityLevel.MEDIUM,
            title="Minor Dwell Delay at Motera Stadium",
            message="Train RL-UP-04 experienced +2m dwell delay due to heavy platform boarding flow.",
            station_id="RL15",
            train_id="RL-UP-04",
            created_at=now - timedelta(minutes=45),
            resolved_at=now - timedelta(minutes=20),
            payload={"acknowledged": True},
        ),
    ]
    for alert in default_alerts:'''

new_code = re.sub(pattern, replacement, code, flags=re.DOTALL)
with open("backend/app/db/seeder.py", "w", encoding="utf-8") as f:
    f.write(new_code)

print("seeder.py fixed successfully!")
