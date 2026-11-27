# SOCHI VAYU — Standard Operating Procedure 01: Site Gateway Deployment & Network Isolation

**Document ID:** SOCHI-SOP-VAYU-001  
**Project:** SOCHI VAYU Industrial Air Quality Monitoring  
**Audience:** Site Deployment Engineers & Systems Administrators  
**Classification:** Internal Operating Procedure  

---

## 1. Objective & Scope

This Standard Operating Procedure (SOP) defines the mandatory steps for commissioning a **Local-First Site Monitoring Gateway** for the SOCHI VAYU Smart Air Purifier fleet on an on-premises host (Windows 11 or Linux).

### Non-Negotiable Constraints
1. **Zero External Cloud Hosting:** Core monitoring, telemetry ingestion, and database operations must run locally on the customer's on-premises gateway.
2. **Strict Loopback Binding:** Services must never be exposed to public interfaces (`0.0.0.0`). All ports bind strictly to `127.0.0.1`.
3. **Reachable Local Gateway:** Every deployment site requiring independent continuous monitoring must have its own dedicated, reachable local host. Office staff cannot see customer devices across separate networks until an approved secure VPN/outbound tunnel is reviewed and deployed.

---

## 2. Gateway Host Hardware & Software Prerequisites

| Component | Minimum Specification | Recommended Specification |
| :--- | :--- | :--- |
| **Operating System** | Windows 11 Pro (WSL2 enabled) / Ubuntu 22.04 LTS | Ubuntu 24.04 LTS Server or Windows 11 Enterprise |
| **CPU** | 4 Cores (x86_64 or ARM64) | 8 Cores (Intel Core i5/i7 or AMD Ryzen) |
| **RAM** | 8 GB System Memory | 16 GB DDR4/DDR5 |
| **Storage** | 120 GB SSD (NVMe / SATA III) | 256 GB NVMe SSD (Encrypted BitLocker / LUKS) |
| **Network Interface** | 1x Gigabit Ethernet (LAN for Purifier Wi-Fi AP) | 2x Gigabit Ethernet (Isolated OT/IoT VLAN + Management) |
| **Runtimes** | Docker Engine 24+, Docker Compose v2+ | Docker Engine 26+, Docker Compose v2.28+ |

---

## 3. Deployment Procedure

### Step 3.1: Environment Configuration (`.env`)
Navigate to the root workspace directory and configure `.env`:

```bash
cd D:\SochiProjects\VAYU\VayuMonitoringDashboard
```

Verify that `.env` sets `HOST_BIND_IP=127.0.0.1` to enforce loopback-only isolation:

```ini
# SOCHI VAYU - Local Environment Configuration (.env)
HOST_BIND_IP=127.0.0.1

# PostgreSQL 16 Settings (Port 5434 maps to container 5432)
POSTGRES_DB=vayu_monitoring
POSTGRES_USER=vayu_admin
POSTGRES_PASSWORD=vayu_dev_secret_2026
POSTGRES_PORT=5434

# Mosquitto MQTT Settings
MQTT_TCP_PORT=1883
MQTT_WS_PORT=9001

# Spring Boot Backend Settings (Port 8081 maps to container 8080)
BACKEND_PORT=8081
SPRING_PROFILES_ACTIVE=prod

# React Dashboard Settings
FRONTEND_PORT=3000
```

### Step 3.2: Launch Local Gateway Services

Execute Docker Compose to pull, build, and initialize the containerized services:

```bash
docker-compose up -d --build
```

Expected output:
```text
 ✔ Container vayu-postgres    Started (healthy)
 ✔ Container vayu-mosquitto   Started (healthy)
 ✔ Container vayu-backend     Started (healthy)
 ✔ Container vayu-frontend    Started
```

### Step 3.3: Verify Network Isolation & Loopback Security

Execute the automated isolation audit script:

```bash
python scripts\verify_phase9_resilience.py
```

Verify that every published port reports `Loopback Only`:
```text
[*] 1. Auditing Container Network Isolation & Port Bindings...
  [PASS] vayu-mosquitto   | Container 1883/tcp   -> Host 127.0.0.1:1883 (Loopback Only)
  [PASS] vayu-mosquitto   | Container 9001/tcp   -> Host 127.0.0.1:9001 (Loopback Only)
  [PASS] vayu-postgres    | Container 5432/tcp   -> Host 127.0.0.1:5434 (Loopback Only)
  [PASS] vayu-backend     | Container 8080/tcp   -> Host 127.0.0.1:8081 (Loopback Only)
  [PASS] vayu-frontend    | Container 80/tcp     -> Host 127.0.0.1:3000 (Loopback Only)
  [PASS] Network isolation verified: All services strictly locked to 127.0.0.1.
```

---

## 4. Operator Verification & Role-Based Access Checklist

Open a web browser on the local host machine at `http://127.0.0.1:3000`:

1. **Admin Persona (`admin`):**
   * Verify full access to all 30 devices across `SITE-HQ-PUNE` and `SITE-BLR-DEV`.
   * Verify access to **Audit Trail**, **Incidents**, and **Firmware / OTA** center.
2. **Service Technician (`tech_pune`):**
   * Switch persona in header.
   * Verify site dropdown is locked to `SITE-HQ-PUNE`.
   * Verify attempts to issue commands to Bengaluru devices return HTTP 403 Forbidden.
   * Verify technician cannot access or approve OTA rollouts.
3. **Kiosk Mode (`kiosk`):**
   * Switch persona in header and toggle TV / Kiosk mode.
   * Verify read-only high-contrast TV view (large typography, contrast ratios $\ge 4.5:1$).
   * Verify all control buttons and command inputs are suppressed.

---

## 5. Gateway Commissioning Sign-off

| Check Item | Required Result | Verified (Y/N) |
| :--- | :--- | :--- |
| Core Services Running | 4/4 containers healthy (`docker ps`) | YES |
| Network Isolation | All ports bound strictly to `127.0.0.1` | YES |
| Database Initialized | 10 tables loaded and seeded (`vayu_monitoring`) | YES |
| MQTT ACLs Active | Password & ACL files enforced on Mosquitto | YES |
| Baseline Backup Created | Verified snapshot in `backups/` directory | YES |
