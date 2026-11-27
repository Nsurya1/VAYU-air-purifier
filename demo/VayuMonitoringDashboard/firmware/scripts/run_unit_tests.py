#!/usr/bin/env python3
"""
SOCHI VAYU - Host-Based Firmware Unit & Integration Test Runner
Compiles and executes C firmware unit tests inside a lightweight container.
"""

import subprocess
import sys
import os

def main():
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    print("==================================================================")
    print("   SOCHI VAYU - Compiling & Running ESP32 Firmware Test Suites    ")
    print("==================================================================")
    print(f"Workspace root: {repo_root}")

    # Docker command to compile with gcc and execute inside alpine
    docker_cmd = [
        "docker", "run", "--rm",
        "-v", f"{repo_root}:/workspace",
        "-w", "/workspace/firmware",
        "alpine:latest",
        "sh", "-c",
        (
            "apk add --no-cache gcc musl-dev > /dev/null 2>&1 && "
            "echo '[*] Suite 1: Safety Controller & Interlocks...' && "
            "gcc -DVAYU_TEST_HOST -Wall -Wextra -Iesp32-vayu-node/main -Iesp32-vayu-node/main/hal -Iesp32-vayu-node/main/net -Iesp32-vayu-node/main/ota "
            "esp32-vayu-node/main/safety_controller.c "
            "esp32-vayu-node/main/hal/hal_fan.c "
            "esp32-vayu-node/main/hal/hal_sensors.c "
            "tests/test_safety_controller.c -lm -o /tmp/test_safety && "
            "/tmp/test_safety && "
            "echo '' && "
            "echo '[*] Suite 2: Bounded Offline Ring Buffer & Telemetry Builder...' && "
            "gcc -DVAYU_TEST_HOST -Wall -Wextra -Iesp32-vayu-node/main -Iesp32-vayu-node/main/hal -Iesp32-vayu-node/main/net -Iesp32-vayu-node/main/ota "
            "esp32-vayu-node/main/telemetry_buffer.c "
            "esp32-vayu-node/main/telemetry_builder.c "
            "tests/test_telemetry_buffer_and_builder.c -lm -o /tmp/test_buffer && "
            "/tmp/test_buffer && "
            "echo '' && "
            "echo '[*] Suite 3: End-to-End Firmware Integration & Offline Recovery...' && "
            "gcc -DVAYU_TEST_HOST -Wall -Wextra -Iesp32-vayu-node/main -Iesp32-vayu-node/main/hal -Iesp32-vayu-node/main/net -Iesp32-vayu-node/main/ota "
            "esp32-vayu-node/main/safety_controller.c "
            "esp32-vayu-node/main/telemetry_buffer.c "
            "esp32-vayu-node/main/telemetry_builder.c "
            "esp32-vayu-node/main/net/wifi_manager.c "
            "esp32-vayu-node/main/net/mqtt_client_service.c "
            "tests/test_firmware_integration.c -lm -o /tmp/test_integ && "
            "/tmp/test_integ && "
            "echo '' && "
            "echo '[*] Suite 4: Two-Partition OTA & Bootloader Rollback Engine...' && "
            "gcc -DVAYU_TEST_HOST -Wall -Wextra -Iesp32-vayu-node/main -Iesp32-vayu-node/main/hal -Iesp32-vayu-node/main/net -Iesp32-vayu-node/main/ota "
            "esp32-vayu-node/main/ota/ota_manager.c "
            "tests/test_ota_manager.c -lm -o /tmp/test_ota && "
            "/tmp/test_ota"
        )
    ]

    try:
        res = subprocess.run(docker_cmd, capture_output=False, check=True)
        sys.exit(res.returncode)
    except subprocess.CalledProcessError as e:
        print(f"\n[ERROR] Test run failed with return code: {e.returncode}")
        sys.exit(e.returncode)
    except Exception as e:
        print(f"\n[ERROR] Execution error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
