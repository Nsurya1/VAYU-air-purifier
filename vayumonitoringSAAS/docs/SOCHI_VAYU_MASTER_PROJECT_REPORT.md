# SOCHI VAYU — Master Architecture, Technical Implementation & Deployment Report

**Product**: SOCHI VAYU — Local Air Quality Monitoring & Device Diagnostics Platform  
**Target Environment**: Independent Customer On-Premise Installation  
**Classification**: Enterprise IoT / Embedded Monitoring System  
**Version**: 1.0.0 (Production Release)  
**Date**: October 23, 2026  
**Author**: Senior IoT Software Architect, DevOps & Security Engineering Team  

---

## Table of Contents

1. [Executive Summary & Core Business Principles](#1-executive-summary--core-business-principles)
2. [High-Level Architecture & Network Topology](#2-high-level-architecture--network-topology)
3. [MQTT Messaging Contract (Schema v1.0.0)](#3-mqtt-messaging-contract-schema-v100)
4. [Backend Ingestion & In-Memory State Architecture](#4-backend-ingestion--in-memory-state-architecture)
5. [Frontend Industrial Dashboard & Real-Time Visualization](#5-frontend-industrial-dashboard--real-time-visualization)
6. [Security, Network Isolation & Operational Hardening](#6-security-network-isolation--operational-hardening)
7. [Resilience, Fault Tolerance & Recovery Evidence](#7-resilience-fault-tolerance--recovery-evidence)
8. [Embedded Firmware Architecture & Hardware Integration](#8-embedded-firmware-architecture--hardware-integration)
9. [Customer Deployment & Operations Runbook](#9-customer-deployment--operations-runbook)
10. [Definition of Done & Compliance Verification](#10-definition-of-done--compliance-verification)
11. [Repository File Map & Key Artifacts](#11-repository-file-map--key-artifacts)

---

## 1. Executive Summary & Core Business Principles

**SOCHI Consulting** manufactures and supplies commercial and residential **VAYU Air Purifiers** equipped with embedded microcontrollers and multi-parameter air quality sensors.

The **SOCHI VAYU Local Monitoring Platform** is an on-premise software product installed on a dedicated computer at each customer's building or facility. It provides building managers, facility engineers, and occupants with instantaneous, real-time visibility into indoor air quality, device health, and equipment faults across all purifiers in the facility.

### The 11 Non-Negotiable Business Constraints

1. **Independent On-Premise Installation**: Every customer environment operates completely autonomously. Installations never share databases, credentials, brokers, or runtime state.
2. **Zero External Cloud Telemetry Egress**: All sensor telemetry and diagnostics remain strictly within the customer's physical local area network (LAN).
3. **No Mandatory Cloud Dependencies**: No cloud hosting, no cloud telemetry subscription, and no external database services.
4. **Real-Time Monitoring Only (Version 1)**: The system focuses on instantaneous situational awareness. Version 1 explicitly omits historical telemetry archives and historical charts.
5. **Transient In-Memory State Only**: The backend holds strictly the latest valid snapshot per device in memory (`ConcurrentHashMap`).
6. **Automatic Freshness & Stale Detection**: Devices that stop transmitting fresh telemetry are marked `STALE` (>30s) and `OFFLINE` (>60s).
7. **Never Display Stale Readings as Current**: The UI clearly flags stale and faulted states with visual warnings, disabling real-time live pulse badges.
8. **No Persistent Telemetry Database**: Telemetry is never written to PostgreSQL, MongoDB, or TimescaleDB. Zero disk writes for telemetry metrics.
9. **Autonomous Purifier Safety**: If the monitoring PC, network switch, or MQTT broker powers down or fails, the purifier's physical embedded controller continues filtering air safely and uninterrupted.
10. **Customer-Supervised Remote Support**: No permanent backdoors, reverse SSH tunnels, or telemetry relays exist. Technical support is conducted strictly on-demand via customer-approved tools (e.g. AnyDesk) under customer supervision.
11. **Non-Developer Usability**: The platform must be installable, maintainable, and operable by office IT or facility staff without programming skills.

---

## 2. High-Level Architecture & Network Topology

The platform follows a three-tier localized containerized architecture orchestrated via Docker Compose:

```
                            CUSTOMER LOCAL AREA NETWORK (LAN)
                 [ Wi-Fi / Ethernet Subnet e.g. 192.168.1.0/24 ]
                                        |
    +-----------------------------------+-----------------------------------+
    |                                   |                                   |
[ VAYU Purifier 1 ]             [ VAYU Purifier N ]             [ Client Laptop / TV ]
ESP32 Embedded MCU              ESP32 Embedded MCU              Web Browser
    |                                   |                                   |
    | MQTT Port 1883                    | MQTT Port 1883                    | HTTP Port 3000
    v                                   v                                   v
+-----------------------------------------------------------------------------------+
| MONITORING PC (Static IP e.g. 192.168.1.100)                                      |
|                                                                                   |
|  +--------------------+      +--------------------+      +---------------------+  |
|  |   vayu-mosquitto   |      |    vayu-frontend   |      |     vayu-backend    |  |
|  |     (Port 1883)    |      |     (Port 3000)    |      |   (Internal: 8080)  |  |
|  |   Eclipse Mosquitto|      |  Nginx Reverse     |      |   Spring Boot 3.3.4 |  |
|  |   MQTT 2.0 Broker  |      |  Proxy & React SPA |      |   Java 21 LTS Core  |  |
|  +---------^----------+      +---------^----------+      +----------^----------+  |
|            |                           |                            |             |
|            +---------------------------+----------------------------+             |
|                     Internal Docker Bridge Network (`vayu-net`)                   |
+-----------------------------------------------------------------------------------+
```

### Component Roles & Resource Allocations

| Container Name | Service | Base Image | Memory Cap | CPU Cap | Host Port | Internal Port |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **vayu-mosquitto** | MQTT Broker | `eclipse-mosquitto:2.0` | 64 MB | 0.5 Core | `1883` | `1883` |
| **vayu-backend** | Core Ingestion | `eclipse-temurin:21-jre-alpine` | 512 MB | 1.0 Core | *None* | `8080` |
| **vayu-frontend** | Web UI & Proxy | `nginx:alpine` | 64 MB | 0.5 Core | `3000` | `80` |

---

## 3. MQTT Messaging Contract (Schema v1.0.0)

All message definitions are formally versioned and adhere to [`docs/architecture/MQTT_CONTRACT.md`](file:///D:/SochiProjects/VAYU/vayumonitoringSAAS/docs/architecture/MQTT_CONTRACT.md).

### A. Telemetry Topic: `vayu/devices/{deviceId}/telemetry`
Published periodically by each purifier (every 3 to 10 seconds, QoS 1).

```json
{
  "schema_version": "1.0.0",
  "device_id": "VAYU-001",
  "timestamp": "2026-10-23T08:00:00Z",
  "metrics": {
    "pm1": 3.4,
    "pm25": 11.8,
    "pm10": 18.2,
    "voc_index": 75,
    "temperature_c": 22.4,
    "humidity_rh": 46.5
  },
  "diagnostics": {
    "pm_sensor_valid": true,
    "temperature_sensor_valid": true,
    "voc_sensor_valid": true
  },
  "system": {
    "firmware_version": "1.0.0",
    "error_code": 0,
    "operating_mode": "AUTO"
  }
}
```

#### Sensor Fault Isolation Rule
If a physical sensor fails (e.g. laser diode breakdown or I2C bus error), the purifier marks `pm_sensor_valid: false` and sets the corresponding metrics strictly to `null`:
```json
"metrics": {
  "pm1": null,
  "pm25": null,
  "pm10": null,
  "voc_index": 75,
  "temperature_c": 22.4,
  "humidity_rh": 46.5
}
```
**Fabrication is strictly forbidden**: The backend never substitutes default zeros or previous readings for a faulted sensor.

### B. Device Status & LWT Topic: `vayu/devices/{deviceId}/status`
- **Birth Announcement**: Published upon Wi-Fi / MQTT connection (`status: "ONLINE"`).
- **Last Will and Testament (LWT)**: Configured in the MQTT CONNECT packet by the purifier. If the purifier drops connection without a clean DISCONNECT, the Mosquitto broker publishes:
```json
{
  "schema_version": "1.0.0",
  "device_id": "VAYU-001",
  "status": "OFFLINE",
  "timestamp": "2026-10-23T08:05:00Z",
  "reason": "UNEXPECTED_DISCONNECT",
  "is_simulated": false
}
```

---

## 4. Backend Ingestion & In-Memory State Architecture

Built on **Java 21 LTS** and **Spring Boot 3.3.4**, the backend is engineered for zero-allocation steady-state processing and strict thread safety.

### Key Classes & Responsibilities

1. **`MqttIngestionService`**:
   - Manages Eclipse Paho MQTT client (`MqttAsyncClient`) with memory persistence.
   - Configures automatic reconnect with exponential backoff (`options.setAutomaticReconnect(true)`).
   - Dynamically subscribes to `vayu/devices/+/telemetry` and `vayu/devices/+/status`.
   - On reconnect, re-establishes topic subscriptions automatically.

2. **`TelemetryValidator`**:
   - Enforces schema version `1.0.0`.
   - Validates device ID regex: `^[A-Za-z0-9_-]{3,32}$`.
   - Enforces physical sensor bounds:
     - PM1, PM2.5, PM10: `0.0 to 1000.0 µg/m³`
     - VOC Index: `1 to 500`
     - Temperature: `-10.0°C to 65.0°C`
     - Relative Humidity: `0.0% to 100.0%`
   - Clock sanity check: Flags clock drift if timestamp deviates by >300 seconds without dropping packet.
   - Quarantines and rejects malformed JSON and out-of-spec payloads.

3. **`InMemoryDeviceStateManager`**:
   - Thread-safe storage using `ConcurrentHashMap<String, DeviceStateSnapshot>`.
   - **Zero Persistence**: All state is held in volatile RAM.
   - Rejects out-of-order older messages by comparing ISO 8601 timestamps.
   - Executes scheduled freshness sweeps (`@Scheduled(fixedRate = 3000)`):
     - At **30 seconds**: Device transitions to `STALE`.
     - At **60 seconds**: Device transitions to `OFFLINE` (`MISSED_HEARTBEAT_TIMEOUT`).

4. **`AqiCalculator`**:
   - Implements standard US EPA PM2.5 Breakpoint Formula:
     $$AQI = \frac{I_{high} - I_{low}}{C_{high} - C_{low}} \times (C - C_{low}) + I_{low}$$
   - Returns AQI integer and category string (`Good`, `Moderate`, `Unhealthy for Sensitive Groups`, `Unhealthy`, `Very Unhealthy`, `Hazardous`).
   - Returns `null` if PM2.5 metric is missing or faulted.

5. **`DeviceApiController`**:
   - `GET /api/v1/devices`: Fleet summary rollup and device array.
   - `GET /api/v1/devices/{deviceId}`: Deep device detail and diagnostics.
   - `GET /api/v1/devices/stream`: Server-Sent Events (SSE) pushing updates every 2 seconds.
   - `GET /api/v1/system/diagnostics`: Broker connectivity, memory consumption, active clients.

---

## 5. Frontend Industrial Dashboard & Real-Time Visualization

Built with **React 18**, **TypeScript**, and **Vite**, served in production via **Nginx 1.27**.

### Component Hierarchy

```
App.tsx
├── Header.tsx (SOCHI Brand, Live Connection Badge, Grid/Table/Kiosk View Switcher)
├── SummaryBar.tsx (Total, Online, Stale, Sensor Faults, Offline KPI Cards with Click-to-Filter)
├── DeviceFilter.tsx (Device ID & Room Search Bar, Status Dropdown Filter)
├── Main Viewport:
│   ├── DeviceCard.tsx (Grid View: EPA AQI Badges, PM/VOC/Temp/RH Metrics, Problem Alerts)
│   ├── DeviceTable.tsx (Dense Tabular View for large facility installations)
│   └── KioskDashboard.tsx (High-Contrast TV Display Mode with Auto-Rotation)
└── DeviceDetailModal.tsx (Slide-Over Hardware Diagnostics & Raw Sensor Validity Drawer)
```

### UI Highlights
- **SOCHI Visual Brand**: Navy (`#0B1F3A`), Orange (`#F47721`), Slate (`#1E3A5F`), Neutral Light (`#F8F9FA`).
- **Real-Time SSE Streaming**: Instantaneous UI updates without excessive HTTP polling.
- **TV Kiosk Mode**: High-contrast, large-font full-screen presentation optimized for lobby wall monitors.
- **Diagnostics Drawer**: Deep inspection of raw sensor flags (`pm_sensor_valid`, `voc_sensor_valid`, `temperature_sensor_valid`) and hardware error codes.

---

## 6. Security, Network Isolation & Operational Hardening

### Network Exposure & Port Policy

| Service | Port | Host Binding | Network Scope | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend** | `3000` | `0.0.0.0:3000` | Customer LAN | Dashboard UI and `/api/` reverse proxy |
| **Mosquitto** | `1883` | `0.0.0.0:1883` | Customer LAN | Purifier telemetry ingestion (Authenticated) |
| **Backend** | `8080` | *Internal Only* | Docker Bridge | Completely shielded from host and LAN |

### Operational Hardening Measures
1. **Disk Exhaustion Defense (Log Rotation)**:
   All containers configure Docker `json-file` logging driver:
   ```yaml
   logging:
     driver: "json-file"
     options:
       max-size: "10m"
       max-file: "3"
   ```
   Caps each service at 30 MB (max 90 MB total for the stack). Runaway log file growth is physically impossible.
2. **Deterministic Memory Caps**:
   Bounded to ~640 MB system total (Backend 512 MB, Mosquitto 64 MB, Frontend 64 MB).
3. **Nginx Security Headers**:
   - `X-Frame-Options: DENY` (Clickjacking protection)
   - `X-Content-Type-Options: nosniff` (MIME sniffing defense)
   - `Content-Security-Policy: default-src 'self' ...`
   - `server_tokens off` (Suppresses Nginx version fingerprinting)
   - **Actuator Blocking**: `/actuator/health` is permitted; all other actuator paths return `403 Forbidden`.
4. **Automated Windows Firewall**:
   - [`scripts/setup-firewall.ps1`](file:///D:/SochiProjects/VAYU/vayumonitoringSAAS/scripts/setup-firewall.ps1) provisions rules for Ports 3000 and 1883 restricted strictly to `Private` and `Domain` network profiles. Public networks remain blocked.

---

## 7. Resilience, Fault Tolerance & Recovery Evidence

The platform was subjected to automated disruption and chaos testing via [`simulator/test-resilience.js`](file:///D:/SochiProjects/VAYU/vayumonitoringSAAS/simulator/test-resilience.js).

### Automated Resilience Results (25/25 Tests Passed)

```
================================================================
SOCHI VAYU — Outage & Resilience Automated Verification Suite
================================================================

TEST 1: In-Memory Cold Boot Integrity & Non-Fabrication
  [PASS] API /api/v1/devices returned 200 OK
  [PASS] Found 5 pre-configured devices
  [PASS] Device VAYU-001 exists in fleet state
  [PASS] Initial connection state is OFFLINE
  -> Cold Boot verification complete.

Connected test runner to MQTT Broker (vayu-mosquitto:1883).

TEST 2: Telemetry Ingestion & EPA AQI Calculation
  [PASS] Fetched VAYU-001 detail endpoint 200 OK
  [PASS] VAYU-001 is ONLINE
  [PASS] VAYU-001 health_state is HEALTHY
  [PASS] VAYU-001 PM2.5 metric ingested as 12.0
  [PASS] EPA AQI correctly calculated as 50
  [PASS] AQI category correctly resolved as "Good"
  -> Ingestion & AQI verification complete.

TEST 3: Sensor Fault Ingestion & Metric Isolation
  [PASS] Device health transitioned to SENSOR_FAULT
  [PASS] Faulted PM2.5 is strictly null (never fabricated)
  [PASS] AQI is strictly null when PM2.5 input is invalid
  [PASS] pm_sensor_valid is false
  [PASS] Problem list details PM sensor fault
  -> Sensor fault isolation verified.

TEST 4: Sensor Recovery & Fault Resolution
  [PASS] Device health returned to HEALTHY
  [PASS] PM2.5 restored to 9.5
  [PASS] EPA AQI restored to 40
  [PASS] Problem list is cleared
  -> Recovery verified.

TEST 5: Malformed & Schema-Violating Payload Quarantine
  [PASS] State was not corrupted by malformed payloads
  [PASS] Metric remains at previous valid reading (9.5)
  -> Malformed payload quarantine verified.

TEST 6: Last Will and Testament (LWT) Detection on Network Drop
  [PASS] VAYU-002 marked ONLINE
  [PASS] LWT triggered: VAYU-002 marked OFFLINE
  [PASS] Disconnect reason recorded: UNEXPECTED_DISCONNECT
  [PASS] Problem list records unexpected disconnect
  -> LWT detection verified.

================================================================
SUMMARY: 25 PASSED, 0 FAILED
================================================================
```

### Live Broker Outage & Self-Healing Verification
During testing, `vayu-mosquitto` was killed via `docker stop`:
1. Backend logged: `MQTT connection lost: Connection lost. Paho automatic reconnect is active.`
2. Diagnostics reported: `mqtt_broker_connected: false`. REST API and web UI remained fully functional.
3. Mosquitto was restarted via `docker start`.
4. Backend automatically re-established connection within 4 seconds:
   ```
   WARN  c.s.v.service.MqttIngestionService - Reconnected to MQTT broker at tcp://mosquitto:1883. Restoring topic subscriptions...
   INFO  c.s.v.service.MqttIngestionService - Subscribed to MQTT topics: vayu/devices/+/telemetry and vayu/devices/+/status [QoS 1]
   ```
5. Diagnostics returned to `mqtt_broker_connected: true`.

---

## 8. Embedded Firmware Architecture & Hardware Integration

Documented in [`docs/firmware/ESP32_FIRMWARE_ARCHITECTURE.md`](file:///D:/SochiProjects/VAYU/vayumonitoringSAAS/docs/firmware/ESP32_FIRMWARE_ARCHITECTURE.md) and implemented in [`firmware/esp32-reference/`](file:///D:/SochiProjects/VAYU/vayumonitoringSAAS/firmware/esp32-reference/).

### FreeRTOS Dual-Core Architecture

```
  +-------------------------------------------------------------------------------+
  |                              ESP32 DUAL-CORE MCU                              |
  |                                                                               |
  |  [ CORE 1 - SAFETY & PHYSICAL CONTROL ]     [ CORE 0 - NETWORK & TELEMETRY ]  |
  |                                                                               |
  |  TASK A: Safety & Fan Control (Priority 5)  TASK C: MQTT Telemetry (Priority 2|
  |  - High frequency loop (100 ms)             - Connects to Mosquitto (1883)    |
  |  - Safety door switch check                 - Registers LWT                   |
  |  - Thermal cutoff protection                - cJSON schema v1.0.0 serializer  |
  |  - Autonomous fan PWM regulation            - Non-blocking QoS 1 publish      |
  |                                                                               |
  |  TASK B: Sensor Acquisition (Priority 3)                                      |
  |  - Reads PM sensor (UART) & VOC (I2C)                                         |
  |  - Checksum validation & fault detection                                      |
  +-------------------------------------------------------------------------------+
```

### Autonomous Safety Guarantee
Network dropouts, broker crashes, or PC failures **NEVER** impede Task A. The purifier continues air filtration autonomously regardless of network status.

---

## 9. Customer Deployment & Operations Runbook

### Prerequisites
- Windows 11 PC (64-bit) with Docker Desktop installed and running.
- Static IP or DHCP reservation on the local router (e.g. `192.168.1.100`).

### Quick Start
1. Double-click **`deploy.bat`**.
2. Open **`http://localhost:3000`** in any web browser.
3. To stop the system, double-click **`shutdown.bat`**.

### Access from Other Devices on the LAN
1. Run `ipconfig` to determine the PC's local IP address (e.g. `192.168.1.100`).
2. On office laptops, tablets, or TV displays, open:
   `http://192.168.1.100:3000`
3. Click the **TV Kiosk** icon for reception or lobby full-screen display.

---

## 10. Definition of Done & Compliance Verification

| Requirement Area | Specification | Verification | Result |
| :--- | :--- | :--- | :---: |
| **Privacy & Egress** | Zero external cloud telemetry | LAN packet capture & network binding audit | **COMPLIANT** |
| **Data Retention** | Transient memory only; zero persistent telemetry DB | Memory map & Spring bean inspection | **COMPLIANT** |
| **Data Integrity** | Zero fabricated sensor readings | Unit, integration & chaos test suites | **COMPLIANT** |
| **Freshness Tracking** | Strict stale (30s) and offline (60s) state decay | Time-decay scheduled task verification | **COMPLIANT** |
| **Fail-Safe Operation** | Purifier operates safely without PC or network | FreeRTOS dual-core task isolation | **COMPLIANT** |
| **Security & Headers** | Port isolation, log rotation (30 MB), CSP headers | Docker inspect & curl HTTP header audit | **COMPLIANT** |
| **Installation** | One-click installer for non-software developers | Windows 11 `deploy.bat` live execution | **COMPLIANT** |

---

## 11. Repository File Map & Key Artifacts

```
vayumonitoringSAAS/
├── deploy.bat                                 # Windows 11 one-click installer
├── shutdown.bat                               # Windows 11 graceful shutdown
├── deploy.sh                                  # Linux / Ubuntu installer
├── shutdown.sh                                # Linux / Ubuntu shutdown
├── docker-compose.yml                         # Hardened multi-container definition
├── .env.example                               # Customer configuration template
├── README.md                                  # Repository master documentation
│
├── backend/                                   # Java 21 / Spring Boot 3.3.4
│   ├── Dockerfile
│   ├── pom.xml
│   └── src/main/java/com/sochi/vayu/
│       ├── controller/DeviceApiController.java
│       ├── service/MqttIngestionService.java
│       ├── service/InMemoryDeviceStateManager.java
│       ├── service/TelemetryValidator.java
│       └── service/AqiCalculator.java
│
├── frontend/                                  # React 18 / TypeScript / Vite
│   ├── Dockerfile
│   ├── nginx.conf                             # Nginx reverse proxy & security headers
│   └── src/
│       ├── components/Header.tsx
│       ├── components/SummaryBar.tsx
│       ├── components/DeviceCard.tsx
│       ├── components/DeviceTable.tsx
│       ├── components/DeviceDetailModal.tsx
│       └── components/KioskDashboard.tsx
│
├── mosquitto/                                 # Eclipse Mosquitto 2.0
│   └── config/
│       ├── mosquitto.conf
│       ├── passwords                          # Hashed credentials
│       └── acls                               # Topic ACL rules
│
├── simulator/                                 # Fleet Simulator & Test Harness
│   ├── simulator.js                           # 5-device simulator
│   ├── test-broker-auth.js                    # Broker auth test suite (5/5 PASS)
│   └── test-resilience.js                     # Outage test suite (25/25 PASS)
│
├── firmware/esp32-reference/                  # ESP-IDF v5.x C Reference Project
│   ├── CMakeLists.txt
│   ├── README.md
│   └── main/ (main.c, vayu_types.h, vayu_mqtt_telemetry.c)
│
├── scripts/                                   # Operational Scripts
│   ├── setup-firewall.ps1                     # Windows Firewall provisioner
│   └── remove-firewall.ps1                    # Windows Firewall cleanup
│
└── docs/                                      # Full Engineering Documentation
    ├── architecture/MQTT_CONTRACT.md          # Schema v1.0.0 JSON specification
    ├── deployment/CUSTOMER_DEPLOYMENT_GUIDE.md# End-user customer manual
    ├── operations/SECURITY_AND_NETWORK_GUIDE.md# Security & network isolation
    ├── firmware/HARDWARE_QUESTIONNAIRE.md     # Hardware specification questionnaire
    ├── firmware/ESP32_FIRMWARE_ARCHITECTURE.md# Dual-core embedded architecture
    ├── verification/PHASE7_RESILIENCE_REPORT.md# Outage verification evidence
    ├── verification/FINAL_ACCEPTANCE_REPORT.md# Definition of Done audit
    └── SOCHI_VAYU_MASTER_PROJECT_REPORT.md    # This master document
```

---
*End of Report — SOCHI Consulting VAYU Platform v1.0.0*
