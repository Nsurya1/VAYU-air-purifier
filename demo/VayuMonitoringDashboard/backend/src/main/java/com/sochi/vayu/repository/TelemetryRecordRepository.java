package com.sochi.vayu.repository;

import com.sochi.vayu.domain.TelemetryRecord;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface TelemetryRecordRepository extends JpaRepository<TelemetryRecord, Long> {

    List<TelemetryRecord> findByDeviceIdOrderByRecordedAtDesc(String deviceId, Pageable pageable);

    Optional<TelemetryRecord> findFirstByDeviceIdOrderByRecordedAtDesc(String deviceId);

    @Query("SELECT t FROM TelemetryRecord t WHERE t.deviceId = :deviceId AND t.recordedAt >= :since ORDER BY t.recordedAt ASC")
    List<TelemetryRecord> findTelemetrySince(
            @Param("deviceId") String deviceId,
            @Param("since") OffsetDateTime since
    );
}
