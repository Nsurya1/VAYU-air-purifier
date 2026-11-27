package com.sochi.vayu.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sochi.vayu.domain.Device;
import com.sochi.vayu.domain.DeviceEvent;
import com.sochi.vayu.dto.DeviceStatusPayloadDto;
import com.sochi.vayu.repository.DeviceEventRepository;
import com.sochi.vayu.repository.DeviceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

@Service
public class DeviceStatusService {

    private static final Logger log = LoggerFactory.getLogger(DeviceStatusService.class);

    private final ObjectMapper objectMapper;
    private final DeviceRepository deviceRepository;
    private final DeviceEventRepository deviceEventRepository;
    private final DiagnosticRuleEngine diagnosticRuleEngine;

    public DeviceStatusService(
            ObjectMapper objectMapper,
            DeviceRepository deviceRepository,
            DeviceEventRepository deviceEventRepository,
            DiagnosticRuleEngine diagnosticRuleEngine
    ) {
        this.objectMapper = objectMapper;
        this.deviceRepository = deviceRepository;
        this.deviceEventRepository = deviceEventRepository;
        this.diagnosticRuleEngine = diagnosticRuleEngine;
    }

    @Transactional
    public void ingestStatus(String payloadJson) {
        try {
            DeviceStatusPayloadDto dto = objectMapper.readValue(payloadJson, DeviceStatusPayloadDto.class);
            String deviceId = dto.getDeviceId();
            if (deviceId == null || deviceId.isBlank()) {
                log.warn("[STATUS REJECTED] Missing device_id in status payload");
                return;
            }

            String status = dto.getStatus() != null ? dto.getStatus().toUpperCase() : "UNKNOWN";
            OffsetDateTime timestamp = dto.getTimestamp() != null ? dto.getTimestamp() : OffsetDateTime.now();

            Device device = deviceRepository.findById(deviceId).orElseGet(() -> {
                log.info("[AUTO-REGISTRATION] New device discovered via status: {}", deviceId);
                Device newDev = new Device(deviceId, dto.getSiteId() != null ? dto.getSiteId() : "DEFAULT_SITE",
                        Boolean.TRUE.equals(dto.getSimulated()));
                return newDev;
            });

            device.setOnlineStatus(status);
            device.setLastSeenAt(timestamp);
            if (dto.getCurrentFwVersion() != null) {
                device.setCurrentFwVersion(dto.getCurrentFwVersion());
            }
            if (dto.getIpAddress() != null) {
                device.setIpAddress(dto.getIpAddress());
            }
            if (dto.getMacAddress() != null) {
                device.setMacAddress(dto.getMacAddress());
            }
            deviceRepository.save(device);

            // Audit status transition in device_events
            String severity = "ONLINE".equals(status) ? "INFO" : ("UNEXPECTED_DISCONNECT".equals(dto.getReason()) ? "WARN" : "INFO");
            String details = String.format("{\"reason\": \"%s\", \"raw_status\": \"%s\"}",
                    dto.getReason() != null ? dto.getReason() : "STANDARD", status);
            DeviceEvent event = new DeviceEvent(deviceId, "STATUS_" + status, severity, details);
            deviceEventRepository.save(event);

            log.info("[DEVICE STATUS] {} transition -> {} (Reason: {})", deviceId, status, dto.getReason());

            // Automated Diagnostic Rule Engine for ungraceful disconnects
            if (diagnosticRuleEngine != null) {
                diagnosticRuleEngine.evaluateStatus(device, dto);
            }

        } catch (Exception e) {
            log.error("[STATUS ERROR] Failed to parse device status payload: {}", e.getMessage(), e);
        }
    }
}
