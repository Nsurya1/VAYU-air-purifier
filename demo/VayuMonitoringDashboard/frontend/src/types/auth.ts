export interface AuthUser {
  username: string;
  fullName: string;
  role: 'ROLE_ADMIN' | 'ROLE_SERVICE_TECH' | 'ROLE_DEV_ENGINEER' | 'ROLE_KIOSK' | string;
  siteScope: string;
  token: string;
}

export interface AuditLogEntry {
  id: number;
  actor: string;
  action: string;
  resourceType: string;
  resourceId: string;
  payload: string | null;
  createdAt: string;
}

export interface PresetPersona {
  id: string;
  username: string;
  label: string;
  role: string;
  siteScope: string;
  description: string;
}
