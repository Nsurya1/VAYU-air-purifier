# ADR-002: MQTT Telemetry & Command Protocol Contract (VAYU v1)

## Status
Accepted

## Context
A fleet of VAYU air purifiers requires a deterministic, lightweight, and structured communication protocol for telemetry reporting, heartbeat/status transitions, and remote operational commands.

## Decision

### 1. Topic Taxonomy
All topics are prefixed by the project namespace `vayu/`:
- `vayu/{device_id}/telemetry` (Device -> Broker): Periodic environmental and operational readings (QoS 0 or 1, default period: 5s to 30s).
- `vayu/{device_id}/status` (Device -> Broker): Connection lifecycle events, initial handshake, graceful disconnect, and MQTT Last Will and Testament (LWT) (QoS 1, Retained: true).
- `vayu/{device_id}/cmd` (Backend -> Device): Target commands such as fan speed adjustment, mode selection, or filter reset (QoS 1).
- `vayu/{device_id}/cmd/ack` (Device -> Backend): Command receipt and execution outcome confirmation (QoS 1).

### 2. Telemetry Payload Contract (Schema Version: `1.0.0`)
```json
{
  "schema_version": "1.0.0",
  "device_id": "VAYU-DEV-001",
  "timestamp": "2026-10-22T06:30:00.000Z",
  "is_simulated": true,
  "metrics": {
    "pm1": 8.4,
    "pm25": 14.2,
    "pm10": 26.8,
    "voc": 110,
    "temp_c": 23.5,
    "rh": 48.2,
    "aqi": 55,
    "aqi_standard": "US_EPA",
    "fan_pct": 45,
    "mode": "AUTO",
    "filter_hours_left": 3840,
    "rssi": -62
  },
  "diagnostics": {
    "fw_build_id": "v1.0.0-rc1",
    "uptime_seconds": 86420,
    "err_code": 0,
    "sensor_status": {
      "pm_valid": true,
      "voc_valid": true,
      "temp_rh_valid": true
    }
  }
}
```

### 3. Metric Units and Definitions
| Field | Unit / Type | Description / Constraints |
| :--- | :--- | :--- |
| `pm1` | $\mu g/m^3$ (Float) | Particulate matter $< 1\mu m$. Valid range: 0.0 - 1000.0 |
| `pm25` | $\mu g/m^3$ (Float) | Particulate matter $< 2.5\mu m$. Valid range: 0.0 - 1000.0 |
| `pm10` | $\mu g/m^3$ (Float) | Particulate matter $< 10\mu m$. Valid range: 0.0 - 2000.0 |
| `voc` | Index / ppb (Int) | Volatile Organic Compounds index (0-500 scale or ppb) |
| `temp_c` | $^\circ C$ (Float) | Ambient temperature. Valid range: -20.0 to 70.0 |
| `rh` | % (Float) | Relative humidity. Valid range: 0.0 to 100.0 |
| `aqi` | Integer (0-500) | Calculated AQI. Formula explicit: standard US-EPA PM2.5 breakpoint table |
| `fan_pct` | % (0-100) | Fan motor PWM duty cycle |
| `mode` | String Enum | `AUTO`, `MANUAL`, `NIGHT`, `TURBO`, `OFF` |
| `filter_hours_left` | Hours (Int) | Estimated filter remaining lifespan (0 to 8760) |
| `rssi` | dBm (Int) | Wi-Fi Received Signal Strength Indicator (-100 to -10) |
| `err_code` | Bitmask (Int) | 0: Normal, 1: Fan Stall, 2: PM Sensor Fault, 4: Temp Sensor Fault |
| `is_simulated` | Boolean | **Strictly `true`** for simulated devices; `false` for physical units |

### 4. Timestamp & Missing Value Policy
- **Timestamp:** ISO-8601 UTC string (`YYYY-MM-DDTHH:mm:ss.sssZ`). If device lacks NTP sync, the payload includes an `epoch_ms` offset and flags `ntp_synced: false`. The backend assigns `recorded_at = NOW()` when ntp is not synced.
- **Missing Values:** If a sensor hardware read times out or reports checksum failure, its field is set to `null`, and the corresponding `sensor_status.{component}_valid` is set to `false`. Missing readings must never be interpolated or guessed.

### 5. Last Will and Testament (LWT)
- **Topic:** `vayu/{device_id}/status`
- **LWT Payload:** `{"device_id":"{device_id}","status":"OFFLINE","reason":"UNEXPECTED_DISCONNECT","timestamp":"..."}`
- **Connect Payload:** `{"device_id":"{device_id}","status":"ONLINE","fw_build_id":"...","ip":"...","timestamp":"..."}`
- **Retain:** `true` (ensures new subscribers immediately receive current connection state).
