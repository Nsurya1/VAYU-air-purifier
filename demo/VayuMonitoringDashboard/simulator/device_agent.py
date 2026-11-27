"""
SOCHI VAYU - Device Agent Simulator
Simulates a single autonomous VAYU Air Purifier adhering to the MQTT contract v1.0.0.
Supports realistic sensor telemetry, failure injection profiles, LWT, and simulated OTA updates.
"""

import json
import logging
import os
import random
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import paho.mqtt.client as mqtt

from aqi_calculator import calculate_aqi

logger = logging.getLogger("VayuDeviceAgent")


def get_utc_iso_timestamp() -> str:
    """Returns current UTC ISO-8601 timestamp with millisecond precision."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


class DeviceAgent:
    def __init__(
        self,
        device_id: str,
        site_id: str,
        profile: str,
        firmware_version: str = "v1.0.0-rc1",
        broker_host: str = "127.0.0.1",
        broker_port: int = 1883,
        telemetry_interval: int = 5,
    ):
        self.device_id = device_id
        self.site_id = site_id
        self.profile = profile
        self.fw_version = firmware_version
        self.broker_host = broker_host
        self.broker_port = broker_port
        self.telemetry_interval = telemetry_interval

        # Deterministic IP & MAC derivation from device_id
        try:
            dev_num = int(device_id.split("-")[-1])
        except (ValueError, IndexError):
            dev_num = abs(hash(device_id)) % 150 + 1

        self.ip_address = f"192.168.1.{100 + (dev_num % 150)}"
        self.mac_address = f"44:17:93:{(dev_num >> 8) & 0xFF:02x}:{dev_num & 0xFF:02x}:B2"

        # Topics
        self.topic_telemetry = f"vayu/{self.device_id}/telemetry"
        self.topic_status = f"vayu/{self.device_id}/status"
        self.topic_cmd = f"vayu/{self.device_id}/cmd"
        self.topic_cmd_ack = f"vayu/{self.device_id}/cmd/ack"

        # Operational State
        self.is_running = False
        self.is_connected = False
        self.uptime_seconds = 0
        self.cycle_count = 0
        self.filter_hours_left = random.randint(3500, 4320)
        self.current_fan_pct = 35
        self.current_mode = "AUTO"
        self.error_code = 0

        # Environmental State variables for smooth Brownian motion
        self.base_pm25 = 10.0
        self.base_temp = 23.5
        self.base_rh = 50.0
        self.base_voc = 110

        # Configure Paho MQTT Client (Paho v2 Callback API)
        self.client = mqtt.Client(
            client_id=f"vayu_sim_{self.device_id}",
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
            protocol=mqtt.MQTTv311,
        )

        # Set MQTT username and password for Mosquitto ACL authentication
        mqtt_user = os.environ.get("MQTT_DEVICE_USERNAME", "vayu_device")
        mqtt_pass = os.environ.get("MQTT_DEVICE_PASSWORD", "vayu_device_pass_2026")
        if mqtt_user:
            self.client.username_pw_set(mqtt_user, mqtt_pass)

        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect
        self.client.on_message = self._on_message

        # Configure Last Will and Testament (LWT)
        # If connection drops ungracefully, the broker automatically publishes this payload
        lwt_payload = json.dumps(
            {
                "schema_version": "1.0.0",
                "device_id": self.device_id,
                "status": "OFFLINE",
                "reason": "UNEXPECTED_DISCONNECT",
                "is_simulated": True,
                "timestamp": get_utc_iso_timestamp(),
            }
        )
        self.client.will_set(self.topic_status, payload=lwt_payload, qos=1, retain=True)

    def _on_connect(self, client, userdata, flags, reason_code, properties=None):
        if reason_code == 0:
            self.is_connected = True
            # Publish retained ONLINE status message
            online_payload = json.dumps(
                {
                    "schema_version": "1.0.0",
                    "device_id": self.device_id,
                    "site_id": self.site_id,
                    "status": "ONLINE",
                    "current_fw_version": self.fw_version,
                    "ip_address": self.ip_address,
                    "mac_address": self.mac_address,
                    "is_simulated": True,
                    "timestamp": get_utc_iso_timestamp(),
                }
            )
            self.client.publish(self.topic_status, payload=online_payload, qos=1, retain=True)

            # Subscribe to command topic
            self.client.subscribe(self.topic_cmd, qos=1)
            logger.debug("[%s] Connected & published ONLINE status.", self.device_id)
        else:
            logger.warning("[%s] MQTT Connect failed with code: %s", self.device_id, reason_code)

    def _on_disconnect(self, client, userdata, flags, reason_code, properties=None):
        self.is_connected = False
        logger.debug("[%s] Disconnected from broker (rc: %s)", self.device_id, reason_code)

    def _on_message(self, client, userdata, msg):
        """Processes incoming remote commands."""
        try:
            payload = json.loads(msg.payload.decode("utf-8"))
            cmd_type = payload.get("command")
            cmd_id = payload.get("cmd_id", "cmd-unknown")
            logger.info("[%s] Received command: %s (id: %s)", self.device_id, cmd_type, cmd_id)

            ack_status = "SUCCESS"
            ack_message = "Command executed"

            if cmd_type == "SET_FAN":
                new_fan = int(payload.get("fan_pct", 50))
                if 0 <= new_fan <= 100:
                    self.current_fan_pct = new_fan
                    self.current_mode = "MANUAL"
                    ack_message = f"Fan speed set to {new_fan}%"
                else:
                    ack_status = "REJECTED"
                    ack_message = "fan_pct out of range (0-100)"

            elif cmd_type == "SET_MODE":
                new_mode = payload.get("mode")
                if new_mode in ["AUTO", "MANUAL", "NIGHT", "TURBO", "OFF"]:
                    self.current_mode = new_mode
                    if new_mode == "TURBO":
                        self.current_fan_pct = 100
                    elif new_mode == "NIGHT":
                        self.current_fan_pct = 20
                    elif new_mode == "OFF":
                        self.current_fan_pct = 0
                    ack_message = f"Mode set to {new_mode}"
                else:
                    ack_status = "REJECTED"
                    ack_message = f"Invalid mode: {new_mode}"

            elif cmd_type == "FILTER_RESET":
                self.filter_hours_left = 4320
                ack_message = "Filter lifespan reset to 4320 hours"

            elif cmd_type == "OTA_UPDATE":
                target_version = payload.get("target_version", "v1.1.0")
                logger.info("[%s] Simulating OTA Update to %s...", self.device_id, target_version)
                # Publish OTA starting acknowledgment
                self._publish_ota_progress(cmd_id, target_version, 25, "DOWNLOADING")
                time.sleep(0.5)
                self._publish_ota_progress(cmd_id, target_version, 75, "FLASHING_PARTITION_B")
                time.sleep(0.5)

                if any(x in target_version.lower() for x in ["bad", "fail", "rollback"]):
                    logger.warning("[%s] Simulating failed image verification! Rolling back to slot A (%s)", self.device_id, self.fw_version)
                    self._publish_ota_progress(cmd_id, target_version, 90, "HEALTH_CHECK_FAILED")
                    self.error_code |= 0x01
                    ack_status = "OTA_ROLLBACK"
                    ack_message = f"Firmware image verification failed or fault detected; rolled back to {self.fw_version}"
                else:
                    self.fw_version = target_version
                    self.uptime_seconds = 0
                    self.error_code = 0
                    ack_status = "OTA_SUCCESS"
                    ack_message = f"Successfully updated firmware to {target_version} and booted slot B"

                # Publish status update with current firmware
                online_payload = json.dumps(
                    {
                        "schema_version": "1.0.0",
                        "device_id": self.device_id,
                        "site_id": self.site_id,
                        "status": "ONLINE",
                        "current_fw_version": self.fw_version,
                        "ip_address": self.ip_address,
                        "mac_address": self.mac_address,
                        "is_simulated": True,
                        "timestamp": get_utc_iso_timestamp(),
                    }
                )
                self.client.publish(self.topic_status, payload=online_payload, qos=1, retain=True)

                # Emit immediate telemetry frame
                telem = self.generate_telemetry()
                if telem:
                    self.client.publish(self.topic_telemetry, payload=json.dumps(telem), qos=1)

            else:
                ack_status = "UNKNOWN_COMMAND"
                ack_message = f"Unsupported command action: {cmd_type}"

            # Publish ACK
            ack_payload = json.dumps(
                {
                    "schema_version": "1.0.0",
                    "device_id": self.device_id,
                    "cmd_id": cmd_id,
                    "command": cmd_type,
                    "status": ack_status,
                    "message": ack_message,
                    "timestamp": get_utc_iso_timestamp(),
                }
            )
            self.client.publish(self.topic_cmd_ack, payload=ack_payload, qos=1)

        except Exception as e:
            logger.error("[%s] Error handling command: %s", self.device_id, e)

    def _publish_ota_progress(self, cmd_id: str, version: str, progress_pct: int, stage: str):
        progress_payload = json.dumps(
            {
                "schema_version": "1.0.0",
                "device_id": self.device_id,
                "cmd_id": cmd_id,
                "command": "OTA_UPDATE",
                "status": "IN_PROGRESS",
                "stage": stage,
                "progress_pct": progress_pct,
                "target_version": version,
                "timestamp": get_utc_iso_timestamp(),
            }
        )
        self.client.publish(self.topic_cmd_ack, payload=progress_payload, qos=1)

    def generate_telemetry(self) -> Dict[str, Any]:
        """Generates realistic telemetry payload based on the assigned device profile."""
        self.cycle_count += 1
        self.uptime_seconds += self.telemetry_interval
        self.filter_hours_left = max(0, self.filter_hours_left - 1)

        # Baseline random drift
        pm_valid = True
        voc_valid = True
        temp_rh_valid = True
        rssi = -60 + random.randint(-4, 4)
        err_code = self.error_code

        if self.profile == "NOMINAL_CLEANROOM":
            # Very clean air, stable climate
            pm25 = max(2.0, min(18.0, self.base_pm25 + random.uniform(-1.0, 1.0)))
            pm1 = round(pm25 * 0.6, 1)
            pm10 = round(pm25 * 1.8, 1)
            voc = max(40, min(140, self.base_voc + random.randint(-5, 5)))
            temp_c = round(22.0 + random.uniform(0.0, 2.0), 1)
            rh = round(48.0 + random.uniform(-2.0, 2.0), 1)
            if self.current_mode == "AUTO":
                self.current_fan_pct = 30
            self.base_pm25 = pm25

        elif self.profile == "POLLUTION_SPIKE":
            # Severe particulate spike (e.g. episodic smoke or dust ingress)
            pm25 = round(random.uniform(140.0, 280.0), 1)
            pm1 = round(pm25 * 0.7, 1)
            pm10 = round(pm25 * 2.2, 1)
            voc = random.randint(320, 480)
            temp_c = round(26.5 + random.uniform(-0.5, 0.5), 1)
            rh = round(65.0 + random.uniform(-3.0, 3.0), 1)
            if self.current_mode == "AUTO":
                self.current_fan_pct = 95  # Ramps fan to clear air
            rssi = -68 + random.randint(-5, 5)

        elif self.profile == "INTERMITTENT_WIFI":
            # Weak Wi-Fi signal
            rssi = random.randint(-94, -86)
            pm25 = round(15.0 + random.uniform(-2.0, 2.0), 1)
            pm1 = round(pm25 * 0.6, 1)
            pm10 = round(pm25 * 1.5, 1)
            voc = random.randint(90, 130)
            temp_c = 23.0
            rh = 50.0

            # Simulate network drop every 6 cycles: close connection abruptly
            if self.cycle_count % 6 == 0:
                logger.info("[%s] Simulating abrupt Wi-Fi dropout (LWT will fire)...", self.device_id)
                self.client.disconnect()
                self.is_connected = False
                return None

        elif self.profile == "SENSOR_FAULT_PM":
            # PM sensor communication error or checksum timeout
            pm1 = None
            pm25 = None
            pm10 = None
            pm_valid = False
            voc = 120
            temp_c = 24.0
            rh = 52.0
            err_code |= 0x02  # Bit 1: PM Sensor Fault
            # Safe local failsafe mode
            if self.current_mode == "AUTO":
                self.current_fan_pct = 50  # Fixed safe velocity

        elif self.profile == "SENSOR_FAULT_TEMP_RH":
            # I2C bus error to temperature/humidity sensor
            pm25 = 12.0
            pm1 = 7.0
            pm10 = 22.0
            voc = 115
            temp_c = None
            rh = None
            temp_rh_valid = False
            err_code |= 0x04  # Bit 2: Temp/RH Sensor Fault

        elif self.profile == "FAN_STALL_FAULT":
            # Fan motor blocked / tachometer reads 0 RPM
            pm25 = round(28.0 + random.uniform(-3.0, 3.0), 1)
            pm1 = round(pm25 * 0.6, 1)
            pm10 = round(pm25 * 1.6, 1)
            voc = 160
            temp_c = 28.5  # Elevated temp due to motor stall
            rh = 45.0
            err_code |= 0x01  # Bit 0: Fan Stall Error
            self.current_mode = "ERROR_SAFE"
            self.current_fan_pct = 0  # Motor cut off by firmware safety loop

        elif self.profile == "WATCHDOG_RESET_CYCLE":
            # Device crashes and brownouts periodically
            if self.cycle_count % 8 == 0:
                logger.info("[%s] Simulating Watchdog Timer / Brownout Reset!", self.device_id)
                self.uptime_seconds = 0
                err_code |= 0x10  # Bit 4: Brownout recovery
            pm25 = 18.0
            pm1 = 10.0
            pm10 = 29.0
            voc = 105
            temp_c = 23.0
            rh = 50.0

        elif self.profile == "STALE_TELEMETRY":
            # Sensor ADC stuck, values completely static
            pm1 = 25.0
            pm25 = 42.0
            pm10 = 68.0
            voc = 180
            temp_c = 24.2
            rh = 51.5
            rssi = -64

        else:
            pm25 = 15.0
            pm1 = 9.0
            pm10 = 25.0
            voc = 100
            temp_c = 23.0
            rh = 50.0

        # Calculate AQI explicitly using US-EPA formula (null when PM sensor is faulty)
        if pm25 is not None:
            aqi_val, _ = calculate_aqi(pm25, pm10)
        else:
            aqi_val = None

        payload = {
            "schema_version": "1.0.0",
            "device_id": self.device_id,
            "timestamp": get_utc_iso_timestamp(),
            "is_simulated": True,
            "metrics": {
                "pm1": pm1,
                "pm25": pm25,
                "pm10": pm10,
                "voc": voc,
                "temp_c": temp_c,
                "rh": rh,
                "aqi": aqi_val,
                "aqi_standard": "US_EPA",
                "fan_pct": self.current_fan_pct,
                "mode": self.current_mode,
                "filter_hours_left": self.filter_hours_left,
                "rssi": rssi,
            },
            "diagnostics": {
                "fw_build_id": self.fw_version,
                "uptime_seconds": self.uptime_seconds,
                "err_code": err_code,
                "sensor_status": {
                    "pm_valid": pm_valid,
                    "voc_valid": voc_valid,
                    "temp_rh_valid": temp_rh_valid,
                },
            },
        }

        return payload

    def start(self):
        """Starts the device connection and background loop."""
        self.is_running = True
        try:
            self.client.connect(self.broker_host, self.broker_port, keepalive=30)
            self.client.loop_start()
        except Exception as e:
            logger.error("[%s] Could not connect to MQTT broker: %s", self.device_id, e)

    def tick(self):
        """Called periodically by FleetManager to emit telemetry."""
        if not self.is_running:
            return

        # If disconnected due to simulated Wi-Fi outage, attempt reconnection
        if not self.is_connected:
            try:
                self.client.reconnect()
                logger.debug("[%s] Reconnected after simulated network drop.", self.device_id)
            except Exception:
                return

        telemetry = self.generate_telemetry()
        if telemetry is not None and self.is_connected:
            payload_str = json.dumps(telemetry)
            self.client.publish(self.topic_telemetry, payload=payload_str, qos=0)

    def stop(self):
        """Graceful shutdown of device simulator."""
        self.is_running = False
        if self.is_connected:
            # Publish graceful OFFLINE status
            offline_payload = json.dumps(
                {
                    "schema_version": "1.0.0",
                    "device_id": self.device_id,
                    "status": "OFFLINE",
                    "reason": "SIMULATOR_SHUTDOWN",
                    "is_simulated": True,
                    "timestamp": get_utc_iso_timestamp(),
                }
            )
            self.client.publish(self.topic_status, payload=offline_payload, qos=1, retain=True)
            time.sleep(0.1)
            self.client.disconnect()
        self.client.loop_stop()
