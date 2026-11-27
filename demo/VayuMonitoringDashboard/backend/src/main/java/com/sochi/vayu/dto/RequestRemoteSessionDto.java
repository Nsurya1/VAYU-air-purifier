package com.sochi.vayu.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class RequestRemoteSessionDto {

    @NotBlank(message = "targetSiteId is required")
    private String targetSiteId;

    @NotBlank(message = "reason is required")
    private String reason;

    @NotNull(message = "durationMinutes is required")
    @Min(value = 5, message = "Minimum session duration is 5 minutes")
    @Max(value = 60, message = "Maximum session duration is 60 minutes")
    private Integer durationMinutes = 30;

    public String getTargetSiteId() { return targetSiteId; }
    public void setTargetSiteId(String targetSiteId) { this.targetSiteId = targetSiteId; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public Integer getDurationMinutes() { return durationMinutes; }
    public void setDurationMinutes(Integer durationMinutes) { this.durationMinutes = durationMinutes; }
}
