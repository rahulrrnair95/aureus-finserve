package com.aureusfinserve.investor;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@Entity
@Table(name = "nominee", indexes = @Index(name = "ix_nominee_investor", columnList = "investor_id"))
public class Nominee {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "investor_id", nullable = false)
    private Long investorId;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(length = 30)
    private String relation;

    @Column(name = "share_pct", precision = 5, scale = 2)
    private BigDecimal sharePct;
}
