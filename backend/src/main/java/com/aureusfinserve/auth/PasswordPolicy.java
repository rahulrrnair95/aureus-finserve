package com.aureusfinserve.auth;

import com.aureusfinserve.common.ApiException;

import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/** 8-64 chars, at least one letter, one digit and one symbol; must not equal PAN or mobile. */
public final class PasswordPolicy {

    private PasswordPolicy() {
    }

    public static Optional<String> violation(String pw, String pan, String mobile) {
        if (pw == null || pw.length() < 8 || pw.length() > 64) {
            return Optional.of("Password must be 8 to 64 characters long");
        }
        if (!pw.chars().anyMatch(Character::isLetter)) {
            return Optional.of("Password must contain at least one letter");
        }
        if (!pw.chars().anyMatch(Character::isDigit)) {
            return Optional.of("Password must contain at least one digit");
        }
        if (pw.chars().allMatch(Character::isLetterOrDigit)) {
            return Optional.of("Password must contain at least one symbol");
        }
        String lower = pw.toLowerCase(Locale.ROOT);
        if (pan != null && lower.equals(pan.toLowerCase(Locale.ROOT))) {
            return Optional.of("Password must not be the same as your PAN");
        }
        if (mobile != null && lower.equals(mobile.toLowerCase(Locale.ROOT))) {
            return Optional.of("Password must not be the same as your mobile number");
        }
        return Optional.empty();
    }

    public static void validate(String pw, String pan, String mobile) {
        violation(pw, pan, mobile).ifPresent(msg -> {
            throw new ApiException(org.springframework.http.HttpStatus.BAD_REQUEST, "VALIDATION", msg,
                    Map.of("newPassword", msg));
        });
    }
}
