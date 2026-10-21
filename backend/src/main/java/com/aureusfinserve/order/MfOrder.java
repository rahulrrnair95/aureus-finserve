package com.aureusfinserve.order;

import com.aureusfinserve.common.OrderStatus;
import com.aureusfinserve.common.OrderType;
import com.aureusfinserve.common.PaymentMode;
import com.aureusfinserve.common.Role;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** A purchase / redemption / switch / systematic-plan order. Table mf_order because ORDER is reserved. */
@Getter
@Setter
@Entity
@Table(name = "mf_order", indexes = {
        @Index(name = "ix_mf_order_investor", columnList = "investor_id"),
        @Index(name = "ix_mf_order_status", columnList = "status")
})
public class MfOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 20)
    private String ref;

    @Column(name = "investor_id", nullable = false)
    private Long investorId;

    @Enumerated(EnumType.STRING)
    @Column(name = "order_type", nullable = false, length = 10)
    private OrderType type;

    @Column(name = "scheme_id", nullable = false)
    private Long schemeId;

    @Column(name = "target_scheme_id")
    private Long targetSchemeId;

    @Column(name = "folio_id")
    private Long folioId;

    @Column(precision = 19, scale = 4)
    private BigDecimal amount;

    @Column(precision = 19, scale = 4)
    private BigDecimal units;

    @Column(name = "all_units", nullable = false)
    private boolean allUnits;

    @Column(name = "sip_day")
    private Integer sipDay;

    private Integer installments;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_mode", length = 20)
    private PaymentMode paymentMode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private OrderStatus status;

    @Column(name = "placed_by_user_id")
    private Long placedByUserId;

    @Column(name = "placed_by_name", length = 150)
    private String placedByName;

    @Enumerated(EnumType.STRING)
    @Column(name = "placed_by_role", length = 20)
    private Role placedByRole;

    @Column(name = "exchange_ref", length = 30)
    private String exchangeRef;

    @Column(name = "risk_acknowledged", nullable = false)
    private boolean riskAcknowledged;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    /** When the order was sent to the exchange (status PLACED); drives the mock exchange timings. */
    @Column(name = "placed_at")
    private LocalDateTime placedAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
