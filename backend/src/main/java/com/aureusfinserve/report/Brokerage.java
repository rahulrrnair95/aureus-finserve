package com.aureusfinserve.report;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

/** Monthly trail commission (brokerage) expected vs. received from AMCs. */
@Getter
@Setter
@Entity
@Table(name = "brokerage", indexes = @Index(name = "ix_brokerage_month", columnList = "brokerage_month"))
public class Brokerage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String amc;

    @Column(name = "scheme_name", nullable = false, length = 250)
    private String schemeName;

    /** YYYY-MM */
    @Column(name = "brokerage_month", nullable = false, length = 7)
    private String month;

    @Column(precision = 19, scale = 4)
    private BigDecimal aum;

    @Column(name = "rate_pct", precision = 9, scale = 4)
    private BigDecimal ratePct;

    @Column(precision = 19, scale = 4)
    private BigDecimal expected;

    @Column(precision = 19, scale = 4)
    private BigDecimal received;

    @Column(nullable = false)
    private boolean reconciled;
}
