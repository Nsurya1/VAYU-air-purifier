#!/usr/bin/env bash
# ==============================================================================
# SOCHI VAYU — Linux / Ubuntu Local Monitoring Platform Installer
# ==============================================================================
set -e

echo "=============================================================================="
echo "          SOCHI VAYU - Local Air Quality Monitoring Platform"
echo "             Autonomous On-Premise Customer Installation"
echo "=============================================================================="
echo ""

# 1. Verify Docker installation
if ! command -v docker &> /dev/null; then
    echo "[ERROR] Docker is not installed. Please install Docker Engine:"
    echo "https://docs.docker.com/engine/install/"
    exit 1
fi

# 2. Verify Docker daemon is running
if ! docker info &> /dev/null; then
    echo "[ERROR] Docker daemon is not running. Please start Docker service: sudo systemctl start docker"
    exit 1
fi

# 3. Prepare .env configuration
if [ ! -f ".env" ]; then
    echo "[*] Creating default '.env' file from '.env.example'..."
    cp .env.example .env
fi

# 4. Launch containers
echo "[*] Starting containers via Docker Compose..."
docker compose up -d --remove-orphans

echo "[*] Waiting for services to initialize..."
sleep 5
docker compose ps

LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "<SERVER_IP>")

echo ""
echo "=============================================================================="
echo "                    SOCHI VAYU INSTALLATION READY!"
echo "=============================================================================="
echo ""
echo "Dashboard URL (Local):  http://localhost:3000"
echo "Dashboard URL (LAN):    http://${LOCAL_IP}:3000"
echo ""
echo "To stop services cleanly, run: ./shutdown.sh"
echo "=============================================================================="
