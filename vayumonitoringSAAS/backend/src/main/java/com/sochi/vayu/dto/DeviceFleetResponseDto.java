package com.sochi.vayu.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.List;

public record DeviceFleetResponseDto(
        @JsonProperty("site_name") String siteName,
        @JsonProperty("timestamp") Instant timestamp,
        @JsonProperty("summary") DeviceSummaryDto summary,
        @JsonProperty("devices") List<DeviceListItemDto> devices
) {}
