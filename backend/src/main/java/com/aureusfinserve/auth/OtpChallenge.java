package com.aureusfinserve.auth;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/** One issued OTP. The OTP itself is never stored, only its SHA-256 hash (salted with the challenge id). */
@Getter
@Setter
@Entity
@Table(name = "otp_challenge")
public class OtpChallenge {

    public enum Purpose { LOGIN, RESET, ACTIVATE, CHANGE_PASSWORD, LEAD, ORDER_APPROVAL }

    @Id
    @Column(length = 36)
    private String id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Purpose purpose;

    @Column(name = "user_id")
    private Long userId;

    /** Purpose-specific reference: order id for ORDER_APPROVAL, activation-token id for ACTIVATE. */
    @Column(name = "ref_id")
    private Long refId;

    /** Purpose-specific text reference: mobile hash for LEAD. */
    @Column(name = "ref_text", length = 100)
    private String refText;

    @Column(name = "otp_hash", length = 64)
    private String otpHash;

    @Column(name = "masked_mobile", length = 20)
    private String maskedMobile;

    @Column(name = "masked_email", length = 120)
    private String maskedEmail;

    @Column(name = "device_id", length = 100)
    private String deviceId;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(nullable = false)
    private int attempts;

    @Column(nullable = false)
    private boolean used;

    /** Dummy challenge for unknown users - can never be verified. */
    @Column(nullable = false)
    private boolean dummy;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
