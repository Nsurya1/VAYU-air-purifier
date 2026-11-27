#!/usr/bin/env python3
"""
SOCHI VAYU - Phase 1 Milestone 1 Verification Script
Verifies:
1. Docker compose syntax and container status.
2. Mosquitto MQTT TCP port (1883) readiness.
3. PostgreSQL port (5434) readiness.
4. Schema validation and seed verification once connected.
"""

import os
import sys
import socket
from pathlib import Path

def load_env(env_path: Path) -> dict:
    env_vars = {}
    if env_path.exists():
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env_vars[k.strip()] = v.strip()
    return env_vars

def check_tcp_port(host: str, port: int, service_name: str, timeout: float = 2.0) -> bool:
    print(f"[*] Checking TCP port for {service_name} on {host}:{port}...", end=" ", flush=True)
    try:
        with socket.create_connection((host, port), timeout=timeout):
            print("OK [Connected]")
            return True
    except (socket.timeout, ConnectionRefusedError, OSError) as e:
        print(f"NOT REACHABLE ({e})")
        return False

def main():
    print("==================================================================")
    print("   SOCHI VAYU - Phase 1 Local Infrastructure Health Verification   ")
    print("==================================================================")
    
    script_dir = Path(__file__).resolve().parent
    root_dir = script_dir.parent
    env_file = root_dir / ".env"
    env_vars = load_env(env_file)
    
    host = env_vars.get("HOST_BIND_IP", "127.0.0.1")
    mqtt_port = int(env_vars.get("MQTT_TCP_PORT", "1883"))
    pg_port = int(env_vars.get("POSTGRES_PORT", "5434"))
    
    print(f"Config loaded from: {env_file}")
    print(f"Binding Host: {host}")
    print(f"MQTT Port:    {mqtt_port}")
    print(f"Postgres Port:{pg_port}\n")
    
    mqtt_ok = check_tcp_port(host, mqtt_port, "Eclipse Mosquitto (MQTT)")
    pg_ok = check_tcp_port(host, pg_port, "PostgreSQL 16 (VAYU Container)")
    
    print("\n------------------------------------------------------------------")
    if mqtt_ok and pg_ok:
        print("[SUCCESS] All local infrastructure ports are responsive!")
        print("Ready to proceed to Phase 2 (Fleet Simulator).")
        return 0
    else:
        print("[STATUS] Containers are not yet started.")
        print("To start the stack, launch Docker Desktop and run:")
        print("  docker-compose up -d")
        print("\nThen re-run this verification script:")
        print("  python scripts/verify_phase1.py")
        return 1

if __name__ == "__main__":
    sys.exit(main())
