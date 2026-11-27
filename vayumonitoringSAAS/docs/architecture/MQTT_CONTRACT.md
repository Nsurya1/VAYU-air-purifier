# SOCHI VAYU — MQTT Message Contract & Broker Architecture

**Document Version:** 1.0.0  
**Status:** Approved  
**Protocol:** MQTT 3.1.1 / MQTT 5.0  
**Transport:** TCP Port 1883 (Local LAN / Isolated Docker Bridge)  

---

## 1. Security & Authentication Architecture

- **Anonymous Access:** Strictly Disabled (`allow_anonymous false`).
- **Authentication Method:** Per-role hashed credentials via `mosquitto_passwd` (PBKDF2/Argon2/SHA512).
- **Access Control:** Enforced by Mosquitto Access Control List (`acl_file /mosquitto/config/acls`).
- **Persistence:** Disabled (`persistence false`). Telemetry is strictly transient real-time state.

### Authorized Roles:
| Role | Username | Allowed Publish Topics | Allowed Subscribe Topics |
| :--- | :--- | :--- | :--- |
| **Backend Core** | `vayu_backend` | `vayu/devices/+/commands` | `vayu/devices/+/telemetry`, `vayu/devices/+/status`, `$SYS/#` |
| **Fleet Simulator**| `vayu_simulator`| `vayu/devices/+/telemetry`, `vayu/devices/+/status` | `vayu/devices/+/commands` |
| **Hardware Purifier**| `vayu_device` | `vayu/devices/%u/telemetry`, `vayu/devices/%u/status` | `vayu/devices/%u/commands` |

---

## 2. Topic Taxonomy

All application topics follow the hierarchical structure:
```
vayu/devices/{device_id}/{channel}
```

Where:
- `{device_id}`: Unique identifier (e.g. `VAYU-001`). Must be alphanumeric plus dashes (`^[A-Z0-9-]+$`).
- `{channel}`: One of `telemetry`, `status`, or `commands`.

---

## 3. Telemetry Payload Schema

**Topic:** `vayu/devices/{device_id}/telemetry`  
**Quality of Service (QoS):** 1 (At least once)  
**Retained:** `false`  

### JSON Schema (v1.0.0)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": [
    "schema_version",
    "device_id",
    "timestamp",
    "metrics",
    "diagnostics",
    "system"
  ],
  "properties": {
    "schema_version": { "type": "string", "enum": ["1.0.0"] },
    "device_id": { "type": "string", "pattern": "^[A-Za-z0-9_-]{3,32}$" },
    "timestamp": { "type": "string", "format": "date-time" },
    "is_simulated": { "type": "boolean", "default": false },
    "metrics": {
      "type": "object",
      "required": ["pm1", "pm25", "pm10", "temperature_c", "humidity_rh"],
      "properties": {
        "pm1": { "type": ["number", "null"], "minimum": 0, "maximum": 1000 },
        "pm25": { "type": ["number", "null"], "minimum": 0, "maximum": 1000 },
        "pm10": { "type": ["number", "null"], "minimum": 0, "maximum": 1000 },
        "voc_index": { "type": ["number", "null"], "minimum": 1, "maximum": 500 },
        "temperature_c": { "type": ["number", "null"], "minimum": -20, "maximum": 70 },
        "humidity_rh": { "type": ["number", "null"], "minimum": 0, "maximum": 100 }
      }
    },
    "diagnostics": {
      "type": "object",
      "required": ["pm_sensor_valid", "temperature_sensor_valid"],
      "properties": {
        "pm_sensor_valid": { "type": "boolean" },
        "temperature_sensor_valid": { "type": "boolean" },
        "voc_sensor_valid": { "type": "boolean" }
      }
    },
    "system": {
      "type": "object",
      "required": ["firmware_version", "error_code"],
      "properties": {
        "firmware_version": { "type": "string" },
        "error_code": { "type": "integer", "minimum": 0 },
        "operating_mode": { "type": "string", "enum": ["AUTO", "MANUAL", "NIGHT", "OFF"] }
      }
    }
  }
}
```

### Sensor Failure Rule
If a sensor is faulted or initializing:
1. The corresponding diagnostic flag MUST be `false` (e.g., `"pm_sensor_valid": false`).
2. The associated metric values MUST be explicitly `null` (e.g., `"pm25": null`).
3. **NEVER** fabricate `0.0` or previous values when a sensor is in error.

---

## 4. Device Lifecycle & Last Will and Testament (LWT)

**Topic:** `vayu/devices/{device_id}/status`  
**Quality of Service (QoS):** 1  
**Retained:** `true` (so new subscribers immediately receive the latest connectivity state)  

### A. Last Will and Testament (Configured during MQTT CONNECT)
Sent automatically by Mosquitto if the device loses power, Wi-Fi, or crashes without a clean DISCONNECT:

```json
{
  "schema_version": "1.0.0",
  "device_id": "VAYU-001",
  "status": "OFFLINE",
  "timestamp": "2026-10-23T07:15:00Z",
  "reason": "UNEXPECTED_DISCONNECT",
  "is_simulated": false
}
```

### B. Birth / Online Announcement (Sent immediately upon MQTT CONNECT)
```json
{
  "schema_version": "1.0.0",
  "device_id": "VAYU-001",
  "status": "ONLINE",
  "timestamp": "2026-10-23T07:00:00Z",
  "firmware_version": "1.0.0",
  "is_simulated": false
}
```

### C. Graceful Offline Announcement (Sent prior to controlled shutdown)
```json
{
  "schema_version": "1.0.0",
  "device_id": "VAYU-001",
  "status": "OFFLINE",
  "timestamp": "2026-10-23T18:00:00Z",
  "reason": "GRACEFUL_SHUTDOWN",
  "is_simulated": false
}
```
