package com.sochi.vayu.service;

import com.sochi.vayu.dto.CalculatedMetricsDto;
import com.sochi.vayu.dto.DeviceListItemDto;
import com.sochi.vayu.model.DeviceConnectionState;
import com.sochi.vayu.model.DeviceHealthState;
import com.sochi.vayu.model.DeviceStateSnapshot;
import com.sochi.vayu.model.TelemetryMessage;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Component
public class DeviceDtoMapper {

    private final AqiCalculator aqiCalculator;
    private final int staleThresholdSeconds;

    public DeviceDtoMapper(
            AqiCalculator aqiCalculator,
            @Value("${vayu.telemetry.stale-threshold-seconds:30}") int staleThresholdSeconds) {
        this.aqiCalculator = aqiCalculator;
        this.staleThresholdSeconds = staleThresholdSeconds;
    }

    public DeviceListItemDto toDto(DeviceStateSnapshot snapshot) {
        Instant now = Instant.now();
        Long elapsedSeconds = null;
        if (snapshot.getLastReceivedAt() != null) {
            elapsedSeconds = Duration.between(snapshot.getLastReceivedAt(), now).getSeconds();
        }

        TelemetryMessage t = snapshot.getLatestTelemetry();
        CalculatedMetricsDto metricsDto = null;
        if (t != null && t.metrics() != null) {
            Integer aqi = aqiCalculator.calculateFromPm25(t.metrics().pm25());
            String category = aqiCalculator.getAqiCategory(aqi);

            metricsDto = new CalculatedMetricsDto(
                    t.metrics().pm1(),
                    t.metrics().pm25(),
                    t.metrics().pm10(),
                    t.metrics().vocIndex(),
                    t.metrics().temperatureC(),
                    t.metrics().humidityRh(),
                    aqi,
                    category
            );
        }

        List<String> problems = new ArrayList<>();
        if (snapshot.getConnectionState() == DeviceConnectionState.WAITING_FOR_DATA) {
            problems.add("Awaiting initial telemetry broadcast from purifier");
        } else if (snapshot.getConnectionState() == DeviceConnectionState.OFFLINE) {
            String reason = snapshot.getDisconnectReason() != null ? snapshot.getDisconnectReason() : "UNEXPECTED_DISCONNECT";
            problems.add("Device is disconnected: " + reason);
        } else if (snapshot.getHealthState() == DeviceHealthState.STALE) {
            problems.add("Telemetry data is stale (> " + staleThresholdSeconds + "s without update)");
        }

        if (t != null) {
            if (t.diagnostics() != null) {
                if (!t.diagnostics().pmSensorValid()) {
                    problems.add("Particulate Matter (PM) sensor reports invalid or failed state");
                }
                if (!t.diagnostics().temperatureSensorValid()) {
                    problems.add("Temperature/Humidity sensor reports invalid state");
                }
                if (t.diagnostics().vocSensorValid() != null && !t.diagnostics().vocSensorValid()) {
                    problems.add("VOC sensor reports invalid state");
                }
            }
            if (t.system() != null && t.system().errorCode() != 0) {
                problems.add("Purifier controller reported hardware error code: " + t.system().errorCode());
            }
        }

        return new DeviceListItemDto(
                snapshot.getDeviceId(),
                snapshot.getDeviceName(),
                snapshot.getRoom(),
                snapshot.getConnectionState(),
                snapshot.getHealthState(),
                snapshot.isSimulated(),
                snapshot.getLastTelemetryTimestamp(),
                elapsedSeconds,
                metricsDto,
                t != null ? t.diagnostics() : null,
                t != null ? t.system() : null,
                problems,
                snapshot.getDisconnectReason()
        );
    }
}
