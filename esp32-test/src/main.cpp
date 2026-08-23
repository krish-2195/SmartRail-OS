/*
 * @file main.cpp
 * @brief SmartRail OS — ESP32 Dual-Beam Directional Passenger Counter
 *
 * Robust Time-Window Directional Traversal Algorithm:
 * ----------------------------------------------------
 *  Boarding (IN: Platform S0 -> Coach S1):
 *    IDLE -> S0 Triggered (STATE_IN_STARTED) -> S1 Triggered (STATE_IN_MIDWAY)
 * -> Both Clear -> COUNT +1 IN
 *
 *  Alighting (OUT: Coach S1 -> Platform S0):
 *    IDLE -> S1 Triggered (STATE_OUT_STARTED) -> S0 Triggered
 * (STATE_OUT_MIDWAY) -> Both Clear -> COUNT -1 OUT
 *
 * Features:
 *  - 10ms fast pulse timeout to prevent loop blocking
 *  - Non-blocking state window (preserves counts during fast strides &
 * single-beam gaps)
 *  - Anti-rebound timeout (aborts if passenger backs away without touching exit
 * beam)
 *  - Clean JSON serial output for serial_bridge.py
 */

#include "esp_config.h"
#include <Arduino.h>

#if ENABLE_WIFI
#include <HTTPClient.h>
#include <WiFi.h>
#endif

// ─── Authoritative State & Counters ──────────────────────────────────────────
volatile int occupancy = 0;
volatile int total_in = 0;
volatile int total_out = 0;

enum TraversalState {
  STATE_IDLE,

  // Boarding Sequence (S0 -> S1)
  STATE_IN_STARTED, // S0 triggered first
  STATE_IN_MIDWAY,  // S1 reached (sequence validated)

  // Alighting Sequence (S1 -> S0)
  STATE_OUT_STARTED, // S1 triggered first
  STATE_OUT_MIDWAY   // S0 reached (sequence validated)
};

TraversalState state = STATE_IDLE;
unsigned long stateStartTime = 0;
unsigned long lastCountTime = 0;
unsigned long lastTelemetrySync = 0;
unsigned long ledTurnOffTime = 0;

// Filter history (3-sample median ring buffer)
float s0_history[3] = {999.0f, 999.0f, 999.0f};
float s1_history[3] = {999.0f, 999.0f, 999.0f};
int sample_idx = 0;

// Hysteresis latches
bool s0_blocked = false;
bool s1_blocked = false;

// ─── Fast Median Filter & Distance Ping
// ───────────────────────────────────────

float median3(float a, float b, float c) {
  if ((a <= b && b <= c) || (c <= b && b <= a))
    return b;
  if ((b <= a && a <= c) || (c <= a && a <= b))
    return a;
  return c;
}

float pingUltrasonic(int trigPin, int echoPin) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);

  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  // Fast pulse timeout ~ 10ms (approx 1.7 meters max range)
  long duration = pulseIn(echoPin, HIGH, PULSE_TIMEOUT_US);

  if (duration <= 0 || duration >= PULSE_TIMEOUT_US) {
    return 999.0f;
  }

  float distanceCm = (duration * 0.0343f) / 2.0f;
  if (distanceCm < 2.0f || distanceCm > 400.0f) {
    return 999.0f;
  }

  return distanceCm;
}

void dispatchCrossing(const char *dir, int in_d, int out_d, float d0,
                      float d1) {
  char jsonLine[160];
  snprintf(jsonLine, sizeof(jsonLine),
           "{\"event\":\"%s\",\"in_delta\":%d,\"out_delta\":%d,\"occupancy\":%"
           "d,\"total_in\":%d,\"total_out\":%d,\"d1\":%.1f,\"d2\":%.1f}",
           dir, in_d, out_d, occupancy, total_in, total_out, d0, d1);
  Serial.println(jsonLine);

  // Status LED pulse (non-blocking 100ms)
  digitalWrite(LED_PIN, HIGH);
  ledTurnOffTime = millis() + 100;
}

// ─── Arduino Lifecycle
// ────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  delay(200);

  pinMode(TRIG1_PIN, OUTPUT);
  pinMode(ECHO1_PIN, INPUT);

  pinMode(TRIG2_PIN, OUTPUT);
  pinMode(ECHO2_PIN, INPUT);

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  digitalWrite(TRIG1_PIN, LOW);
  digitalWrite(TRIG2_PIN, LOW);

  Serial.println();
  Serial.println("==================================================");
  Serial.println(" SmartRail OS — Robust Passenger Gate Counter     ");
  Serial.printf(" S0 (Entry): GPIO %d/%d | S1 (Exit): GPIO %d/%d\n", TRIG1_PIN,
                ECHO1_PIN, TRIG2_PIN, ECHO2_PIN);
  Serial.printf(" Thresholds: Block < %.1f cm | Clear > %.1f cm\n",
                THRESHOLD_ENTER_CM, THRESHOLD_LEAVE_CM);
  Serial.printf(" Max Echo Timeout: %d us | Traversal Window: %d ms\n",
                PULSE_TIMEOUT_US, TRAVERSAL_TIMEOUT_MS);
  Serial.printf(" Station: %s | Coach: %s | Invert: %d\n", DEFAULT_STATION_ID,
                DEFAULT_COACH_ID, INVERT_DIRECTION);
  Serial.println("==================================================");
  Serial.println();
}

void loop() {
  unsigned long now = millis();

  // Check for incoming serial commands (e.g. RESET)
  while (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    if (cmd.equalsIgnoreCase("RESET") || cmd.indexOf("\"reset\"") >= 0) {
      occupancy = 0;
      total_in = 0;
      total_out = 0;
      state = STATE_IDLE;
      char resetBuf[160];
      snprintf(resetBuf, sizeof(resetBuf),
               "{\"event\":\"RESET_ACK\",\"occupancy\":0,\"total_in\":0,\"total_out\":0,\"d1\":%.1f,\"d2\":%.1f}",
               s0_history[0], s1_history[0]);
      Serial.println(resetBuf);
    }
  }

  // 0. Non-blocking LED turn-off
  if (ledTurnOffTime > 0 && now >= ledTurnOffTime) {
    digitalWrite(LED_PIN, LOW);
    ledTurnOffTime = 0;
  }

  // 1. Read ultrasonic pings with cross-talk avoidance delay
  float raw0 = pingUltrasonic(TRIG1_PIN, ECHO1_PIN);
  delay(SENSOR_SPACING_MS);
  float raw1 = pingUltrasonic(TRIG2_PIN, ECHO2_PIN);

  // 2. 3-Sample Median Ring Filter (fast response with glitch rejection)
  s0_history[sample_idx] = raw0;
  s1_history[sample_idx] = raw1;
  sample_idx = (sample_idx + 1) % 3;

  float d0 = median3(s0_history[0], s0_history[1], s0_history[2]);
  float d1 = median3(s1_history[0], s1_history[1], s1_history[2]);

  // 3. Hysteresis Obstacle Detection
  s0_blocked =
      s0_blocked ? (d0 < THRESHOLD_LEAVE_CM) : (d0 < THRESHOLD_ENTER_CM);
  s1_blocked =
      s1_blocked ? (d1 < THRESHOLD_LEAVE_CM) : (d1 < THRESHOLD_ENTER_CM);

  // Handle optional physical inversion
  bool b0 = INVERT_DIRECTION ? s1_blocked : s0_blocked;
  bool b1 = INVERT_DIRECTION ? s0_blocked : s1_blocked;

#if DEBUG_SERIAL
  Serial.printf("d0: %.1f cm (%d) | d1: %.1f cm (%d) | state: %d\n", d0, b0, d1,
                b1, state);
#endif

  // 4. Directional Traversal State Machine
  switch (state) {

  // ── IDLE: Waiting for first beam interruption ─────────────────────────────
  case STATE_IDLE:
    if (now - lastCountTime < COOLDOWN_MS) {
      break; // Post-count debounce cooldown
    }

    if (b0 && !b1) {
      // Sensor 0 triggered first -> Candidate Boarding (IN)
      state = STATE_IN_STARTED;
      stateStartTime = now;
    } else if (b1 && !b0) {
      // Sensor 1 triggered first -> Candidate Alighting (OUT)
      state = STATE_OUT_STARTED;
      stateStartTime = now;
    }
    break;

  // ── BOARDING SEQUENCE (IN: S0 -> S1) ───────────────────────────────────────
  case STATE_IN_STARTED:
    if (b1) {
      // Sensor 1 triggered -> Candidate confirmed in progress
      state = STATE_IN_MIDWAY;
      stateStartTime = now; // Reset timer for completion phase
    } else if (now - stateStartTime > TRAVERSAL_TIMEOUT_MS) {
      // Passenger backed away without reaching S1 -> Reset
      state = STATE_IDLE;
    }
    break;

  case STATE_IN_MIDWAY:
    if (!b0 && !b1) {
      // Both beams now completely cleared -> Passenger fully entered!
      total_in++;
      occupancy++;
      lastCountTime = now;
      dispatchCrossing("IN", 1, 0, d0, d1);
      state = STATE_IDLE;
    } else if (now - stateStartTime > TRAVERSAL_TIMEOUT_MS) {
      // Traversal stalled or person stopped inside doorway too long -> Reset
      state = STATE_IDLE;
    }
    break;

  // ── ALIGHTING SEQUENCE (OUT: S1 -> S0) ─────────────────────────────────────
  case STATE_OUT_STARTED:
    if (b0) {
      // Sensor 0 triggered -> Candidate confirmed in progress
      state = STATE_OUT_MIDWAY;
      stateStartTime = now; // Reset timer for completion phase
    } else if (now - stateStartTime > TRAVERSAL_TIMEOUT_MS) {
      // Passenger backed away without reaching S0 -> Reset
      state = STATE_IDLE;
    }
    break;

  case STATE_OUT_MIDWAY:
    if (!b0 && !b1) {
      // Both beams now completely cleared -> Passenger fully exited!
      total_out++;
      if (occupancy > 0)
        occupancy--;
      lastCountTime = now;
      dispatchCrossing("OUT", 0, 1, d0, d1);
      state = STATE_IDLE;
    } else if (now - stateStartTime > TRAVERSAL_TIMEOUT_MS) {
      // Traversal stalled or person stopped inside doorway too long -> Reset
      state = STATE_IDLE;
    }
    break;
  }

  // 5. Periodic Heartbeat Sync (every 1.5s when idle)
  if (now - lastTelemetrySync > 1500) {
    lastTelemetrySync = now;
    if (state == STATE_IDLE) {
      char syncBuf[160];
      snprintf(
          syncBuf, sizeof(syncBuf),
          "{\"event\":\"SYNC\",\"in_delta\":0,\"out_delta\":0,\"occupancy\":%d,"
          "\"total_in\":%d,\"total_out\":%d,\"d1\":%.1f,\"d2\":%.1f}",
          occupancy, total_in, total_out, d0, d1);
      Serial.println(syncBuf);
    }
  }

  // Fast loop cadence (~5ms)
  delay(5);
}