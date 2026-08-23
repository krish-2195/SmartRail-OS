#ifndef ESP_CONFIG_H
#define ESP_CONFIG_H

/**
 * @file esp_config.h
 * @brief SmartRail OS — ESP32 Directional Passenger Counter Configuration
 */

// ─── Network & Backend Configuration ───────────────────────────────────────────
// Set to 1 to enable direct Wi-Fi telemetry posting from ESP32, or 0 for USB serial bridge mode
#define ENABLE_WIFI         0

// Wi-Fi Credentials
#define WIFI_SSID           "Your_WiFi_SSID"
#define WIFI_PASSWORD       "Your_WiFi_Password"

// SmartRail OS Backend Server IP & Port (e.g. your computer's local LAN IP)
#define BACKEND_HOST        "192.168.1.100"
#define BACKEND_PORT        8000
#define TELEMETRY_ENDPOINT  "/api/v1/esp32/telemetry"

// ─── Hardware Pin Mapping (ESP32) ──────────────────────────────────────────────
// Sensor 0 (S0 / S1 Entry): Platform / Outside Side
#define TRIG1_PIN           4
#define ECHO1_PIN           14

// Sensor 1 (S1 / S2 Exit): Coach Interior / Inside Side
#define TRIG2_PIN           27
#define ECHO2_PIN           33

// Direction Inversion (Set to 1 if sensors are mounted in opposite physical orientation)
#define INVERT_DIRECTION    0

// Status LED (Builtin LED is GPIO 2 on standard ESP32 DevKit)
#define LED_PIN             2

// ─── Detection Distance Thresholds & Timing Calibration ────────────────────────
// Doorway setup: normal doorway width is 60-150cm. Max echo timeout 10000us (~171cm).
#define PULSE_TIMEOUT_US    10000  // 10ms timeout (~171cm max range) avoids long blocking
#define THRESHOLD_ENTER_CM  75.0   // Blocked when distance < 75 cm
#define THRESHOLD_LEAVE_CM  85.0   // Cleared when distance > 85 cm

// Maximum time in milliseconds allowed for a full traversal before resetting to IDLE
#define TRAVERSAL_TIMEOUT_MS 1200

// Cooldown in milliseconds after a successful count before next crossing can start
#define COOLDOWN_MS         300

// Spacing delay in milliseconds between pinging S0 and S1 to avoid acoustic cross-talk
#define SENSOR_SPACING_MS   10

// Debug logging over Serial (0 = Clean JSON only for serial_bridge.py, 1 = Verbose debug)
#define DEBUG_SERIAL        0

// ─── Transit & Coach Metadata ─────────────────────────────────────────────────
#define DEVICE_ID           "ESP32_COACH_01"
#define DEFAULT_STATION_ID  "BL08"        // e.g. Old High Court (BL08)
#define DEFAULT_COACH_ID    "C1"
#define COACH_CAPACITY      400

#endif // ESP_CONFIG_H

