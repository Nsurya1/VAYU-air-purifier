package com.sochi.vayu.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.sochi.vayu.domain.Device;
import com.sochi.vayu.domain.Incident;
import com.sochi.vayu.domain.TelemetryRecord;
import com.sochi.vayu.dto.DeviceStatusPayloadDto;
import com.sochi.vayu.dto.TelemetryPayloadDto;
import com.sochi.vayu.repository.IncidentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class DiagnosticRuleEngineTest {

    private IncidentRepository incidentRepository;
    private AuditLogService auditLogService;
    private ObjectMapper objectMapper;
    private DiagnosticRuleEngine ruleEngine;

    @BeforeEach
    void setUp() {
        incidentRepository = mock(IncidentRepository.class);
        auditLogService = mock(AuditLogService.class);
        objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule());

        ruleEngine = new DiagnosticRuleEngine(incidentRepository, auditLogService, objectMapper);
    }

    private TelemetryPayloadDto createBaselinePayload(String deviceId) {
        TelemetryPayloadDto payload = new TelemetryPayloadDto();
        payload.setDeviceId(deviceId);
        payload.setSchemaVersion("1.0.0");
        payload.setTimestamp(OffsetDateTime.now());
        payload.setSimulated(true);

        TelemetryPayloadDto.MetricsDto m = new TelemetryPayloadDto.MetricsDto();
        m.setPm1(BigDecimal.valueOf(8.0));
        m.setPm25(BigDecimal.valueOf(15.0));
        m.setPm10(BigDecimal.valueOf(25.0));
        m.setVoc(50);
        m.setTempC(BigDecimal.valueOf(24.5));
        m.setRh(BigDecimal.valueOf(45.0));
        m.setAqi(52);
        m.setAqiStandard("US-EPA");
        m.setFanPct(50);
        m.setMode("AUTO");
        m.setFilterHoursLeft(2000);
        m.setRssi(-65);
        payload.setMetrics(m);

        TelemetryPayloadDto.DiagnosticsDto d = new TelemetryPayloadDto.DiagnosticsDto();
        d.setFwBuildId("v1.0.0-rc3");
        d.setUptimeSeconds(3600L);
        d.setErrCode(0);
        TelemetryPayloadDto.SensorStatusDto s = new TelemetryPayloadDto.SensorStatusDto();
        s.setPmValid(true);
        s.setVocValid(true);
        s.setTempRhValid(true);
        d.setSensorStatus(s);
        payload.setDiagnostics(d);

        return payload;
    }

    private TelemetryRecord createBaselineRecord(String deviceId) {
        TelemetryRecord rec = new TelemetryRecord();
        rec.setDeviceId(deviceId);
        rec.setRecordedAt(OffsetDateTime.now());
        rec.setPm1(BigDecimal.valueOf(8.0));
        rec.setPm25(BigDecimal.valueOf(15.0));
        rec.setPm10(BigDecimal.valueOf(25.0));
        rec.setVoc(50);
        rec.setTempC(BigDecimal.valueOf(24.5));
        rec.setRh(BigDecimal.valueOf(45.0));
        rec.setAqi(52);
        rec.setFanPct(50);
        rec.setMode("AUTO");
        rec.setFilterHoursLeft(2000);
        rec.setRssi(-65);
        rec.setErrCode(0);
        rec.setSimulated(true);
        return rec;
    }

    @Test
    @DisplayName("Should trigger CRITICAL HARDWARE incident when fan stall bitmask (0x01) is active")
    void testFanStallRule_TriggersCriticalHardwareIncident() {
        Device dev = new Device("VAYU-DEV-001", "SITE-HQ-PUNE", true);
        TelemetryPayloadDto payload = createBaselinePayload("VAYU-DEV-001");
        TelemetryRecord rec = createBaselineRecord("VAYU-DEV-001");

        rec.setErrCode(0x01); // Fan stall
        rec.setFanPct(60);

        when(incidentRepository.findFirstByDeviceIdAndDiagnosticRuleAndStatusIn(eq("VAYU-DEV-001"), eq("RULE_FAN_STALL"), any()))
                .thenReturn(Optional.empty());

        ruleEngine.evaluateTelemetry(dev, payload, rec);

        ArgumentCaptor<Incident> captor = ArgumentCaptor.forClass(Incident.class);
        verify(incidentRepository, times(1)).save(captor.capture());

        Incident saved = captor.getValue();
        assertEquals("VAYU-DEV-001", saved.getDeviceId());
        assertEquals("RULE_FAN_STALL", saved.getDiagnosticRule());
        assertEquals("CRITICAL", saved.getSeverity());
        assertEquals("HARDWARE", saved.getCategory());
        assertEquals("OPEN", saved.getStatus());
        assertNotNull(saved.getEvidence());
        assertTrue(saved.getEvidence().contains("tachometer return pulse"));
    }

    @Test
    @DisplayName("Should trigger HIGH HARDWARE incident when PM sensor communication fault (0x02) occurs")
    void testPmFaultRule_TriggersHardwareIncident() {
        Device dev = new Device("VAYU-DEV-002", "SITE-HQ-PUNE", true);
        TelemetryPayloadDto payload = createBaselinePayload("VAYU-DEV-002");
        TelemetryRecord rec = createBaselineRecord("VAYU-DEV-002");

        rec.setErrCode(0x02); // PM fault
        rec.setPm25(null);
        payload.getDiagnostics().getSensorStatus().setPmValid(false);

        when(incidentRepository.findFirstByDeviceIdAndDiagnosticRuleAndStatusIn(eq("VAYU-DEV-002"), eq("RULE_PM_FAULT"), any()))
                .thenReturn(Optional.empty());

        ruleEngine.evaluateTelemetry(dev, payload, rec);

        ArgumentCaptor<Incident> captor = ArgumentCaptor.forClass(Incident.class);
        verify(incidentRepository, times(1)).save(captor.capture());

        Incident saved = captor.getValue();
        assertEquals("VAYU-DEV-002", saved.getDeviceId());
        assertEquals("RULE_PM_FAULT", saved.getDiagnosticRule());
        assertEquals("HIGH", saved.getSeverity());
        assertEquals("HARDWARE", saved.getCategory());
        assertEquals("Laser Scattering PM Sensor Fault", saved.getTitle());
        assertTrue(saved.getEvidence().contains("laser optical chamber"));
    }

    @Test
    @DisplayName("Should trigger MEDIUM HARDWARE incident when Temp/RH sensor fault (0x04) occurs")
    void testTempRhFaultRule_TriggersHardwareIncident() {
        Device dev = new Device("VAYU-DEV-003", "SITE-HQ-PUNE", true);
        TelemetryPayloadDto payload = createBaselinePayload("VAYU-DEV-003");
        TelemetryRecord rec = createBaselineRecord("VAYU-DEV-003");

        rec.setErrCode(0x04); // Temp/RH fault
        rec.setTempC(null);
        payload.getDiagnostics().getSensorStatus().setTempRhValid(false);

        when(incidentRepository.findFirstByDeviceIdAndDiagnosticRuleAndStatusIn(eq("VAYU-DEV-003"), eq("RULE_TEMP_RH_FAULT"), any()))
                .thenReturn(Optional.empty());

        ruleEngine.evaluateTelemetry(dev, payload, rec);

        ArgumentCaptor<Incident> captor = ArgumentCaptor.forClass(Incident.class);
        verify(incidentRepository, times(1)).save(captor.capture());

        Incident saved = captor.getValue();
        assertEquals("VAYU-DEV-003", saved.getDeviceId());
        assertEquals("RULE_TEMP_RH_FAULT", saved.getDiagnosticRule());
        assertEquals("MEDIUM", saved.getSeverity());
        assertEquals("HARDWARE", saved.getCategory());
    }

    @Test
    @DisplayName("Should trigger HIGH FIRMWARE incident on Task Watchdog reset cycle (0x10)")
    void testWatchdogResetRule_TriggersFirmwareIncident() {
        Device dev = new Device("VAYU-DEV-008", "SITE-HQ-PUNE", true);
        TelemetryPayloadDto payload = createBaselinePayload("VAYU-DEV-008");
        TelemetryRecord rec = createBaselineRecord("VAYU-DEV-008");

        rec.setErrCode(0x10); // Watchdog crash

        when(incidentRepository.findFirstByDeviceIdAndDiagnosticRuleAndStatusIn(eq("VAYU-DEV-008"), eq("RULE_WATCHDOG_RESET"), any()))
                .thenReturn(Optional.empty());

        ruleEngine.evaluateTelemetry(dev, payload, rec);

        ArgumentCaptor<Incident> captor = ArgumentCaptor.forClass(Incident.class);
        verify(incidentRepository, times(1)).save(captor.capture());

        Incident saved = captor.getValue();
        assertEquals("RULE_WATCHDOG_RESET", saved.getDiagnosticRule());
        assertEquals("FIRMWARE", saved.getCategory());
        assertEquals("HIGH", saved.getSeverity());
    }

    @Test
    @DisplayName("Should NOT trigger duplicate incident if an active ticket already exists for the device & rule")
    void testDeduplication_SkipsWhenActiveIncidentAlreadyExists() {
        Device dev = new Device("VAYU-DEV-001", "SITE-HQ-PUNE", true);
        TelemetryPayloadDto payload = createBaselinePayload("VAYU-DEV-001");
        TelemetryRecord rec = createBaselineRecord("VAYU-DEV-001");

        rec.setErrCode(0x01); // Fan stall

        Incident active = new Incident("VAYU-DEV-001", "Existing Ticket", "", "CRITICAL", "RULE_FAN_STALL", "HARDWARE", "{}");
        when(incidentRepository.findFirstByDeviceIdAndDiagnosticRuleAndStatusIn(eq("VAYU-DEV-001"), eq("RULE_FAN_STALL"), any()))
                .thenReturn(Optional.of(active));

        ruleEngine.evaluateTelemetry(dev, payload, rec);

        // Verify save was never called
        verify(incidentRepository, never()).save(any());
    }

    @Test
    @DisplayName("Should trigger FIRMWARE incident on ungraceful MQTT LWT disconnect")
    void testOfflineLwt_TriggersFirmwareConnectivityIncident() {
        Device dev = new Device("VAYU-DEV-016", "SITE-BLR-DEV", true);

        DeviceStatusPayloadDto status = new DeviceStatusPayloadDto();
        status.setDeviceId("VAYU-DEV-016");
        status.setStatus("OFFLINE");
        status.setReason("UNEXPECTED_DISCONNECT");

        when(incidentRepository.findFirstByDeviceIdAndDiagnosticRuleAndStatusIn(eq("VAYU-DEV-016"), eq("RULE_OFFLINE_LWT"), any()))
                .thenReturn(Optional.empty());

        ruleEngine.evaluateStatus(dev, status);

        ArgumentCaptor<Incident> captor = ArgumentCaptor.forClass(Incident.class);
        verify(incidentRepository, times(1)).save(captor.capture());

        Incident saved = captor.getValue();
        assertEquals("RULE_OFFLINE_LWT", saved.getDiagnosticRule());
        assertEquals("FIRMWARE", saved.getCategory());
        assertTrue(saved.getEvidence().contains("triage_checklist"));
    }
}
