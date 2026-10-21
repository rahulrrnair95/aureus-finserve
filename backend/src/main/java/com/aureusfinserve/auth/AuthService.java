package com.aureusfinserve.auth;

import com.aureusfinserve.audit.AuditService;
import com.aureusfinserve.common.ApiException;
import com.aureusfinserve.common.Fmt;
import com.aureusfinserve.common.LoginStatus;
import com.aureusfinserve.common.NotificationType;
import com.aureusfinserve.common.Role;
import com.aureusfinserve.config.AppProperties;
import com.aureusfinserve.investor.Investor;
import com.aureusfinserve.investor.InvestorRepository;
import com.aureusfinserve.notification.NotificationService;
import com.aureusfinserve.security.AuthUser;
import com.aureusfinserve.security.CryptoService;
import com.aureusfinserve.security.RequestInfo;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/** Login (password + OTP), OTP-only login, password reset / change, and first-time activation. */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    public static final String PAN_REGEX = "[A-Za-z]{5}[0-9]{4}[A-Za-z]";

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record LoginResult(String status, String challengeId, String maskedMobile, String maskedEmail,
                              String devOtp, String token, UserDto user) {
        static LoginResult otp(OtpService.OtpIssued o) {
            return new LoginResult("OTP_REQUIRED", o.challengeId(), o.maskedMobile(), o.maskedEmail(), o.devOtp(), null, null);
        }

        static LoginResult ok(String token, UserDto user) {
            return new LoginResult("OK", null, null, null, null, token, user);
        }
    }

    private volatile String dummyHash;

    private final AppUserRepository userRepo;
    private final InvestorRepository investorRepo;
    private final ActivationTokenRepository activationRepo;
    private final PasswordEncoder encoder;
    private final OtpService otpService;
    private final CaptchaService captchaService;
    private final SessionService sessionService;
    private final DeviceService deviceService;
    private final AuditService audit;
    private final NotificationService notifications;
    private final CryptoService crypto;
    private final AppProperties props;

    private String dummyHash() {
        if (dummyHash == null) {
            dummyHash = encoder.encode("timing-equaliser-" + crypto.randomToken(8));
        }
        return dummyHash;
    }

    // ------------------------------------------------------------------ lookup

    /** Resolves the "User ID" field: 10-digit mobile, e-mail, or PAN. */
    public Optional<AppUser> resolve(String userId) {
        if (userId == null) {
            return Optional.empty();
        }
        String s = userId.trim();
        String digits = s.replaceAll("[\\s+-]", "");
        if (digits.matches("(91)?\\d{10}")) {
            return userRepo.findFirstByMobileHash(crypto.mobileHash(digits));
        }
        if (s.contains("@")) {
            return userRepo.findFirstByEmailHash(crypto.emailHash(s));
        }
        if (s.matches(PAN_REGEX)) {
            return investorRepo.findFirstByPanHash(crypto.panHash(s))
                    .flatMap(inv -> userRepo.findFirstByInvestorId(inv.getId()));
        }
        return Optional.empty();
    }

    public UserDto toDto(AppUser u) {
        String pan = null;
        if (u.getInvestorId() != null) {
            pan = investorRepo.findById(u.getInvestorId()).map(Investor::getPan).orElse(null);
        }
        return new UserDto(u.getId(), u.getName(), u.getRole(), u.getEmail(), Fmt.maskMobile(u.getMobile()),
                Fmt.maskPan(pan), u.getInvestorId(), u.isStaff() ? u.getEuin() : null,
                sessionService.idleMinutes(u.getRole()));
    }

    // ------------------------------------------------------------------ login

    @Transactional(noRollbackFor = ApiException.class)
    public LoginResult login(String userId, String password, String captchaId, String captchaAnswer) {
        Optional<AppUser> opt = resolve(userId);
        if (opt.isEmpty()) {
            encoder.matches(password == null ? "" : password, dummyHash()); // equalise timing
            audit.logAs(null, null, null, "LOGIN_FAILED", "USER", null, "Unknown user id");
            throw invalidCredentials();
        }
        AppUser u = opt.get();
        checkUsable(u);
        if (u.getFailedAttempts() >= props.getSecurity().getCaptchaThreshold()) {
            if (captchaId == null || captchaId.isBlank() || captchaAnswer == null || captchaAnswer.isBlank()) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "CAPTCHA_REQUIRED",
                        "Please solve the CAPTCHA to continue");
            }
            if (!captchaService.check(captchaId, captchaAnswer)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "CAPTCHA_INVALID",
                        "The CAPTCHA answer is incorrect. Please try again.");
            }
        }
        if (u.getPasswordHash() == null || password == null || !encoder.matches(password, u.getPasswordHash())) {
            registerFailure(u);
        }
        u.setFailedAttempts(0);
        userRepo.save(u);

        String deviceId = RequestInfo.deviceId();
        if (u.getRole() == Role.INVESTOR && deviceService.isTrusted(u.getId(), deviceId)) {
            return completeLogin(u, deviceId, false, "Trusted device - OTP skipped");
        }
        OtpService.OtpIssued o = otpService.issue(new OtpService.OtpTarget(OtpChallenge.Purpose.LOGIN, u.getId(),
                u.getMobile(), u.getEmail(), null, null, "user:" + u.getId()), deviceId);
        return LoginResult.otp(o);
    }

    /** Investors only: OTP-only login. Unknown ids get an indistinguishable dummy challenge. */
    @Transactional(noRollbackFor = ApiException.class)
    public LoginResult loginOtp(String userId) {
        Optional<AppUser> opt = resolve(userId).filter(u -> u.getRole() == Role.INVESTOR);
        if (opt.isEmpty()) {
            return LoginResult.otp(otpService.issueDummy(OtpChallenge.Purpose.LOGIN, "id:" + norm(userId)));
        }
        AppUser u = opt.get();
        checkUsable(u);
        OtpService.OtpIssued o = otpService.issue(new OtpService.OtpTarget(OtpChallenge.Purpose.LOGIN, u.getId(),
                u.getMobile(), u.getEmail(), null, null, "user:" + u.getId()), RequestInfo.deviceId());
        return LoginResult.otp(o);
    }

    @Transactional(noRollbackFor = ApiException.class)
    public LoginResult verifyOtp(String challengeId, String otp, boolean rememberDevice) {
        OtpChallenge c = otpService.verify(challengeId, otp, OtpChallenge.Purpose.LOGIN);
        AppUser u = userRepo.findById(c.getUserId()).orElseThrow(this::invalidCredentials);
        checkUsable(u);
        String deviceId = RequestInfo.deviceId();
        boolean trust = rememberDevice && u.getRole() == Role.INVESTOR && deviceId != null;
        return completeLogin(u, deviceId, trust, trust ? "Device trusted for "
                + props.getSecurity().getTrustedDeviceDays() + " days" : null);
    }

    private LoginResult completeLogin(AppUser u, String deviceId, boolean trust, String note) {
        String token = sessionService.create(u, deviceId, RequestInfo.ip());
        u.setLastLoginAt(Fmt.now());
        u.setFailedAttempts(0);
        userRepo.save(u);
        deviceService.recordLogin(u, deviceId, trust);
        audit.logAs(u.getId(), u.getName(), u.getRole().name(), "LOGIN_SUCCESS", "USER", u.getId(), note);
        return LoginResult.ok(token, toDto(u));
    }

    private void checkUsable(AppUser u) {
        if (!u.isEnabled() || u.getLoginStatus() == LoginStatus.DISABLED) {
            throw new ApiException(HttpStatus.FORBIDDEN, "ACCOUNT_DISABLED",
                    "This account has been disabled. Please contact us for help.");
        }
        if (u.getLoginStatus() == LoginStatus.NOT_ACTIVATED) {
            throw new ApiException(HttpStatus.FORBIDDEN, "NOT_ACTIVATED",
                    "This account is not activated yet. Please use the activation link sent to you.");
        }
        if (u.getLockedUntil() != null) {
            if (u.getLockedUntil().isAfter(LocalDateTime.now(Fmt.IST))) {
                throw locked(u.getLockedUntil());
            }
            // lock expired -> auto unlock
            u.setLockedUntil(null);
            u.setFailedAttempts(0);
            u.setLoginStatus(LoginStatus.ACTIVE);
            userRepo.save(u);
        }
    }

    private void registerFailure(AppUser u) {
        int attempts = u.getFailedAttempts() + 1;
        u.setFailedAttempts(attempts);
        audit.logAs(u.getId(), u.getName(), u.getRole().name(), "LOGIN_FAILED", "USER", u.getId(),
                "Wrong password (attempt " + attempts + ")");
        if (attempts >= props.getSecurity().getLockoutThreshold()) {
            LocalDateTime until = Fmt.now().plusMinutes(props.getSecurity().getLockoutMinutes());
            u.setLockedUntil(until);
            u.setLoginStatus(LoginStatus.LOCKED);
            userRepo.save(u);
            audit.logAs(u.getId(), u.getName(), u.getRole().name(), "ACCOUNT_LOCKED", "USER", u.getId(),
                    "Locked after " + attempts + " failed attempts until " + until);
            String msg = "Your Aureus Finserve account has been locked for " + props.getSecurity().getLockoutMinutes()
                    + " minutes after repeated failed login attempts. If this was not you, please reset your password.";
            notifications.sms(u.getMobile(), msg);
            notifications.email(u.getEmail(), "Account locked", msg);
            notifications.notifyUser(u.getId(), NotificationType.SECURITY, "Account locked", msg);
            throw locked(until);
        }
        userRepo.save(u);
        throw invalidCredentials();
    }

    private ApiException invalidCredentials() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Invalid user ID or password");
    }

    private ApiException locked(LocalDateTime until) {
        return new ApiException(HttpStatus.LOCKED, "ACCOUNT_LOCKED",
                "Your account is locked due to repeated failed attempts. Try again after "
                        + until.format(DateTimeFormatter.ofPattern("hh:mm a", Locale.ENGLISH)) + " or reset your password.");
    }

    // ------------------------------------------------------------------ resend / forgot / reset

    @Transactional(noRollbackFor = ApiException.class)
    public OtpService.OtpIssued resend(String challengeId) {
        OtpChallenge old = otpService.get(challengeId);
        if (old.isDummy() || old.getUserId() == null) {
            return otpService.issueDummy(old.getPurpose(), "challenge:" + challengeId);
        }
        AppUser u = userRepo.findById(old.getUserId()).orElseThrow(() -> ApiException.notFound("User"));
        if (old.getPurpose() == OtpChallenge.Purpose.LEAD) {
            throw ApiException.validation("Please request a new OTP");
        }
        otpService.markUsed(old);
        return otpService.issue(new OtpService.OtpTarget(old.getPurpose(), u.getId(), u.getMobile(), u.getEmail(),
                old.getRefId(), old.getRefText(), "user:" + u.getId()), old.getDeviceId());
    }

    @Transactional(noRollbackFor = ApiException.class)
    public OtpService.OtpIssued forgot(String userId) {
        Optional<AppUser> opt = resolve(userId)
                .filter(u -> u.isEnabled() && u.getLoginStatus() != LoginStatus.NOT_ACTIVATED
                        && u.getLoginStatus() != LoginStatus.DISABLED);
        if (opt.isEmpty()) {
            return otpService.issueDummy(OtpChallenge.Purpose.RESET, "id:" + norm(userId));
        }
        AppUser u = opt.get();
        return otpService.issue(new OtpService.OtpTarget(OtpChallenge.Purpose.RESET, u.getId(), u.getMobile(),
                u.getEmail(), null, null, "user:" + u.getId()), RequestInfo.deviceId());
    }

    @Transactional(noRollbackFor = ApiException.class)
    public void reset(String challengeId, String otp, String newPassword) {
        OtpChallenge pre = otpService.get(challengeId);
        AppUser u = pre.getUserId() == null ? null : userRepo.findById(pre.getUserId()).orElse(null);
        if (u != null) {
            PasswordPolicy.validate(newPassword, panOf(u), u.getMobile());
        }
        OtpChallenge c = otpService.verify(challengeId, otp, OtpChallenge.Purpose.RESET);
        if (u == null || !u.getId().equals(c.getUserId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "OTP_INVALID", "Invalid OTP request");
        }
        u.setPasswordHash(encoder.encode(newPassword));
        u.setPasswordChangedAt(Fmt.now());
        u.setFailedAttempts(0);
        u.setLockedUntil(null);
        if (u.getLoginStatus() == LoginStatus.LOCKED) {
            u.setLoginStatus(LoginStatus.ACTIVE);
        }
        userRepo.save(u);
        sessionService.revokeAll(u.getId(), "PASSWORD_RESET");
        audit.logAs(u.getId(), u.getName(), u.getRole().name(), "PASSWORD_RESET", "USER", u.getId(), "Via OTP");
        String msg = "Your Aureus Finserve password was reset. If you did not do this, contact us immediately.";
        notifications.sms(u.getMobile(), msg);
        notifications.notifyUser(u.getId(), NotificationType.SECURITY, "Password reset", msg);
    }

    // ------------------------------------------------------------------ session-bound

    public UserDto me(AuthUser au) {
        return toDto(userRepo.findById(au.userId()).orElseThrow(() -> ApiException.notFound("User")));
    }

    @Transactional
    public void logout(AuthUser au) {
        sessionService.revokeSession(au.sessionId(), "LOGOUT");
        audit.logAs(au.userId(), au.name(), au.role().name(), "LOGOUT", "USER", au.userId(), null);
    }

    @Transactional(noRollbackFor = ApiException.class)
    public OtpService.OtpIssued changePasswordOtp(AuthUser au) {
        AppUser u = userRepo.findById(au.userId()).orElseThrow(() -> ApiException.notFound("User"));
        return otpService.issue(new OtpService.OtpTarget(OtpChallenge.Purpose.CHANGE_PASSWORD, u.getId(),
                u.getMobile(), u.getEmail(), null, null, "user:" + u.getId()), RequestInfo.deviceId());
    }

    @Transactional(noRollbackFor = ApiException.class)
    public void changePassword(AuthUser au, String current, String newPassword, String challengeId, String otp) {
        AppUser u = userRepo.findById(au.userId()).orElseThrow(() -> ApiException.notFound("User"));
        if (current == null || u.getPasswordHash() == null || !encoder.matches(current, u.getPasswordHash())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_CREDENTIALS", "Current password is incorrect",
                    Map.of("currentPassword", "Current password is incorrect"));
        }
        PasswordPolicy.validate(newPassword, panOf(u), u.getMobile());
        if (encoder.matches(newPassword, u.getPasswordHash())) {
            throw ApiException.validation("newPassword", "New password must be different from the current password");
        }
        OtpChallenge c = otpService.verify(challengeId, otp, OtpChallenge.Purpose.CHANGE_PASSWORD);
        if (!u.getId().equals(c.getUserId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "OTP_INVALID", "Invalid OTP request");
        }
        u.setPasswordHash(encoder.encode(newPassword));
        u.setPasswordChangedAt(Fmt.now());
        userRepo.save(u);
        sessionService.revokeOthers(u.getId(), au.sessionId(), "PASSWORD_CHANGED");
        audit.logAs(u.getId(), u.getName(), u.getRole().name(), "PASSWORD_CHANGED", "USER", u.getId(), null);
        String msg = "Your Aureus Finserve password was changed. If you did not do this, contact us immediately.";
        notifications.sms(u.getMobile(), msg);
        notifications.notifyUser(u.getId(), NotificationType.SECURITY, "Password changed", msg);
    }

    // ------------------------------------------------------------------ activation

    /** Creates a new activation link (7 days), invalidating older unused ones; "sends" it by SMS / e-mail. */
    @Transactional
    public String createActivationLink(AppUser u) {
        for (ActivationToken old : activationRepo.findByUserIdAndUsedAtIsNull(u.getId())) {
            old.setExpiresAt(Fmt.now());
            activationRepo.save(old);
        }
        String raw = crypto.randomToken(24);
        ActivationToken t = new ActivationToken();
        t.setTokenHash(CryptoService.sha256(raw));
        t.setUserId(u.getId());
        t.setCreatedAt(Fmt.now());
        t.setExpiresAt(Fmt.now().plusDays(props.getSecurity().getActivationLinkDays()));
        activationRepo.save(t);
        String link = props.getFrontendUrl().split(",")[0].trim() + "/activate/" + raw;
        String msg = "Welcome to Aureus Finserve, " + u.getName() + ". Activate your online account within "
                + props.getSecurity().getActivationLinkDays() + " days: " + link;
        notifications.sms(u.getMobile(), msg);
        notifications.email(u.getEmail(), "Activate your Aureus Finserve account", msg);
        return link;
    }

    private ActivationToken validToken(String raw) {
        if (raw == null || raw.isBlank()) {
            throw ApiException.notFound("Activation link");
        }
        ActivationToken t = activationRepo.findByTokenHash(CryptoService.sha256(raw))
                .orElseThrow(() -> ApiException.notFound("Activation link"));
        if (t.getUsedAt() != null || t.getExpiresAt().isBefore(LocalDateTime.now(Fmt.IST))) {
            throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "This activation link has expired or was already used");
        }
        return t;
    }

    public Map<String, Object> activationInfo(String raw) {
        ActivationToken t = validToken(raw);
        AppUser u = userRepo.findById(t.getUserId()).orElseThrow(() -> ApiException.notFound("Activation link"));
        if (u.getLoginStatus() != LoginStatus.NOT_ACTIVATED) {
            throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "This account is already activated");
        }
        return Map.of("name", u.getName(), "valid", true);
    }

    @Transactional(noRollbackFor = ApiException.class)
    public OtpService.OtpIssued activationVerify(String raw, String pan, String dob) {
        ActivationToken t = validToken(raw);
        AppUser u = userRepo.findById(t.getUserId()).orElseThrow(() -> ApiException.notFound("Activation link"));
        if (u.getLoginStatus() != LoginStatus.NOT_ACTIVATED) {
            throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "This account is already activated");
        }
        Investor inv = u.getInvestorId() == null ? null : investorRepo.findById(u.getInvestorId()).orElse(null);
        boolean match = inv != null && pan != null && dob != null
                && pan.trim().equalsIgnoreCase(inv.getPan()) && dob.trim().equals(inv.getDob());
        if (!match) {
            audit.logAs(u.getId(), u.getName(), u.getRole().name(), "LOGIN_FAILED", "USER", u.getId(),
                    "Activation: PAN/DOB mismatch");
            throw ApiException.validation("PAN or date of birth does not match our records");
        }
        return otpService.issue(new OtpService.OtpTarget(OtpChallenge.Purpose.ACTIVATE, u.getId(), u.getMobile(),
                u.getEmail(), t.getId(), null, "user:" + u.getId()), RequestInfo.deviceId());
    }

    @Transactional(noRollbackFor = ApiException.class)
    public void activationComplete(String challengeId, String otp, String newPassword) {
        OtpChallenge pre = otpService.get(challengeId);
        AppUser u = pre.getUserId() == null ? null : userRepo.findById(pre.getUserId()).orElse(null);
        if (u != null) {
            PasswordPolicy.validate(newPassword, panOf(u), u.getMobile());
        }
        OtpChallenge c = otpService.verify(challengeId, otp, OtpChallenge.Purpose.ACTIVATE);
        ActivationToken t = c.getRefId() == null ? null : activationRepo.findById(c.getRefId()).orElse(null);
        if (u == null || t == null || t.getUsedAt() != null || !t.getUserId().equals(u.getId())) {
            throw ApiException.notFound("Activation link");
        }
        u.setPasswordHash(encoder.encode(newPassword));
        u.setPasswordChangedAt(Fmt.now());
        u.setLoginStatus(LoginStatus.ACTIVE);
        u.setFailedAttempts(0);
        userRepo.save(u);
        t.setUsedAt(Fmt.now());
        activationRepo.save(t);
        audit.logAs(u.getId(), u.getName(), u.getRole().name(), "ACCOUNT_ACTIVATED", "USER", u.getId(), null);
        notifications.notifyUser(u.getId(), NotificationType.SECURITY, "Account activated",
                "Welcome to Aureus Finserve! Your online account is now active.");
    }

    private String panOf(AppUser u) {
        return u.getInvestorId() == null ? null
                : investorRepo.findById(u.getInvestorId()).map(Investor::getPan).orElse(null);
    }

    private static String norm(String s) {
        return s == null ? "" : s.trim().toLowerCase(Locale.ROOT);
    }
}
