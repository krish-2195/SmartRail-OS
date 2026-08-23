import pandas as pd
import requests
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error
from datetime import datetime

# Gujarat 2026 public holidays dict
GUJARAT_HOLIDAYS_2026 = {
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

now = datetime.now()




df = pd.read_csv("metro.csv", low_memory=False)

df = df.sample(n=100000, random_state=42)

df["Festival"] = df["Festival"].fillna("No_Festival")
df["Festival"] = df["Festival"].astype(str)

df["Timestamp"] = pd.to_datetime(df["Timestamp"])

df["Hour"] = df["Timestamp"].dt.hour
df["Minute"] = df["Timestamp"].dt.minute
df["Day"] = df["Timestamp"].dt.day
df["Month"] = df["Timestamp"].dt.month
df["DayOfWeek"] = df["Timestamp"].dt.dayofweek
df["IsWeekend"] = (df["DayOfWeek"] >= 5).astype(int)

features = [
    "Station_ID",
    "Coach_Type",
    "Temperature",
    "Delay_Minutes",
    "ETA_Minutes",
    "Day_Type",
    "Weather",
    "Festival",
    "Hour",
    "Minute",
    "Day",
    "Month",
    "DayOfWeek",
    "IsWeekend"
]

target = "Passengers"


encoders = {}

categorical_columns = [
    "Station_ID",
    "Coach_Type",
    "Day_Type",
    "Weather",
    "Festival",
]

for col in categorical_columns:
    encoder = LabelEncoder()
    df[col] = encoder.fit_transform(df[col].astype(str))
    encoders[col] = encoder

X = df[features]
y = df[target]

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
)

model = RandomForestRegressor(
    n_estimators=300,
    max_depth=20,
    min_samples_split=5,
    random_state=42,
    n_jobs=-1
)

model.fit(X_train, y_train)


predictions = model.predict(X_test)

mae = mean_absolute_error(y_test, predictions)

print(f"Mean Absolute Error: {mae:.2f}")

# getting current weather data using free Open-Meteo API
latitude = 23.0225
longitude = 72.5714
weather_url = (
    f"https://api.open-meteo.com/v1/forecast"
    f"?latitude={latitude}&longitude={longitude}"
    f"&current=temperature_2m,weathercode"
    f"&timezone=Asia%2FKolkata"
)

try:
    response = requests.get(weather_url, timeout=5)
    response.raise_for_status()
    weather_data = response.json()
    temperature = float(weather_data["current"]["temperature_2m"])
    wmo_code = int(weather_data["current"]["weathercode"])
    
    # WMO Weather Code -> label (matching labels in training set: Sunny, Cloudy, Rainy)
    wmo_to_label = {
        **{c: "Sunny"  for c in [0, 1]},
        **{c: "Cloudy" for c in [2, 3, 45, 48]},
        **{c: "Rainy"  for c in list(range(51, 68)) + list(range(71, 78)) + list(range(80, 83)) + [95, 96, 99]},
    }
    weather = wmo_to_label.get(wmo_code, "Sunny")
except Exception as exc:
    print(f"Error calling Open-Meteo API: {exc}. Using fallbacks.")
    temperature = 32.0
    weather = "Sunny"

print("Current Temperature:", temperature)
print("Current Weather:", weather)

# new dummy input 
station_id = "BL07"
coach_type = "General"

# Determine day type and festival dynamically from date and holidays
check_date_str = now.strftime("%Y-%m-%d")
festival = GUJARAT_HOLIDAYS_2026.get(check_date_str, "No_Festival")
day_type = "Weekend" if now.weekday() >= 5 else "Weekday"

delay_minutes = 2
eta_minutes = 3
hour = now.hour
minute = now.minute
day = now.day
month = now.month
day_of_week = now.weekday()
is_weekend = int(day_of_week >= 5)

# Handle unknown values or unseen categories
if weather not in encoders["Weather"].classes_:
    weather = encoders["Weather"].classes_[0]
if festival not in encoders["Festival"].classes_:
    festival = encoders["Festival"].classes_[0]
if day_type not in encoders["Day_Type"].classes_:
    day_type = encoders["Day_Type"].classes_[0]
if station_id not in encoders["Station_ID"].classes_:
    station_id = encoders["Station_ID"].classes_[0]
if coach_type not in encoders["Coach_Type"].classes_:
    coach_type = encoders["Coach_Type"].classes_[0]

input_data = pd.DataFrame([{
    "Station_ID": encoders["Station_ID"].transform([station_id])[0],
    "Coach_Type": encoders["Coach_Type"].transform([coach_type])[0],
    "Temperature": temperature,
    "Delay_Minutes": delay_minutes,
    "ETA_Minutes": eta_minutes,
    "Day_Type": encoders["Day_Type"].transform([day_type])[0],
    "Weather": encoders["Weather"].transform([weather])[0],
    "Festival": encoders["Festival"].transform([festival])[0],
    "Hour": hour,
    "Minute": minute,
    "Day": day,
    "Month": month,
    "DayOfWeek": day_of_week,
    "IsWeekend": is_weekend
}])


predicted_passengers = model.predict(input_data)

importance = pd.DataFrame({
    "Feature": X.columns,
    "Importance": model.feature_importances_
}).sort_values(
    by="Importance",
    ascending=False
)

print(importance)

print(
    f"Predicted Passenger Count: "
    f"{int(predicted_passengers[0])}"
)

# Save model and encoders to pickle files for faster backend startup
import pickle
print("Saving trained model and encoders to model.pkl and encoders.pkl...")
with open("model.pkl", "wb") as f:
    pickle.dump(model, f)
with open("encoders.pkl", "wb") as f:
    pickle.dump(encoders, f)
print("Saved successfully!")

