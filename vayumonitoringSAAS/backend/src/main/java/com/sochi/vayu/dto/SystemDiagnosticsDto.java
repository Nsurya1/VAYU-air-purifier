package com.sochi.vayu.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;

public record SystemDiagnosticsDto(
        @JsonProperty("site_name") String siteName,
        @JsonProperty("timestamp") Instant timestamp,
        @JsonProperty("mqtt_broker_connected") boolean mqttBrokerConnected,
        @JsonProperty("total_configured_devices") int totalConfiguredDevices,
        @JsonProperty("online_devices") int onlineDevices,
        @JsonProperty("offline_devices") int offlineDevices,
        @JsonProperty("stale_devices") int staleDevices,
        @JsonProperty("sensor_fault_devices") int sensorFaultDevices,
        @JsonProperty("jvm_used_memory_mb") long jvmUsedMemoryMb,
        @JsonProperty("jvm_total_memory_mb") long jvmTotalMemoryMb,
        @JsonProperty("active_sse_clients") int activeSseClients
) {}
