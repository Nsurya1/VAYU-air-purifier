package com.sochi.vayu.repository;

import com.sochi.vayu.domain.RemoteSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface RemoteSessionRepository extends JpaRepository<RemoteSession, Long> {

    Optional<RemoteSession> findBySessionCode(String sessionCode);

    Optional<RemoteSession> findByEphemeralToken(String ephemeralToken);

    List<RemoteSession> findByTargetSiteIdOrderByCreatedAtDesc(String targetSiteId);

    List<RemoteSession> findAllByOrderByCreatedAtDesc();

    List<RemoteSession> findByStatus(String status);

    List<RemoteSession> findByStatusAndExpiresAtBefore(String status, OffsetDateTime cutoff);
}
