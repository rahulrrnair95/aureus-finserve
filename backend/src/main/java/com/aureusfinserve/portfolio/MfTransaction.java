package com.aureusfinserve.portfolio;

import com.aureusfinserve.common.TxnType;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * A mutual fund transaction. {@code units} and {@code amount} are stored as positive numbers; the direction
 * comes from {@link TxnType#isInflow()}. Holdings are always derived from these rows.
 */
@Getter
@Setter
@Entity
@Table(name = "mf_transaction", indexes = {
        @Index(name = "ix_mf_txn_folio", columnList = "folio_id"),
        @Index(name = "ix_mf_txn_investor", columnList = "investor_id"),
        @Index(name = "ix_mf_txn_date", columnList = "txn_date")
})
public class MfTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "folio_id", nullable = false)
    private Long folioId;

    @Column(name = "investor_id", nullable = false)
    private Long investorId;

    @Column(name = "scheme_id", nullable = false)
    private Long schemeId;

    @Column(name = "txn_date", nullable = false)
    private LocalDate date;

    @Enumerated(EnumType.STRING)
    @Column(name = "txn_type", nullable = false, length = 20)
    private TxnType type;

    @Column(precision = 19, scale = 4, nullable = false)
    private BigDecimal amount;

    @Column(precision = 19, scale = 4, nullable = false)
    private BigDecimal units;

    @Column(precision = 19, scale = 4, nullable = false)
    private BigDecimal nav;

    @Column(name = "order_id")
    private Long orderId;

    /** SEED, ORDER, RTA */
    @Column(length = 10)
    private String source;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
