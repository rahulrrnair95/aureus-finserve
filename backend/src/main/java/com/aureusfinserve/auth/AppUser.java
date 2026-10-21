package com.aureusfinserve.auth;

import com.aureusfinserve.common.LoginStatus;
import com.aureusfinserve.common.Role;
import com.aureusfinserve.security.EncryptedStringConverter;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/** Login identity for investors and staff. Table is app_user because USER is reserved in SQL Server. */
@Getter
@Setter
@Entity
@Table(name = "app_user", indexes = {
        @Index(name = "ix_app_user_email_hash", columnList = "email_hash"),
        @Index(name = "ix_app_user_mobile_hash", columnList = "mobile_hash"),
        @Index(name = "ix_app_user_investor", columnList = "investor_id")
})
public class AppUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(length = 200)
    private String email;

    @Column(name = "email_hash", length = 64)
    private String emailHash;

    @Convert(converter = EncryptedStringConverter.class)
    @Column(length = 512)
    private String mobile;

    @Column(name = "mobile_hash", length = 64)
    private String mobileHash;

    @Column(name = "password_hash", length = 100)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Role role;

    @Enumerated(EnumType.STRING)
    @Column(name = "login_status", nullable = false, length = 20)
    private LoginStatus loginStatus = LoginStatus.NOT_ACTIVATED;

    @Column(nullable = false)
    private boolean enabled = true;

    @Column(name = "failed_attempts", nullable = false)
    private int failedAttempts;

    @Column(name = "locked_until")
    private LocalDateTime lockedUntil;

    @Column(name = "last_login_at")
    private LocalDateTime lastLoginAt;

    @Column(name = "password_changed_at")
    private LocalDateTime passwordChangedAt;

    @Column(length = 20)
    private String euin;

    /** For INVESTOR users: the investor record this login belongs to. */
    @Column(name = "investor_id")
    private Long investorId;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    public boolean isStaff() {
        return role == Role.RM || role == Role.ADMIN;
    }
}
