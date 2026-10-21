package com.aureusfinserve.auth;

import com.aureusfinserve.common.ApiException;
import com.aureusfinserve.common.Fmt;
import com.aureusfinserve.config.AppProperties;
import com.aureusfinserve.notification.NotificationService;
import com.aureusfinserve.security.CryptoService;
import com.aureusfinserve.security.RateLimiter;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

/** Issues and verifies 6-digit OTPs (5 min validity, 3 attempts, per-user issue rate limit). */
@Slf4j
@Service
@RequiredArgsConstructor
public class OtpService {

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record OtpIssued(String challengeId, String maskedMobile, String maskedEmail, String devOtp) {
    }

    /** Parameters for an OTP. */
    public record OtpTarget(OtpChallenge.Purpose purpose, Long userId, String mobile, String email,
                            Long refId, String refText, String rateKey) {
    }

    private final OtpChallengeRepository repo;
    private final CryptoService crypto;
    private final AppProperties props;
    private final RateLimiter rateLimiter;
    private final NotificationService notifications;

    @Transactional
    public OtpIssued issue(OtpTarget t, String deviceId) {
        checkRate(t.rateKey());
        String otp = String.format("%06d", crypto.random().nextInt(1_000_000));
        OtpChallenge c = base(t.purpose());
        c.setUserId(t.userId());
        c.setRefId(t.refId());
        c.setRefText(t.refText());
        c.setDeviceId(deviceId);
        c.setOtpHash(hash(c.getId(), otp));
        c.setMaskedMobile(Fmt.maskMobile(t.mobile()));
        c.setMaskedEmail(Fmt.maskEmail(t.email()));
        repo.save(c);

        String text = otp + " is your Aureus Finserve OTP for " + label(t.purpose())
                + ". Valid for " + props.getSecurity().getOtpValidityMinutes() + " minutes. Do not share it with anyone.";
        notifications.sms(t.mobile(), text);
        notifications.email(t.email(), "Your Aureus Finserve OTP", text);
        if (props.isDevMode()) {
            // Explicit dev-mode log line - the only place an OTP is ever logged.
            log.info("DEV MODE OTP [{}] challenge={} otp={}", t.purpose(), c.getId(), otp);
        }
        return new OtpIssued(c.getId(), c.getMaskedMobile(), c.getMaskedEmail(), props.isDevMode() ? otp : null);
    }

    /** A challenge for an unknown user: same response shape, can never be verified. */
    @Transactional
    public OtpIssued issueDummy(OtpChallenge.Purpose purpose, String rateKey) {
        checkRate(rateKey);
        OtpChallenge c = base(purpose);
        c.setDummy(true);
        c.setMaskedMobile("XXXXXX" + String.format("%04d", crypto.random().nextInt(10_000)));
        c.setMaskedEmail("us***@example.com");
        repo.save(c);
        String fake = String.format("%06d", crypto.random().nextInt(1_000_000));
        return new OtpIssued(c.getId(), c.getMaskedMobile(), c.getMaskedEmail(), props.isDevMode() ? fake : null);
    }

    private OtpChallenge base(OtpChallenge.Purpose purpose) {
        LocalDateTime now = Fmt.now();
        OtpChallenge c = new OtpChallenge();
        c.setId(UUID.randomUUID().toString());
        c.setPurpose(purpose);
        c.setCreatedAt(now);
        c.setExpiresAt(now.plusMinutes(props.getSecurity().getOtpValidityMinutes()));
        return c;
    }

    private void checkRate(String rateKey) {
        if (rateKey != null && !rateLimiter.tryAcquire("otp:" + rateKey,
                props.getRateLimit().getOtpPerUserPer15Min(), 15 * 60_000L)) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMITED",
                    "Too many OTP requests. Please try again after some time.");
        }
    }

    public OtpChallenge get(String challengeId) {
        if (challengeId == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "OTP_INVALID", "Invalid or unknown OTP request");
        }
        return repo.findById(challengeId).orElseThrow(() ->
                new ApiException(HttpStatus.BAD_REQUEST, "OTP_INVALID", "Invalid or unknown OTP request"));
    }

    /**
     * Verifies an OTP. Runs in its own transaction so that failed attempts are counted even though the
     * caller's transaction is rolled back by the resulting exception.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW, noRollbackFor = ApiException.class)
    public OtpChallenge verify(String challengeId, String otp, OtpChallenge.Purpose purpose) {
        OtpChallenge c = get(challengeId);
        if (c.getPurpose() != purpose || c.isUsed()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "OTP_INVALID", "This OTP is no longer valid. Please request a new one.");
        }
        int max = props.getSecurity().getOtpMaxAttempts();
        if (c.getAttempts() >= max) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "OTP_ATTEMPTS_EXCEEDED",
                    "Too many incorrect attempts. Please request a new OTP.");
        }
        if (LocalDateTime.now(Fmt.IST).isAfter(c.getExpiresAt())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "OTP_EXPIRED", "This OTP has expired. Please request a new one.");
        }
        boolean ok = !c.isDummy() && otp != null && otp.matches("\\d{6}")
                && java.security.MessageDigest.isEqual(hash(c.getId(), otp).getBytes(), c.getOtpHash().getBytes());
        if (!ok) {
            c.setAttempts(c.getAttempts() + 1);
            repo.save(c);
            if (c.getAttempts() >= max) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "OTP_ATTEMPTS_EXCEEDED",
                        "Too many incorrect attempts. Please request a new OTP.");
            }
            int left = max - c.getAttempts();
            throw new ApiException(HttpStatus.BAD_REQUEST, "OTP_INVALID",
                    "Incorrect OTP. " + left + (left == 1 ? " attempt" : " attempts") + " left.");
        }
        c.setUsed(true);
        repo.save(c);
        return c;
    }

    /**
     * For long forms (online KYC) whose mobile is verified on the first step: accepts a challenge that is
     * either still open (verified now) or was already verified with the same OTP less than
     * {@code verifiedValidMinutes} after it was issued. Wrong OTPs still count against the attempt limit.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW, noRollbackFor = ApiException.class)
    public OtpChallenge verifyOrConfirm(String challengeId, String otp, OtpChallenge.Purpose purpose,
                                        int verifiedValidMinutes) {
        OtpChallenge c = get(challengeId);
        if (!c.isUsed()) {
            return verify(challengeId, otp, purpose);
        }
        int max = props.getSecurity().getOtpMaxAttempts();
        if (c.getPurpose() != purpose || c.isDummy() || c.getAttempts() >= max) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "OTP_INVALID", "This OTP is no longer valid. Please request a new one.");
        }
        if (LocalDateTime.now(Fmt.IST).isAfter(c.getCreatedAt().plusMinutes(verifiedValidMinutes))) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "OTP_EXPIRED",
                    "Your mobile verification has expired. Please verify your mobile number again.");
        }
        boolean ok = otp != null && otp.matches("\\d{6}")
                && java.security.MessageDigest.isEqual(hash(c.getId(), otp).getBytes(), c.getOtpHash().getBytes());
        if (!ok) {
            c.setAttempts(c.getAttempts() + 1);
            repo.save(c);
            throw new ApiException(HttpStatus.BAD_REQUEST, "OTP_INVALID", "This OTP is no longer valid. Please request a new one.");
        }
        return c;
    }

    @Transactional
    public void markUsed(OtpChallenge c) {
        c.setUsed(true);
        repo.save(c);
    }

    private static String hash(String challengeId, String otp) {
        return CryptoService.sha256(challengeId + ":" + otp);
    }

    private static String label(OtpChallenge.Purpose p) {
        return switch (p) {
            case LOGIN -> "login";
            case RESET -> "password reset";
            case ACTIVATE -> "account activation";
            case CHANGE_PASSWORD -> "changing your password";
            case LEAD -> "verifying your mobile number";
            case ORDER_APPROVAL -> "approving your order";
        };
    }
}
