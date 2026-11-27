package com.sochi.vayu.repository;

import com.sochi.vayu.domain.DeviceEvent;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DeviceEventRepository extends JpaRepository<DeviceEvent, Long> {
    List<DeviceEvent> findByDeviceIdOrderByCreatedAtDesc(String deviceId, Pageable pageable);
    List<DeviceEvent> findBySeverityOrderByCreatedAtDesc(String severity, Pageable pageable);
}
