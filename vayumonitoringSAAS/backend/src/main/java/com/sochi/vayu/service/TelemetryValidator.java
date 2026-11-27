package com.sochi.vayu.service;

import com.sochi.vayu.model.TelemetryMessage;
import com.sochi.vayu.model.TelemetryMetrics;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.regex.Pattern;

@Component
public class TelemetryValidator {

    private static final String SUPPORTED_SCHEMA_VERSION = "1.0.0";
    private static final Pattern DEVICE_ID_PATTERN = Pattern.compile("^[A-Za-z0-9_-]{3,32}$");
    private static final Duration MAX_FUTURE_SKEW = Duration.ofMinutes(5);
    private static final Duration MAX_PAST_SKEW = Duration.ofDays(1);

    public record ValidationResult(boolean valid, String errorMessage) {
        public static ValidationResult success() {
            return new ValidationResult(true, null);
        }

        public static ValidationResult fail(String msg) {
            return new ValidationResult(false, msg);
        }
    }

    public ValidationResult validate(TelemetryMessage message) {
        if (message == null) {
            return ValidationResult.fail("Payload is null");
        }

        // 1. Schema version check
        if (!SUPPORTED_SCHEMA_VERSION.equals(message.schemaVersion())) {
            return ValidationResult.fail("Unsupported schema_version: " + message.schemaVersion() + " (Expected: " + SUPPORTED_SCHEMA_VERSION + ")");
        }

        // 2. Device ID format check
        if (message.deviceId() == null || !DEVICE_ID_PATTERN.matcher(message.deviceId()).matches()) {
            return ValidationResult.fail("Invalid device_id format: " + message.deviceId());
        }

        // 3. Timestamp check
        if (message.timestamp() == null) {
            return ValidationResult.fail("Missing required timestamp");
        }
        Instant now = Instant.now();
        if (message.timestamp().isAfter(now.plus(MAX_FUTURE_SKEW))) {
            return ValidationResult.fail("Timestamp is skewed into the future: " + message.timestamp() + " (current backend time: " + now + ")");
        }
        if (message.timestamp().isBefore(now.minus(MAX_PAST_SKEW))) {
            return ValidationResult.fail("Timestamp is excessively old: " + message.timestamp());
        }

        // 4. Sub-objects presence
        if (message.metrics() == null) {
            return ValidationResult.fail("Missing required metrics block");
        }
        if (message.diagnostics() == null) {
            return ValidationResult.fail("Missing required diagnostics block");
        }
        if (message.system() == null) {
            return ValidationResult.fail("Missing required system block");
        }

        TelemetryMetrics m = message.metrics();

        // 5. Sensor consistency and range validations
        if (message.diagnostics().pmSensorValid()) {
            if (m.pm1() == null || m.pm25() == null || m.pm10() == null) {
                return ValidationResult.fail("pm_sensor_valid is true but PM values are null");
            }
            if (m.pm1() < 0.0 || m.pm1() > 1000.0 || m.pm25() < 0.0 || m.pm25() > 1000.0 || m.pm10() < 0.0 || m.pm10() > 1000.0) {
                return ValidationResult.fail("PM values out of physical sensor bounds (0-1000 µg/m³)");
            }
        }

        if (message.diagnostics().temperatureSensorValid()) {
            if (m.temperatureC() == null || m.humidityRh() == null) {
                return ValidationResult.fail("temperature_sensor_valid is true but temp/humidity values are null");
            }
            if (m.temperatureC() < -20.0 || m.temperatureC() > 70.0) {
                return ValidationResult.fail("Temperature value out of operational range (-20 to 70 °C): " + m.temperatureC());
            }
            if (m.humidityRh() < 0.0 || m.humidityRh() > 100.0) {
                return ValidationResult.fail("Humidity value out of physical range (0-100 %RH): " + m.humidityRh());
            }
        }

        if (m.vocIndex() != null && (m.vocIndex() < 1 || m.vocIndex() > 500)) {
            return ValidationResult.fail("VOC Index out of standard range (1-500): " + m.vocIndex());
        }

        return ValidationResult.success();
    }
}
