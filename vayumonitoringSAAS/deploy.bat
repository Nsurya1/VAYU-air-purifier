@echo off
setlocal enabledelayedexpansion

title SOCHI VAYU - Local Real-Time Monitoring System
color 0F

echo ==============================================================================
echo           SOCHI VAYU - Local Air Quality Monitoring Platform
echo              Autonomous On-Premise Customer Installation
echo ==============================================================================
echo.

:: 1. Check if Docker is installed
where docker >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Docker is not installed or not found in system PATH.
    echo.
    echo Please install Docker Desktop for Windows from:
    echo https://www.docker.com/products/docker-desktop/
    echo.
    echo After installing, restart your computer and run this script again.
    pause
    exit /b 1
)

:: 2. Check if Docker Desktop engine is running
echo [1/4] Verifying Docker Desktop runtime engine...
docker info >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Docker Desktop is installed but is NOT currently running.
    echo.
    echo Please launch Docker Desktop from your Start Menu, wait until the
    echo status icon turns green (Engine Running), and press any key to retry.
    echo.
    pause
    docker info >nul 2>&1
    if !ERRORLEVEL! neq 0 (
        echo [FATAL] Docker Desktop engine is still not responding. Exiting.
        pause
        exit /b 1
    )
)
echo [OK] Docker engine is running.
echo.

:: 3. Prepare Environment Configuration (.env)
echo [2/4] Checking installation configuration (.env)...
if not exist ".env" (
    echo [*] Creating initial '.env' from '.env.example' template...
    copy ".env.example" ".env" >nul
    echo [OK] Default configuration generated.
) else (
    echo [OK] Existing configuration found.
)
echo.

:: 4. Start Docker Compose Stack
echo [3/4] Starting SOCHI VAYU local services (Mosquitto, Backend, Dashboard)...
docker compose up -d --remove-orphans
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to start Docker services. Inspect logs with: docker compose logs
    pause
    exit /b 1
)
echo [OK] Containers started.
echo.

:: 5. Verification & Service Readiness
echo [4/4] Verifying service health status...
timeout /t 5 /nobreak >nul
docker compose ps

echo.
echo ==============================================================================
echo                     SOCHI VAYU INSTALLATION READY!
echo ==============================================================================
echo.
echo Dashboard URL (Local PC):   http://localhost:3000
echo.
echo To view this dashboard on facility TVs, laptops, or tablets on this network:
echo 1. Find this PC's local IP address by typing 'ipconfig' in Command Prompt.
echo    Example: http://192.168.1.50:3000
echo 2. Make sure Windows Firewall allows inbound connections on Port 3000.
echo.
echo Optional: To automatically configure Windows Firewall rules now,
echo right-click 'scripts\setup-firewall.ps1' and choose 'Run with PowerShell'.
echo.
echo To stop the monitoring system at any time, run 'shutdown.bat'.
echo ==============================================================================
echo.
pause
