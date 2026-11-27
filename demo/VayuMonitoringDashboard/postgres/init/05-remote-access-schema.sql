-- ==============================================================================
-- SOCHI VAYU - Phase 10 Remote Troubleshooting & Ephemeral Consent Schema
-- ==============================================================================

CREATE TABLE IF NOT EXISTS remote_sessions (
    id SERIAL PRIMARY KEY,
    session_code VARCHAR(64) UNIQUE NOT NULL,
    target_site_id VARCHAR(64) NOT NULL REFERENCES sites(site_id),
    requested_by VARCHAR(64) NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'REQUESTED', -- REQUESTED, APPROVED_ACTIVE, REJECTED, EXPIRED, REVOKED, CLOSED
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    ephemeral_token VARCHAR(255),
    approved_by VARCHAR(64),
    approved_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    revoked_by VARCHAR(64),
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_remote_sessions_status ON remote_sessions(status);
CREATE INDEX IF NOT EXISTS idx_remote_sessions_site ON remote_sessions(target_site_id);
CREATE INDEX IF NOT EXISTS idx_remote_sessions_token ON remote_sessions(ephemeral_token);
