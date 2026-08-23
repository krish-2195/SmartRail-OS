import pandas as pd
import numpy as np
import os

# Set seed for reproducibility
np.random.seed(42)

def generate_metro_dataset():
    print("Initializing Ahmedabad Metro network definitions...")
    
    # Blue Line stations
    blue_stations = [
        ("BL01", "Vastral Gam"),
        ("BL02", "Nirant Cross Road"),
        ("BL03", "Vastral"),
        ("BL04", "Rabari Colony"),
        ("BL05", "Amraiwadi"),
        ("BL06", "Apparel Park"),
        ("BL07", "Kankaria East"),
        ("BL08", "Kalupur Metro Station"),
        ("BL09", "Ghee Kanta"),
        ("BL10", "Shahpur"),
        ("BL11", "Old High Court"),
        ("BL12", "S P Stadium"),
        ("BL13", "Commerce Six Road"),
        ("BL14", "Gujarat University"),
        ("BL15", "Gurukul Road"),
        ("BL16", "Doordarshan Kendra"),
        ("BL17", "Thaltej"),
        ("BL18", "Thaltej Gam")
    ]

    # Red Line stations
    red_stations = [
        ("RL01", "APMC"),
        ("RL02", "Jivraj Park"),
        ("RL03", "Rajivnagar"),
        ("RL04", "Shreyas"),
        ("RL05", "Paldi"),
        ("RL06", "Gandhigram"),
        ("RL07", "Old High Court"),
        ("RL08", "Usmanpura"),
        ("RL09", "Vijay Nagar"),
        ("RL10", "Vadaj"),
        ("RL11", "Ranip"),
        ("RL12", "Sabarmati Rly Station"),
        ("RL13", "AEC"),
        ("RL14", "Sabarmati"),
        ("RL15", "Motera Stadium")
    ]

    # Trains configuration — 24 circulating rakes
    trains_config = {}
    for i in range(12):
        trains_config[f"BL-{i+1:02d}"] = {"line": "Blue", "route_up": blue_stations, "route_down": list(reversed(blue_stations)), "offset": i * 3}
    for i in range(12):
        trains_config[f"RL-{i+1:02d}"] = {"line": "Red", "route_up": red_stations, "route_down": list(reversed(red_stations)), "offset": int(i * 2.5)}

    dates = pd.date_range(start="2025-01-01 00:00:00", end="2025-12-31 23:00:00", freq="h")
    train_ids = list(trains_config.keys())
    coaches = ["C1", "C2", "C3"]

    print("Generating base index combinations (630,720 rows)...")
    index = pd.MultiIndex.from_product([dates, train_ids, coaches], names=["Timestamp", "Train_ID", "Coach_ID"])
    df = pd.DataFrame(index=index).reset_index()

    # Extract timestamp properties
    hours = df["Timestamp"].dt.hour.values
    months = df["Timestamp"].dt.month.values
    day_of_week = df["Timestamp"].dt.dayofweek.values
    hours_since_start = ((df["Timestamp"] - dates[0]).dt.total_seconds() // 3600).astype(int).values

    # Map static train configuration
    line_map = {t: trains_config[t]["line"] for t in train_ids}
    offset_map = {t: trains_config[t]["offset"] for t in train_ids}

    df["Line"] = df["Train_ID"].map(line_map).astype("category")
    offsets = df["Train_ID"].map(offset_map).values

    # Dynamic direction determination: continuous cycle alternates UP and DOWN
    # Blue line: 18 stations (trip len 18), Red line: 15 stations (trip len 15)
    print("Mapping stations along route configurations...")
    station_ids = np.empty(len(df), dtype=object)
    station_names = np.empty(len(df), dtype=object)
    next_stations = np.empty(len(df), dtype=object)
    directions = np.empty(len(df), dtype=object)

    for line_name, stations_up in [("Blue", blue_stations), ("Red", red_stations)]:
        mask = (df["Line"] == line_name)
        idx_in_mask = df.index[mask]
        if len(idx_in_mask) == 0:
            continue
        
        n_stn = len(stations_up)
        h_since = hours_since_start[mask]
        offs = offsets[mask]
        total_cycle = 2 * n_stn
        
        pos_in_cycle = (h_since + offs) % total_cycle
        is_up_trip = pos_in_cycle < n_stn
        
        stations_down = list(reversed(stations_up))
        
        for i_local, is_up_val in enumerate(is_up_trip):
            real_idx = idx_in_mask[i_local]
            p = pos_in_cycle[i_local]
            if is_up_val:
                directions[real_idx] = "UP"
                st_idx = p
                station_ids[real_idx] = stations_up[st_idx][0]
                station_names[real_idx] = stations_up[st_idx][1]
                if st_idx < n_stn - 1:
                    next_stations[real_idx] = stations_up[st_idx + 1][1]
                else:
                    # At the terminal UP end, the next stop upon turnaround is the first stop on the DOWN journey
                    next_stations[real_idx] = stations_down[1][1]
            else:
                directions[real_idx] = "DOWN"
                st_idx = p - n_stn
                station_ids[real_idx] = stations_down[st_idx][0]
                station_names[real_idx] = stations_down[st_idx][1]
                if st_idx < n_stn - 1:
                    next_stations[real_idx] = stations_down[st_idx + 1][1]
                else:
                    # At the terminal DOWN end, the next stop upon turnaround is the first stop on the UP journey
                    next_stations[real_idx] = stations_up[1][1]

    df["Direction"] = pd.Categorical(directions, categories=["UP", "DOWN"])

    df["Station_ID"] = station_ids
    df["Station_ID"] = df["Station_ID"].astype("category")
    df["Station_Name"] = station_names
    df["Station_Name"] = df["Station_Name"].astype("category")
    df["Next_Station"] = next_stations
    df["Next_Station"] = df["Next_Station"].astype("category")

    # Platform Number Mapping
    # Standard: UP -> 1, DOWN -> 2
    # Old High Court (BL11 / RL07): BL UP -> 1, BL DOWN -> 2, RL UP -> 3, RL DOWN -> 4
    is_ohc = (df["Station_ID"] == "BL11") | (df["Station_ID"] == "RL07")
    is_up = (df["Direction"] == "UP")
    is_bl = (df["Line"] == "Blue")
    platform_nums = np.where(
        is_ohc,
        np.where(is_bl, np.where(is_up, 1, 2), np.where(is_up, 3, 4)),
        np.where(is_up, 1, 2)
    ).astype(np.int8)
    df["Platform_Number"] = platform_nums

    # Event State cycle: BOARDING, ALIGHTING, IN_TRANSIT, NOT_IN_SERVICE
    print("Generating event states...")
    is_night_closed = (hours < 6)
    event_idx = (hours_since_start + offsets) % 3
    event_states_list = ["BOARDING", "ALIGHTING", "IN_TRANSIT"]
    event_states_arr = np.array(event_states_list, dtype=object)[event_idx]
    event_states_arr[is_night_closed] = "NOT_IN_SERVICE"
    df["Event_State"] = pd.Categorical(event_states_arr, categories=["BOARDING", "ALIGHTING", "IN_TRANSIT", "NOT_IN_SERVICE"])

    # ETA minutes (0 for night closed or dwelling)
    eta = np.zeros(len(df), dtype=np.int8)
    is_transit = (df["Event_State"] == "IN_TRANSIT").values
    eta[is_transit] = np.random.randint(1, 3, size=np.sum(is_transit))
    eta[~is_transit & ~is_night_closed] = np.random.randint(2, 5, size=np.sum(~is_transit & ~is_night_closed))
    eta[is_night_closed] = 0
    df["ETA_Minutes"] = eta

    # Coach configurations
    df["Coach_Type"] = np.where(df["Coach_ID"] == "C2", "Ladies", "General")
    df["Coach_Type"] = df["Coach_Type"].astype("category")
    df["Coach_Capacity"] = np.int16(400)

    # Day Type and Festivals
    df["Day_Type"] = np.where(day_of_week >= 5, "Weekend", "Weekday")
    df["Day_Type"] = df["Day_Type"].astype("category")
    is_weekend = (df["Day_Type"] == "Weekend").values

    festival_mapping = {
        "2025-03-14": "Holi",
        "2025-08-15": "Independence Day",
        "2025-10-02": "Gandhi Jayanti",
        "2025-10-20": "Diwali",
        "2025-12-25": "Christmas"
    }
    df["Festival"] = df["Timestamp"].dt.strftime("%Y-%m-%d").map(festival_mapping).fillna("None")
    df["Festival"] = df["Festival"].astype("category")
    is_festival = (df["Festival"] != "None").values

    # Weather Logic
    print("Simulating weather and temperature...")
    weather_rand = np.random.rand(len(df))
    weather = np.empty(len(df), dtype=object)
    monsoon_mask = (months >= 6) & (months <= 9)

    weather[monsoon_mask] = np.select(
        [weather_rand[monsoon_mask] < 0.60, weather_rand[monsoon_mask] < 0.90],
        ["Rainy", "Cloudy"],
        default="Sunny"
    )
    weather[~monsoon_mask] = np.select(
        [weather_rand[~monsoon_mask] < 0.75, weather_rand[~monsoon_mask] < 0.95],
        ["Sunny", "Cloudy"],
        default="Rainy"
    )
    df["Weather"] = weather
    df["Weather"] = df["Weather"].astype("category")

    # Temperature Logic (regional for Ahmedabad)
    temp_base = np.select(
        [(months >= 3) & (months <= 5), (months >= 6) & (months <= 9)],
        [37.0, 30.0],
        default=21.0
    )
    hourly_var = 8.0 * np.sin((hours - 8) * np.pi / 12)
    temp_noise = np.random.normal(0, 1.5, size=len(df))
    temperature = temp_base + hourly_var + temp_noise
    temperature = np.where(df["Weather"] == "Rainy", temperature - 3.0, temperature)
    df["Temperature"] = np.round(temperature, 1).astype(np.float32)

    # Delay Minutes
    base_delay = np.random.exponential(scale=2.0, size=len(df)).astype(int)
    base_delay = np.clip(base_delay, 0, 10)
    rainy_addon = np.where(df["Weather"] == "Rainy", np.random.randint(10, 30, size=len(df)), 0)
    festival_addon = np.where(is_festival, np.random.randint(5, 15, size=len(df)), 0)
    delays = (base_delay + rainy_addon + festival_addon).astype(np.int16)
    delays[is_night_closed] = 0
    df["Delay_Minutes"] = delays

    # Peak hour & Weekend Base occupancy logic
    print("Generating realistic passengers occupancy profiles...")
    hour_min_pct = np.zeros(24)
    hour_max_pct = np.zeros(24)

    # Morning Peak (07:00 - 10:00)
    hour_min_pct[7:11] = 0.70
    hour_max_pct[7:11] = 0.95
    # Afternoon (11:00 - 16:00)
    hour_min_pct[11:17] = 0.30
    hour_max_pct[11:17] = 0.55
    # Evening Peak (17:00 - 21:00)
    hour_min_pct[17:22] = 0.75
    hour_max_pct[17:22] = 0.98
    # Late Evening (22:00 - 23:00)
    hour_min_pct[[22, 23]] = 0.05
    hour_max_pct[[22, 23]] = 0.15
    # Closed Night Hours (00:00 - 05:00) - No revenue service
    hour_min_pct[[0, 1, 2, 3, 4, 5]] = 0.0
    hour_max_pct[[0, 1, 2, 3, 4, 5]] = 0.0
    # Early Morning Transition (06:00)
    hour_min_pct[6] = 0.15
    hour_max_pct[6] = 0.35

    base_min = hour_min_pct[hours]
    base_max = hour_max_pct[hours]

    # Weekend changes
    is_peak = ((hours >= 7) & (hours <= 10)) | ((hours >= 17) & (hours <= 21))
    weekend_min = np.where(is_weekend, base_min * 0.70, base_min)
    weekend_max = np.where(is_weekend, base_max * 0.70, base_max)
    weekend_min = np.where(is_weekend & ~is_peak, weekend_min * 1.2, weekend_min)
    weekend_max = np.where(is_weekend & ~is_peak, weekend_max * 1.2, weekend_max)

    # Festival multiplier
    festival_mult = np.where(is_festival, np.random.uniform(1.2, 1.4, size=len(df)), 1.0)
    final_min = weekend_min * festival_mult
    final_max = weekend_max * festival_mult

    final_min = np.where(is_night_closed, 0.0, np.clip(final_min, 0.02, 0.95))
    final_max = np.where(is_night_closed, 0.0, np.clip(final_max, 0.05, 1.00))

    train_occ_base = np.where(is_night_closed, 0.0, np.random.uniform(final_min, final_max))

    # Coach specific multipliers (Ladies vs General)
    coach_mult = np.ones(len(df))
    coach_mult[df["Coach_ID"] == "C1"] = np.random.uniform(1.0, 1.15, size=np.sum(df["Coach_ID"] == "C1"))
    coach_mult[df["Coach_ID"] == "C3"] = np.random.uniform(1.0, 1.15, size=np.sum(df["Coach_ID"] == "C3"))
    coach_mult[df["Coach_ID"] == "C2"] = np.random.uniform(0.5, 0.65, size=np.sum(df["Coach_ID"] == "C2"))

    passengers = np.round(train_occ_base * 400 * coach_mult).astype(int)
    passengers = np.clip(passengers, 0, 400)
    passengers[is_night_closed] = 0
    df["Passengers"] = passengers.astype(np.int16)

    # Anomalies (1% target) - only during operating hours (hours >= 6)
    print("Injecting operational anomalies...")
    df["Anomaly_Flag"] = np.int8(0)
    operating_indices = df.index[~is_night_closed]
    anomaly_indices = np.random.choice(operating_indices, size=int(len(df) * 0.01), replace=False)
    df.loc[anomaly_indices, "Anomaly_Flag"] = np.int8(1)

    num_anomalies = len(anomaly_indices)
    type_size = num_anomalies // 3
    idx_surge = anomaly_indices[:type_size]
    idx_overcrowd = anomaly_indices[type_size:2*type_size]
    idx_delay_spike = anomaly_indices[2*type_size:]

    # Anomaly 1: Sudden passenger surge (exceed capacity in General coaches)
    is_c2 = (df.loc[idx_surge, "Coach_ID"] == "C2").values
    df.loc[idx_surge, "Passengers"] = np.where(
        is_c2,
        np.random.randint(250, 320, size=len(idx_surge)),
        np.random.randint(410, 460, size=len(idx_surge))
    ).astype(np.int16)

    # Anomaly 2: Unexpected overcrowding late evening
    df.loc[idx_overcrowd, "Passengers"] = np.random.randint(300, 390, size=len(idx_overcrowd)).astype(np.int16)

    # Anomaly 3: High delay spike + platform congestion
    df.loc[idx_delay_spike, "Delay_Minutes"] = np.random.randint(60, 150, size=len(idx_delay_spike)).astype(np.int16)
    df.loc[idx_delay_spike, "Passengers"] = np.minimum(
        np.round(df.loc[idx_delay_spike, "Passengers"] * 1.3).astype(int), 400
    ).astype(np.int16)

    # Compute occupancy percentages
    df["Coach_Occupancy_Percentage"] = np.round((df["Passengers"] / df["Coach_Capacity"]) * 100, 2).astype(np.float32)

    # Train-level summaries
    print("Aggregating coach counts to train levels...")
    train_sums = df.groupby(["Timestamp", "Train_ID"])["Passengers"].transform("sum")
    df["Train_Total_Passengers"] = train_sums.astype(np.int16)
    df["Train_Total_Capacity"] = np.int16(1200)
    df["Train_Occupancy_Percentage"] = np.round((df["Train_Total_Passengers"] / df["Train_Total_Capacity"]) * 100, 2).astype(np.float32)

    # Crowd Level Classification
    pct_vals = df["Coach_Occupancy_Percentage"].values
    df["Crowd_Level"] = np.select(
        [pct_vals <= 20.0, pct_vals <= 50.0, pct_vals <= 85.0],
        ["EMPTY", "MODERATE", "CROWDED"],
        default="VERY_CROWDED"
    )
    df["Crowd_Level"] = df["Crowd_Level"].astype("category")

    # Reorder columns as requested
    required_cols = [
        "Timestamp", "Train_ID", "Line", "Direction", "Platform_Number", "Station_ID", "Station_Name",
        "Coach_ID", "Coach_Type", "Passengers", "Coach_Capacity", "Coach_Occupancy_Percentage",
        "Train_Total_Passengers", "Train_Total_Capacity", "Train_Occupancy_Percentage",
        "Crowd_Level", "Weather", "Temperature", "Day_Type", "Festival", "Delay_Minutes",
        "Event_State", "Next_Station", "ETA_Minutes", "Anomaly_Flag"
    ]
    df = df[required_cols]

    # Save to CSV in passenger_estimation/data/ and passenger_estimation/
    base_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(base_dir, "data")
    os.makedirs(data_dir, exist_ok=True)
    csv_filename = os.path.join(data_dir, "metro.csv")
    csv_fallback = os.path.join(base_dir, "metro.csv")
    print(f"Saving new dataset to {csv_filename} and {csv_fallback}...")
    df.to_csv(csv_filename, index=False)
    df.to_csv(csv_fallback, index=False)
    print(f"Dataset successfully saved.\n")

    # Output stats
    print("--- df.head() ---")
    print(df.head())
    print("\n--- df.info() ---")
    print(df.info())
    print("\n--- df.describe() ---")
    print(df.describe())

    total_rows = len(df)
    file_size_mb = os.path.getsize(csv_filename) / (1024 * 1024)
    print("\n--- Summary Metrics ---")
    print(f"Total Rows: {total_rows}")
    print(f"CSV File Size: {file_size_mb:.2f} MB")

if __name__ == "__main__":
    generate_metro_dataset()
