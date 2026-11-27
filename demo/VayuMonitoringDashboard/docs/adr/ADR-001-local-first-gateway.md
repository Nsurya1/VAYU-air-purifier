# ADR-001: Local-First Site Gateway Architecture

## Status
Accepted

## Context
The SOCHI VAYU air purifier fleet monitoring system must operate reliably on desktop PCs, laptops, and TV kiosks across diverse deployment sites (offices, residential buildings, test facilities). 

Key business and operational requirements:
1. **Zero Cloud Dependency:** Core telemetry ingestion, real-time health monitoring, and local alerting must run completely without public cloud servers or subscription fees.
2. **Autonomous Purifier Safety:** An air purifier is a physical environmental control appliance. Its internal safety loops, motor protection, and automated filtration algorithms must run independently on the ESP32 micro-controller and never block or fail if the network, MQTT broker, database, or dashboard is offline.
3. **No External Network Exposure:** Database (PostgreSQL 5432) and Message Broker (MQTT 1883) must not be accessible over the public internet without explicit VPN tunnels or authenticated outbound-only architectures.
4. **Hardware Footprint:** The initial host environment is a Windows 11 PC using WSL2 and Docker, with the ability to run on standard Linux/Ubuntu edge hosts when deployed at customer premises.

## Decision
We adopt a **Local-First Gateway Architecture**:
- Each physical site or monitoring domain runs a local host/gateway containing:
  - **Eclipse Mosquitto MQTT Broker**: Low-latency, lightweight telemetry bus (`vayu/{device_id}/#`).
  - **PostgreSQL 16 Engine**: Robust relational persistence for high-volume time-stamped telemetry, device records, alarms, and audit trails.
  - **Java Spring Boot Backend**: Application service providing validation, ingestion, status tracking, diagnostics, and REST APIs.
  - **React 18 / TypeScript Web Dashboard**: Responsive single-page application tailored for desktop triage, mobile field technicians, and read-only TV kiosk monitoring.
- Devices connect to the site broker over local Wi-Fi / Ethernet LAN.
- The purifier firmware uses a store-and-forward circular buffer to prevent data loss during brief network dropouts, but strictly drops old telemetry rather than halting physical air filtration.

## Consequences
- **Positive:** Maximum privacy, zero recurring cloud hosting costs, millisecond-level local response times, completely unaffected by wide-area internet outages.
- **Trade-off:** Central visibility across disparate physical customer networks is deferred until a secure outbound reverse tunnel or site-to-site VPN model is formally evaluated in Phase 10.
