package com.sochi.vayu.repository;

import com.sochi.vayu.domain.Device;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DeviceRepository extends JpaRepository<Device, String> {
    List<Device> findBySiteId(String siteId);
    List<Device> findByOnlineStatus(String onlineStatus);
    long countByOnlineStatus(String onlineStatus);
}
