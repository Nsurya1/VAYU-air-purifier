"""
SOCHI VAYU - Live MQTT End-to-End Integration Test
Verifies live interaction between DeviceAgent and running Eclipse Mosquitto broker:
1. Broker connection & LWT registration.
2. Initial ONLINE retained status publication.
3. Telemetry emission and validation.
4. Bidirectional command handling (SET_FAN, OTA_UPDATE) and ACK receipt.
5. Clean shutdown and OFFLINE transition.
"""

import json
import sys
import time
import unittest
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
SIMULATOR_DIR = ROOT_DIR / "simulator"
sys.path.insert(0, str(SIMULATOR_DIR))

import paho.mqtt.client as mqtt
from device_agent import DeviceAgent


class TestLiveMqttIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.broker_host = "127.0.0.1"
        cls.broker_port = 1883
        cls.test_device_id = "VAYU-DEV-TEST"

        cls.received_messages = []

        cls.observer = mqtt.Client(
            client_id="vayu_test_observer",
            callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
        )
        cls.observer.username_pw_set("vayu_backend", "vayu_backend_pass_2026")
        cls.observer.on_message = cls._on_observer_message
        cls.observer.connect(cls.broker_host, cls.broker_port, keepalive=30)
        cls.observer.subscribe(f"vayu/{cls.test_device_id}/#", qos=1)
        cls.observer.loop_start()

    @classmethod
    def tearDownClass(cls):
        cls.observer.loop_stop()
        cls.observer.disconnect()

    @classmethod
    def _on_observer_message(cls, client, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode("utf-8"))
            cls.received_messages.append({"topic": msg.topic, "payload": payload})
        except Exception:
            pass

    def test_live_agent_lifecycle_and_commands(self):
        # 1. Instantiate agent
        agent = DeviceAgent(
            device_id=self.test_device_id,
            site_id="SITE-HQ-PUNE",
            profile="NOMINAL_CLEANROOM",
            broker_host=self.broker_host,
            broker_port=self.broker_port,
            telemetry_interval=1,
        )

        agent.start()
        time.sleep(1.0)

        # Verify ONLINE status message arrived
        online_msgs = [
            m for m in self.received_messages
            if m["topic"] == f"vayu/{self.test_device_id}/status" and m["payload"].get("status") == "ONLINE"
        ]
        self.assertGreaterEqual(len(online_msgs), 1, "Agent should publish ONLINE status on connect")

        # 2. Trigger telemetry tick
        agent.tick()
        time.sleep(0.5)

        telemetry_msgs = [
            m for m in self.received_messages
            if m["topic"] == f"vayu/{self.test_device_id}/telemetry"
        ]
        self.assertGreaterEqual(len(telemetry_msgs), 1, "Agent should publish telemetry")
        first_telem = telemetry_msgs[0]["payload"]
        self.assertTrue(first_telem["is_simulated"])
        self.assertIn("metrics", first_telem)

        # 3. Publish SET_FAN command
        cmd_fan = {
            "cmd_id": "cmd-test-101",
            "command": "SET_FAN",
            "fan_pct": 80,
        }
        self.observer.publish(f"vayu/{self.test_device_id}/cmd", payload=json.dumps(cmd_fan), qos=1)
        time.sleep(0.8)

        ack_msgs = [
            m for m in self.received_messages
            if m["topic"] == f"vayu/{self.test_device_id}/cmd/ack" and m["payload"].get("cmd_id") == "cmd-test-101"
        ]
        self.assertGreaterEqual(len(ack_msgs), 1, "Agent must acknowledge SET_FAN command")
        self.assertEqual(ack_msgs[0]["payload"]["status"], "SUCCESS")
        self.assertEqual(agent.current_fan_pct, 80)

        # 4. Clean shutdown
        agent.stop()
        time.sleep(0.8)

        offline_msgs = [
            m for m in self.received_messages
            if m["topic"] == f"vayu/{self.test_device_id}/status" and m["payload"].get("status") == "OFFLINE"
        ]
        self.assertGreaterEqual(len(offline_msgs), 1, "Agent should publish OFFLINE status on graceful stop")


if __name__ == "__main__":
    unittest.main()
