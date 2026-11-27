package com.sochi.vayu.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;

public record TelemetryMessage(
        @JsonProperty("schema_version") String schemaVersion,
        @JsonProperty("device_id") String deviceId,
        @JsonProperty("timestamp") Instant timestamp,
        @JsonProperty("is_simulated") boolean isSimulated,
        @JsonProperty("metrics") TelemetryMetrics metrics,
        @JsonProperty("diagnostics") TelemetryDiagnostics diagnostics,
        @JsonProperty("system") TelemetrySystem system
) {}
