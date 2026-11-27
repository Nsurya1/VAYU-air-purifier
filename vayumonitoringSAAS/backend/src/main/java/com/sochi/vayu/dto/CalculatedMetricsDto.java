package com.sochi.vayu.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record CalculatedMetricsDto(
        @JsonProperty("pm1") Double pm1,
        @JsonProperty("pm25") Double pm25,
        @JsonProperty("pm10") Double pm10,
        @JsonProperty("voc_index") Integer vocIndex,
        @JsonProperty("temperature_c") Double temperatureC,
        @JsonProperty("humidity_rh") Double humidityRh,
        @JsonProperty("calculated_aqi") Integer calculatedAqi,
        @JsonProperty("aqi_category") String aqiCategory
) {}
