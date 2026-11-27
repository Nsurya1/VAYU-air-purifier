package com.sochi.vayu.dto;

public class UserProfileDto {

    private String username;
    private String fullName;
    private String role;
    private String siteScope;
    private boolean enabled;

    public UserProfileDto() {}

    public UserProfileDto(String username, String fullName, String role, String siteScope, boolean enabled) {
        this.username = username;
        this.fullName = fullName;
        this.role = role;
        this.siteScope = siteScope;
        this.enabled = enabled;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
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
}
