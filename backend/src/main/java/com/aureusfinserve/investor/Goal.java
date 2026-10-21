package com.aureusfinserve.investor;

import com.aureusfinserve.common.GoalType;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@Entity
@Table(name = "goal", indexes = @Index(name = "ix_goal_investor", columnList = "investor_id"))
public class Goal {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "investor_id", nullable = false)
    private Long investorId;

    @Column(nullable = false, length = 150)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private GoalType type;

    @Column(name = "target_amount", precision = 19, scale = 4, nullable = false)
    private BigDecimal targetAmount;

    @Column(name = "target_date", nullable = false)
    private LocalDate targetDate;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "goal_folio", joinColumns = @JoinColumn(name = "goal_id"))
    @Column(name = "folio_id")
    private List<Long> folioIds = new ArrayList<>();
}
