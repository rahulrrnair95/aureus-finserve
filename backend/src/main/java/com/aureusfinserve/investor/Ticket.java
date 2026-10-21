package com.aureusfinserve.investor;

import com.aureusfinserve.common.TicketCategory;
import com.aureusfinserve.common.TicketStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.Length;

import java.time.LocalDateTime;

/** Service request raised by an investor. */
@Getter
@Setter
@Entity
@Table(name = "ticket", indexes = @Index(name = "ix_ticket_investor", columnList = "investor_id"))
public class Ticket {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 20)
    private String ref;

    @Column(name = "investor_id", nullable = false)
    private Long investorId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private TicketCategory category;

    @Column(nullable = false, length = 200)
    private String subject;

    @Column(length = Length.LONG32)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TicketStatus status = TicketStatus.OPEN;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
