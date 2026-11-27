"""
SOCHI VAYU - Fleet Simulator Manager
Orchestrates 30 simultaneous simulated VAYU Air Purifiers across diverse operational profiles.
"""

import json
import logging
import os
import signal
import sys
import time
from pathlib import Path
from typing import List

from device_agent import DeviceAgent

logger = logging.getLogger("VayuFleetManager")


class FleetManager:
    def __init__(
        self,
        config_path: Path,
        broker_override: str = None,
        port_override: int = None,
        interval_override: int = None,
        device_limit: int = None,
    ):
        self.config_path = config_path
        self.broker = broker_override
        self.port = port_override
        self.interval = interval_override
        self.device_limit = device_limit

        self.agents: List[DeviceAgent] = []
        self.is_running = False

        self._load_config()

    def _load_config(self):
        if not self.config_path.exists():
            raise FileNotFoundError(f"Fleet configuration not found at {self.config_path}")

        with open(self.config_path, "r", encoding="utf-8") as f:
            cfg = json.load(f)

        self.broker = self.broker or cfg.get("default_broker", "127.0.0.1")
        self.port = self.port or cfg.get("default_port", 1883)
        self.interval = self.interval or cfg.get("default_telemetry_interval_sec", 5)

        raw_devices = cfg.get("devices", [])
        if self.device_limit:
            raw_devices = raw_devices[: self.device_limit]

        logger.info(
            "Configuring %d simulated devices against MQTT broker %s:%d (Interval: %ds)",
            len(raw_devices),
            self.broker,
            self.port,
            self.interval,
        )

        for d in raw_devices:
            agent = DeviceAgent(
                device_id=d["device_id"],
                site_id=d["site_id"],
                profile=d["profile"],
                firmware_version=d.get("firmware_version", "v1.0.0-rc1"),
                broker_host=self.broker,
                broker_port=self.port,
                telemetry_interval=self.interval,
            )
            self.agents.append(agent)

    def start(self):
        """Starts all simulated devices."""
        self.is_running = True
        logger.info("Starting %d device agents...", len(self.agents))

        # Stagger initial connections to avoid sudden TCP burst
        for i, agent in enumerate(self.agents):
            agent.start()
            if (i + 1) % 5 == 0:
                time.sleep(0.1)

        logger.info("[SUCCESS] All %d devices connected. Telemetry stream is active.", len(self.agents))

    def run_loop(self):
        """Main execution loop with periodic telemetry ticks and fleet stats."""
        tick_counter = 0

        while self.is_running:
            start_time = time.time()
            tick_counter += 1

            # Dispatch ticks to all active agents
            for agent in self.agents:
                agent.tick()

            # Periodic fleet statistics in logs
            if tick_counter % 6 == 0:
                self._print_fleet_summary(tick_counter)

            elapsed = time.time() - start_time
            sleep_duration = max(0.1, self.interval - elapsed)
            time.sleep(sleep_duration)

    def _print_fleet_summary(self, tick_count: int):
        online_count = sum(1 for a in self.agents if a.is_connected)
        fault_count = sum(1 for a in self.agents if "FAULT" in a.profile or "STALL" in a.profile)
        logger.info(
            ">>> [FLEET SUMMARY | Tick #%d] Devices: %d/%d Online | Fault Injections Active: %d | Interval: %ds",
            tick_count,
            online_count,
            len(self.agents),
            fault_count,
            self.interval,
        )

    def stop(self):
        """Stops all simulated devices cleanly."""
        logger.info("Stopping fleet simulator...")
        self.is_running = False
        for agent in self.agents:
            try:
                agent.stop()
            except Exception as e:
                logger.error("Error stopping agent %s: %s", agent.device_id, e)
        logger.info("All simulated devices cleanly stopped and marked OFFLINE.")
