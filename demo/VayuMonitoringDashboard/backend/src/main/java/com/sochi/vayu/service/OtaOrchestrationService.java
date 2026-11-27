package com.sochi.vayu.service;

import com.sochi.vayu.domain.Device;
import com.sochi.vayu.domain.DeviceOtaHistory;
import com.sochi.vayu.domain.FirmwareRelease;
import com.sochi.vayu.domain.OtaDeployment;
import com.sochi.vayu.domain.TelemetryRecord;
import com.sochi.vayu.dto.*;
import com.sochi.vayu.repository.DeviceOtaHistoryRepository;
import com.sochi.vayu.repository.DeviceRepository;
import com.sochi.vayu.repository.FirmwareReleaseRepository;
import com.sochi.vayu.repository.OtaDeploymentRepository;
import com.sochi.vayu.repository.TelemetryRecordRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class OtaOrchestrationService {

    private static final Logger log = LoggerFactory.getLogger(OtaOrchestrationService.class);

    private final FirmwareReleaseRepository releaseRepository;
    private final OtaDeploymentRepository deploymentRepository;
    private final DeviceOtaHistoryRepository historyRepository;
    private final DeviceRepository deviceRepository;
    private final TelemetryRecordRepository telemetryRecordRepository;
    private final MqttGatewayService mqttGatewayService;
    private final AuditLogService auditLogService;

    public OtaOrchestrationService(
            FirmwareReleaseRepository releaseRepository,
            OtaDeploymentRepository deploymentRepository,
            DeviceOtaHistoryRepository historyRepository,
            DeviceRepository deviceRepository,
            TelemetryRecordRepository telemetryRecordRepository,
            MqttGatewayService mqttGatewayService,
            AuditLogService auditLogService
    ) {
        this.releaseRepository = releaseRepository;
        this.deploymentRepository = deploymentRepository;
        this.historyRepository = historyRepository;
        this.deviceRepository = deviceRepository;
        this.telemetryRecordRepository = telemetryRecordRepository;
        this.mqttGatewayService = mqttGatewayService;
        this.auditLogService = auditLogService;
    }

    public List<FirmwareReleaseDto> getReleases() {
        return releaseRepository.findAll().stream()
                .map(this::toReleaseDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public FirmwareReleaseDto createRelease(CreateReleaseRequestDto req, String actor, String role) {
        enforceOtaOperatorRole(actor, role, "CREATE_FIRMWARE_RELEASE");

        if (releaseRepository.existsByVersion(req.getVersion())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Firmware version already exists: " + req.getVersion());
        }

        FirmwareRelease rel = new FirmwareRelease(
                req.getVersion(),
                req.getBuildId(),
                req.getTargetHardware(),
                req.getSha256().toLowerCase(),
                req.getBinarySize(),
                req.getBinaryUrl(),
                req.getStatus(),
                req.getReleaseNotes(),
                actor
        );
        releaseRepository.save(rel);

        auditLogService.logAction(
                actor,
                "FIRMWARE_RELEASE_PUBLISHED",
                "FIRMWARE",
                rel.getVersion(),
                Map.of("build_id", rel.getBuildId(), "sha256", rel.getSha256(), "binary_size", rel.getBinarySize())
        );

        log.info("[OTA RELEASE] Published version '{}' by '{}'", rel.getVersion(), actor);
        return toReleaseDto(rel);
    }

    public List<OtaDeploymentDto> getDeployments() {
        return deploymentRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(this::toDeploymentDto)
                .collect(Collectors.toList());
    }

    public OtaDeploymentDto getDeploymentById(Long id) {
        OtaDeployment dep = deploymentRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Deployment not found: " + id));
        return toDeploymentDto(dep);
    }

    @Transactional
    public OtaDeploymentDto createDeployment(CreateDeploymentRequestDto req, String actor, String role) {
        enforceOtaOperatorRole(actor, role, "CREATE_OTA_DEPLOYMENT");

        FirmwareRelease rel = releaseRepository.findByVersion(req.getFirmwareVersion())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Firmware release not found: " + req.getFirmwareVersion()));

        if ("REVOKED".equalsIgnoreCase(rel.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot deploy a REVOKED firmware release.");
        }

        OtaDeployment dep = new OtaDeployment(
                req.getDeploymentName(),
                rel.getVersion(),
                req.getRolloutStrategy(),
                req.getCanaryDeviceId(),
                req.getCanaryDurationSeconds(),
                actor
        );
        deploymentRepository.save(dep);

        auditLogService.logAction(
                actor,
                "OTA_DEPLOYMENT_CREATED",
                "OTA_DEPLOYMENT",
                String.valueOf(dep.getId()),
                Map.of("version", dep.getFirmwareVersion(), "strategy", dep.getRolloutStrategy(), "canary_device", dep.getCanaryDeviceId() != null ? dep.getCanaryDeviceId() : "NONE")
        );

        log.info("[OTA DEPLOYMENT CREATED] Deployment #{} ('{}') targeting version '{}'", dep.getId(), dep.getDeploymentName(), dep.getFirmwareVersion());
        return toDeploymentDto(dep);
    }

    @Transactional
    public OtaDeploymentDto startCanary(Long deploymentId, String actor, String role) {
        enforceOtaOperatorRole(actor, role, "START_CANARY_OTA");

        OtaDeployment dep = deploymentRepository.findById(deploymentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Deployment not found: " + deploymentId));

        if (!"CREATED".equalsIgnoreCase(dep.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Deployment must be in 'CREATED' state to start canary. Current: " + dep.getStatus());
        }

        String canaryDevId = dep.getCanaryDeviceId() != null ? dep.getCanaryDeviceId() : "VAYU-DEV-001";
        Device dev = deviceRepository.findById(canaryDevId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Canary device not found: " + canaryDevId));

        FirmwareRelease rel = releaseRepository.findByVersion(dep.getFirmwareVersion())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Firmware release not found: " + dep.getFirmwareVersion()));

        // Create or update device history
        DeviceOtaHistory history = historyRepository.findFirstByDeviceIdAndDeploymentId(canaryDevId, dep.getId())
                .orElse(new DeviceOtaHistory(canaryDevId, dep.getId(), rel.getVersion(), dev.getCurrentFwVersion(), "DOWNLOADING", null));
        history.setStatus("DOWNLOADING");
        history.setUpdatedAt(OffsetDateTime.now());
        historyRepository.save(history);

        // Dispatch OTA command to canary device
        CommandRequestDto cmd = new CommandRequestDto();
        cmd.setCommand("OTA_UPDATE");
        cmd.setTargetVersion(rel.getVersion());
        cmd.setBinaryUrl(rel.getBinaryUrl());
        cmd.setSha256(rel.getSha256());

        boolean dispatched = mqttGatewayService.sendDeviceCommand(canaryDevId, cmd);
        if (!dispatched) {
            history.setStatus("FAILED_ROLLBACK");
            history.setFailureReason("Failed to dispatch OTA MQTT command to device broker queue");
            historyRepository.save(history);
            dep.setStatus("CANARY_FAILED");
            deploymentRepository.save(dep);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to dispatch OTA command via MQTT gateway.");
        }

        dep.setStatus("CANARY_ACTIVE");
        deploymentRepository.save(dep);

        auditLogService.logAction(
                actor,
                "OTA_CANARY_DISPATCHED",
                "DEVICE",
                canaryDevId,
                Map.of("deployment_id", dep.getId(), "target_version", rel.getVersion(), "sha256", rel.getSha256())
        );

        log.info("[OTA CANARY DISPATCHED] Deployment #{} sent to canary device '{}'", dep.getId(), canaryDevId);
        return toDeploymentDto(dep);
    }

    @Transactional
    public OtaDeploymentDto evaluateCanaryHealth(Long deploymentId) {
        OtaDeployment dep = deploymentRepository.findById(deploymentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Deployment not found: " + deploymentId));

        String canaryDevId = dep.getCanaryDeviceId();
        if (canaryDevId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No canary device specified for deployment: " + deploymentId);
        }

        Device dev = deviceRepository.findById(canaryDevId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Canary device not found: " + canaryDevId));

        DeviceOtaHistory history = historyRepository.findFirstByDeviceIdAndDeploymentId(canaryDevId, dep.getId())
                .orElse(new DeviceOtaHistory(canaryDevId, dep.getId(), dep.getFirmwareVersion(), dev.getCurrentFwVersion(), "VERIFYING", null));

        // Evaluate canary state
        Optional<TelemetryRecord> latestTelem = telemetryRecordRepository.findFirstByDeviceIdOrderByRecordedAtDesc(canaryDevId);
        boolean hasFault = latestTelem.map(t -> t.getErrCode() != null && t.getErrCode() > 0).orElse(false);
        boolean hasRolledBackOrCrashed = "OFFLINE".equalsIgnoreCase(dev.getOnlineStatus()) || hasFault;
        boolean isRunningTargetVersion = dep.getFirmwareVersion().equalsIgnoreCase(dev.getCurrentFwVersion());

        if (isRunningTargetVersion && !hasRolledBackOrCrashed) {
            history.setStatus("SUCCESS");
            history.setFailureReason(null);
            history.setUpdatedAt(OffsetDateTime.now());
            historyRepository.save(history);

            dep.setStatus("CANARY_PASSED");
            deploymentRepository.save(dep);

            auditLogService.logAction(
                    "OTA_ORCHESTRATOR",
                    "CANARY_HEALTH_PASSED",
                    "OTA_DEPLOYMENT",
                    String.valueOf(dep.getId()),
                    Map.of("device_id", canaryDevId, "version", dep.getFirmwareVersion(), "health", "NOMINAL")
            );

            log.info("[OTA CANARY PASSED] Device '{}' successfully verified on version '{}'", canaryDevId, dep.getFirmwareVersion());
        } else {
            history.setStatus("FAILED_ROLLBACK");
            history.setFailureReason(hasRolledBackOrCrashed ? "Device reported diagnostic faults or offline state during post-flash trial" : "Device firmware version did not match target");
            history.setUpdatedAt(OffsetDateTime.now());
            historyRepository.save(history);

            dep.setStatus("CANARY_FAILED");
            deploymentRepository.save(dep);

            auditLogService.logAction(
                    "OTA_ORCHESTRATOR",
                    "CANARY_HEALTH_FAILED",
                    "OTA_DEPLOYMENT",
                    String.valueOf(dep.getId()),
                    Map.of("device_id", canaryDevId, "reason", history.getFailureReason(), "action", "ROLLBACK_ABORT_FLEET")
            );

            log.warn("[OTA CANARY FAILED] Device '{}' failed post-flash verification: {}", canaryDevId, history.getFailureReason());
        }

        return toDeploymentDto(dep);
    }

    @Transactional
    public OtaDeploymentDto approveAndRolloutFleet(Long deploymentId, String actor, String role) {
        enforceOtaOperatorRole(actor, role, "APPROVE_FLEET_OTA");

        OtaDeployment dep = deploymentRepository.findById(deploymentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Deployment not found: " + deploymentId));

        if (!"CANARY_PASSED".equalsIgnoreCase(dep.getStatus()) && !"CREATED".equalsIgnoreCase(dep.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Deployment must be in 'CANARY_PASSED' or 'CREATED' state to approve fleet rollout. Current: " + dep.getStatus());
        }

        FirmwareRelease rel = releaseRepository.findByVersion(dep.getFirmwareVersion())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Firmware release not found: " + dep.getFirmwareVersion()));

        List<Device> allDevices = deviceRepository.findAll();
        int dispatchedCount = 0;

        for (Device dev : allDevices) {
            if (dev.getDeviceId().equals(dep.getCanaryDeviceId())) {
                continue; // Canary already updated
            }

            DeviceOtaHistory history = historyRepository.findFirstByDeviceIdAndDeploymentId(dev.getDeviceId(), dep.getId())
                    .orElse(new DeviceOtaHistory(dev.getDeviceId(), dep.getId(), rel.getVersion(), dev.getCurrentFwVersion(), "DOWNLOADING", null));
            history.setStatus("DOWNLOADING");
            history.setUpdatedAt(OffsetDateTime.now());
            historyRepository.save(history);

            CommandRequestDto cmd = new CommandRequestDto();
            cmd.setCommand("OTA_UPDATE");
            cmd.setTargetVersion(rel.getVersion());
            cmd.setBinaryUrl(rel.getBinaryUrl());
            cmd.setSha256(rel.getSha256());

            mqttGatewayService.sendDeviceCommand(dev.getDeviceId(), cmd);
            dispatchedCount++;
        }

        dep.setStatus("FULL_ROLLOUT");
        dep.setApprovedBy(actor);
        dep.setApprovedAt(OffsetDateTime.now());
        deploymentRepository.save(dep);

        auditLogService.logAction(
                actor,
                "OTA_FLEET_ROLLOUT_APPROVED",
                "OTA_DEPLOYMENT",
                String.valueOf(dep.getId()),
                Map.of("target_version", rel.getVersion(), "dispatched_device_count", dispatchedCount)
        );

        log.info("[OTA FLEET ROLLOUT] Deployment #{} approved by '{}'. Dispatched to {} devices.", dep.getId(), actor, dispatchedCount);
        return toDeploymentDto(dep);
    }

    public List<DeviceOtaHistory> getDeviceHistory(String deviceId) {
        return historyRepository.findByDeviceIdOrderByUpdatedAtDesc(deviceId);
    }

    private void enforceOtaOperatorRole(String actor, String role, String actionName) {
        if ("ROLE_KIOSK".equalsIgnoreCase(role) || "ROLE_SERVICE_TECH".equalsIgnoreCase(role)) {
            auditLogService.logAction(
                    actor,
                    "ACTION_DENIED",
                    "OTA",
                    actionName,
                    Map.of("reason", "Only administrators and development engineers have OTA orchestration authority.", "role", role)
            );
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access Denied: Only administrators and development engineers can perform OTA operations.");
        }
    }

    private FirmwareReleaseDto toReleaseDto(FirmwareRelease r) {
        FirmwareReleaseDto dto = new FirmwareReleaseDto();
        dto.setId(r.getId());
        dto.setVersion(r.getVersion());
        dto.setBuildId(r.getBuildId());
        dto.setTargetHardware(r.getTargetHardware());
        dto.setSha256(r.getSha256());
        dto.setBinarySize(r.getBinarySize());
        dto.setBinaryUrl(r.getBinaryUrl());
        dto.setStatus(r.getStatus());
        dto.setReleaseNotes(r.getReleaseNotes());
        dto.setCreatedAt(r.getCreatedAt());
        dto.setCreatedBy(r.getCreatedBy());
        return dto;
    }

    private OtaDeploymentDto toDeploymentDto(OtaDeployment d) {
        OtaDeploymentDto dto = new OtaDeploymentDto();
        dto.setId(d.getId());
        dto.setDeploymentName(d.getDeploymentName());
        dto.setFirmwareVersion(d.getFirmwareVersion());
        dto.setRolloutStrategy(d.getRolloutStrategy());
        dto.setCanaryDeviceId(d.getCanaryDeviceId());
        dto.setCanaryDurationSeconds(d.getCanaryDurationSeconds());
        dto.setStatus(d.getStatus());
        dto.setApprovedBy(d.getApprovedBy());
        dto.setApprovedAt(d.getApprovedAt());
        dto.setCreatedAt(d.getCreatedAt());
        dto.setCreatedBy(d.getCreatedBy());

        List<OtaDeploymentDto.DeviceOtaHistoryDto> histDtos = historyRepository.findByDeploymentId(d.getId()).stream()
                .map(h -> {
                    OtaDeploymentDto.DeviceOtaHistoryDto hDto = new OtaDeploymentDto.DeviceOtaHistoryDto();
                    hDto.setDeviceId(h.getDeviceId());
                    hDto.setTargetVersion(h.getTargetVersion());
                    hDto.setPreviousVersion(h.getPreviousVersion());
                    hDto.setStatus(h.getStatus());
                    hDto.setFailureReason(h.getFailureReason());
                    hDto.setUpdatedAt(h.getUpdatedAt());
                    return hDto;
                })
                .collect(Collectors.toList());
        dto.setDeviceHistory(histDtos);

        return dto;
    }
}
