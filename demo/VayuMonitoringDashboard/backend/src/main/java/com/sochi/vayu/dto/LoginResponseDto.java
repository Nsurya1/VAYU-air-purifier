package com.sochi.vayu.dto;

public class LoginResponseDto {

    private String token;
    private String tokenType = "Bearer";
    private long expiresInMs;
    private String username;
    private String fullName;
    private String role;
    private String siteScope;

    public LoginResponseDto() {}

    public LoginResponseDto(String token, long expiresInMs, String username, String fullName, String role, String siteScope) {
        this.token = token;
        this.tokenType = "Bearer";
        this.expiresInMs = expiresInMs;
        this.username = username;
        this.fullName = fullName;
        this.role = role;
        this.siteScope = siteScope;
    }

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }

    public String getTokenType() {
        return tokenType;
    }

    public void setTokenType(String tokenType) {
        this.tokenType = tokenType;
    }

    public long getExpiresInMs() {
        return expiresInMs;
    }

    public void setExpiresInMs(long expiresInMs) {
        this.expiresInMs = expiresInMs;
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
}
