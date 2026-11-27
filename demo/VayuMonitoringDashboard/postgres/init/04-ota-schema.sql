-- ==============================================================================
-- SOCHI VAYU - Phase 8 Over-The-Air (OTA) Orchestration Schema
-- ==============================================================================

CREATE TABLE IF NOT EXISTS firmware_releases (
    id SERIAL PRIMARY KEY,
    version VARCHAR(32) UNIQUE NOT NULL,
    build_id VARCHAR(64) NOT NULL,
    target_hardware VARCHAR(32) NOT NULL DEFAULT 'REV-B-ESP32',
    sha256 VARCHAR(64) NOT NULL,
    binary_size INTEGER NOT NULL,
    binary_url VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PUBLISHED', -- PUBLISHED, TESTING, REVOKED
    release_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(64) NOT NULL DEFAULT 'admin'
);

CREATE TABLE IF NOT EXISTS ota_deployments (
    id SERIAL PRIMARY KEY,
    deployment_name VARCHAR(128) NOT NULL,
    firmware_version VARCHAR(32) NOT NULL REFERENCES firmware_releases(version),
    rollout_strategy VARCHAR(32) NOT NULL DEFAULT 'CANARY', -- CANARY, FULL_ROLLOUT
    canary_device_id VARCHAR(64) REFERENCES devices(device_id),
    canary_duration_seconds INTEGER NOT NULL DEFAULT 60,
    status VARCHAR(32) NOT NULL DEFAULT 'CREATED', -- CREATED, CANARY_ACTIVE, CANARY_PASSED, CANARY_FAILED, FULL_ROLLOUT, COMPLETED, CANCELLED
    approved_by VARCHAR(64),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(64) NOT NULL DEFAULT 'admin'
);

CREATE TABLE IF NOT EXISTS device_ota_history (
    id SERIAL PRIMARY KEY,
    device_id VARCHAR(64) NOT NULL REFERENCES devices(device_id),
    deployment_id INTEGER REFERENCES ota_deployments(id) ON DELETE CASCADE,
    target_version VARCHAR(32) NOT NULL,
    previous_version VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'SCHEDULED', -- SCHEDULED, DOWNLOADING, FLASHING, VERIFYING, SUCCESS, FAILED_ROLLBACK
    failure_reason TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_firmware_version ON firmware_releases(version);
CREATE INDEX IF NOT EXISTS idx_ota_deployments_status ON ota_deployments(status);
CREATE INDEX IF NOT EXISTS idx_device_ota_history_device ON device_ota_history(device_id);

-- Seed Initial Stable Release (v1.0.0-prod) and Test Canary Release (v1.1.0-rc1)
INSERT INTO firmware_releases (version, build_id, target_hardware, sha256, binary_size, binary_url, status, release_notes, created_by)
VALUES 
(
    'v1.0.0-prod',
    'bld-20261022-01',
    'REV-B-ESP32',
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    1048576,
    '/binaries/vayu-v1.0.0-prod.bin',
    'PUBLISHED',
    'Initial factory baseline firmware with autonomous EPA auto-speed curve and tachometer stall interlock.',
    'admin'
),
(
    'v1.1.0-rc1',
    'bld-20261022-02',
    'REV-B-ESP32',
    'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0',
    1073152,
    '/binaries/vayu-v1.1.0-rc1.bin',
    'TESTING',
    'Enhanced PM sensor UART noise filtering, optimized dual-core FreeRTOS stack allocation, and WiFi reconnect hysteresis.',
    'admin'
)
ON CONFLICT (version) DO NOTHING;
