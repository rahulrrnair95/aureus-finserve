package com.aureusfinserve.publicsite;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.Length;

/** AMC partner shown on the website (name must match Scheme.amc for the fund-explorer link). */
@Getter
@Setter
@Entity
@Table(name = "amc", indexes = @Index(name = "ux_amc_slug", columnList = "slug", unique = true))
public class Amc {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false, length = 120)
    private String slug;

    /** PNG or SVG bytes (VARBINARY(MAX) on SQL Server). */
    @Basic(fetch = FetchType.LAZY)
    @Column(name = "logo", length = Length.LONG32)
    private byte[] logo;

    /** AMC's official website (shown on the AMC partners page). */
    @Column(length = 200)
    private String website;

    @Column(name = "logo_content_type", length = 40)
    private String logoContentType;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;
}
