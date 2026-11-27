package com.sochi.vayu.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.sochi.vayu.model.DeviceConnectionState;
import com.sochi.vayu.model.DeviceHealthState;
import com.sochi.vayu.model.TelemetryDiagnostics;
import com.sochi.vayu.model.TelemetrySystem;

import java.time.Instant;
import java.util.List;

public record DeviceListItemDto(
        @JsonProperty("device_id") String deviceId,
        @JsonProperty("name") String name,
        @JsonProperty("room") String room,
        @JsonProperty("connection_state") DeviceConnectionState connectionState,
        @JsonProperty("health_state") DeviceHealthState healthState,
        @JsonProperty("is_simulated") boolean isSimulated,
        @JsonProperty("last_seen_at") Instant lastSeenAt,
        @JsonProperty("elapsed_seconds_since_telemetry") Long elapsedSecondsSinceTelemetry,
        @JsonProperty("metrics") CalculatedMetricsDto metrics,
        @JsonProperty("diagnostics") TelemetryDiagnostics diagnostics,
        @JsonProperty("system") TelemetrySystem system,
        @JsonProperty("problems") List<String> problems,
        @JsonProperty("disconnect_reason") String disconnectReason
) {}
