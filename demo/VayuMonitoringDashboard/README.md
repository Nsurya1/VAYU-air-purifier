# SOCHI VAYU — Local-First Fleet Monitoring Dashboard & Telemetry Platform

![SOCHI VAYU](https://img.shields.io/badge/Project-SOCHI%20VAYU-0B1F3A?style=for-the-badge&logoColor=F47721)
![Local First](https://img.shields.io/badge/Architecture-Local--First-F47721?style=for-the-badge)
![Security](https://img.shields.io/badge/Security-Zero--Cloud--Exposure-green?style=for-the-badge)

## Project Overview
**SOCHI VAYU** is an industrial-grade, local-first IoT telemetry and device health monitoring platform built for VAYU smart air purifiers. It provides continuous real-time fleet health triage, hardware/sensor fault diagnostics, firmware connectivity telemetry, and safe over-the-air (OTA) rollout orchestration without relying on any external cloud hosting.

### Core Principles
1. **Zero Cloud Dependency:** Core telemetry ingestion, alerting, and monitoring operate locally at each deployment site.
2. **Purifier Safety Autonomy:** The physical air purifier's motor control, particulate filtering, and safety fail-safes operate independently on the ESP32 micro-controller and never block or halt if the network, MQTT, or backend is unreachable.
3. **Simulated vs Physical Integrity:** All synthetic telemetry is strictly labeled with `"is_simulated": true` and stored explicitly as simulated data. Real sensor values are never fabricated.
4. **Isolated Network Footprint:** MQTT (port 1883) and PostgreSQL (port 5432) bind strictly to local/LAN interfaces with zero public cloud exposure.

---

## Brand Identity & Color Palette
- **SOCHI Primary Navy:** `#0B1F3A` (Headers, navigation bars, brand backdrops)
- **SOCHI Vivid Orange:** `#F47721` (Active indicators, primary CTAs, alerts, brand highlights)
- **Background Grey:** `#F8F9FA` (Clean surface grey for high-readability triage)
- **Card Slate:** `#E2E8F0` / `#FFFFFF` (Panel surfaces, KPI tiles, borders)
- **Warning Gold:** `#EAB308` (AQI Moderate / Sensor Drift)
- **Critical Red:** `#EF4444` (Fan Stall / Severe Hardware Failure / PM Overload)

---

## Repository Structure
```
D:\SochiProjects\VAYU\VayuMonitoringDashboard/
├── docker-compose.yml              # Local container orchestration (Mosquitto + Postgres)
├── .env.example                    # Template environment variables
├── .env                            # Active local development configuration
├── README.md                       # Project documentation and developer guide
├── docs/
│   ├── adr/                        # Architecture Decision Records
│   │   ├── ADR-001-local-first-gateway.md
│   │   └── ADR-002-mqtt-telemetry-contract.md
│   └── specs/                      # Data schemas & contracts
│       └── mqtt-contract-v1.json   # Telemetry & Status JSON Schema
├── mosquitto/
│   └── config/
│       └── mosquitto.conf          # Eclipse Mosquitto configuration
├── postgres/
│   └── init/
│       └── 01-init-schema.sql      # Schema initialization & 30-device seed
├── scripts/
│   └── verify_phase1.py            # Local infrastructure readiness verification
├── backend/                        # Java Spring Boot backend (Phase 3)
├── frontend/                       # React + TypeScript Vite dashboard (Phase 4)
└── simulator/                      # Python 30-device fleet simulator (Phase 2)
```

---

## Phase Roadmap
- [x] **Phase 0:** Architecture, Repository Structure, ADRs & Hardware Decision Clarity
- [x] **Phase 1:** Local Development Environment & Docker Compose Infrastructure
- [x] **Phase 2:** 30-Device Multi-Condition Fleet Simulator
- [x] **Phase 3:** Java Spring Boot MQTT Ingestion & PostgreSQL Persistence
- [x] **Phase 4:** React + TypeScript Fleet Dashboard (Responsive Desktop/Laptop/TV) *(Completed & Verified)*
- [ ] **Phase 5:** Authentication, RBAC, Site-Level Authorization & MQTT ACLs *(Next)*
- [ ] **Phase 6:** Incident Management, Diagnostic Engine & Developer Evidence
- [ ] **Phase 7:** Physical ESP32 ESP-IDF Firmware Integration & Offline Buffering
- [ ] **Phase 8:** Safe OTA Workflow (Dual Partition, Signed Manifest, Canary Rollout)
- [ ] **Phase 9:** Pilot Deployment, Network Isolation, Backup/Restore Runbooks
- [ ] **Phase 10:** Secure Remote Troubleshooting Architecture & VPN Model
