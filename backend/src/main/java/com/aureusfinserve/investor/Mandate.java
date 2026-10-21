package com.aureusfinserve.investor;

import com.aureusfinserve.common.MandateStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

/** NACH / e-mandate registration for SIP / STP / SWP debits. */
@Getter
@Setter
@Entity
@Table(name = "mandate", indexes = @Index(name = "ix_mandate_investor", columnList = "investor_id"))
public class Mandate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "investor_id", nullable = false)
    private Long investorId;

    @Column(length = 30)
    private String umrn;

    @Column(name = "bank_name", length = 100)
    private String bankName;

    @Column(name = "limit_amount", precision = 19, scale = 4)
    private BigDecimal limitAmount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MandateStatus status;
}
