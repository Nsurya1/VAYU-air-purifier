package com.sochi.vayu.service;

import com.sochi.vayu.domain.Device;
import com.sochi.vayu.domain.DeviceOtaHistory;
import com.sochi.vayu.domain.FirmwareRelease;
import com.sochi.vayu.domain.OtaDeployment;
import com.sochi.vayu.domain.TelemetryRecord;
import com.sochi.vayu.dto.CreateDeploymentRequestDto;
import com.sochi.vayu.dto.CreateReleaseRequestDto;
import com.sochi.vayu.dto.FirmwareReleaseDto;
import com.sochi.vayu.dto.OtaDeploymentDto;
import com.sochi.vayu.repository.DeviceOtaHistoryRepository;
import com.sochi.vayu.repository.DeviceRepository;
import com.sochi.vayu.repository.FirmwareReleaseRepository;
import com.sochi.vayu.repository.OtaDeploymentRepository;
import com.sochi.vayu.repository.TelemetryRecordRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class OtaOrchestrationServiceTest {

    private FirmwareReleaseRepository releaseRepository;
    private OtaDeploymentRepository deploymentRepository;
    private DeviceOtaHistoryRepository historyRepository;
    private DeviceRepository deviceRepository;
    private TelemetryRecordRepository telemetryRecordRepository;
    private MqttGatewayService mqttGatewayService;
    private AuditLogService auditLogService;
    private OtaOrchestrationService otaService;

    @BeforeEach
    void setUp() {
        releaseRepository = mock(FirmwareReleaseRepository.class);
        deploymentRepository = mock(OtaDeploymentRepository.class);
        historyRepository = mock(DeviceOtaHistoryRepository.class);
        deviceRepository = mock(DeviceRepository.class);
        telemetryRecordRepository = mock(TelemetryRecordRepository.class);
        mqttGatewayService = mock(MqttGatewayService.class);
        auditLogService = mock(AuditLogService.class);

        otaService = new OtaOrchestrationService(
                releaseRepository,
                deploymentRepository,
                historyRepository,
                deviceRepository,
                telemetryRecordRepository,
                mqttGatewayService,
                auditLogService
        );
    }

    @Test
    @DisplayName("Should publish firmware release successfully when actor has ROLE_ADMIN")
    void testCreateRelease_Success_WhenAdmin() {
        CreateReleaseRequestDto req = new CreateReleaseRequestDto();
        req.setVersion("v1.2.0-rc1");
        req.setBuildId("bld-20261022-03");
        req.setTargetHardware("REV-B-ESP32");
        req.setSha256("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
        req.setBinarySize(1048576);
        req.setBinaryUrl("/binaries/vayu-v1.2.0-rc1.bin");
        req.setStatus("PUBLISHED");

        when(releaseRepository.existsByVersion("v1.2.0-rc1")).thenReturn(false);

        FirmwareReleaseDto result = otaService.createRelease(req, "admin", "ROLE_ADMIN");

        assertNotNull(result);
        assertEquals("v1.2.0-rc1", result.getVersion());
        verify(releaseRepository, times(1)).save(any(FirmwareRelease.class));
        verify(auditLogService, times(1)).logAction(eq("admin"), eq("FIRMWARE_RELEASE_PUBLISHED"), eq("FIRMWARE"), eq("v1.2.0-rc1"), any());
    }

    @Test
    @DisplayName("Should forbid release creation when actor is Kiosk or Technician (403 Forbidden)")
    void testCreateRelease_Forbidden_WhenKioskOrTech() {
        CreateReleaseRequestDto req = new CreateReleaseRequestDto();
        req.setVersion("v1.2.0-rc1");

        assertThrows(ResponseStatusException.class, () ->
                otaService.createRelease(req, "kiosk", "ROLE_KIOSK")
        );

        assertThrows(ResponseStatusException.class, () ->
                otaService.createRelease(req, "tech_pune", "ROLE_SERVICE_TECH")
        );

        verify(releaseRepository, never()).save(any());
    }

    @Test
    @DisplayName("Should dispatch OTA command to Canary device and transition deployment to CANARY_ACTIVE")
    void testStartCanary_DispatchesCommandToTargetCanaryDevice() {
        OtaDeployment dep = new OtaDeployment("Release 1.1 Canary", "v1.1.0-rc1", "CANARY", "VAYU-DEV-001", 60, "admin");
        dep.setId(10L);

        FirmwareRelease rel = new FirmwareRelease("v1.1.0-rc1", "bld-02", "REV-B-ESP32", "sha123", 1000, "/bin.bin", "PUBLISHED", "", "admin");
        Device canary = new Device("VAYU-DEV-001", "SITE-HQ-PUNE", true);
        canary.setCurrentFwVersion("v1.0.0-prod");

        when(deploymentRepository.findById(10L)).thenReturn(Optional.of(dep));
        when(deviceRepository.findById("VAYU-DEV-001")).thenReturn(Optional.of(canary));
        when(releaseRepository.findByVersion("v1.1.0-rc1")).thenReturn(Optional.of(rel));
        when(mqttGatewayService.sendDeviceCommand(eq("VAYU-DEV-001"), any())).thenReturn(true);

        OtaDeploymentDto result = otaService.startCanary(10L, "admin", "ROLE_ADMIN");

        assertEquals("CANARY_ACTIVE", result.getStatus());
        verify(mqttGatewayService, times(1)).sendDeviceCommand(eq("VAYU-DEV-001"), any());
        verify(auditLogService, times(1)).logAction(eq("admin"), eq("OTA_CANARY_DISPATCHED"), eq("DEVICE"), eq("VAYU-DEV-001"), any());
    }

    @Test
    @DisplayName("Should evaluate canary as CANARY_PASSED when canary device reports target version and no errors")
    void testEvaluateCanaryHealth_MarksPassed_WhenHealthy() {
        OtaDeployment dep = new OtaDeployment("Release 1.1 Canary", "v1.1.0-rc1", "CANARY", "VAYU-DEV-001", 60, "admin");
        dep.setId(10L);
        dep.setStatus("CANARY_ACTIVE");

        Device canary = new Device("VAYU-DEV-001", "SITE-HQ-PUNE", true);
        canary.setCurrentFwVersion("v1.1.0-rc1"); // Target version confirmed
        canary.setOnlineStatus("ONLINE");

        TelemetryRecord healthyTelem = new TelemetryRecord();
        healthyTelem.setErrCode(0);

        when(deploymentRepository.findById(10L)).thenReturn(Optional.of(dep));
        when(deviceRepository.findById("VAYU-DEV-001")).thenReturn(Optional.of(canary));
        when(telemetryRecordRepository.findFirstByDeviceIdOrderByRecordedAtDesc("VAYU-DEV-001")).thenReturn(Optional.of(healthyTelem));

        OtaDeploymentDto result = otaService.evaluateCanaryHealth(10L);

        assertEquals("CANARY_PASSED", result.getStatus());
        verify(auditLogService, times(1)).logAction(eq("OTA_ORCHESTRATOR"), eq("CANARY_HEALTH_PASSED"), eq("OTA_DEPLOYMENT"), eq("10"), any());
    }

    @Test
    @DisplayName("Should evaluate canary as CANARY_FAILED when device is offline or reports fault bitmask")
    void testEvaluateCanaryHealth_MarksFailed_WhenOfflineOrFault() {
        OtaDeployment dep = new OtaDeployment("Release 1.1 Canary", "v1.1.0-rc1", "CANARY", "VAYU-DEV-001", 60, "admin");
        dep.setId(10L);
        dep.setStatus("CANARY_ACTIVE");

        Device canary = new Device("VAYU-DEV-001", "SITE-HQ-PUNE", true);
        canary.setCurrentFwVersion("v1.1.0-rc1");
        canary.setOnlineStatus("OFFLINE"); // Device dropped offline or crashed

        when(deploymentRepository.findById(10L)).thenReturn(Optional.of(dep));
        when(deviceRepository.findById("VAYU-DEV-001")).thenReturn(Optional.of(canary));
        when(telemetryRecordRepository.findFirstByDeviceIdOrderByRecordedAtDesc("VAYU-DEV-001")).thenReturn(Optional.empty());

        OtaDeploymentDto result = otaService.evaluateCanaryHealth(10L);

        assertEquals("CANARY_FAILED", result.getStatus());
        verify(auditLogService, times(1)).logAction(eq("OTA_ORCHESTRATOR"), eq("CANARY_HEALTH_FAILED"), eq("OTA_DEPLOYMENT"), eq("10"), any());
    }

    @Test
    @DisplayName("Should reject full fleet rollout if deployment has not passed canary trial")
    void testApproveFleet_RejectsWhenCanaryNotPassed() {
        OtaDeployment dep = new OtaDeployment("Release 1.1 Canary", "v1.1.0-rc1", "CANARY", "VAYU-DEV-001", 60, "admin");
        dep.setId(10L);
        dep.setStatus("CANARY_ACTIVE"); // Still testing!

        when(deploymentRepository.findById(10L)).thenReturn(Optional.of(dep));

        assertThrows(ResponseStatusException.class, () ->
                otaService.approveAndRolloutFleet(10L, "admin", "ROLE_ADMIN")
        );

        verify(mqttGatewayService, never()).sendDeviceCommand(any(), any());
    }
}
