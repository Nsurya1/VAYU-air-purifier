package com.sochi.vayu.config;

import java.security.Principal;

/**
 * Security principal representing an authenticated user session in the SOCHI VAYU platform.
 */
public class VayuUserPrincipal implements Principal {

    private final String username;
    private final String fullName;
    private final String role;
    private final String siteScope;

    public VayuUserPrincipal(String username, String fullName, String role, String siteScope) {
        this.username = username;
        this.fullName = fullName;
        this.role = role;
        this.siteScope = siteScope != null ? siteScope : "*";
    }

    @Override
    public String getName() {
        return username;
    }

    public String getUsername() {
        return username;
    }

    public String getFullName() {
        return fullName;
    }

    public String getRole() {
        return role;
    }

    public String getSiteScope() {
        return siteScope;
    }
}
