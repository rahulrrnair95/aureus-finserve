package com.aureusfinserve.portfolio;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/** A folio holding of one scheme for one investor (folio numbers are shared across schemes of the same AMC). */
@Getter
@Setter
@Entity
@Table(name = "folio", indexes = {
        @Index(name = "ix_folio_investor", columnList = "investor_id"),
        @Index(name = "ix_folio_no", columnList = "folio_no")
}, uniqueConstraints = @UniqueConstraint(name = "ux_folio_investor_scheme", columnNames = {"investor_id", "scheme_id"}))
public class Folio {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "folio_no", nullable = false, length = 30)
    private String folioNo;

    @Column(name = "investor_id", nullable = false)
    private Long investorId;

    @Column(name = "scheme_id", nullable = false)
    private Long schemeId;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
