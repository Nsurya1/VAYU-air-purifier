package com.sochi.vayu.repository;

import com.sochi.vayu.domain.OtaDeployment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface OtaDeploymentRepository extends JpaRepository<OtaDeployment, Long> {
    List<OtaDeployment> findAllByOrderByCreatedAtDesc();
    List<OtaDeployment> findByStatus(String status);
}
