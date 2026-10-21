package com.aureusfinserve.admin;

import com.aureusfinserve.admin.AdminDtos.StaffUser;
import com.aureusfinserve.admin.AdminDtos.StaffUserRequest;
import com.aureusfinserve.audit.AuditService;
import com.aureusfinserve.auth.AppUser;
import com.aureusfinserve.auth.AppUserRepository;
import com.aureusfinserve.auth.SessionService;
import com.aureusfinserve.common.*;
import com.aureusfinserve.notification.NotificationService;
import com.aureusfinserve.security.AuthUser;
import com.aureusfinserve.security.CryptoService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Staff (RM / ADMIN) user administration. */
@Service
@RequiredArgsConstructor
public class StaffUserService {

    private static final String ALNUM = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    private static final String SYMBOLS = "@#$%&!";

    private final AppUserRepository userRepo;
    private final PasswordEncoder encoder;
    private final SessionService sessions;
    private final CryptoService crypto;
    private final AuditService audit;
    private final NotificationService notifications;

    public List<StaffUser> list() {
        return userRepo.findByRoleInOrderByNameAsc(List.of(Role.RM, Role.ADMIN)).stream().map(StaffUserService::dto).toList();
    }

    static StaffUser dto(AppUser u) {
        return new StaffUser(u.getId(), u.getName(), u.getEmail(), Fmt.maskMobile(u.getMobile()), u.getRole(), u.getEuin(),
                u.isEnabled(), ClientService.effectiveStatus(u), u.getLastLoginAt());
    }

    /** Random temporary password that satisfies the password policy. */
    public String tempPassword() {
        StringBuilder sb = new StringBuilder("Af");
        for (int i = 0; i < 7; i++) {
            sb.append(ALNUM.charAt(crypto.random().nextInt(ALNUM.length())));
        }
        sb.append(SYMBOLS.charAt(crypto.random().nextInt(SYMBOLS.length())));
        sb.append(crypto.random().nextInt(10)).append(crypto.random().nextInt(10));
        return sb.toString();
    }

    private AppUser staff(Long id) {
        AppUser u = userRepo.findById(id).orElseThrow(() -> ApiException.notFound("User"));
        if (!u.isStaff()) {
            throw ApiException.notFound("User");
        }
        return u;
    }

    @Transactional
    public Map<String, Object> create(StaffUserRequest r) {
        if (r.role() == Role.INVESTOR) {
            throw ApiException.validation("role", "Role must be RM or ADMIN");
        }
        String email = r.email().trim().toLowerCase(Locale.ROOT);
        String mobile = CryptoService.normaliseMobile(r.mobile());
        if (userRepo.findFirstByEmailHash(crypto.emailHash(email)).isPresent()) {
            throw ApiException.conflict("A login with this e-mail already exists");
        }
        if (userRepo.findFirstByMobileHash(crypto.mobileHash(mobile)).isPresent()) {
            throw ApiException.conflict("A login with this mobile already exists");
        }
        String temp = tempPassword();
        AppUser u = new AppUser();
        u.setName(r.name().trim());
        u.setEmail(email);
        u.setEmailHash(crypto.emailHash(email));
        u.setMobile(mobile);
        u.setMobileHash(crypto.mobileHash(mobile));
        u.setRole(r.role());
        u.setEuin(r.euin() == null || r.euin().isBlank() ? null : r.euin().trim().toUpperCase(Locale.ROOT));
        u.setPasswordHash(encoder.encode(temp));
        u.setPasswordChangedAt(Fmt.now());
        u.setLoginStatus(LoginStatus.ACTIVE);
        u.setEnabled(true);
        u.setCreatedAt(Fmt.now());
        userRepo.save(u);
        audit.log("USER_CREATED", "USER", u.getId(), u.getName() + " as " + u.getRole());
        notifications.email(u.getEmail(), "Your Aureus Finserve staff account",
                "An account has been created for you. Your administrator will share your temporary password separately.");
        return Map.of("user", dto(u), "tempPassword", temp);
    }

    @Transactional
    public String resetPassword(Long id) {
        AppUser u = staff(id);
        String temp = tempPassword();
        u.setPasswordHash(encoder.encode(temp));
        u.setPasswordChangedAt(Fmt.now());
        u.setFailedAttempts(0);
        u.setLockedUntil(null);
        if (u.getLoginStatus() == LoginStatus.LOCKED) {
            u.setLoginStatus(LoginStatus.ACTIVE);
        }
        userRepo.save(u);
        sessions.revokeAll(u.getId(), "PASSWORD_RESET");
        audit.log("PASSWORD_RESET", "USER", u.getId(), "Temporary password issued by admin");
        return temp;
    }

    @Transactional
    public void forceLogout(Long id) {
        AppUser u = staff(id);
        int n = sessions.revokeAll(u.getId(), "FORCE_LOGOUT");
        audit.log("FORCE_LOGOUT", "USER", u.getId(), n + " session(s) revoked");
    }

    @Transactional
    public StaffUser setEnabled(AuthUser by, Long id, boolean enabled) {
        AppUser u = staff(id);
        if (!enabled && u.getId().equals(by.userId())) {
            throw ApiException.validation("enabled", "You cannot disable your own account");
        }
        ClientService.applyEnabled(u, enabled, sessions);
        userRepo.save(u);
        audit.log("USER_UPDATED", "USER", u.getId(), enabled ? "Enabled" : "Disabled");
        return dto(u);
    }
}
