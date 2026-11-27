package com.sochi.vayu.domain;

import jakarta.persistence.*;
import java.time.OffsetDateTime;

@Entity
@Table(name = "sites")
public class Site {

    @Id
    @Column(name = "site_id", length = 64)
    private String siteId;

    @Column(name = "name", nullable = false, length = 128)
    private String name;

    @Column(name = "location", length = 255)
    private String location;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    public Site() {}

    public Site(String siteId, String name, String location) {
        this.siteId = siteId;
        this.name = name;
        this.location = location;
        this.createdAt = OffsetDateTime.now();
    }

    public String getSiteId() {
        return siteId;
    }

    public void setSiteId(String siteId) {
        this.siteId = siteId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
