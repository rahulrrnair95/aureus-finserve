package com.aureusfinserve.audit;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Immutable;

import java.time.LocalDateTime;

/** Append-only audit trail. Marked @Immutable: Hibernate never issues UPDATEs, and no delete path exists. */
@Getter
@Setter
@Entity
@Immutable
@Table(name = "audit_log", indexes = {
        @Index(name = "ix_audit_at", columnList = "created_at"),
        @Index(name = "ix_audit_action", columnList = "action")
})
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime at;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "user_name", length = 150)
    private String userName;

    @Column(name = "user_role", length = 20)
    private String role;

    @Column(nullable = false, length = 40)
    private String action;

    @Column(length = 60)
    private String entity;

    @Column(name = "entity_id", length = 60)
    private String entityId;

    @Column(length = 2000)
    private String detail;

    @Column(length = 64)
    private String ip;
}
