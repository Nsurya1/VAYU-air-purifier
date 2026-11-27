export interface Incident {
  id: number;
  deviceId: string;
  siteId?: string;
  title: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  diagnosticRule: string;
  category: 'HARDWARE' | 'FIRMWARE';
  status: 'OPEN' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'RESOLVED';
  assignedTo: string | null;
  evidence: string | null;
  createdAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNotes: string | null;
}

export interface IncidentActionRequest {
  assignedTo?: string;
  notes?: string;
}

export interface IncidentEvidenceData {
  device_id?: string;
  site_id?: string;
  model?: string;
  firmware_version?: string;
  ip_address?: string;
  mac_address?: string;
  snapshot_timestamp?: string;
  telemetry_metrics?: {
    err_code?: number;
    err_code_hex?: string;
    pm25?: number | null;
    aqi?: number | null;
    fan_pct?: number | null;
    mode?: string;
    filter_hours_left?: number;
    rssi?: number | null;
    temp_c?: number | null;
    rh?: number | null;
    sensors_valid?: string;
  };
  triage_checklist?: string[];
  status_payload?: any;
}
