package com.sochi.vayu.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

@JsonIgnoreProperties(ignoreUnknown = true)
public class TelemetryPayloadDto {

    @NotBlank(message = "schema_version is required")
    @JsonProperty("schema_version")
    private String schemaVersion;

    @NotBlank(message = "device_id is required")
    @Pattern(regexp = "^[A-Za-z0-9_-]{3,64}$", message = "device_id format is invalid")
    @JsonProperty("device_id")
    private String deviceId;

    @NotNull(message = "timestamp is required")
    @JsonProperty("timestamp")
    private OffsetDateTime timestamp;

    @NotNull(message = "is_simulated flag is required")
    @JsonProperty("is_simulated")
    private Boolean simulated;

    @NotNull(message = "metrics object is required")
    @Valid
    @JsonProperty("metrics")
    private MetricsDto metrics;

    @NotNull(message = "diagnostics object is required")
    @Valid
    @JsonProperty("diagnostics")
    private DiagnosticsDto diagnostics;

    public static class MetricsDto {
        @DecimalMin(value = "0.0", message = "pm1 cannot be negative")
        @DecimalMax(value = "1000.0", message = "pm1 exceeds physical upper bound")
        private BigDecimal pm1;

        @DecimalMin(value = "0.0", message = "pm25 cannot be negative")
        @DecimalMax(value = "1000.0", message = "pm25 exceeds physical upper bound")
        private BigDecimal pm25;

        @DecimalMin(value = "0.0", message = "pm10 cannot be negative")
        @DecimalMax(value = "2000.0", message = "pm10 exceeds physical upper bound")
        private BigDecimal pm10;

        @Min(0)
        @Max(1000)
        private Integer voc;

        @DecimalMin(value = "-20.0", message = "temp_c below minimum")
        @DecimalMax(value = "80.0", message = "temp_c above maximum")
        @JsonProperty("temp_c")
        private BigDecimal tempC;

        @DecimalMin(value = "0.0", message = "rh below minimum")
        @DecimalMax(value = "100.0", message = "rh above maximum")
        private BigDecimal rh;

        @Min(0)
        @Max(500)
        private Integer aqi;

        @JsonProperty("aqi_standard")
        private String aqiStandard;

        @NotNull(message = "fan_pct is required")
        @Min(value = 0, message = "fan_pct minimum is 0")
        @Max(value = 100, message = "fan_pct maximum is 100")
        @JsonProperty("fan_pct")
        private Integer fanPct;

        @NotBlank(message = "mode is required")
        private String mode;

        @NotNull(message = "filter_hours_left is required")
        @Min(0)
        @JsonProperty("filter_hours_left")
        private Integer filterHoursLeft;

        @Min(-120)
        @Max(0)
        private Integer rssi;

        public BigDecimal getPm1() { return pm1; }
        public void setPm1(BigDecimal pm1) { this.pm1 = pm1; }
        public BigDecimal getPm25() { return pm25; }
        public void setPm25(BigDecimal pm25) { this.pm25 = pm25; }
        public BigDecimal getPm10() { return pm10; }
        public void setPm10(BigDecimal pm10) { this.pm10 = pm10; }
        public Integer getVoc() { return voc; }
        public void setVoc(Integer voc) { this.voc = voc; }
        public BigDecimal getTempC() { return tempC; }
        public void setTempC(BigDecimal tempC) { this.tempC = tempC; }
        public BigDecimal getRh() { return rh; }
        public void setRh(BigDecimal rh) { this.rh = rh; }
        public Integer getAqi() { return aqi; }
        public void setAqi(Integer aqi) { this.aqi = aqi; }
        public String getAqiStandard() { return aqiStandard; }
        public void setAqiStandard(String aqiStandard) { this.aqiStandard = aqiStandard; }
        public Integer getFanPct() { return fanPct; }
        public void setFanPct(Integer fanPct) { this.fanPct = fanPct; }
        public String getMode() { return mode; }
        public void setMode(String mode) { this.mode = mode; }
        public Integer getFilterHoursLeft() { return filterHoursLeft; }
        public void setFilterHoursLeft(Integer filterHoursLeft) { this.filterHoursLeft = filterHoursLeft; }
        public Integer getRssi() { return rssi; }
        public void setRssi(Integer rssi) { this.rssi = rssi; }
    }

    public static class DiagnosticsDto {
        @NotBlank(message = "fw_build_id is required")
        @JsonProperty("fw_build_id")
        private String fwBuildId;

        @NotNull(message = "uptime_seconds is required")
        @Min(0)
        @JsonProperty("uptime_seconds")
        private Long uptimeSeconds;

        @NotNull(message = "err_code is required")
        @JsonProperty("err_code")
        private Integer errCode;

        @JsonProperty("sensor_status")
        private SensorStatusDto sensorStatus;

        public String getFwBuildId() { return fwBuildId; }
        public void setFwBuildId(String fwBuildId) { this.fwBuildId = fwBuildId; }
        public Long getUptimeSeconds() { return uptimeSeconds; }
        public void setUptimeSeconds(Long uptimeSeconds) { this.uptimeSeconds = uptimeSeconds; }
        public Integer getErrCode() { return errCode; }
        public void setErrCode(Integer errCode) { this.errCode = errCode; }
        public SensorStatusDto getSensorStatus() { return sensorStatus; }
        public void setSensorStatus(SensorStatusDto sensorStatus) { this.sensorStatus = sensorStatus; }
    }

    public static class SensorStatusDto {
        @JsonProperty("pm_valid")
        private Boolean pmValid;
        @JsonProperty("voc_valid")
        private Boolean vocValid;
        @JsonProperty("temp_rh_valid")
        private Boolean tempRhValid;

        public Boolean getPmValid() { return pmValid; }
        public void setPmValid(Boolean pmValid) { this.pmValid = pmValid; }
        public Boolean getVocValid() { return vocValid; }
        public void setVocValid(Boolean vocValid) { this.vocValid = vocValid; }
        public Boolean getTempRhValid() { return tempRhValid; }
        public void setTempRhValid(Boolean tempRhValid) { this.tempRhValid = tempRhValid; }
    }

    public String getSchemaVersion() { return schemaVersion; }
    public void setSchemaVersion(String schemaVersion) { this.schemaVersion = schemaVersion; }
    public String getDeviceId() { return deviceId; }
    public void setDeviceId(String deviceId) { this.deviceId = deviceId; }
    public OffsetDateTime getTimestamp() { return timestamp; }
    public void setTimestamp(OffsetDateTime timestamp) { this.timestamp = timestamp; }
    public Boolean getSimulated() { return simulated; }
    public void setSimulated(Boolean simulated) { this.simulated = simulated; }
    public MetricsDto getMetrics() { return metrics; }
    public void setMetrics(MetricsDto metrics) { this.metrics = metrics; }
    public DiagnosticsDto getDiagnostics() { return diagnostics; }
    public void setDiagnostics(DiagnosticsDto diagnostics) { this.diagnostics = diagnostics; }
}
