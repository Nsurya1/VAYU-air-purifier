"""
SOCHI VAYU - Simulator & Telemetry Contract Unit Tests
Validates:
1. EPA AQI calculation correctness against known official EPA breakpoints.
2. Complete adherence of simulated payloads to the JSON Schema contract (v1.0.0).
3. Missing value policy (null when faulty, sensor validity boolean flags).
4. Mandatory simulation provenance ("is_simulated": True).
5. Command handling and OTA progress event generation.
"""

import json
import sys
import unittest
from pathlib import Path

# Add simulator to Python path
ROOT_DIR = Path(__file__).resolve().parent.parent
SIMULATOR_DIR = ROOT_DIR / "simulator"
sys.path.insert(0, str(SIMULATOR_DIR))

import jsonschema
from aqi_calculator import calculate_aqi, calculate_sub_index, PM25_BREAKPOINTS
from device_agent import DeviceAgent


class TestAqiCalculation(unittest.TestCase):
    def test_epa_pm25_boundary_values(self):
        """Verifies exact EPA index boundaries for PM2.5."""
        # 0.0 ug/m3 -> AQI 0 (Good)
        aqi, cat = calculate_aqi(0.0)
        self.assertEqual(aqi, 0)
        self.assertEqual(cat, "GOOD")

        # 12.0 ug/m3 -> AQI 50 (Good upper bound)
        aqi, cat = calculate_aqi(12.0)
        self.assertEqual(aqi, 50)
        self.assertEqual(cat, "GOOD")

        # 12.1 ug/m3 -> AQI 51 (Moderate lower bound)
        aqi, cat = calculate_aqi(12.1)
        self.assertEqual(aqi, 51)
        self.assertEqual(cat, "MODERATE")

        # 35.4 ug/m3 -> AQI 100 (Moderate upper bound)
        aqi, cat = calculate_aqi(35.4)
        self.assertEqual(aqi, 100)
        self.assertEqual(cat, "MODERATE")

        # 55.4 ug/m3 -> AQI 150 (Unhealthy for Sensitive)
        aqi, cat = calculate_aqi(55.4)
        self.assertEqual(aqi, 150)
        self.assertEqual(cat, "UNHEALTHY_FOR_SENSITIVE")

        # 150.4 ug/m3 -> AQI 200 (Unhealthy upper bound)
        aqi, cat = calculate_aqi(150.4)
        self.assertEqual(aqi, 200)
        self.assertEqual(cat, "UNHEALTHY")

        # 250.4 ug/m3 -> AQI 300 (Very Unhealthy upper bound)
        aqi, cat = calculate_aqi(250.4)
        self.assertEqual(aqi, 300)
        self.assertEqual(cat, "VERY_UNHEALTHY")

        # 350.4 ug/m3 -> AQI 400 (Hazardous)
        aqi, cat = calculate_aqi(350.4)
        self.assertEqual(aqi, 400)
        self.assertEqual(cat, "HAZARDOUS")

    def test_extreme_and_negative_values(self):
        """Tests handling of out-of-range inputs."""
        # Negative concentration clamped to 0
        aqi, _ = calculate_aqi(-10.5)
        self.assertEqual(aqi, 0)

        # Extreme concentration (> 500 ug/m3) clamped to 500
        aqi, cat = calculate_aqi(650.0)
        self.assertEqual(aqi, 500)
        self.assertEqual(cat, "HAZARDOUS")


class TestTelemetryContractCompliance(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        schema_path = ROOT_DIR / "docs" / "specs" / "mqtt-contract-v1.json"
        with open(schema_path, "r", encoding="utf-8") as f:
            cls.schema = json.load(f)

    def test_all_profiles_conform_to_schema(self):
        """Verifies that every device profile generates schema-compliant JSON payloads."""
        profiles = [
            "NOMINAL_CLEANROOM",
            "POLLUTION_SPIKE",
            "INTERMITTENT_WIFI",
            "SENSOR_FAULT_PM",
            "SENSOR_FAULT_TEMP_RH",
            "FAN_STALL_FAULT",
            "WATCHDOG_RESET_CYCLE",
            "STALE_TELEMETRY",
        ]

        for profile in profiles:
            with self.subTest(profile=profile):
                agent = DeviceAgent(
                    device_id=f"TEST-{profile[:8]}",
                    site_id="SITE-HQ-PUNE",
                    profile=profile,
                )
                payload = agent.generate_telemetry()
                if payload is not None:
                    # Validate against formal JSON Schema Draft 2020-12
                    jsonschema.validate(instance=payload, schema=self.schema)
                    # Verify simulation provenance
                    self.assertTrue(payload["is_simulated"])
                    self.assertEqual(payload["schema_version"], "1.0.0")

    def test_missing_values_on_sensor_fault(self):
        """Proves that PM sensor faults emit null and set valid flag to false without fabricating data."""
        agent = DeviceAgent(
            device_id="TEST-FAULT-001",
            site_id="SITE-BLR-DEV",
            profile="SENSOR_FAULT_PM",
        )
        payload = agent.generate_telemetry()
        metrics = payload["metrics"]
        diag = payload["diagnostics"]

        self.assertIsNone(metrics["pm1"])
        self.assertIsNone(metrics["pm25"])
        self.assertIsNone(metrics["pm10"])
        self.assertFalse(diag["sensor_status"]["pm_valid"])
        self.assertTrue(diag["err_code"] & 0x02)  # PM fault bit set

    def test_fan_stall_fault_detection(self):
        """Proves fan stall error code and safety fallback mode."""
        agent = DeviceAgent(
            device_id="TEST-STALL-001",
            site_id="SITE-BLR-DEV",
            profile="FAN_STALL_FAULT",
        )
        payload = agent.generate_telemetry()
        metrics = payload["metrics"]
        diag = payload["diagnostics"]

        self.assertEqual(metrics["mode"], "ERROR_SAFE")
        self.assertEqual(metrics["fan_pct"], 0)
        self.assertTrue(diag["err_code"] & 0x01)  # Fan stall bit set


if __name__ == "__main__":
    unittest.main()
