-- ==============================================================================
-- SOCHI VAYU - Phase 6 Incidents, Diagnostic Rules & Evidence Schema
-- Database: PostgreSQL 16
-- ==============================================================================

ALTER TABLE incidents ADD COLUMN IF NOT EXISTS diagnostic_rule VARCHAR(64);
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS category VARCHAR(32) NOT NULL DEFAULT 'HARDWARE';
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS evidence JSONB;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS acknowledged_by VARCHAR(64);
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS resolved_by VARCHAR(64);
ALTER TABLE incidents ADD COLUMN IF NOT EXISTS resolution_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_incidents_category ON incidents (category);
CREATE INDEX IF NOT EXISTS idx_incidents_rule ON incidents (diagnostic_rule);
CREATE INDEX IF NOT EXISTS idx_incidents_device_status ON incidents (device_id, status);
