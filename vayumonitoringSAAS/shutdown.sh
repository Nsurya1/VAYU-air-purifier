#!/usr/bin/env bash
# ==============================================================================
# SOCHI VAYU — Linux / Ubuntu Local Monitoring Platform Shutdown Script
# ==============================================================================
set -e

echo "Stopping SOCHI VAYU local services..."
docker compose down

echo ""
echo "[OK] All SOCHI VAYU local services stopped cleanly."
echo "Note: VAYU purifiers continue their autonomous air cleaning operations."
