#!/usr/bin/env python3
"""
SOCHI VAYU - Fleet Simulator Entrypoint
Launches 30 simulated VAYU devices with distinct behavioral & fault profiles.
"""

import argparse
import logging
import os
import signal
import sys
from pathlib import Path

# Ensure local modules can be resolved
CURRENT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(CURRENT_DIR))

from fleet_manager import FleetManager

def setup_logging(level_name: str):
    level = getattr(logging, level_name.upper(), logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )

def main():
    parser = argparse.ArgumentParser(description="SOCHI VAYU - 30-Device Multi-Condition Fleet Simulator")
    parser.add_argument("--broker", type=str, default="127.0.0.1", help="MQTT Broker host (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=1883, help="MQTT Broker port (default: 1883)")
    parser.add_argument("--interval", type=int, default=5, help="Telemetry publishing interval in seconds (default: 5)")
    parser.add_argument("--devices", type=int, default=30, help="Number of simulated devices (default: 30)")
    parser.add_argument("--config", type=str, default=str(CURRENT_DIR / "configs" / "fleet_config.json"), help="Path to fleet config JSON")
    parser.add_argument("--log-level", type=str, default="INFO", choices=["DEBUG", "INFO", "WARNING", "ERROR"], help="Logging level")
    
    args = parser.parse_args()
    setup_logging(args.log_level)
    
    config_path = Path(args.config)
    
    print("==================================================================")
    print("        SOCHI VAYU - 30-Device Fleet Telemetry Simulator          ")
    print("==================================================================")
    print(f"Target Broker: {args.broker}:{args.port}")
    print(f"Fleet Size:    {args.devices} Devices")
    print(f"Interval:      {args.interval}s")
    print(f"Config File:   {config_path}\n")
    
    manager = FleetManager(
        config_path=config_path,
        broker_override=args.broker,
        port_override=args.port,
        interval_override=args.interval,
        device_limit=args.devices,
    )
    
    def handle_exit(signum, frame):
        print("\n[!] Received shutdown signal. Initiating clean fleet disconnect...")
        manager.stop()
        sys.exit(0)
        
    signal.signal(signal.SIGINT, handle_exit)
    signal.signal(signal.SIGTERM, handle_exit)
    
    manager.start()
    try:
        manager.run_loop()
    except KeyboardInterrupt:
        handle_exit(None, None)

if __name__ == "__main__":
    main()
