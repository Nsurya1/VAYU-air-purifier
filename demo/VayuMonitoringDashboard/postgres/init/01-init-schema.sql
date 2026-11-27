-- ==============================================================================
-- SOCHI VAYU Telemetry & Fleet Management Database Initialization
-- Schema Version: 1.0.0
-- Database: PostgreSQL 16
-- ==============================================================================

-- 1. Sites / Deployment Locations
CREATE TABLE IF NOT EXISTS sites (
    site_id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    location VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Device Inventory
CREATE TABLE IF NOT EXISTS devices (
    device_id VARCHAR(64) PRIMARY KEY,
    site_id VARCHAR(64) REFERENCES sites(site_id) ON DELETE SET NULL,
    model VARCHAR(64) NOT NULL DEFAULT 'VAYU-AirPurifier-Pro',
    hardware_rev VARCHAR(32) NOT NULL DEFAULT 'REV-A',
    mac_address VARCHAR(32),
    ip_address VARCHAR(45),
    current_fw_version VARCHAR(32) NOT NULL DEFAULT 'v1.0.0-rc1',
    online_status VARCHAR(20) NOT NULL DEFAULT 'OFFLINE',
    last_seen_at TIMESTAMPTZ,
    is_simulated BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Telemetry Time-Series Records
CREATE TABLE IF NOT EXISTS telemetry_records (
    id BIGSERIAL PRIMARY KEY,
    device_id VARCHAR(64) NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    recorded_at TIMESTAMPTZ NOT NULL,
    pm1 NUMERIC(6, 2),
    pm25 NUMERIC(6, 2), -- Nullable when PM sensor is in fault condition
    pm10 NUMERIC(6, 2),
    voc INTEGER,
    temp_c NUMERIC(5, 2),
    rh NUMERIC(5, 2),
    aqi INTEGER, -- Nullable when PM sensor is in fault condition
    aqi_standard VARCHAR(20) NOT NULL DEFAULT 'US_EPA',
    fan_pct INTEGER NOT NULL,
    mode VARCHAR(20) NOT NULL DEFAULT 'AUTO',
    filter_hours_left INTEGER NOT NULL,
    rssi INTEGER,
    err_code INTEGER NOT NULL DEFAULT 0,
    sensors_valid JSONB NOT NULL DEFAULT '{"pm_valid": true, "voc_valid": true, "temp_rh_valid": true}'::jsonb,
    is_simulated BOOLEAN NOT NULL DEFAULT TRUE,
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Device Lifecycle & Diagnostic Events (Status transitions, LWT, resets, errors)
CREATE TABLE IF NOT EXISTS device_events (
    id BIGSERIAL PRIMARY KEY,
    device_id VARCHAR(64) NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    event_type VARCHAR(32) NOT NULL,
    severity VARCHAR(16) NOT NULL DEFAULT 'INFO',
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Operational Incidents & Triage Records
CREATE TABLE IF NOT EXISTS incidents (
    id BIGSERIAL PRIMARY KEY,
    device_id VARCHAR(64) NOT NULL REFERENCES devices(device_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
    severity VARCHAR(16) NOT NULL DEFAULT 'MEDIUM',
    assigned_to VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- 6. Audit Logs (Commands, Config changes, User logins)
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    actor VARCHAR(64) NOT NULL,
    action VARCHAR(64) NOT NULL,
    resource_type VARCHAR(64) NOT NULL,
    resource_id VARCHAR(64) NOT NULL,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices for high-frequency time-series queries
CREATE INDEX IF NOT EXISTS idx_telemetry_device_time ON telemetry_records (device_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_recorded_at ON telemetry_records (recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_devices_site_id ON devices (site_id);
CREATE INDEX IF NOT EXISTS idx_devices_online_status ON devices (online_status);
CREATE INDEX IF NOT EXISTS idx_device_events_device_time ON device_events (device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents (status);

-- Seed Initial Sites
INSERT INTO sites (site_id, name, location) VALUES
('SITE-HQ-PUNE', 'SOCHI Technologies HQ - Cleanroom & Labs', 'Pune, Maharashtra, India'),
('SITE-BLR-DEV', 'SOCHI R&D Facility - Testing Wing B', 'Bengaluru, Karnataka, India')
ON CONFLICT (site_id) DO NOTHING;

-- Seed Initial 30 Simulated Fleet Devices (Pre-allocated for Phase 2 Simulator)
DO $$
BEGIN
    FOR i IN 1..30 LOOP
        INSERT INTO devices (
            device_id,
            site_id,
            model,
            hardware_rev,
            mac_address,
            ip_address,
            current_fw_version,
            online_status,
            is_simulated
        ) VALUES (
            'VAYU-DEV-' || LPAD(i::text, 3, '0'),
            CASE WHEN i <= 15 THEN 'SITE-HQ-PUNE' ELSE 'SITE-BLR-DEV' END,
            'VAYU-AirPurifier-Pro',
            'REV-A',
            '44:17:93:' || LPAD(to_hex(i), 2, '0') || ':A1:B2',
            '192.168.1.' || (100 + i)::text,
            'v1.0.0-rc1',
            'OFFLINE',
            TRUE
        ) ON CONFLICT (device_id) DO NOTHING;
    END LOOP;
END $$;
