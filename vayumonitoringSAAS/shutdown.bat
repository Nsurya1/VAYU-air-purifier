@echo off
title SOCHI VAYU - Shutdown Local Monitoring Services
color 0F

echo ==============================================================================
echo             SOCHI VAYU - Graceful System Shutdown
echo ==============================================================================
echo.
echo Stopping local monitoring containers (Mosquitto, Backend, Dashboard)...
docker compose down

echo.
echo [OK] All SOCHI VAYU local services have stopped cleanly.
echo Note: VAYU purifiers continue their autonomous air cleaning operations.
echo.
pause
