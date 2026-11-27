package com.sochi.vayu.model;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.time.Instant;

public record DeviceStatusMessage(
        @JsonProperty("schema_version") String schemaVersion,
        @JsonProperty("device_id") String deviceId,
        @JsonProperty("status") @JsonAlias("state") String status,
        @JsonProperty("timestamp") Instant timestamp,
        @JsonProperty("reason") String reason,
        @JsonProperty("firmware_version") String firmwareVersion,
        @JsonProperty("room") String room,
        @JsonProperty("is_simulated") boolean isSimulated
) {}
