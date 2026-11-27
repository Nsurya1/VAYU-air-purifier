package com.sochi.vayu.domain;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

/**
 * Domain entity representing an authorized user in the SOCHI VAYU platform.
 * Supports Role-Based Access Control (RBAC) and site-level isolation.
 */
@Entity
@Table(name = "users")
public class User {

    @Id
    @Column(name = "username", nullable = false, length = 64)
    private String username;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(name = "full_name", nullable = false, length = 128)
    private String fullName;

    @Column(name = "role", nullable = false, length = 32)
    private String role; // e.g. ROLE_ADMIN, ROLE_SERVICE_TECH, ROLE_DEV_ENGINEER, ROLE_KIOSK

    @Column(name = "site_scope", nullable = false, length = 64)
    private String siteScope = "*"; // '*' for fleet-wide, or site ID like 'SITE-HQ-PUNE'

    @Column(name = "enabled", nullable = false)
    private boolean enabled = true;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    public User() {}

    public User(String username, String passwordHash, String fullName, String role, String siteScope, boolean enabled) {
        this.username = username;
        this.passwordHash = passwordHash;
        this.fullName = fullName;
        this.role = role;
        this.siteScope = siteScope != null ? siteScope : "*";
        this.enabled = enabled;
        this.createdAt = OffsetDateTime.now();
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getSiteScope() {
        return siteScope;
    }

    public void setSiteScope(String siteScope) {
        this.siteScope = siteScope;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
