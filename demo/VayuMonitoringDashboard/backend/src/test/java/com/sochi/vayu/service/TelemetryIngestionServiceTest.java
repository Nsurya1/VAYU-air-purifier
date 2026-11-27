package com.sochi.vayu.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.sochi.vayu.domain.Device;
import com.sochi.vayu.domain.TelemetryRecord;
import com.sochi.vayu.repository.DeviceEventRepository;
import com.sochi.vayu.repository.DeviceRepository;
import com.sochi.vayu.repository.TelemetryRecordRepository;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class TelemetryIngestionServiceTest {

    private ObjectMapper objectMapper;
    private Validator validator;
    private DeviceRepository deviceRepository;
    private TelemetryRecordRepository telemetryRecordRepository;
    private DeviceEventRepository deviceEventRepository;
    private TelemetryIngestionService service;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());
        validator = Validation.buildDefaultValidatorFactory().getValidator();

        deviceRepository = mock(DeviceRepository.class);
        telemetryRecordRepository = mock(TelemetryRecordRepository.class);
        deviceEventRepository = mock(DeviceEventRepository.class);
        DiagnosticRuleEngine diagnosticRuleEngine = mock(DiagnosticRuleEngine.class);

        service = new TelemetryIngestionService(
                objectMapper,
                validator,
                deviceRepository,
                telemetryRecordRepository,
                deviceEventRepository,
                diagnosticRuleEngine
        );
    }

    @Test
    @DisplayName("Should successfully validate and ingest nominal telemetry payload")
    void testIngestNominalTelemetry() {
        String json = """
        {
          "schema_version": "1.0.0",
          "device_id": "VAYU-DEV-001",
          "timestamp": "2026-10-22T08:00:00.000Z",
          "is_simulated": true,
          "metrics": {
            "pm1": 6.2,
            "pm25": 11.5,
            "pm10": 19.8,
            "voc": 95,
            "temp_c": 23.4,
            "rh": 50.1,
            "aqi": 48,
            "aqi_standard": "US_EPA",
            "fan_pct": 35,
            "mode": "AUTO",
            "filter_hours_left": 4100,
            "rssi": -58
          },
          "diagnostics": {
            "fw_build_id": "v1.0.0-rc1",
            "uptime_seconds": 3600,
            "err_code": 0,
            "sensor_status": {
              "pm_valid": true,
              "voc_valid": true,
              "temp_rh_valid": true
            }
          }
        }
        """;

        Device existingDevice = new Device("VAYU-DEV-001", "SITE-HQ-PUNE", true);
        when(deviceRepository.findById("VAYU-DEV-001")).thenReturn(Optional.of(existingDevice));

        service.ingestTelemetry(json);

        // Verify device updated to ONLINE
        assertEquals("ONLINE", existingDevice.getOnlineStatus());
        verify(deviceRepository, times(1)).save(existingDevice);

        // Verify telemetry record saved with exact numbers
        ArgumentCaptor<TelemetryRecord> recordCaptor = ArgumentCaptor.forClass(TelemetryRecord.class);
        verify(telemetryRecordRepository, times(1)).save(recordCaptor.capture());
        TelemetryRecord saved = recordCaptor.getValue();

        assertEquals("VAYU-DEV-001", saved.getDeviceId());
        assertEquals(new BigDecimal("11.5"), saved.getPm25());
        assertEquals(48, saved.getAqi());
        assertEquals(35, saved.getFanPct());
        assertTrue(saved.isSimulated());
    }

    @Test
    @DisplayName("Should reject payload when fan_pct exceeds boundary constraints")
    void testRejectInvalidFanPercentage() {
        String invalidJson = """
        {
          "schema_version": "1.0.0",
          "device_id": "VAYU-DEV-002",
          "timestamp": "2026-10-22T08:00:00.000Z",
          "is_simulated": true,
          "metrics": {
            "pm25": 15.0,
            "aqi": 50,
            "fan_pct": 150,
            "mode": "AUTO",
            "filter_hours_left": 4000,
            "rssi": -60
          },
          "diagnostics": {
            "fw_build_id": "v1.0.0",
            "uptime_seconds": 120,
            "err_code": 0
          }
        }
        """;

        service.ingestTelemetry(invalidJson);

        // Should not save to database
        verify(telemetryRecordRepository, never()).save(any());
        verify(deviceRepository, never()).save(any());
    }

    @Test
    @DisplayName("Should accept missing PM sensor readings without fabricating values")
    void testHandleSensorFaultNullValues() {
        String sensorFaultJson = """
        {
          "schema_version": "1.0.0",
          "device_id": "VAYU-DEV-021",
          "timestamp": "2026-10-22T08:00:00.000Z",
          "is_simulated": true,
          "metrics": {
            "pm1": null,
            "pm25": null,
            "pm10": null,
            "voc": 110,
            "temp_c": 24.0,
            "rh": 50.0,
            "aqi": null,
            "aqi_standard": "US_EPA",
            "fan_pct": 50,
            "mode": "AUTO",
            "filter_hours_left": 3800,
            "rssi": -65
          },
          "diagnostics": {
            "fw_build_id": "v1.0.0-rc1",
            "uptime_seconds": 5400,
            "err_code": 2,
            "sensor_status": {
              "pm_valid": false,
              "voc_valid": true,
              "temp_rh_valid": true
            }
          }
        }
        """;

        when(deviceRepository.findById("VAYU-DEV-021")).thenReturn(Optional.of(new Device("VAYU-DEV-021", "SITE-BLR-DEV", true)));

        service.ingestTelemetry(sensorFaultJson);

        ArgumentCaptor<TelemetryRecord> recordCaptor = ArgumentCaptor.forClass(TelemetryRecord.class);
        verify(telemetryRecordRepository, times(1)).save(recordCaptor.capture());
        TelemetryRecord saved = recordCaptor.getValue();

        assertNull(saved.getPm25());
        assertNull(saved.getAqi());
        assertEquals(2, saved.getErrCode());
        assertTrue(saved.getSensorsValid().contains("\"pm_valid\":false"));
    }

    @Test
    @DisplayName("Should record critical event when fan stall bit is detected")
    void testDetectFanStallCriticalEvent() {
        String fanStallJson = """
        {
          "schema_version": "1.0.0",
          "device_id": "VAYU-DEV-025",
          "timestamp": "2026-10-22T08:00:00.000Z",
          "is_simulated": true,
          "metrics": {
            "pm25": 28.0,
            "aqi": 84,
            "fan_pct": 0,
            "mode": "ERROR_SAFE",
            "filter_hours_left": 3500,
            "rssi": -60
          },
          "diagnostics": {
            "fw_build_id": "v1.0.0-rc1",
            "uptime_seconds": 600,
            "err_code": 1
          }
        }
        """;

        when(deviceRepository.findById("VAYU-DEV-025")).thenReturn(Optional.of(new Device("VAYU-DEV-025", "SITE-BLR-DEV", true)));

        service.ingestTelemetry(fanStallJson);

        verify(deviceEventRepository, times(1)).save(any());
    }
}
