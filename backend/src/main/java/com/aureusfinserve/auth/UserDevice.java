package com.aureusfinserve.auth;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/** Devices (X-Device-Id) a user has logged in from; used for new-device alerts and trusted devices. */
@Getter
@Setter
@Entity
@Table(name = "user_device", uniqueConstraints = @UniqueConstraint(name = "ux_user_device", columnNames = {"user_id", "device_id"}))
public class UserDevice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "device_id", nullable = false, length = 100)
    private String deviceId;

    @Column(name = "first_seen_at", nullable = false)
    private LocalDateTime firstSeenAt;

    @Column(name = "last_seen_at", nullable = false)
    private LocalDateTime lastSeenAt;

    /** Investor "remember this device" - OTP is skipped until this time. */
    @Column(name = "trusted_until")
    private LocalDateTime trustedUntil;
}
