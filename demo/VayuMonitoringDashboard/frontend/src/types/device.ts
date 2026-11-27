export interface DeviceSummary {
  deviceId: string;
  siteId: string;
  model: string;
  currentFwVersion: string;
  onlineStatus: 'ONLINE' | 'OFFLINE' | 'FAULT' | string;
  lastSeenAt: string | null;
  simulated: boolean;

  pm25: number | null;
  aqi: number | null;
  fanPct: number | null;
  mode: string | null;
  filterHoursLeft: number | null;
  rssi: number | null;
  errCode: number | null;
  healthBadge: 'NORMAL' | 'WARNING' | 'CRITICAL' | 'OFFLINE' | 'NO_DATA';
}

export interface TelemetryRecord {
  id: number;
  deviceId: string;
  recordedAt: string;
  pm1: number | null;
  pm25: number | null;
  pm10: number | null;
  voc: number | null;
  tempC: number | null;
  rh: number | null;
  aqi: number | null;
  aqiStandard: string;
  fanPct: number;
  mode: string;
  filterHoursLeft: number;
  rssi: number | null;
  errCode: number;
  sensorsValid: string;
  simulated: boolean;
  ingestedAt: string;
}

export interface DeviceDetail {
  deviceId: string;
  siteId: string;
  model: string;
  hardwareRev: string;
  macAddress: string;
  ipAddress: string;
  currentFwVersion: string;
  onlineStatus: string;
  lastSeenAt: string;
  simulated: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CommandRequest {
  command: 'SET_FAN' | 'SET_MODE' | 'FILTER_RESET' | 'OTA_UPDATE';
  fanPct?: number;
  mode?: string;
  targetVersion?: string;
}

export interface SystemHealth {
  status: string;
  service: string;
  database: string;
  total_devices_registered: number;
  online_devices: number;
  uptime_seconds: number;
}
