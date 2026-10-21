package com.aureusfinserve.publicsite;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.Length;

import java.time.LocalDateTime;

/** Investor-education article. publishAt null = draft, future = scheduled. */
@Getter
@Setter
@Entity
@Table(name = "article", indexes = @Index(name = "ux_article_slug", columnList = "slug", unique = true))
public class Article {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String slug;

    @Column(nullable = false, length = 250)
    private String title;

    @Column(length = 600)
    private String summary;

    @Column(length = 60)
    private String category;

    @Column(length = Length.LONG32)
    private String body;

    @Column(name = "publish_at")
    private LocalDateTime publishAt;

    @Column(name = "read_minutes")
    private Integer readMinutes;

    @Column(name = "video_url", length = 300)
    private String videoUrl;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
