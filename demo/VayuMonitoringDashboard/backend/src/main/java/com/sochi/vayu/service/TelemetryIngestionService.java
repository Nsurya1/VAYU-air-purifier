package com.sochi.vayu.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sochi.vayu.domain.Device;
import com.sochi.vayu.domain.DeviceEvent;
import com.sochi.vayu.domain.TelemetryRecord;
import com.sochi.vayu.dto.TelemetryPayloadDto;
import com.sochi.vayu.repository.DeviceEventRepository;
import com.sochi.vayu.repository.DeviceRepository;
import com.sochi.vayu.repository.TelemetryRecordRepository;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Set;

@Service
public class TelemetryIngestionService {

    private static final Logger log = LoggerFactory.getLogger(TelemetryIngestionService.class);

    private final ObjectMapper objectMapper;
    private final Validator validator;
    private final DeviceRepository deviceRepository;
    private final TelemetryRecordRepository telemetryRecordRepository;
    private final DeviceEventRepository deviceEventRepository;
    private final DiagnosticRuleEngine diagnosticRuleEngine;

    public TelemetryIngestionService(
            ObjectMapper objectMapper,
            Validator validator,
            DeviceRepository deviceRepository,
            TelemetryRecordRepository telemetryRecordRepository,
            DeviceEventRepository deviceEventRepository,
            DiagnosticRuleEngine diagnosticRuleEngine
    ) {
        this.objectMapper = objectMapper;
        this.validator = validator;
        this.deviceRepository = deviceRepository;
        this.telemetryRecordRepository = telemetryRecordRepository;
        this.deviceEventRepository = deviceEventRepository;
        this.diagnosticRuleEngine = diagnosticRuleEngine;
    }

    @Transactional
    public void ingestTelemetry(String payloadJson) {
        try {
            TelemetryPayloadDto dto = objectMapper.readValue(payloadJson, TelemetryPayloadDto.class);

            // 1. Strict Schema & Boundary Validation
            Set<ConstraintViolation<TelemetryPayloadDto>> violations = validator.validate(dto);
            if (!violations.isEmpty()) {
                StringBuilder sb = new StringBuilder();
                for (ConstraintViolation<TelemetryPayloadDto> v : violations) {
                    sb.append(v.getPropertyPath()).append(": ").append(v.getMessage()).append("; ");
                }
                log.warn("[INGESTION REJECTED] Validation failed for payload: {}", sb);
                return;
            }

            String deviceId = dto.getDeviceId();
            OffsetDateTime recordedAt = dto.getTimestamp();

            // 2. Device Identity Resolution / Upsert
            Device device = deviceRepository.findById(deviceId).orElseGet(() -> {
                log.info("[AUTO-REGISTRATION] New device discovered via telemetry: {}", deviceId);
                Device newDevice = new Device(deviceId, "DEFAULT_SITE", dto.getSimulated());
                return newDevice;
            });

            device.setOnlineStatus("ONLINE");
            device.setLastSeenAt(recordedAt);
            if (dto.getDiagnostics() != null && dto.getDiagnostics().getFwBuildId() != null) {
                device.setCurrentFwVersion(dto.getDiagnostics().getFwBuildId());
            }
            deviceRepository.save(device);

            // 3. Map to Telemetry Entity
            TelemetryRecord record = new TelemetryRecord();
            record.setDeviceId(deviceId);
            record.setRecordedAt(recordedAt);
            record.setSimulated(Boolean.TRUE.equals(dto.getSimulated()));

            TelemetryPayloadDto.MetricsDto m = dto.getMetrics();
            record.setPm1(m.getPm1());
            record.setPm25(m.getPm25());
            record.setPm10(m.getPm10());
            record.setVoc(m.getVoc());
            record.setTempC(m.getTempC());
            record.setRh(m.getRh());
            record.setAqi(m.getAqi());
            record.setAqiStandard(m.getAqiStandard() != null ? m.getAqiStandard() : "US_EPA");
            record.setFanPct(m.getFanPct());
            record.setMode(m.getMode());
            record.setFilterHoursLeft(m.getFilterHoursLeft());
            record.setRssi(m.getRssi());

            TelemetryPayloadDto.DiagnosticsDto d = dto.getDiagnostics();
            record.setErrCode(d.getErrCode());

            if (d.getSensorStatus() != null) {
                record.setSensorsValid(objectMapper.writeValueAsString(d.getSensorStatus()));
            } else {
                record.setSensorsValid("{\"pm_valid\": true, \"voc_valid\": true, \"temp_rh_valid\": true}");
            }

            telemetryRecordRepository.save(record);

            // 4. Fault Detection & Event Logging
            if (d.getErrCode() != 0) {
                String severity = (d.getErrCode() & 0x01) != 0 ? "CRITICAL" : "WARN";
                String details = String.format("{\"err_code\": %d, \"fan_pct\": %d, \"mode\": \"%s\"}",
                        d.getErrCode(), m.getFanPct(), m.getMode());
                DeviceEvent event = new DeviceEvent(deviceId, "HARDWARE_FAULT_DETECTED", severity, details);
                deviceEventRepository.save(event);
            }

            // 5. Automated Diagnostic Rules Evaluation (Phase 6)
            if (diagnosticRuleEngine != null) {
                diagnosticRuleEngine.evaluateTelemetry(device, dto, record);
            }

        } catch (Exception e) {
            log.error("[INGESTION ERROR] Failed to process telemetry message: {}", e.getMessage(), e);
        }
    }
}
