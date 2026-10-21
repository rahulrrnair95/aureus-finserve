package com.aureusfinserve.publicsite;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Daily NAV history. */
@Getter
@Setter
@Entity
@Table(name = "nav_history", uniqueConstraints = @UniqueConstraint(name = "ux_nav_scheme_date", columnNames = {"scheme_id", "nav_date"}))
public class NavPoint {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "scheme_id", nullable = false)
    private Long schemeId;

    @Column(name = "nav_date", nullable = false)
    private LocalDate navDate;

    @Column(precision = 19, scale = 4, nullable = false)
    private BigDecimal nav;
}
