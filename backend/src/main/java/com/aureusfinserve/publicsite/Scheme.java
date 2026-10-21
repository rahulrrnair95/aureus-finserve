package com.aureusfinserve.publicsite;

import com.aureusfinserve.common.AssetClass;
import com.aureusfinserve.common.Risk;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Mutual fund scheme master. {@code code} is the AMFI scheme code used by NAV sync. */
@Getter
@Setter
@Entity
@Table(name = "scheme", indexes = @Index(name = "ux_scheme_code", columnList = "code", unique = true))
public class Scheme {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 20)
    private String code;

    @Column(name = "isin_growth", length = 12)
    private String isinGrowth;

    @Column(nullable = false, length = 250)
    private String name;

    @Column(nullable = false, length = 100)
    private String amc;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private AssetClass category;

    @Column(name = "sub_category", length = 60)
    private String subCategory;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Risk risk;

    @Column(precision = 19, scale = 4)
    private BigDecimal nav;

    @Column(name = "nav_date")
    private LocalDate navDate;

    @Column(name = "return_1y")
    private Double return1y;

    @Column(name = "return_3y")
    private Double return3y;

    @Column(name = "return_5y")
    private Double return5y;

    @Column(name = "return_10y")
    private Double return10y;

    @Column(name = "expense_ratio", precision = 9, scale = 4)
    private BigDecimal expenseRatio;

    @Column(name = "min_sip", precision = 19, scale = 4)
    private BigDecimal minSip;

    @Column(name = "min_lumpsum", precision = 19, scale = 4)
    private BigDecimal minLumpsum;

    @Column(name = "aum_cr", precision = 19, scale = 4)
    private BigDecimal aumCr;

    @Column(name = "trail_commission_pct", precision = 9, scale = 4)
    private BigDecimal trailCommissionPct;

    @Column(name = "sid_url", length = 300)
    private String sidUrl;

    @Column(name = "factsheet_url", length = 300)
    private String factsheetUrl;

    @Column(name = "fund_manager", length = 150)
    private String fundManager;

    @Column(length = 150)
    private String benchmark;

    @Column(name = "launch_date")
    private LocalDate launchDate;

    @Column(name = "exit_load", length = 1000)
    private String exitLoad;

    @Column(length = 2000)
    private String objective;

    /** Only regular plans are distributed. */
    @Column(name = "regular_plan", nullable = false)
    private boolean regularPlan = true;

    @Column(nullable = false)
    private boolean active = true;
}
