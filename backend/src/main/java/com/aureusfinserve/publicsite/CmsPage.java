package com.aureusfinserve.publicsite;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.Length;

import java.time.LocalDateTime;

/** Static compliance/content pages: about, disclaimer, privacy, terms, commission, grievance. */
@Getter
@Setter
@Entity
@Table(name = "cms_page")
public class CmsPage {

    @Id
    @Column(name = "page_key", length = 40)
    private String key;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(length = Length.LONG32)
    private String body;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
