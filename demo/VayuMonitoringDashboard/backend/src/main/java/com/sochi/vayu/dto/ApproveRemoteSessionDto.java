package com.sochi.vayu.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public class ApproveRemoteSessionDto {

    @Min(value = 5, message = "Minimum duration is 5 minutes")
    @Max(value = 60, message = "Maximum duration is 60 minutes")
    private Integer durationMinutes;

    public Integer getDurationMinutes() { return durationMinutes; }
    public void setDurationMinutes(Integer durationMinutes) { this.durationMinutes = durationMinutes; }
}
