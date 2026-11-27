package com.sochi.vayu.model;

import com.fasterxml.jackson.annotation.JsonProperty;

public record TelemetryMetrics(
        @JsonProperty("pm1") Double pm1,
        @JsonProperty("pm25") Double pm25,
        @JsonProperty("pm10") Double pm10,
        @JsonProperty("voc_index") Integer vocIndex,
        @JsonProperty("temperature_c") Double temperatureC,
        @JsonProperty("humidity_rh") Double humidityRh
) {}
