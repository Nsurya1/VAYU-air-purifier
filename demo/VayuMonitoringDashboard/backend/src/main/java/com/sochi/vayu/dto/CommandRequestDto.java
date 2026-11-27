package com.sochi.vayu.dto;

import jakarta.validation.constraints.NotBlank;

public class CommandRequestDto {

    @NotBlank(message = "command type is required (e.g. SET_FAN, SET_MODE, FILTER_RESET)")
    private String command;

    private Integer fanPct;
    private String mode;
    private String targetVersion;
    private String binaryUrl;
    private String sha256;

    public CommandRequestDto() {}

    public String getCommand() { return command; }
    public void setCommand(String command) { this.command = command; }
    public Integer getFanPct() { return fanPct; }
    public void setFanPct(Integer fanPct) { this.fanPct = fanPct; }
    public String getMode() { return mode; }
    public void setMode(String mode) { this.mode = mode; }
    public String getTargetVersion() { return targetVersion; }
    public void setTargetVersion(String targetVersion) { this.targetVersion = targetVersion; }
    public String getBinaryUrl() { return binaryUrl; }
    public void setBinaryUrl(String binaryUrl) { this.binaryUrl = binaryUrl; }
    public String getSha256() { return sha256; }
    public void setSha256(String sha256) { this.sha256 = sha256; }
}
