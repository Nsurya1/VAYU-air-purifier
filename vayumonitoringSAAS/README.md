# SOCHI VAYU — Local Air Quality Monitoring & Device Diagnostics Platform

**SOCHI Consulting** on-premise real-time monitoring software for VAYU commercial and industrial air purifiers.

---

## 1. Non-Negotiable Architecture Principles

1. **Independent On-Premise Installation**: Deployed entirely at the customer facility. Zero cloud telemetry egress.
2. **Transient In-Memory State**: Telemetry metrics are retained strictly in transient memory. Zero persistent database (PostgreSQL/TimescaleDB) for telemetry retention.
3. **No Fabricated Readings**: Sensors without valid data display explicit null/unavailable states. Zero fake zeros or guesses.
4. **Autonomous Purifier Safety**: Purifier hardware runs an independent FreeRTOS safety and fan loop (Priority 5) on Core 1; purifiers continue cleaning air safely even if the monitoring PC, network, or broker is offline.
5. **No Permanent Remote Tunnel**: Support is conducted only upon explicit customer request via customer-supervised tools (e.g. AnyDesk).
6. **Bounded Resource Footprint**: Automatic 30 MB rotating log limits (`max-size: 10m`, `max-file: 3`) and RAM caps (~640 MB system total).

---

## 2. Directory Structure

```
vayumonitoringSAAS/
├── .env.example                     # Environment variables template
├── docker-compose.yml               # Local multi-container orchestration with resource limits
├── deploy.bat                       # Windows 11 one-click installer
├── shutdown.bat                     # Windows 11 clean shutdown script
├── deploy.sh                        # Linux / Ubuntu one-click installer
├── shutdown.sh                      # Linux / Ubuntu clean shutdown script
├── README.md                        # Project documentation & master index
├── backend/                         # Java 21 / Spring Boot 3.3.4 service
│   ├── Dockerfile
│   ├── pom.xml
│   └── src/
├── frontend/                        # React 18 / TypeScript / Vite UI (Nginx reverse proxy)
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   └── src/
├── mosquitto/                       # Hardened Eclipse Mosquitto 2.0 MQTT broker
│   └── config/                      # mosquitto.conf, passwords, acls
├── simulator/                       # Multi-device IoT test simulator & verification suites
│   ├── simulator.js
│   ├── test-broker-auth.js          # Broker authentication tests (5/5 PASS)
│   └── test-resilience.js           # Full resilience & outage tests (25/25 PASS)
├── firmware/                        # Embedded firmware reference implementation
│   └── esp32-reference/             # ESP-IDF v5.x / FreeRTOS production C project
│       ├── CMakeLists.txt
│       ├── README.md
│       └── main/ (main.c, vayu_types.h, vayu_mqtt_telemetry.c)
├── scripts/                         # Operational helper scripts
│   ├── setup-firewall.ps1           # Windows Defender Firewall provisioner
│   └── remove-firewall.ps1          # Windows Defender Firewall cleanup
└── docs/                            # Architectural & operational specs
    ├── architecture/
    │   └── MQTT_CONTRACT.md         # Schema v1.0.0 JSON specification
    ├── deployment/
    │   └── CUSTOMER_DEPLOYMENT_GUIDE.md  # End-user customer installation manual
    ├── operations/
    │   └── SECURITY_AND_NETWORK_GUIDE.md # Security, network isolation & firewall guide
    ├── firmware/
    │   ├── HARDWARE_QUESTIONNAIRE.md     # Hardware specification questionnaire
    │   └── ESP32_FIRMWARE_ARCHITECTURE.md# Dual-core embedded safety specification
    └── verification/
        ├── PHASE7_RESILIENCE_REPORT.md   # Outage & failure recovery evidence
        └── FINAL_ACCEPTANCE_REPORT.md    # Final Definition of Done audit
```

---

## 3. Quick Start

### For Customers (Windows 11)
Simply double-click **`deploy.bat`**.  
The dashboard will open at **[http://localhost:3000](http://localhost:3000)**.  
To stop services cleanly, double-click **`shutdown.bat`**.

### For Developers & Engineers
```powershell
# 1. Clone repository
cd D:\SochiProjects\VAYU\vayumonitoringSAAS

# 2. Copy environment template
cp .env.example .env

# 3. Launch Docker Compose stack
docker compose up -d --build

# 4. Run automated resilience verification
cd simulator
node test-resilience.js
```

---

## 4. Development Milestones & Audit Status

- [x] **Phase 0 & 1**: Requirements Discovery & Project Foundation
- [x] **Phase 2**: MQTT Broker Hardening & Multi-Device Simulator (5/5 tests passed)
- [x] **Phase 3**: Backend Telemetry Ingestion & In-Memory State Manager (18/18 tests passed)
- [x] **Phase 4**: Real-Time REST APIs & Health Probes (26/26 tests passed)
- [x] **Phase 5**: Industrial React Dashboard with Live Indicators & Kiosk Mode
- [x] **Phase 6**: Security & Operational Hardening (Log rotation, RAM caps, proxy security headers)
- [x] **Phase 7**: Resilience & Outage Recovery Verification (25/25 tests passed)
- [x] **Phase 8**: Real Hardware Integration & ESP-IDF v5.x Firmware Reference
- [x] **Phase 9**: Customer Installation Package & Offline Runbook
- [x] **Phase 10**: Final Acceptance & Definition of Done Audit (100% Compliant)
