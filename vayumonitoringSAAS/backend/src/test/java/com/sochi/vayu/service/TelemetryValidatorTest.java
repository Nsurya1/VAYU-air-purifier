package com.sochi.vayu.service;

import com.sochi.vayu.model.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TelemetryValidatorTest {

    private TelemetryValidator validator;

    @BeforeEach
    void setUp() {
        validator = new TelemetryValidator();
    }

    private TelemetryMessage createSampleMessage(
            String schemaVersion,
            String deviceId,
            Instant timestamp,
            boolean pmValid,
            Double pm25,
            boolean tempValid,
            Double temp) {

        TelemetryMetrics metrics = new TelemetryMetrics(
                pmValid ? 5.0 : null,
                pm25,
                pmValid ? 20.0 : null,
                80,
                temp,
                tempValid ? 50.0 : null
        );

        TelemetryDiagnostics diag = new TelemetryDiagnostics(pmValid, tempValid, true);
        TelemetrySystem sys = new TelemetrySystem("1.0.0", 0, "AUTO");

        return new TelemetryMessage(
                schemaVersion,
                deviceId,
                timestamp,
                false,
                metrics,
                diag,
                sys
        );
    }

    @Test
    @DisplayName("Valid telemetry payload passes validation")
    void validTelemetryPasses() {
        TelemetryMessage msg = createSampleMessage(
                "1.0.0", "VAYU-001", Instant.now(), true, 12.5, true, 23.5
        );
        TelemetryValidator.ValidationResult result = validator.validate(msg);
        assertTrue(result.valid(), "Expected validation to succeed: " + result.errorMessage());
    }

    @Test
    @DisplayName("Invalid schema version is rejected")
    void invalidSchemaVersionRejected() {
        TelemetryMessage msg = createSampleMessage(
                "2.0.0", "VAYU-001", Instant.now(), true, 12.5, true, 23.5
        );
        TelemetryValidator.ValidationResult result = validator.validate(msg);
        assertFalse(result.valid());
        assertTrue(result.errorMessage().contains("Unsupported schema_version"));
    }

    @Test
    @DisplayName("Malformed device ID is rejected")
    void malformedDeviceIdRejected() {
        TelemetryMessage msg = createSampleMessage(
                "1.0.0", "invalid device #1", Instant.now(), true, 12.5, true, 23.5
        );
        TelemetryValidator.ValidationResult result = validator.validate(msg);
        assertFalse(result.valid());
        assertTrue(result.errorMessage().contains("Invalid device_id"));
    }

    @Test
    @DisplayName("Grossly skewed future timestamp is rejected")
    void futureTimestampRejected() {
        Instant farFuture = Instant.now().plus(2, ChronoUnit.HOURS);
        TelemetryMessage msg = createSampleMessage(
                "1.0.0", "VAYU-001", farFuture, true, 12.5, true, 23.5
        );
        TelemetryValidator.ValidationResult result = validator.validate(msg);
        assertFalse(result.valid());
        assertTrue(result.errorMessage().contains("skewed into the future"));
    }

    @Test
    @DisplayName("PM sensor valid with null metric is rejected")
    void pmValidWithNullValueRejected() {
        TelemetryMessage msg = createSampleMessage(
                "1.0.0", "VAYU-001", Instant.now(), true, null, true, 23.5
        );
        TelemetryValidator.ValidationResult result = validator.validate(msg);
        assertFalse(result.valid());
        assertTrue(result.errorMessage().contains("pm_sensor_valid is true but PM values are null"));
    }

    @Test
    @DisplayName("Sensor faulted with explicit null metric passes validation (no fabrication rule)")
    void sensorFaultWithExplicitNullPasses() {
        TelemetryMessage msg = createSampleMessage(
                "1.0.0", "VAYU-001", Instant.now(), false, null, true, 23.5
        );
        TelemetryValidator.ValidationResult result = validator.validate(msg);
        assertTrue(result.valid(), "Sensor fault with explicit nulls must be accepted");
    }

    @Test
    @DisplayName("Out-of-bounds physical metrics (>1000 µg/m³) are rejected")
    void outOfBoundsMetricsRejected() {
        TelemetryMessage msg = createSampleMessage(
                "1.0.0", "VAYU-001", Instant.now(), true, 1500.0, true, 23.5
        );
        TelemetryValidator.ValidationResult result = validator.validate(msg);
        assertFalse(result.valid());
        assertTrue(result.errorMessage().contains("out of physical sensor bounds"));
    }
}
