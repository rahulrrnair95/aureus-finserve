package com.aureusfinserve.nfo;

import com.aureusfinserve.common.Risk;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * New fund offer. Imported daily from the AMFI scheme master (one row per scheme, all plans / options grouped) and
 * enriched from the Scheme Summary Document; staff can correct any field, upload the AMC's one-pager and add NFOs by
 * hand. Fields listed in {@code staffEditedFields} are never overwritten by the import. Closed NFOs are kept (they drop
 * out of the public lists 30 days after closing); nothing is deleted by the import.
 */
@Getter
@Setter
@Entity
@Table(name = "nfo", indexes = {
        @Index(name = "ix_nfo_scheme_key", columnList = "scheme_key"),
        @Index(name = "ix_nfo_open_date", columnList = "open_date")
})
public class Nfo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Grouping key: AMFI AMC legal name + "|" + cleaned scheme name in lower case. */
    @Column(name = "scheme_key", length = 400)
    private String schemeKey;

    /** AMFI code of the representative row (Regular Growth when there is one); null for manual entries. */
    @Column(name = "scheme_code", length = 20)
    private String schemeCode;

    /** AMC as AMFI lists it in the scheme master (legal name, e.g. "HDFC Asset Management Company Limited"). */
    @Column(name = "amc_name", nullable = false, length = 150)
    private String amcName;

    /** AMC as shown on the site: the AMC partner name when it matches (e.g. "HDFC Mutual Fund"), else a short legal name. */
    @Column(name = "amc_display", nullable = false, length = 150)
    private String amcDisplay;

    /** Cleaned scheme name without plan / option. */
    @Column(name = "scheme_name", nullable = false, length = 250)
    private String schemeName;

    /** "Open Ended" | "Close Ended" | "Interval Fund" (AMFI scheme type). */
    @Column(name = "scheme_type", length = 30)
    private String schemeType;

    /** AMFI scheme category as listed, e.g. "Equity Schemes - Large & Mid Cap Fund". */
    @Column(name = "amfi_category", length = 150)
    private String amfiCategory;

    /** EQUITY | DEBT | HYBRID | OTHER (ETF, fund of funds, FMP, interval, life cycle). */
    @Column(name = "asset_class", nullable = false, length = 10)
    private String assetClass;

    @Column(name = "sub_category", length = 60)
    private String subCategory;

    /** AMFI "Scheme Minimum Amount" text, e.g. "Rs. 1000 and in multiples of Re. 1/- thereafter". */
    @Column(name = "min_amount_text", length = 300)
    private String minAmountText;

    @Column(name = "min_amount", precision = 19, scale = 2)
    private BigDecimal minAmount;

    @Column(name = "open_date", nullable = false)
    private LocalDate openDate;

    @Column(name = "close_date")
    private LocalDate closeDate;

    /** AMFI | SSD | STAFF; null while the close date is unknown (then estimated as open date + 15 days). */
    @Column(name = "close_date_source", length = 10)
    private String closeDateSource;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private Risk riskometer;

    @Column(length = 150)
    private String benchmark;

    @Column(name = "fund_managers", length = 300)
    private String fundManagers;

    @Column(name = "exit_load", length = 1000)
    private String exitLoad;

    @Column(length = 2000)
    private String objective;

    /** Scheme Information Document link (staff). */
    @Column(name = "sid_url", length = 300)
    private String sidUrl;

    /** One-pager metadata; the PDF bytes are in nfo_one_pager (kept out of list queries). */
    @Column(name = "one_pager_content_type", length = 40)
    private String onePagerContentType;

    @Column(name = "one_pager_file_name", length = 200)
    private String onePagerFileName;

    @Column(name = "one_pager_size")
    private Integer onePagerSize;

    @Column(name = "one_pager_updated_at")
    private LocalDateTime onePagerUpdatedAt;

    @Column(nullable = false)
    private boolean featured;

    @Column(nullable = false)
    private boolean hidden;

    /** AMFI | MANUAL */
    @Column(nullable = false, length = 10)
    private String source;

    /** Comma-separated field names corrected by staff; the import leaves these alone. */
    @Column(name = "staff_edited_fields", length = 500)
    private String staffEditedFields;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public boolean hasOnePager() {
        return onePagerContentType != null;
    }
}
