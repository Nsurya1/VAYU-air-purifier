// SOCHI VAYU - Remote Support & Ephemeral Consent Types

export type RemoteSessionStatus =
  | 'REQUESTED'
  | 'APPROVED_ACTIVE'
  | 'REJECTED'
  | 'EXPIRED'
  | 'REVOKED'
  | 'CLOSED';

export interface RemoteSession {
  id: number;
  sessionCode: string;
  targetSiteId: string;
  requestedBy: string;
  reason: string;
  status: RemoteSessionStatus;
  durationMinutes: number;
  ephemeralToken: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  expiresAt: string | null;
  revokedBy: string | null;
  revokedAt: string | null;
  createdAt: string;
  remainingSeconds: number;
}

export interface RequestRemoteSessionRequest {
  targetSiteId: string;
  reason: string;
  durationMinutes: number;
}
