# SOCHI VAYU — Security & Operational Hardening Guide

This document defines the security architecture, local networking configuration, resource bounding, and operational procedures for on-premise installations of the **SOCHI VAYU Local Monitoring Platform**.

---

## 1. Core Security Principles

1. **Zero External Telemetry Egress**:
   - The monitoring system has no outbound cloud telemetry connections.
   - All air quality metrics, device states, and diagnostics stay exclusively within the customer's physical premises.

2. **No Permanent Remote Backdoors**:
   - The platform includes NO built-in remote access tunnels, reverse SSH sessions, or cloud relay agents.
   - When support is required, the customer explicitly initiates a temporary session via customer-controlled tools (e.g. AnyDesk, TeamViewer) and monitors the technician in real time.

3. **Autonomous Purifier Safety**:
   - Purifiers operate with fail-safe embedded firmware. If the monitoring PC, local network switch, or MQTT broker fails or powers off, the purifier continues its filtration, fan control, and physical safety operations uninterrupted.

4. **Transient Telemetry (No Database Attack Surface)**:
   - There is no persistent SQL or time-series database storing historical readings. Only the latest reading per device is held in volatile memory.

---

## 2. Network Topology & Port Bindings

```
                              CUSTOMER LOCAL AREA NETWORK (LAN)
                      [ Wi-Fi / Ethernet - e.g. 192.168.1.0/24 ]
                                          |
     +------------------------------------+------------------------------------+
     |                                    |                                    |
[ VAYU Purifier 1 ]              [ VAYU Purifier N ]               [ Client Laptop / TV ]
ESP32 / Wi-Fi                     ESP32 / Wi-Fi                     Web Browser
     |                                    |                                    |
     | MQTT Port 1883                     | MQTT Port 1883                     | HTTP Port 3000
     v                                    v                                    v
+--------------------------------------------------------------------------------------+
| MONITORING PC (Static / DHCP-Reserved IP e.g. 192.168.1.100)                         |
|                                                                                      |
|  +-------------------+        +--------------------+        +---------------------+  |
|  |   vayu-mosquitto  |        |    vayu-frontend   |        |     vayu-backend    |  |
|  |     (Port 1883)   |        |     (Port 3000)    |        |  (127.0.0.1:8080)   |  |
|  |  MQTT Broker with |        |  Nginx Reverse     |        |   Spring Boot Core  |  |
|  |   Auth & ACLs     |        |  Proxy & React SPA |        | (Transient Memory)  |  |
|  +---------^---------+        +---------^----------+        +----------^----------+  |
|            |                            |                              |             |
|            +----------------------------+------------------------------+             |
|                           Internal Docker Network (`vayu-net`)                       |
+--------------------------------------------------------------------------------------+
```

### Port Allocation & Exposure Matrix

| Service | Port | Bound Interface | Access Scope | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **vayu-frontend** | `3000` | `0.0.0.0` (All LAN) | Customer LAN | Hosts dashboard web UI and proxies `/api/` calls |
| **vayu-mosquitto** | `1883` | `0.0.0.0` (All LAN) | Customer LAN | Purifier telemetry ingestion (authenticated) |
| **vayu-backend** | `8080` | `127.0.0.1` (Loopback) | Host PC Only | Restricts raw Spring Boot & Actuator access |
| **Docker Internal** | All | `vayu-network` bridge | Containers Only | Inter-service Paho MQTT and proxy routing |

---

## 3. Host Network & Firewall Configuration

### DHCP Reservation Recommendation
The monitoring PC should be assigned a static IP or permanent DHCP reservation on the customer's router (e.g. `192.168.1.50`). This ensures the dashboard URL (`http://192.168.1.50:3000`) and the purifiers' MQTT target (`192.168.1.50:1883`) remain unchanged across router reboots.

### Windows Defender Firewall Setup
Windows Firewall must permit incoming traffic on ports 3000 and 1883, but **strictly on Private and Domain network profiles**.

Run the automated PowerShell script as Administrator:
```powershell
cd D:\SochiProjects\VAYU\vayumonitoringSAAS\scripts
.\setup-firewall.ps1
```

To verify active rules:
```powershell
Get-NetFirewallRule -DisplayName "SOCHI VAYU*" | Select-Object DisplayName, Direction, Action, Enabled, Profile
```

To remove rules upon decommissioning:
```powershell
.\remove-firewall.ps1
```

---

## 4. Operational Resource Hardening

To ensure the monitoring stack operates continuously without degrading the host PC:

### A. Disk Quota & Log Rotation
Docker containers are configured with size-capped log rotation in `docker-compose.yml`:
```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```
- **Total Max Log Size**: 30 MB per service (90 MB total across the entire fleet stack).
- Logs rotate automatically; older log slices are discarded without requiring manual maintenance.

### B. Memory & CPU Caps
Containers are bounded using Docker resource limits:
- `vayu-backend`: Max 512 MB RAM, 1.0 CPU Core
- `vayu-mosquitto`: Max 64 MB RAM, 0.5 CPU Core
- `vayu-frontend`: Max 64 MB RAM, 0.5 CPU Core
- **Total Maximum RAM Footprint**: ~640 MB RAM. The host PC requires at least 4 GB total system RAM.

### C. Auto-Recovery Policy
All services are set to `restart: unless-stopped`.
- If the PC is rebooted, Docker Desktop starts the containers automatically.
- If a container crashes, the Docker daemon automatically restarts it within seconds.

---

## 5. Web Client & Proxy Hardening

The Nginx reverse proxy (`frontend/nginx.conf`) enforces the following headers:
- `X-Frame-Options: DENY` — Prevents dashboard embedding in malicious iframes (clickjacking protection).
- `X-Content-Type-Options: nosniff` — Enforces strict MIME typing.
- `Content-Security-Policy` — Restricts script execution strictly to local bundle assets (`'self'`).
- `server_tokens off` — Suppresses Nginx version fingerprinting.
- Restricted Actuator: `/actuator/health` is permitted for probes; all other `/actuator/*` paths return `403 Forbidden`.
- SSE Optimization: `proxy_buffering off;` and `proxy_read_timeout 86400s;` ensure real-time delivery without connection drops.

---

## 6. Remote Support Protocol

When customer assistance is requested:
1. Customer initiates contact with SOCHI Support via email or phone.
2. Customer launches AnyDesk or TeamViewer and provides the 9-digit session code to the certified SOCHI engineer.
3. The customer accepts the incoming connection and observes the engineer's actions on screen.
4. Support inspects container health and logs:
   ```powershell
   docker compose ps
   docker compose logs --tail 100 backend
   ```
5. Once resolved, the customer closes the AnyDesk application. No lingering connections or service credentials remain with SOCHI.
