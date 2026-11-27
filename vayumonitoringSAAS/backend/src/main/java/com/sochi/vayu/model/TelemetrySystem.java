package com.sochi.vayu.model;

import com.fasterxml.jackson.annotation.JsonProperty;

public record TelemetrySystem(
        @JsonProperty("firmware_version") String firmwareVersion,
        @JsonProperty("error_code") int errorCode,
        @JsonProperty("operating_mode") String operatingMode
) {}
