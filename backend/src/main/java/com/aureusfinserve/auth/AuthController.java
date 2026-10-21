package com.aureusfinserve.auth;

import com.aureusfinserve.security.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    public record LoginRequest(@NotBlank(message = "User ID is required") String userId,
                               @NotBlank(message = "Password is required") String password,
                               String captchaId, String captchaAnswer) {
    }

    public record UserIdRequest(@NotBlank(message = "User ID is required") String userId) {
    }

    public record VerifyOtpRequest(@NotBlank(message = "Challenge is required") String challengeId,
                                   @NotBlank(message = "OTP is required") String otp,
                                   boolean rememberDevice) {
    }

    public record ChallengeRequest(@NotBlank(message = "Challenge is required") String challengeId) {
    }

    public record ResetRequest(@NotBlank(message = "Challenge is required") String challengeId,
                               @NotBlank(message = "OTP is required") String otp,
                               @NotBlank(message = "New password is required") String newPassword) {
    }

    public record ActivateVerifyRequest(@NotBlank(message = "Token is required") String token,
                                        @NotBlank(message = "PAN is required") String pan,
                                        @NotBlank(message = "Date of birth is required") String dob) {
    }

    public record ChangePasswordRequest(@NotBlank(message = "Current password is required") String currentPassword,
                                        @NotBlank(message = "New password is required") String newPassword,
                                        @NotBlank(message = "Challenge is required") String challengeId,
                                        @NotBlank(message = "OTP is required") String otp) {
    }

    private static final Map<String, Object> OK = Map.of("ok", true);

    private final AuthService auth;
    private final CaptchaService captcha;

    public AuthController(AuthService auth, CaptchaService captcha) {
        this.auth = auth;
        this.captcha = captcha;
    }

    @PostMapping("/login")
    public AuthService.LoginResult login(@Valid @RequestBody LoginRequest r) {
        return auth.login(r.userId(), r.password(), r.captchaId(), r.captchaAnswer());
    }

    @PostMapping("/login-otp")
    public AuthService.LoginResult loginOtp(@Valid @RequestBody UserIdRequest r) {
        return auth.loginOtp(r.userId());
    }

    @PostMapping("/verify-otp")
    public AuthService.LoginResult verifyOtp(@Valid @RequestBody VerifyOtpRequest r) {
        return auth.verifyOtp(r.challengeId(), r.otp(), r.rememberDevice());
    }

    @PostMapping("/resend-otp")
    public OtpService.OtpIssued resend(@Valid @RequestBody ChallengeRequest r) {
        return auth.resend(r.challengeId());
    }

    @PostMapping("/forgot")
    public OtpService.OtpIssued forgot(@Valid @RequestBody UserIdRequest r) {
        return auth.forgot(r.userId());
    }

    @PostMapping("/reset")
    public Map<String, Object> reset(@Valid @RequestBody ResetRequest r) {
        auth.reset(r.challengeId(), r.otp(), r.newPassword());
        return OK;
    }

    @GetMapping("/activate/{token}")
    public Map<String, Object> activationInfo(@PathVariable String token) {
        return auth.activationInfo(token);
    }

    @PostMapping("/activate/verify")
    public OtpService.OtpIssued activationVerify(@Valid @RequestBody ActivateVerifyRequest r) {
        return auth.activationVerify(r.token(), r.pan(), r.dob());
    }

    @PostMapping("/activate/complete")
    public Map<String, Object> activationComplete(@Valid @RequestBody ResetRequest r) {
        auth.activationComplete(r.challengeId(), r.otp(), r.newPassword());
        return OK;
    }

    @GetMapping("/me")
    public UserDto me() {
        return auth.me(CurrentUser.get());
    }

    @PostMapping("/logout")
    public Map<String, Object> logout() {
        auth.logout(CurrentUser.get());
        return OK;
    }

    @PostMapping("/change-password/otp")
    public OtpService.OtpIssued changePasswordOtp() {
        return auth.changePasswordOtp(CurrentUser.get());
    }

    @PostMapping("/change-password")
    public Map<String, Object> changePassword(@Valid @RequestBody ChangePasswordRequest r) {
        auth.changePassword(CurrentUser.get(), r.currentPassword(), r.newPassword(), r.challengeId(), r.otp());
        return OK;
    }

    @GetMapping("/captcha")
    public CaptchaService.Captcha captcha() {
        return captcha.create();
    }
}
