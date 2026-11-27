package com.sochi.vayu.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sochi.vayu.domain.AuditLog;
import com.sochi.vayu.dto.AuditLogDto;
import com.sochi.vayu.repository.AuditLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class AuditLogService {

    private static final Logger log = LoggerFactory.getLogger(AuditLogService.class);

    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;

    public AuditLogService(AuditLogRepository auditLogRepository, ObjectMapper objectMapper) {
        this.auditLogRepository = auditLogRepository;
        this.objectMapper = objectMapper;
    }

    public void logAction(String actor, String action, String resourceType, String resourceId, Object payloadObj) {
        String payloadJson = null;
        if (payloadObj != null) {
            try {
                payloadJson = objectMapper.writeValueAsString(payloadObj);
            } catch (Exception e) {
                payloadJson = "{\"raw\":\"" + payloadObj.toString().replace("\"", "\\\"") + "\"}";
            }
        }

        try {
            AuditLog auditLog = new AuditLog(actor, action, resourceType, resourceId, payloadJson);
            auditLogRepository.save(auditLog);
            log.info("[AUDIT] Actor '{}' executed '{}' on {}:{}", actor, action, resourceType, resourceId);
        } catch (Exception e) {
            log.error("[AUDIT ERROR] Failed to record audit log for actor {}: {}", actor, e.getMessage());
        }
    }

    public List<AuditLogDto> getRecentAuditLogs() {
        return auditLogRepository.findTop100ByOrderByCreatedAtDesc()
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    public List<AuditLogDto> getRecentAuditLogsByActor(String actor) {
        return auditLogRepository.findTop50ByActorOrderByCreatedAtDesc(actor)
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    private AuditLogDto toDto(AuditLog a) {
        return new AuditLogDto(
                a.getId(),
                a.getActor(),
                a.getAction(),
                a.getResourceType(),
                a.getResourceId(),
                a.getPayload(),
                a.getCreatedAt()
        );
    }
}
