# ==============================================================================
# SOCHI VAYU - Main Component CMake Definition
# ==============================================================================
idf_component_register(
    SRCS
        "app_main.c"
        "safety_controller.c"
        "telemetry_buffer.c"
        "telemetry_builder.c"
        "hal/hal_fan.c"
        "hal/hal_sensors.c"
        "net/wifi_manager.c"
        "net/mqtt_client_service.c"
    INCLUDE_DIRS
        "."
        "hal"
        "net"
    REQUIRES
        nvs_flash
        esp_wifi
        esp_event
        esp_netif
        mqtt
        json
        driver
        esp_timer
        freertos
)
