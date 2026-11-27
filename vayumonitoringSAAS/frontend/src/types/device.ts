export type DeviceConnectionState = 'ONLINE' | 'OFFLINE' | 'WAITING_FOR_DATA';
export type DeviceHealthState = 'HEALTHY' | 'SENSOR_FAULT' | 'STALE' | 'WAITING_FOR_DATA' | 'OFFLINE';

export interface CalculatedMetrics {
  pm1: number | null;
  pm25: number | null;
  pm10: number | null;
  voc_index: number | null;
  temperature_c: number | null;
  humidity_rh: number | null;
  calculated_aqi: number | null;
  aqi_category: string;
}

export interface TelemetryDiagnostics {
  pm_sensor_valid: boolean;
  temperature_sensor_valid: boolean;
  voc_sensor_valid: boolean | null;
}

export interface TelemetrySystem {
  firmware_version: string;
  error_code: number;
  operating_mode: string;
}

export interface DeviceListItem {
  device_id: string;
  name: string;
  room: string;
  connection_state: DeviceConnectionState;
  health_state: DeviceHealthState;
  is_simulated: boolean;
  last_seen_at: string | null;
  elapsed_seconds_since_telemetry: number | null;
  metrics: CalculatedMetrics | null;
  diagnostics: TelemetryDiagnostics | null;
  system: TelemetrySystem | null;
  problems: string[];
  disconnect_reason: string | null;
}

export interface DeviceSummary {
  total_devices: number;
  online_devices: number;
  offline_devices: number;
  stale_devices: number;
  fault_devices: number;
}

export interface DeviceFleetResponse {
  site_name: string;
  timestamp: string;
  summary: DeviceSummary;
  devices: DeviceListItem[];
}

export interface SystemDiagnostics {
  site_name: string;
  timestamp: string;
  mqtt_broker_connected: boolean;
  total_configured_devices: number;
  online_devices: number;
  offline_devices: number;
  stale_devices: number;
  sensor_fault_devices: number;
  jvm_used_memory_mb: number;
  jvm_total_memory_mb: number;
  active_sse_clients: number;
}
