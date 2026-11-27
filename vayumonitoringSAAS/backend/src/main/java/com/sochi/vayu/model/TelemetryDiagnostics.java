package com.sochi.vayu.model;

import com.fasterxml.jackson.annotation.JsonProperty;

public record TelemetryDiagnostics(
        @JsonProperty("pm_sensor_valid") boolean pmSensorValid,
        @JsonProperty("temperature_sensor_valid") boolean temperatureSensorValid,
        @JsonProperty("voc_sensor_valid") Boolean vocSensorValid
) {}
