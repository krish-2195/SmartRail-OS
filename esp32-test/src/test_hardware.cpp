#include <Arduino.h>

// ─── Hardware Pin Mapping ─────────────────────────────────────────────────────
#define TRIG1_PIN    4   // Sensor 1: Platform / Entry Side Trigger
#define ECHO1_PIN   14   // Sensor 1: Platform / Entry Side Echo

#define TRIG2_PIN   27   // Sensor 2: Coach / Exit Side Trigger
#define ECHO2_PIN   33   // Sensor 2: Coach / Exit Side Echo

#define LED_PIN      2   // Built-in LED (GPIO 2 on standard ESP32)

// Detection threshold for test
#define DETECT_DIST_CM  45.0

// ─── Sensor Measurement with Hardware Diagnostics ─────────────────────────────
struct SensorReading {
  float distanceCm;
  long rawDurationUs;
  bool isConnected;
  bool isDetecting;
};

SensorReading readUltrasonic(int trigPin, int echoPin) {
  SensorReading r;
  r.distanceCm = 999.0;
  r.rawDurationUs = 0;
  r.isConnected = false;
  r.isDetecting = false;

  // Clear trigger
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);

  // 10us ultrasonic burst
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  // Measure echo pulse width (max 35ms ~ 6 meters)
  long duration = pulseIn(echoPin, HIGH, 35000);
  r.rawDurationUs = duration;

  if (duration <= 0) {
    // No pulse returned -> Sensor not receiving 5V power, or Echo wire disconnected
    r.isConnected = false;
    r.distanceCm = 999.0;
    return r;
  }

  r.isConnected = true;
  float dist = (duration * 0.0343) / 2.0;

  if (dist >= 2.0 && dist <= 400.0) {
    r.distanceCm = dist;
    r.isDetecting = (dist <= DETECT_DIST_CM);
  } else {
    r.distanceCm = 999.0;
  }

  return r;
}

void setup() {
  Serial.begin(115200);
  delay(500);

  pinMode(TRIG1_PIN, OUTPUT);
  pinMode(ECHO1_PIN, INPUT);

  pinMode(TRIG2_PIN, OUTPUT);
  pinMode(ECHO2_PIN, INPUT);

  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  digitalWrite(TRIG1_PIN, LOW);
  digitalWrite(TRIG2_PIN, LOW);

  Serial.println();
  Serial.println("================================================================");
  Serial.println("  SmartRail OS — ESP32 Ultrasonic Hardware Diagnostic Test       ");
  Serial.println("================================================================");
  Serial.printf ("  Sensor 1 (Platform): TRIG = GPIO %d  |  ECHO = GPIO %d\n", TRIG1_PIN, ECHO1_PIN);
  Serial.printf ("  Sensor 2 (Coach)   : TRIG = GPIO %d |  ECHO = GPIO %d\n", TRIG2_PIN, ECHO2_PIN);
  Serial.printf ("  Builtin Indicator  : LED  = GPIO %d\n", LED_PIN);
  Serial.println("  Power Requirement  : VCC must be connected to 5V (VIN)\n");
  Serial.println("  Wave your hand in front of Sensor 1 or Sensor 2 (< 45 cm)");
  Serial.println("================================================================");
  Serial.println();
  delay(1000);
}

void loop() {
  // 1. Test Sensor 1
  SensorReading s1 = readUltrasonic(TRIG1_PIN, ECHO1_PIN);
  delay(30); // Prevent acoustic cross-talk

  // 2. Test Sensor 2
  SensorReading s2 = readUltrasonic(TRIG2_PIN, ECHO2_PIN);

  // 3. LED Indicator: turn ON if hand/obstacle detected by either sensor
  if (s1.isDetecting || s2.isDetecting) {
    digitalWrite(LED_PIN, HIGH);
  } else {
    digitalWrite(LED_PIN, LOW);
  }

  // 4. Print Diagnostic Line
  Serial.print("[DIAG] ");

  // Sensor 1 Diagnostic
  if (!s1.isConnected) {
    Serial.print("S1(GPIO 4/14): [NO ECHO / CHECK 5V/GND]  | ");
  } else if (s1.isDetecting) {
    Serial.printf("S1(GPIO 4/14): [DETECT %4.1f cm] 🟢     | ", s1.distanceCm);
  } else {
    Serial.printf("S1(GPIO 4/14): [CLEAR  %4.1f cm]        | ", s1.distanceCm);
  }

  // Sensor 2 Diagnostic
  if (!s2.isConnected) {
    Serial.print("S2(GPIO 27/33): [NO ECHO / CHECK 5V/GND]");
  } else if (s2.isDetecting) {
    Serial.printf("S2(GPIO 27/33): [DETECT %4.1f cm] 🟢", s2.distanceCm);
  } else {
    Serial.printf("S2(GPIO 27/33): [CLEAR  %4.1f cm]", s2.distanceCm);
  }

  if (s1.isDetecting || s2.isDetecting) {
    Serial.print("  <-- HAND DETECTED (LED ON)");
  }

  Serial.println();
  delay(250);
}
