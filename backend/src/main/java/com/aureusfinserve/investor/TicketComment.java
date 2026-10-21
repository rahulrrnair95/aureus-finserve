package com.aureusfinserve.investor;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "ticket_comment", indexes = @Index(name = "ix_ticket_comment_ticket", columnList = "ticket_id"))
public class TicketComment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ticket_id", nullable = false)
    private Long ticketId;

    @Column(name = "author_name", nullable = false, length = 150)
    private String byName;

    @Column(name = "comment_text", nullable = false, length = 2000)
    private String text;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
