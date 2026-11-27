# SOCHI VAYU — Standard Operating Procedure 03: Outage Resilience & Host Gateway Recovery

**Document ID:** SOCHI-SOP-VAYU-003  
**Project:** SOCHI VAYU Industrial Air Quality Monitoring  
**Audience:** Site Technicians & Maintenance Engineers  
**Classification:** Internal Operating Procedure  

---

## 1. Scope & Recovery Objectives

This procedure defines recovery actions following an unexpected gateway host shutdown, power loss, local Wi-Fi drop, or MQTT broker interruption.

### Key Industrial Architecture Invariants
* **Decoupled Purifier Safety:** The purifier's local fan control loop, tachometer stall interlock, and thermal cutoff logic run completely autonomously on FreeRTOS. They **never** depend on the gateway host, MQTT broker, Internet, or database availability.
* **Bounded Offline Ring-Buffering:** When network connectivity is lost, ESP32 nodes buffer up to 200 telemetry frames in static RAM (`telemetry_buffer.c`). On reconnection, buffered frames are flushed to the broker in FIFO order with zero data fabrication.
* **Automatic Service Recovery:** All Docker services are configured with `restart: unless-stopped`. When host power is restored, containers launch and self-heal automatically.

---

## 2. Common Outage Scenarios & Recovery Workflows

### Scenario 1: Sudden Gateway Host Power Outage
**Symptom:** Gateway host loses power; dashboard is inaccessible; devices cannot connect to broker.

**Purifier Node Behavior:**
* Purifiers continue autonomous air filtration according to EPA AQI thresholds.
* If a fan motor stalls (0 RPM for 5 seconds), the physical node cuts power and logs `err_code |= 0x01` locally.
* Telemetry records accumulate in the 200-sample offline buffer.

**Gateway Host Recovery Steps:**
1. Restore mains power or UPS supply to the gateway PC.
2. Allow Windows 11 / Linux host OS to boot.
3. Verify Docker Desktop / Docker daemon has started.
4. Verify all 4 VAYU containers resume automatically:
   ```powershell
   docker ps
   ```
5. If containers are stopped, execute:
   ```powershell
   cd D:\SochiProjects\VAYU\VayuMonitoringDashboard
   docker-compose up -d
   ```
6. Verify service health:
   ```powershell
   curl.exe http://127.0.0.1:8081/api/health
   ```
7. When the broker resumes, nodes will automatically re-publish their `ONLINE` status and flush their buffered telemetry frames.

---

### Scenario 2: MQTT Broker Outage (Mosquitto Restart)
**Symptom:** Dashboard indicates `ONLINE` devices dropped to 0; Spring Boot logs show `[MQTT INGESTION] Connection lost to broker`.

**Recovery Workflow:**
1. Verify Mosquitto container status:
   ```powershell
   docker ps -f name=vayu-mosquitto
   ```
2. If stopped or unhealthy, inspect logs:
   ```powershell
   docker logs vayu-mosquitto --tail 50
   ```
3. Restart broker:
   ```powershell
   docker-compose restart mosquitto
   ```
4. Spring Boot Paho client automatically reconnects (`MqttCallbackExtended.connectComplete(reconnect=true)`).
5. Devices reconnect, re-subscribe to `vayu/{id}/cmd`, and flush buffered frames.

---

### Scenario 3: Local Database Host Interruption
**Symptom:** `/api/health` indicates `status: DOWN` or `database: DISCONNECTED`.

**Recovery Workflow:**
1. Verify PostgreSQL container:
   ```powershell
   docker ps -f name=vayu-postgres
   ```
2. Restart PostgreSQL:
   ```powershell
   docker-compose restart postgres
   ```
3. Spring Boot HikariCP connection pool automatically detects database restoration, validates idle connections, and recovers without requiring a backend JVM restart.

---

## 3. Post-Outage Health Checklist

Execute the automated resilience verification suite to ensure all subsystems have self-healed:

```powershell
python D:\SochiProjects\VAYU\VayuMonitoringDashboard\scripts\verify_phase9_resilience.py
```

Expected output:
```text
==================================================================
   SOCHI VAYU - Phase 9.2 Outage Resilience & Isolation Drill     
==================================================================
[*] 1. Auditing Container Network Isolation & Port Bindings... [PASS]
[*] 2. Executing MQTT Broker Crash & Recovery Drill...           [PASS]
[*] 3. Executing PostgreSQL Outage & HikariCP Pool Recovery...  [PASS]
==================================================================
   [SUCCESS] All Outage Resilience & Network Drills Passed!      
==================================================================
```
