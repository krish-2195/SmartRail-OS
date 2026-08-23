#!/usr/bin/env python3
"""
SmartRail OS — ESP32 Hardware Diagnostic Serial Monitor
Reads live sensor diagnostic data directly from the ESP32 via USB Serial.
"""

import sys
import time
import glob
import serial


def find_serial_port():
    ports = glob.glob("/dev/ttyUSB*") + glob.glob("/dev/ttyACM*")
    if ports:
        return ports[0]
    return "/dev/ttyUSB0"


def main():
    port = sys.argv[1] if len(sys.argv) > 1 else find_serial_port()
    baud = 115200

    print("=" * 66)
    print("  SmartRail OS — ESP32 Sensor Diagnostic Monitor")
    print("=" * 66)
    print(f"  Serial Port: {port}  @  {baud} baud")
    print("  Press Ctrl+C to stop.")
    print("=" * 66)
    print()

    try:
        ser = serial.Serial(port, baud, timeout=1)
        # Pulse DTR to reset ESP32
        ser.dtr = False
        ser.rts = False
        time.sleep(0.1)
        ser.dtr = True
        ser.rts = True
        time.sleep(0.1)

        print(f"✓ Connected to {port}! Streaming live hardware output:\n")

        while True:
            raw = ser.readline()
            if not raw:
                continue
            line = raw.decode("utf-8", errors="ignore").strip()
            if line:
                print(line)

    except serial.SerialException as exc:
        print(f"✗ Serial Error: {exc}")
        print("  1. Is the ESP32 plugged in?")
        print("  2. Run: sudo chmod a+rw /dev/ttyUSB0")
    except KeyboardInterrupt:
        print("\n\nMonitor stopped by user.")


if __name__ == "__main__":
    main()
