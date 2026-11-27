package com.sochi.vayu.repository;

import com.sochi.vayu.domain.DeviceOtaHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DeviceOtaHistoryRepository extends JpaRepository<DeviceOtaHistory, Long> {
    List<DeviceOtaHistory> findByDeviceIdOrderByUpdatedAtDesc(String deviceId);
    List<DeviceOtaHistory> findByDeploymentId(Long deploymentId);
    Optional<DeviceOtaHistory> findFirstByDeviceIdAndDeploymentId(String deviceId, Long deploymentId);
}
