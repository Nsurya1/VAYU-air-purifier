package com.sochi.vayu.service;

import com.sochi.vayu.domain.Device;
import com.sochi.vayu.domain.TelemetryRecord;
import com.sochi.vayu.dto.DeviceSummaryDto;
import com.sochi.vayu.repository.DeviceRepository;
import com.sochi.vayu.repository.TelemetryRecordRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class DeviceQueryService {

    private final DeviceRepository deviceRepository;
    private final TelemetryRecordRepository telemetryRecordRepository;

    public DeviceQueryService(DeviceRepository deviceRepository, TelemetryRecordRepository telemetryRecordRepository) {
        this.deviceRepository = deviceRepository;
        this.telemetryRecordRepository = telemetryRecordRepository;
    }

    @Transactional(readOnly = true)
    public List<DeviceSummaryDto> getAllDeviceSummaries() {
        return getAllDeviceSummaries(null);
    }

    @Transactional(readOnly = true)
    public List<DeviceSummaryDto> getAllDeviceSummaries(String siteFilter) {
        List<Device> devices = deviceRepository.findAll();
        List<DeviceSummaryDto> summaries = new ArrayList<>();

        for (Device dev : devices) {
            // Apply site filter if specified (e.g. for site-scoped service technicians)
            if (siteFilter != null && !siteFilter.isBlank() && !"*".equals(siteFilter)) {
                if (dev.getSiteId() == null || !siteFilter.equalsIgnoreCase(dev.getSiteId())) {
                    continue;
                }
            }

            DeviceSummaryDto dto = new DeviceSummaryDto();
            dto.setDeviceId(dev.getDeviceId());
            dto.setSiteId(dev.getSiteId());
            dto.setModel(dev.getModel());
            dto.setCurrentFwVersion(dev.getCurrentFwVersion());
            dto.setOnlineStatus(dev.getOnlineStatus());
            dto.setLastSeenAt(dev.getLastSeenAt());
            dto.setSimulated(dev.isSimulated());

            // Fetch latest telemetry record
            Optional<TelemetryRecord> latestTelem = telemetryRecordRepository
                    .findFirstByDeviceIdOrderByRecordedAtDesc(dev.getDeviceId());

            if (latestTelem.isPresent()) {
                TelemetryRecord t = latestTelem.get();
                dto.setPm25(t.getPm25());
                dto.setAqi(t.getAqi());
                dto.setFanPct(t.getFanPct());
                dto.setMode(t.getMode());
                dto.setFilterHoursLeft(t.getFilterHoursLeft());
                dto.setRssi(t.getRssi());
                dto.setErrCode(t.getErrCode());

                // Health Badge calculation
                if ("OFFLINE".equalsIgnoreCase(dev.getOnlineStatus())) {
                    dto.setHealthBadge("OFFLINE");
                } else if ((t.getErrCode() & 0x01) != 0) {
                    dto.setHealthBadge("CRITICAL"); // Fan Stall / Motor Fault
                } else if (t.getErrCode() != 0 || t.getPm25() == null) {
                    dto.setHealthBadge("WARNING"); // Sensor error or degraded
                } else if (t.getAqi() != null && t.getAqi() > 200) {
                    dto.setHealthBadge("WARNING"); // Severe pollution spike
                } else {
                    dto.setHealthBadge("NORMAL");
                }
            } else {
                dto.setHealthBadge("OFFLINE".equalsIgnoreCase(dev.getOnlineStatus()) ? "OFFLINE" : "NO_DATA");
            }

            summaries.add(dto);
        }

        return summaries;
    }

    @Transactional(readOnly = true)
    public Optional<Device> getDevice(String deviceId) {
        return deviceRepository.findById(deviceId);
    }

    @Transactional(readOnly = true)
    public List<TelemetryRecord> getTelemetryHistory(String deviceId, int limit) {
        int safeLimit = Math.min(Math.max(limit, 1), 500);
        return telemetryRecordRepository.findByDeviceIdOrderByRecordedAtDesc(
                deviceId,
                PageRequest.of(0, safeLimit)
        );
    }
}
