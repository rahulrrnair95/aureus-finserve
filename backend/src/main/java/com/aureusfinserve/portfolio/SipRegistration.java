package com.aureusfinserve.portfolio;

import com.aureusfinserve.common.RegistrationType;
import com.aureusfinserve.common.SipStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** A systematic plan registration: SIP, STP or SWP. */
@Getter
@Setter
@Entity
@Table(name = "sip_registration", indexes = @Index(name = "ix_sip_investor", columnList = "investor_id"))
public class SipRegistration {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "reg_type", nullable = false, length = 10)
    private RegistrationType regType = RegistrationType.SIP;

    @Column(name = "investor_id", nullable = false)
    private Long investorId;

    @Column(name = "scheme_id", nullable = false)
    private Long schemeId;

    @Column(name = "target_scheme_id")
    private Long targetSchemeId;

    @Column(name = "folio_id")
    private Long folioId;

    @Column(precision = 19, scale = 4, nullable = false)
    private BigDecimal amount;

    @Column(name = "sip_day", nullable = false)
    private int sipDay;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    /** null = perpetual. */
    private Integer installments;

    @Column(name = "installments_done", nullable = false)
    private int installmentsDone;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private SipStatus status = SipStatus.ACTIVE;

    @Column(name = "step_up_pct")
    private Integer stepUpPct;

    @Column(name = "paused_until")
    private LocalDate pausedUntil;

    @Column(name = "order_id")
    private Long orderId;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
