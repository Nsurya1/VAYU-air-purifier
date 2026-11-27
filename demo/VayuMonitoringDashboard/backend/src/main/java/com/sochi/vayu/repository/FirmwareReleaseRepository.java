package com.sochi.vayu.repository;

import com.sochi.vayu.domain.FirmwareRelease;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface FirmwareReleaseRepository extends JpaRepository<FirmwareRelease, Long> {
    Optional<FirmwareRelease> findByVersion(String version);
    boolean existsByVersion(String version);
}
