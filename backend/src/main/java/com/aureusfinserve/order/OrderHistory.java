package com.aureusfinserve.order;

import com.aureusfinserve.common.OrderStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "mf_order_history", indexes = @Index(name = "ix_order_history_order", columnList = "order_id"))
public class OrderHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_id", nullable = false)
    private Long orderId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private OrderStatus status;

    @Column(name = "changed_at", nullable = false)
    private LocalDateTime at;

    @Column(length = 500)
    private String note;
}
