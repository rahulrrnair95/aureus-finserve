package com.aureusfinserve.auth;

import com.aureusfinserve.common.Role;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/** Server-side session. Only the SHA-256 hash of the opaque bearer token is stored. */
@Getter
@Setter
@Entity
@Table(name = "user_session", indexes = {
        @Index(name = "ux_user_session_token", columnList = "token_hash", unique = true),
        @Index(name = "ix_user_session_user", columnList = "user_id")
})
public class UserSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "token_hash", nullable = false, length = 64)
    private String tokenHash;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Role role;

    @Column(name = "device_id", length = 100)
    private String deviceId;

    @Column(length = 64)
    private String ip;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "last_seen_at", nullable = false)
    private LocalDateTime lastSeenAt;

    /** Absolute expiry (created + 8h). */
    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(nullable = false)
    private boolean revoked;

    @Column(name = "revoked_reason", length = 50)
    private String revokedReason;
}
