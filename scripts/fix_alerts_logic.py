import os

seeder_path = 'backend/app/db/seeder.py'
if os.path.exists(seeder_path):
    with open(seeder_path, 'r', encoding='utf-8') as f:
        s_content = f.read()
    s_content = s_content.replace(
        'created_at=now - timedelta(minutes=4),',
        'created_at=now - timedelta(minutes=15), resolved_at=now - timedelta(minutes=5),'
    ).replace(
        'created_at=now - timedelta(minutes=12),',
        'created_at=now - timedelta(minutes=25), resolved_at=now - timedelta(minutes=10),'
    ).replace(
        'created_at=now - timedelta(minutes=25),',
        'created_at=now - timedelta(minutes=45), resolved_at=now - timedelta(minutes=20),'
    )
    with open(seeder_path, 'w', encoding='utf-8') as f:
        f.write(s_content)
    print('Updated seeder.py')

alert_srv_path = 'backend/app/services/domain/alert_service.py'
if os.path.exists(alert_srv_path):
    with open(alert_srv_path, 'r', encoding='utf-8') as f:
        srv_content = f.read()
    
    old_code = '''            # Auto-resolve stale / off-peak dummy alerts
            is_stale = alert.created_at and (now - alert.created_at).total_seconds() > 1800
            is_offpeak_crowd = is_off_peak and alert.alert_type in (AlertType.PLATFORM_CONGESTION, AlertType.PREDICTION_ALERT)
            is_res = alert.resolved_at is not None or is_stale or is_offpeak_crowd'''

    new_code = '''            # Auto-resolve stale / off-peak dummy alerts
            type_val = (getattr(alert.alert_type, "value", str(alert.alert_type)) or "").lower()
            is_stale = alert.created_at and (now - alert.created_at).total_seconds() > 900
            is_offpeak_crowd = is_off_peak and type_val in ("platform_congestion", "prediction_alert", "train_delay")
            is_res = alert.resolved_at is not None or is_stale or is_offpeak_crowd'''

    if old_code in srv_content:
        srv_content = srv_content.replace(old_code, new_code)
        with open(alert_srv_path, 'w', encoding='utf-8') as f:
            f.write(srv_content)
        print('Updated alert_service.py')
    else:
        print('Pattern not found in alert_service.py')
