package com.sochi.vayu.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "telemetry_records")
public class TelemetryRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "device_id", nullable = false, length = 64)
    private String deviceId;

    @Column(name = "recorded_at", nullable = false)
    private OffsetDateTime recordedAt;

    @Column(name = "pm1", precision = 6, scale = 2)
    private BigDecimal pm1;

    @Column(name = "pm25", precision = 6, scale = 2)
    private BigDecimal pm25;

    @Column(name = "pm10", precision = 6, scale = 2)
    private BigDecimal pm10;

    @Column(name = "voc")
    private Integer voc;

    @Column(name = "temp_c", precision = 5, scale = 2)
    private BigDecimal tempC;

    @Column(name = "rh", precision = 5, scale = 2)
    private BigDecimal rh;

    @Column(name = "aqi")
    private Integer aqi;

    @Column(name = "aqi_standard", length = 20)
    private String aqiStandard = "US_EPA";

    @Column(name = "fan_pct", nullable = false)
    private Integer fanPct;

    @Column(name = "mode", nullable = false, length = 20)
    private String mode;

    @Column(name = "filter_hours_left", nullable = false)
    private Integer filterHoursLeft;

    @Column(name = "rssi")
    private Integer rssi;

    @Column(name = "err_code", nullable = false)
    private Integer errCode = 0;

    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
    @Column(name = "sensors_valid", columnDefinition = "jsonb")
    private String sensorsValid;

    @Column(name = "is_simulated", nullable = false)
    private boolean simulated = true;

    @Column(name = "ingested_at", nullable = false)
    private OffsetDateTime ingestedAt = OffsetDateTime.now();

    public TelemetryRecord() {}

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getDeviceId() {
        return deviceId;
    }

    public void setDeviceId(String deviceId) {
        this.deviceId = deviceId;
    }

    public OffsetDateTime getRecordedAt() {
        return recordedAt;
    }

    public void setRecordedAt(OffsetDateTime recordedAt) {
        this.recordedAt = recordedAt;
    }

    public BigDecimal getPm1() {
        return pm1;
    }

    public void setPm1(BigDecimal pm1) {
        this.pm1 = pm1;
    }

    public BigDecimal getPm25() {
        return pm25;
    }

    public void setPm25(BigDecimal pm25) {
        this.pm25 = pm25;
    }

    public BigDecimal getPm10() {
        return pm10;
    }

    public void setPm10(BigDecimal pm10) {
        this.pm10 = pm10;
    }

    public Integer getVoc() {
        return voc;
    }

    public void setVoc(Integer voc) {
        this.voc = voc;
    }

    public BigDecimal getTempC() {
        return tempC;
    }

    public void setTempC(BigDecimal tempC) {
        this.tempC = tempC;
    }

    public BigDecimal getRh() {
        return rh;
    }

    public void setRh(BigDecimal rh) {
        this.rh = rh;
    }

    public Integer getAqi() {
        return aqi;
    }

    public void setAqi(Integer aqi) {
        this.aqi = aqi;
    }

    public String getAqiStandard() {
        return aqiStandard;
    }

    public void setAqiStandard(String aqiStandard) {
        this.aqiStandard = aqiStandard;
    }

    public Integer getFanPct() {
        return fanPct;
    }

    public void setFanPct(Integer fanPct) {
        this.fanPct = fanPct;
    }

    public String getMode() {
        return mode;
    }

    public void setMode(String mode) {
        this.mode = mode;
    }

    public Integer getFilterHoursLeft() {
        return filterHoursLeft;
    }

    public void setFilterHoursLeft(Integer filterHoursLeft) {
        this.filterHoursLeft = filterHoursLeft;
    }

    public Integer getRssi() {
        return rssi;
    }

    public void setRssi(Integer rssi) {
        this.rssi = rssi;
    }

    public Integer getErrCode() {
        return errCode;
    }

    public void setErrCode(Integer errCode) {
        this.errCode = errCode;
    }

    public String getSensorsValid() {
        return sensorsValid;
    }

    public void setSensorsValid(String sensorsValid) {
        this.sensorsValid = sensorsValid;
    }

    public boolean isSimulated() {
        return simulated;
    }

    public void setSimulated(boolean simulated) {
        this.simulated = simulated;
    }

    public OffsetDateTime getIngestedAt() {
        return ingestedAt;
    }

    public void setIngestedAt(OffsetDateTime ingestedAt) {
        this.ingestedAt = ingestedAt;
    }
}
