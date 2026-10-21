package com.aureusfinserve.notification;

import com.aureusfinserve.common.Fmt;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Stub gateway: logs instead of sending. Any 6-digit number (an OTP) is redacted so OTPs never reach
 * the logs through this path - the only OTP log line is the explicit dev-mode line in OtpService.
 */
@Slf4j
@Component
public class LoggingNotificationGateway implements NotificationGateway {

    @Override
    public void sendSms(String mobile, String message) {
        log.info("[SMS stub] to {}: {}", Fmt.maskMobile(mobile), redact(message));
    }

    @Override
    public void sendEmail(String email, String subject, String body) {
        log.info("[Email stub] to {}: {} - {}", Fmt.maskEmail(email), subject, redact(body));
    }

    private static String redact(String s) {
        return s == null ? null : s.replaceAll("\\b\\d{6}\\b", "******");
    }
}
