package com.sochi.vayu.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record DeviceSummaryDto(
        @JsonProperty("total_devices") int totalDevices,
        @JsonProperty("online_devices") int onlineDevices,
        @JsonProperty("offline_devices") int offlineDevices,
        @JsonProperty("stale_devices") int staleDevices,
        @JsonProperty("fault_devices") int faultDevices
) {}
