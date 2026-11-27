import { DeviceDetail, DeviceSummary, TelemetryRecord, CommandRequest, SystemHealth } from '../types/device';
import { AuthUser, AuditLogEntry } from '../types/auth';
import { Incident } from '../types/incident';
import { FirmwareRelease, OtaDeployment, DeviceOtaHistory, CreateReleaseRequest, CreateDeploymentRequest } from '../types/ota';
import { RemoteSession, RequestRemoteSessionRequest } from '../types/remote';

const API_BASE = '/api';
const TOKEN_KEY = 'vayu_auth_token';
const USER_KEY = 'vayu_auth_user';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  const data = localStorage.getItem(USER_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function setStoredAuth(user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, user.token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStoredAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function getAuthHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = getStoredToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function loginApi(username: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Authentication failed (HTTP ${res.status})`);
  }

  const data = await res.json();
  const user: AuthUser = {
    username: data.username,
    fullName: data.fullName,
    role: data.role,
    siteScope: data.siteScope,
    token: data.token,
  };

  setStoredAuth(user);
  return user;
}

export async function fetchHealth(): Promise<SystemHealth> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
  return res.json();
}

export async function fetchDevices(siteId?: string): Promise<DeviceSummary[]> {
  const url = siteId && siteId !== 'ALL'
    ? `${API_BASE}/devices?siteId=${encodeURIComponent(siteId)}`
    : `${API_BASE}/devices`;

  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`Failed to fetch fleet devices: ${res.statusText}`);
  return res.json();
}

export async function fetchDevice(deviceId: string): Promise<DeviceDetail> {
  const res = await fetch(`${API_BASE}/devices/${encodeURIComponent(deviceId)}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch device details for ${deviceId}`);
  return res.json();
}

export async function fetchDeviceTelemetry(deviceId: string, limit: number = 50): Promise<TelemetryRecord[]> {
  const res = await fetch(`${API_BASE}/devices/${encodeURIComponent(deviceId)}/telemetry?limit=${limit}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch telemetry for ${deviceId}`);
  return res.json();
}

export async function sendDeviceCommand(deviceId: string, command: CommandRequest): Promise<{ dispatched: boolean }> {
  const res = await fetch(`${API_BASE}/devices/${encodeURIComponent(deviceId)}/commands`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(command),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `Failed to dispatch command to ${deviceId} (HTTP ${res.status})`);
  }

  return res.json();
}

export async function fetchAuditLogs(): Promise<AuditLogEntry[]> {
  const res = await fetch(`${API_BASE}/audit-logs`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `Failed to fetch audit logs (HTTP ${res.status})`);
  }

  return res.json();
}

export async function fetchIncidents(siteId?: string, status?: string, category?: string): Promise<Incident[]> {
  const params = new URLSearchParams();
  if (siteId && siteId !== 'ALL') params.append('siteId', siteId);
  if (status && status !== 'ALL') params.append('status', status);
  if (category && category !== 'ALL') params.append('category', category);

  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${API_BASE}/incidents${query}`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `Failed to fetch incidents (HTTP ${res.status})`);
  }

  return res.json();
}

export async function fetchIncident(id: number): Promise<Incident> {
  const res = await fetch(`${API_BASE}/incidents/${id}`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `Failed to fetch incident #${id} (HTTP ${res.status})`);
  }

  return res.json();
}

export async function acknowledgeIncidentApi(id: number): Promise<Incident> {
  const res = await fetch(`${API_BASE}/incidents/${id}/acknowledge`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `Failed to acknowledge incident #${id} (HTTP ${res.status})`);
  }

  return res.json();
}

export async function assignIncidentApi(id: number, assignedTo: string): Promise<Incident> {
  const res = await fetch(`${API_BASE}/incidents/${id}/assign`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ assignedTo }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `Failed to assign incident #${id} (HTTP ${res.status})`);
  }

  return res.json();
}

export async function resolveIncidentApi(id: number, notes: string): Promise<Incident> {
  const res = await fetch(`${API_BASE}/incidents/${id}/resolve`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ notes }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `Failed to resolve incident #${id} (HTTP ${res.status})`);
  }

  return res.json();
}

// ==============================================================================
// OTA & Firmware APIs
// ==============================================================================

export async function fetchFirmwareReleases(): Promise<FirmwareRelease[]> {
  const res = await fetch(`${API_BASE}/ota/releases`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `Failed to fetch firmware releases (HTTP ${res.status})`);
  }
  return res.json();
}

export async function createFirmwareReleaseApi(req: CreateReleaseRequest): Promise<FirmwareRelease> {
  const res = await fetch(`${API_BASE}/ota/releases`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `Failed to create firmware release (HTTP ${res.status})`);
  }
  return res.json();
}

export async function fetchOtaDeployments(): Promise<OtaDeployment[]> {
  const res = await fetch(`${API_BASE}/ota/deployments`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `Failed to fetch OTA deployments (HTTP ${res.status})`);
  }
  return res.json();
}

export async function fetchOtaDeployment(id: number): Promise<OtaDeployment> {
  const res = await fetch(`${API_BASE}/ota/deployments/${id}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `Failed to fetch deployment #${id} (HTTP ${res.status})`);
  }
  return res.json();
}

export async function createOtaDeploymentApi(req: CreateDeploymentRequest): Promise<OtaDeployment> {
  const res = await fetch(`${API_BASE}/ota/deployments`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `Failed to create OTA deployment (HTTP ${res.status})`);
  }
  return res.json();
}

export async function startCanaryDeploymentApi(id: number): Promise<OtaDeployment> {
  const res = await fetch(`${API_BASE}/ota/deployments/${id}/start-canary`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `Failed to start canary trial for deployment #${id} (HTTP ${res.status})`);
  }
  return res.json();
}

export async function evaluateCanaryDeploymentApi(id: number): Promise<OtaDeployment> {
  const res = await fetch(`${API_BASE}/ota/deployments/${id}/evaluate-canary`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `Failed to evaluate canary trial #${id} (HTTP ${res.status})`);
  }
  return res.json();
}

export async function approveFleetDeploymentApi(id: number): Promise<OtaDeployment> {
  const res = await fetch(`${API_BASE}/ota/deployments/${id}/approve-fleet`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `Failed to approve fleet rollout for deployment #${id} (HTTP ${res.status})`);
  }
  return res.json();
}

export async function fetchDeviceOtaHistoryApi(deviceId: string): Promise<DeviceOtaHistory[]> {
  const res = await fetch(`${API_BASE}/ota/devices/${encodeURIComponent(deviceId)}/history`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `Failed to fetch OTA history for device ${deviceId} (HTTP ${res.status})`);
  }
  return res.json();
}

// -------------------------------------------------------------
// Phase 10: Ephemeral Remote Troubleshooting & Consent APIs
// -------------------------------------------------------------

export async function fetchRemoteSessions(): Promise<RemoteSession[]> {
  const res = await fetch(`${API_BASE}/remote-sessions`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `Failed to fetch remote sessions (HTTP ${res.status})`);
  }
  return res.json();
}

export async function fetchRemoteSession(id: number): Promise<RemoteSession> {
  const res = await fetch(`${API_BASE}/remote-sessions/${id}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `Failed to fetch remote session #${id} (HTTP ${res.status})`);
  }
  return res.json();
}

export async function requestRemoteSessionApi(req: RequestRemoteSessionRequest): Promise<RemoteSession> {
  const res = await fetch(`${API_BASE}/remote-sessions/request`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `Failed to request remote session (HTTP ${res.status})`);
  }
  return res.json();
}

export async function approveRemoteSessionApi(id: number, durationMinutes?: number): Promise<RemoteSession> {
  const body = durationMinutes ? JSON.stringify({ durationMinutes }) : undefined;
  const res = await fetch(`${API_BASE}/remote-sessions/${id}/approve`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body,
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `Failed to approve remote session #${id} (HTTP ${res.status})`);
  }
  return res.json();
}

export async function rejectRemoteSessionApi(id: number): Promise<RemoteSession> {
  const res = await fetch(`${API_BASE}/remote-sessions/${id}/reject`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `Failed to reject remote session #${id} (HTTP ${res.status})`);
  }
  return res.json();
}

export async function revokeRemoteSessionApi(id: number, reason?: string): Promise<RemoteSession> {
  const res = await fetch(`${API_BASE}/remote-sessions/${id}/revoke`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ reason: reason || 'Emergency Administrator Killswitch Triggered' }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `Failed to revoke remote session #${id} (HTTP ${res.status})`);
  }
  return res.json();
}
