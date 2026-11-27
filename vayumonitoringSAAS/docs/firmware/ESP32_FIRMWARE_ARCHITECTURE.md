# SOCHI VAYU — ESP32 Firmware Architecture & Safety Specification

This document specifies the software architecture for the embedded controller running inside the **SOCHI VAYU Air Purifier** based on the **ESP-IDF v5.x** framework and **FreeRTOS**.

---

## 1. Safety-Critical Design Constraint

> **Autonomous Air Cleaning Guarantee:**
> The primary function of the VAYU purifier is to filter particulate matter and volatile organic compounds from indoor air.
> Under **NO circumstances** shall network disconnects, MQTT broker outages, or PC monitoring crashes cause the purifier to stop operating, hang, or enter a boot loop.
> 
> Network and telemetry tasks operate strictly at low FreeRTOS task priorities and use non-blocking message queues. The air purification control loop runs at high priority on Core 1 independently of the network stack.

---

## 2. Multi-Tasking FreeRTOS Architecture

```
  +-----------------------------------------------------------------------------------+
  |                                ESP32 DUAL-CORE MCU                                |
  |                                                                                   |
  |  [ CORE 1 - SAFETY & EMBEDDED CONTROL ]      [ CORE 0 - NETWORK & TELEMETRY ]    |
  |                                                                                   |
  |  +------------------------------------+      +---------------------------------+  |
  |  | TASK A: Safety & Fan Control       |      | TASK C: Wi-Fi & MQTT Telemetry  |  |
  |  | Priority: 5 (HIGHEST)              |      | Priority: 2 (LOW)               |  |
  |  | Period:   100 ms                   |      | Period:   3 - 5 seconds         |  |
  |  | - Door safety interlock check      |      | - esp-mqtt client event loop    |  |
  |  | - Thermal cutoff detection         |      | - LWT 'UNEXPECTED_DISCONNECT'   |  |
  |  | - Fan PWM regulation               |      | - cJSON v1.0.0 payload build    |  |
  |  | - Tachometer RPM verify            |      | - Non-blocking MQTT publish     |  |
  |  +-----------------+------------------+      +----------------+----------------+  |
  |                    |                                          |                   |
  |  +-----------------v------------------+                       |                   |
  |  | TASK B: Sensor Acquisition         |                       |                   |
  |  | Priority: 3 (MEDIUM)               |                       |                   |
  |  | Period:   1.0 second               |                       |                   |
  |  | - PM Sensor UART parser (CRC/sum)  |                       |                   |
  |  | - VOC & Temp/RH I2C read           |                       |                   |
  |  | - Sensor fault diagnosis           |                       |                   |
  |  +-----------------+------------------+                       |                   |
  |                    |                                          |                   |
  |                    v                                          v                   |
  |            +----------------------------------------------------------+           |
  |            |     THREAD-SAFE SHARED STATE (FreeRTOS Mutex Lock)       |           |
  |            |  - Latest sensor readings (PM1, PM2.5, PM10, VOC, Temp)  |           |
  |            |  - Validity flags (pm_valid, temp_valid, voc_valid)      |           |
  |            |  - System operational mode and hardware error codes      |           |
  |            +----------------------------------------------------------+           |
  +-----------------------------------------------------------------------------------+
```

---

## 3. Detailed Task Specifications

### Task A: Safety & Fan Control (`vayu_safety_ctrl_task`)
- **Pinned Core**: Core 1
- **FreeRTOS Priority**: 5 (High)
- **Period**: 100 ms (10 Hz)
- **Responsibilities**:
  1. Poll safety door switch. If filter door is open, instantly set fan PWM to `0%` and signal error code `101`.
  2. Read hardware temperature sensor. If thermal threshold is breached (>65°C internal ambient), cut fan power.
  3. Update fan PWM duty cycle based on configured operating mode:
     - `MANUAL`: User-selected speed (Low, Med, High).
     - `AUTO`: Automatically ramp fan curve based on latest valid PM2.5 from shared state.
     - `SENSOR_FAULT_FALLBACK`: If PM sensor is invalid/unreachable, default to safe continuous medium filtration (50% PWM) rather than shutting off.
  4. Measure tachometer pulses. If fan is commanded to spin but tachometer indicates 0 RPM for >5 seconds, raise error code `102` (Fan Stalled).

### Task B: Sensor Acquisition (`vayu_sensor_acq_task`)
- **Pinned Core**: Core 1
- **FreeRTOS Priority**: 3 (Medium)
- **Period**: 1000 ms (1 Hz)
- **Responsibilities**:
  1. Read UART frame from Particulate Matter sensor.
  2. Compute 16-bit checksum. If checksum fails or UART read times out (>2000 ms), set `pm_sensor_valid = false` and set PM values to `NAN`.
  3. Query I2C bus for VOC and Temperature/Humidity sensors.
  4. If I2C NACK occurs, retry once; if failed, set `sensor_valid = false`.
  5. Acquire `xSensorDataMutex` (max timeout 50 ms). Update shared state struct and release mutex.

### Task C: Wi-Fi & MQTT Telemetry (`vayu_telemetry_task`)
- **Pinned Core**: Core 0 (Network Core)
- **FreeRTOS Priority**: 2 (Low)
- **Period**: Configurable reporting interval (default: 3 seconds)
- **Responsibilities**:
  1. Monitor Wi-Fi station events (`IP_EVENT_STA_GOT_IP`, `WIFI_EVENT_STA_DISCONNECTED`).
  2. Connect to local Mosquitto broker on port 1883 using `esp-mqtt`.
  3. Configure MQTT Last Will and Testament (LWT) during client initialization:
     - **Topic**: `vayu/devices/{DEVICE_ID}/status`
     - **QoS**: 1
     - **Retain**: false
     - **Payload**:
       ```json
       {
         "schema_version": "1.0.0",
         "device_id": "VAYU-001",
         "status": "OFFLINE",
         "timestamp": "2026-10-23T08:00:00Z",
         "reason": "UNEXPECTED_DISCONNECT"
       }
       ```
  4. On successful connection:
     - Publish birth message: `{"schema_version":"1.0.0","device_id":"VAYU-001","status":"ONLINE","timestamp":"..."}` to `vayu/devices/{DEVICE_ID}/status`.
  5. In loop:
     - Try acquiring `xSensorDataMutex` (timeout: 100 ms).
     - Format JSON strictly following **SOCHI VAYU Schema v1.0.0**.
     - If any sensor validity flag is `false`, serialize that metric as JSON `null` (never fabricate a zero or estimated number).
     - Publish to `vayu/devices/{DEVICE_ID}/telemetry` with QoS 1.

---

## 4. Clock & Timestamp Synchronization

1. Purifiers initiate SNTP time synchronization (`sntp_setoperatingmode(SNTP_OPMODE_POLL)`) querying the customer's local gateway or designated NTP server.
2. Once synced, timestamps are serialized in ISO 8601 UTC format (`YYYY-MM-DDTHH:MM:SSZ`).
3. If local network has no NTP server or Internet access:
   - Purifier boots with epoch 0 (1970-01-01).
   - In telemetry JSON, timestamp is generated as `1970-01-01T00:00:00Z` or relative uptime.
   - The backend `TelemetryValidator` detects clock discrepancy, logs a diagnostic clock drift warning, and uses the host PC reception timestamp for ordering without discarding the telemetry metrics.
