package com.aureusfinserve.publicsite;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.Length;

import java.time.LocalDateTime;

/**
 * Structured CMS documents stored as JSON: "home", "about", "site" (site-settings overrides) and
 * "service:{slug}" for the 8 service pages.
 */
@Getter
@Setter
@Entity
@Table(name = "cms_content")
public class CmsContent {

    @Id
    @Column(name = "content_key", length = 80)
    private String key;

    @Column(name = "json_value", length = Length.LONG32, nullable = false)
    private String json;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
