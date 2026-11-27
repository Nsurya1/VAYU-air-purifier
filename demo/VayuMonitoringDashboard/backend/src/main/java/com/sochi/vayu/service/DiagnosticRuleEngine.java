package com.sochi.vayu.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sochi.vayu.domain.Device;
import com.sochi.vayu.domain.Incident;
import com.sochi.vayu.domain.TelemetryRecord;
import com.sochi.vayu.dto.DeviceStatusPayloadDto;
import com.sochi.vayu.dto.TelemetryPayloadDto;
import com.sochi.vayu.repository.IncidentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.*;

/**
 * Diagnostic Rules Engine that analyzes incoming telemetry and device status transitions
 * to automatically trigger actionable incidents with rich developer evidence.
 */
@Service
public class DiagnosticRuleEngine {

    private static final Logger log = LoggerFactory.getLogger(DiagnosticRuleEngine.class);

    private final IncidentRepository incidentRepository;
    private final AuditLogService auditLogService;
    private final ObjectMapper objectMapper;

    public DiagnosticRuleEngine(
            IncidentRepository incidentRepository,
            AuditLogService auditLogService,
            ObjectMapper objectMapper
    ) {
        this.incidentRepository = incidentRepository;
        this.auditLogService = auditLogService;
        this.objectMapper = objectMapper;
    }

    public void evaluateTelemetry(Device device, TelemetryPayloadDto payload, TelemetryRecord record) {
        int err = record.getErrCode();

        // 1. RULE_FAN_STALL: Hardware Fan Stall
        if ((err & 0x01) != 0) {
            triggerIncident(
                    device,
                    "RULE_FAN_STALL",
                    "HARDWARE",
                    "CRITICAL",
                    "Impeller Blower Stall / Motor Failure",
                    "Purifier fan duty cycle commanded but tachometer reports 0 RPM. Immediate motor obstruction or bearing seizure triage required.",
                    buildTelemetryEvidence(device, payload, record, List.of(
                            "1. Disconnect purifier AC/DC power supply before physical servicing.",
                            "2. Inspect intake and HEPA cavity for foreign object obstruction.",
                            "3. Measure PWM signal and tachometer return pulse on connector J4.",
                            "4. Replace blower motor assembly if winding open-circuit detected."
                    ))
            );
        }

        // 2. RULE_PM_FAULT: PM Sensor Communication Fault
        boolean pmInvalid = payload.getDiagnostics() != null &&
                payload.getDiagnostics().getSensorStatus() != null &&
                Boolean.FALSE.equals(payload.getDiagnostics().getSensorStatus().getPmValid());
        if ((err & 0x02) != 0 || pmInvalid || record.getPm25() == null) {
            triggerIncident(
                    device,
                    "RULE_PM_FAULT",
                    "HARDWARE",
                    "HIGH",
                    "Laser Scattering PM Sensor Fault",
                    "UART communication failure or optical chamber saturation detected on PM sensor.",
                    buildTelemetryEvidence(device, payload, record, List.of(
                            "1. Inspect PM sensor cable harness and 5V power supply rail.",
                            "2. Clean laser optical chamber using oil-free dry compressed air.",
                            "3. Verify 9600 baud UART transmission with handheld serial console.",
                            "4. Swap sensor module with calibrated spare."
                    ))
            );
        }

        // 3. RULE_TEMP_RH_FAULT: Temperature / Humidity Sensor Fault
        boolean tempRhInvalid = payload.getDiagnostics() != null &&
                payload.getDiagnostics().getSensorStatus() != null &&
                Boolean.FALSE.equals(payload.getDiagnostics().getSensorStatus().getTempRhValid());
        if ((err & 0x04) != 0 || tempRhInvalid || record.getTempC() == null) {
            triggerIncident(
                    device,
                    "RULE_TEMP_RH_FAULT",
                    "HARDWARE",
                    "MEDIUM",
                    "Temperature & Humidity Sensor Timeout",
                    "I2C bus communication timeout or invalid checksum on environmental sensor.",
                    buildTelemetryEvidence(device, payload, record, List.of(
                            "1. Verify 3.3V power supply rail on environmental daughterboard.",
                            "2. Inspect I2C SDA/SCL pull-up resistors and header soldering.",
                            "3. Power cycle unit to reset sensor state machine."
                    ))
            );
        }

        // 4. RULE_WATCHDOG_RESET: Processor Reset / Crash Loop
        if ((err & 0x10) != 0) {
            triggerIncident(
                    device,
                    "RULE_WATCHDOG_RESET",
                    "FIRMWARE",
                    "HIGH",
                    "Watchdog Reset & Processor Crash Cycle",
                    "Task Watchdog Timer (TWDT) or hardware brownout triggered MCU reset.",
                    buildTelemetryEvidence(device, payload, record, List.of(
                            "1. Extract ESP-IDF crash dump backtrace from flash memory.",
                            "2. Analyze free heap memory trend prior to crash.",
                            "3. Check for blocking calls or priority inversion in FreeRTOS tasks.",
                            "4. Verify 3.3V power rail decoupling capacitors for voltage ripple."
                    ))
            );
        }
    }

    public void evaluateStatus(Device device, DeviceStatusPayloadDto statusPayload) {
        // 5. RULE_OFFLINE_LWT: Ungraceful MQTT Disconnect
        if ("OFFLINE".equalsIgnoreCase(statusPayload.getStatus()) &&
                "UNEXPECTED_DISCONNECT".equalsIgnoreCase(statusPayload.getReason())) {

            Map<String, Object> evidenceMap = new LinkedHashMap<>();
            evidenceMap.put("device_id", device.getDeviceId());
            evidenceMap.put("site_id", device.getSiteId());
            evidenceMap.put("model", device.getModel());
            evidenceMap.put("firmware_version", device.getCurrentFwVersion());
            evidenceMap.put("ip_address", device.getIpAddress());
            evidenceMap.put("mac_address", device.getMacAddress());
            evidenceMap.put("last_seen_at", device.getLastSeenAt() != null ? device.getLastSeenAt().toString() : "UNKNOWN");
            evidenceMap.put("status_payload", statusPayload);
            evidenceMap.put("triage_checklist", List.of(
                    "1. Check local site Wi-Fi access point logs for deauth packets or signal drop.",
                    "2. Verify device IP lease in DHCP server table.",
                    "3. Check physical unit power state at site (wall plug / PSU failure).",
                    "4. Dev team: Inspect TCP keepalive and ping timeout thresholds in ESP-IDF network stack."
            ));

            String evidenceJson = toJson(evidenceMap);

            triggerIncident(
                    device,
                    "RULE_OFFLINE_LWT",
                    "FIRMWARE",
                    "HIGH",
                    "Ungraceful Broker Disconnect (MQTT LWT)",
                    "Purifier dropped network connection abruptly without sending clean MQTT DISCONNECT. Broker emitted Last Will and Testament.",
                    evidenceJson
            );
        }
    }

    private void triggerIncident(
            Device device,
            String rule,
            String category,
            String severity,
            String title,
            String description,
            String evidenceJson
    ) {
        // Deduplication: Check if there is already an active (OPEN or ACKNOWLEDGED) incident for this device & rule
        Optional<Incident> existing = incidentRepository
                .findFirstByDeviceIdAndDiagnosticRuleAndStatusIn(device.getDeviceId(), rule, List.of("OPEN", "ACKNOWLEDGED"));

        if (existing.isPresent()) {
            // Already tracked; do not flood with duplicate tickets
            return;
        }

        try {
            Incident incident = new Incident(
                    device.getDeviceId(),
                    title,
                    description,
                    severity,
                    rule,
                    category,
                    evidenceJson
            );
            Incident saved = incidentRepository.save(incident);

            log.warn("[DIAGNOSTIC RULE TRIGGERED] Device '{}' -> {} ({}) [Severity: {}]",
                    device.getDeviceId(), rule, title, severity);

            Map<String, Object> details = new HashMap<>();
            details.put("rule", rule);
            if (saved != null && saved.getId() != null) {
                details.put("incident_id", saved.getId());
            }
            details.put("severity", severity);
            details.put("category", category);

            auditLogService.logAction(
                    "DIAGNOSTIC_ENGINE",
                    "INCIDENT_TRIGGERED",
                    "DEVICE",
                    device.getDeviceId(),
                    details
            );
        } catch (Exception e) {
            log.error("[DIAGNOSTIC ERROR] Failed to record incident for {}: {}", device.getDeviceId(), e.getMessage());
        }
    }

    private String buildTelemetryEvidence(Device device, TelemetryPayloadDto payload, TelemetryRecord record, List<String> checklist) {
        Map<String, Object> evidenceMap = new LinkedHashMap<>();
        evidenceMap.put("device_id", device.getDeviceId());
        evidenceMap.put("site_id", device.getSiteId());
        evidenceMap.put("model", device.getModel());
        evidenceMap.put("firmware_version", device.getCurrentFwVersion());
        evidenceMap.put("ip_address", device.getIpAddress());
        evidenceMap.put("mac_address", device.getMacAddress());
        evidenceMap.put("snapshot_timestamp", record.getRecordedAt() != null ? record.getRecordedAt().toString() : OffsetDateTime.now().toString());

        Map<String, Object> metrics = new LinkedHashMap<>();
        metrics.put("err_code", record.getErrCode());
        metrics.put("err_code_hex", "0x" + Integer.toHexString(record.getErrCode()).toUpperCase());
        metrics.put("pm25", record.getPm25());
        metrics.put("aqi", record.getAqi());
        metrics.put("fan_pct", record.getFanPct());
        metrics.put("mode", record.getMode());
        metrics.put("filter_hours_left", record.getFilterHoursLeft());
        metrics.put("rssi", record.getRssi());
        metrics.put("temp_c", record.getTempC());
        metrics.put("rh", record.getRh());
        metrics.put("sensors_valid", record.getSensorsValid());

        evidenceMap.put("telemetry_metrics", metrics);
        evidenceMap.put("triage_checklist", checklist);

        return toJson(evidenceMap);
    }

    private String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            return "{\"error\":\"Serialization failure\"}";
        }
    }
}
