package com.sochi.vayu.dto;

public class IncidentActionRequestDto {

    private String notes;
    private String assignedTo;

    public IncidentActionRequestDto() {}

    public IncidentActionRequestDto(String notes, String assignedTo) {
        this.notes = notes;
        this.assignedTo = assignedTo;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public String getAssignedTo() {
        return assignedTo;
    }

    public void setAssignedTo(String assignedTo) {
        this.assignedTo = assignedTo;
    }
}
