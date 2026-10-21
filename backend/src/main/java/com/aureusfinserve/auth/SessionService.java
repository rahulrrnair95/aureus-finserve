package com.aureusfinserve.auth;

import com.aureusfinserve.common.Fmt;
import com.aureusfinserve.common.Role;
import com.aureusfinserve.config.AppProperties;
import com.aureusfinserve.security.AuthUser;
import com.aureusfinserve.security.CryptoService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

/** Opaque bearer-token sessions persisted in user_session (only SHA-256 of the token is stored). */
@Service
@RequiredArgsConstructor
public class SessionService {

    public record AuthResult(AuthUser user, String errorCode) {
    }

    private final UserSessionRepository sessionRepo;
    private final AppUserRepository userRepo;
    private final CryptoService crypto;
    private final AppProperties props;

    public int idleMinutes(Role role) {
        return role == Role.INVESTOR ? props.getSecurity().getIdleTimeoutInvestorMinutes()
                : props.getSecurity().getIdleTimeoutStaffMinutes();
    }

    /** Creates a session and returns the raw token (shown to the client once). Staff keep a single session. */
    @Transactional
    public String create(AppUser user, String deviceId, String ip) {
        if (user.isStaff()) {
            sessionRepo.revokeAllForUser(user.getId(), "NEW_LOGIN");
        }
        String token = crypto.randomToken(32);
        LocalDateTime now = Fmt.now();
        UserSession s = new UserSession();
        s.setTokenHash(CryptoService.sha256(token));
        s.setUserId(user.getId());
        s.setRole(user.getRole());
        s.setDeviceId(deviceId);
        s.setIp(ip);
        s.setCreatedAt(now);
        s.setLastSeenAt(now);
        s.setExpiresAt(now.plusHours(props.getSecurity().getAbsoluteTimeoutHours()));
        sessionRepo.save(s);
        return token;
    }

    @Transactional
    public AuthResult authenticate(String token) {
        if (token == null || token.isBlank()) {
            return new AuthResult(null, "UNAUTHORIZED");
        }
        Optional<UserSession> opt = sessionRepo.findByTokenHash(CryptoService.sha256(token));
        if (opt.isEmpty()) {
            return new AuthResult(null, "UNAUTHORIZED");
        }
        UserSession s = opt.get();
        if (s.isRevoked()) {
            return new AuthResult(null, "IDLE_TIMEOUT".equals(s.getRevokedReason())
                    || "ABSOLUTE_TIMEOUT".equals(s.getRevokedReason()) ? "SESSION_EXPIRED" : "UNAUTHORIZED");
        }
        LocalDateTime now = LocalDateTime.now(Fmt.IST);
        if (now.isAfter(s.getExpiresAt())) {
            revoke(s, "ABSOLUTE_TIMEOUT");
            return new AuthResult(null, "SESSION_EXPIRED");
        }
        if (now.isAfter(s.getLastSeenAt().plusMinutes(idleMinutes(s.getRole())))) {
            revoke(s, "IDLE_TIMEOUT");
            return new AuthResult(null, "SESSION_EXPIRED");
        }
        AppUser u = userRepo.findById(s.getUserId()).orElse(null);
        if (u == null || !u.isEnabled()) {
            revoke(s, "DISABLED");
            return new AuthResult(null, "UNAUTHORIZED");
        }
        // Throttle writes: refresh last-seen at most every 15 seconds.
        if (s.getLastSeenAt().plusSeconds(15).isBefore(now)) {
            s.setLastSeenAt(now.withNano(0));
            sessionRepo.save(s);
        }
        return new AuthResult(new AuthUser(u.getId(), u.getName(), u.getRole(), u.getInvestorId(), s.getId()), null);
    }

    private void revoke(UserSession s, String reason) {
        s.setRevoked(true);
        s.setRevokedReason(reason);
        sessionRepo.save(s);
    }

    @Transactional
    public void revokeSession(Long sessionId, String reason) {
        sessionRepo.findById(sessionId).ifPresent(s -> revoke(s, reason));
    }

    @Transactional
    public int revokeAll(Long userId, String reason) {
        return sessionRepo.revokeAllForUser(userId, reason);
    }

    @Transactional
    public int revokeOthers(Long userId, Long keepSessionId, String reason) {
        return sessionRepo.revokeOthersForUser(userId, keepSessionId, reason);
    }
}
