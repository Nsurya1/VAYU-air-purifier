# SOCHI VAYU — ESP32 Embedded Firmware Reference Guide

This directory provides the production-grade **ESP-IDF v5.x / FreeRTOS** C implementation for the **SOCHI VAYU Air Purifier**.

It demonstrates:
1. **Autonomous Air Filtration**: Core safety interlocks and fan control run at high FreeRTOS priority (Priority 5) on Core 1, completely isolated from network interruptions.
2. **Schema v1.0.0 Compliance**: Encodes sensor telemetry strictly matching the versioned JSON contract.
3. **Sensor Fault Quarantine**: If physical sensor communication times out or fails checksum, the metric is explicitly serialized as JSON `null` (never fabricated).
4. **Last Will and Testament (LWT)**: Registers an unannounced disconnect payload with Mosquitto (`vayu/devices/{id}/status`, `status: "OFFLINE"`, `reason: "UNEXPECTED_DISCONNECT"`, QoS 1).

---

## 1. Directory Structure

```
firmware/esp32-reference/
├── CMakeLists.txt                 # Project-level CMake definition
├── README.md                      # Hardware setup & flashing guide
└── main/
    ├── CMakeLists.txt             # Component build rules (esp-mqtt, cJSON)
    ├── main.c                     # FreeRTOS tasks (Safety, Sensor, Telemetry)
    ├── vayu_types.h               # State structs, sensor flags, error codes
    ├── vayu_mqtt_telemetry.h      # Telemetry publisher API
    └── vayu_mqtt_telemetry.c      # ESP-MQTT client, LWT, & cJSON serializer
```

---

## 2. Prerequisites & Toolchain

- **Framework**: ESP-IDF v5.1 LTS or v5.2 (`https://docs.espressif.com/projects/esp-idf/en/stable/`)
- **Target MCU**: ESP32, ESP32-S3, or ESP32-C3
- **Development Tool**: ESP-IDF Command Prompt or VS Code ESP-IDF Extension
- **USB Driver**: Silicon Labs CP210x or WCH CH340 depending on board USB-UART chip

---

## 3. Configuration & Provisioning

Before building, update the device identification in `main/main.c` (or configure via `menuconfig` / NVS storage):

```c
#define CONFIG_VAYU_DEVICE_ID   "VAYU-001"
#define CONFIG_VAYU_ROOM        "Conference Room 2A"
#define CONFIG_MQTT_BROKER_URI  "mqtt://<MONITORING-PC-LAN-IP>:1883"
#define CONFIG_MQTT_USERNAME    "vayu_device"
#define CONFIG_MQTT_PASSWORD    "VayuDevice2026!"
```

> **Note**: For fleet manufacturing, these credentials should be burned into the ESP32's encrypted Non-Volatile Storage (NVS) partition during factory end-of-line calibration.

---

## 4. Build & Flash Instructions

1. Open the ESP-IDF terminal and navigate to the project directory:
   ```bash
   cd D:\SochiProjects\VAYU\vayumonitoringSAAS\firmware\esp32-reference
   ```

2. Set target chip architecture (default: ESP32 standard):
   ```bash
   idf.py set-target esp32
   ```

3. Build the firmware binary:
   ```bash
   idf.py build
   ```

4. Connect the VAYU purifier's programming port via USB and flash:
   ```bash
   idf.py -p COM3 flash monitor
   ```
   *(Replace `COM3` with the actual serial port enumerated in Windows Device Manager).*

---

## 5. Verification on Local Network

Once booted, observe the serial output:
1. **Wi-Fi Connected**: Obtains local IP address via DHCP.
2. **NTP Sync**: Calibrates internal RTC clock using local SNTP server.
3. **Birth Announcement**:
   ```
   I (2450) VAYU_MQTT: Connected to Mosquitto MQTT broker successfully.
   I (2460) VAYU_MQTT: Published birth ONLINE announcement to vayu/devices/VAYU-001/status
   ```
4. **Telemetry Stream**:
   Every 3 seconds, a telemetry frame is published to `vayu/devices/VAYU-001/telemetry`.
5. **Dashboard Reflection**:
   Open `http://localhost:3000` on the monitoring PC. Device `VAYU-001` will show **ONLINE** with real-time metrics.
6. **LWT Verification**:
   Unplug the USB/power cable from the ESP32. Within 2-3 seconds, the Mosquitto broker detects the dead socket and publishes the LWT message, updating the dashboard to **OFFLINE** (`UNEXPECTED_DISCONNECT`).
