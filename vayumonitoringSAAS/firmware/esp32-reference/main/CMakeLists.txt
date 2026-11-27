idf_component_register(
    SRCS "main.c" "vayu_mqtt_telemetry.c"
    INCLUDE_DIRS "."
    REQUIRES mqtt json nvs_flash esp_netif esp_event lwip
)
