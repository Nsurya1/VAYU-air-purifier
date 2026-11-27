// SOCHI VAYU - OTA & Firmware Types

export type FirmwareStatus = 'PUBLISHED' | 'TESTING' | 'REVOKED';

export interface FirmwareRelease {
  id: number;
  version: string;
  buildId: string;
  targetHardware: string;
  sha256: string;
  binarySize: number;
  binaryUrl: string;
  status: FirmwareStatus;
  releaseNotes: string | null;
  createdAt: string;
  createdBy: string;
}

export type RolloutStrategy = 'CANARY' | 'FULL_ROLLOUT';

export type DeploymentStatus =
  | 'CREATED'
  | 'CANARY_ACTIVE'
  | 'CANARY_PASSED'
  | 'CANARY_FAILED'
  | 'FULL_ROLLOUT'
  | 'COMPLETED'
  | 'CANCELLED';

export interface OtaDeployment {
  id: number;
  deploymentName: string;
  firmwareVersion: string;
  rolloutStrategy: RolloutStrategy;
  canaryDeviceId: string | null;
  canaryDurationSeconds: number;
  status: DeploymentStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  createdBy: string;
}

export type DeviceOtaStatus =
  | 'SCHEDULED'
  | 'DOWNLOADING'
  | 'FLASHING'
  | 'VERIFYING'
  | 'SUCCESS'
  | 'FAILED_ROLLBACK';

export interface DeviceOtaHistory {
  id: number;
  deviceId: string;
  deploymentId: number | null;
  targetVersion: string;
  previousVersion: string;
  status: DeviceOtaStatus;
  failureReason: string | null;
  updatedAt: string;
}

export interface CreateReleaseRequest {
  version: string;
  buildId: string;
  targetHardware?: string;
  sha256: string;
  binarySize: number;
  binaryUrl: string;
  releaseNotes?: string;
}

export interface CreateDeploymentRequest {
  deploymentName: string;
  firmwareVersion: string;
  rolloutStrategy: RolloutStrategy;
  canaryDeviceId?: string;
  canaryDurationSeconds?: number;
}
