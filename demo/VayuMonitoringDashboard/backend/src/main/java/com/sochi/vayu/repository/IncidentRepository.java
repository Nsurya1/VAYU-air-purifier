package com.sochi.vayu.repository;

import com.sochi.vayu.domain.Incident;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface IncidentRepository extends JpaRepository<Incident, Long> {

    List<Incident> findAllByOrderByCreatedAtDesc();

    List<Incident> findByStatusOrderByCreatedAtDesc(String status);

    List<Incident> findByDeviceIdOrderByCreatedAtDesc(String deviceId);

    Optional<Incident> findFirstByDeviceIdAndDiagnosticRuleAndStatusIn(
            String deviceId,
            String diagnosticRule,
            Collection<String> statuses
    );

    long countByStatusIn(Collection<String> statuses);

    @Query("SELECT i FROM Incident i, Device d WHERE i.deviceId = d.deviceId AND (:siteId IS NULL OR d.siteId = :siteId) AND (:status IS NULL OR i.status = :status) AND (:category IS NULL OR i.category = :category) ORDER BY i.createdAt DESC")
    List<Incident> findFilteredIncidents(
            @Param("siteId") String siteId,
            @Param("status") String status,
            @Param("category") String category
    );
}
