from datetime import datetime, timedelta
from app.services.metro_engine import MetroEngine, get_train_state

def test_train_prep_window_and_not_in_service():
    engine = MetroEngine()
    
    # We choose train BL-01 to test its scheduling transitions
    train = next(t for t in engine._trains if t["train_id"] == "BL-01")
    
    # First departure of the day for BL-01 (in seconds from midnight)
    base_dt = datetime(2026, 6, 12)
    first_dep_sec = train["launch_sec"]
    first_dep_dt = base_dt + timedelta(seconds=first_dep_sec)

    # Case A: 5 minutes before the first departure (300 seconds > 60s prep window)
    # The train should be NOT_IN_SERVICE
    now_a = first_dep_dt - timedelta(minutes=5)
    state_a = get_train_state(train, now_a)
    assert state_a["status"] == "NOT_IN_SERVICE"

    # Case B: 30 seconds before the first departure (30 seconds <= prep window)
    # The train should be WAITING_AT_TERMINAL at Vastral Gam
    now_b = first_dep_dt - timedelta(seconds=30)
    state_b = get_train_state(train, now_b)
    assert state_b["status"] == "WAITING_AT_TERMINAL"
    assert state_b["current_station"] == train["terminal_A"]
    assert state_b["platform_number"] == 1

    # Case C: 5 minutes into the UP journey (running)
    now_c = first_dep_dt + timedelta(minutes=5)
    state_c = get_train_state(train, now_c)
    assert state_c["status"] in {"IN_TRANSIT", "AT_STATION"}
    assert state_c["direction"] == "UP"
    assert state_c["platform_number"] == 1

    # Case D: At Thaltej Gam during turnaround crossover/reversing (16 min after launch = 960s)
    # At 960s: in reversing/crossover siding, direction is DOWN, status is REVERSING
    now_d = first_dep_dt + timedelta(seconds=960)
    state_d = get_train_state(train, now_d)
    assert state_d["current_station"] == train["terminal_B"]
    assert state_d["direction"] == "DOWN"
    assert state_d["status"] == "REVERSING"
    assert state_d["platform_name"] == "Crossover / Reversing Siding"

    # Case D2: At Thaltej Gam platform 2 boarding (17.5 min after launch = 1050s)
    now_d2 = first_dep_dt + timedelta(seconds=1050)
    state_d2 = get_train_state(train, now_d2)
    assert state_d2["current_station"] == train["terminal_B"]
    assert state_d2["direction"] == "DOWN"
    assert state_d2["status"] == "WAITING_AT_TERMINAL"
    assert state_d2["platform_number"] == 2

    # Case E: 20 minutes after launch (running DOWN towards Vastral Gam)
    now_e = first_dep_dt + timedelta(minutes=20)
    state_e = get_train_state(train, now_e)
    assert state_e["status"] in {"IN_TRANSIT", "AT_STATION"}
    assert state_e["direction"] == "DOWN"
    assert state_e["platform_number"] == 2

