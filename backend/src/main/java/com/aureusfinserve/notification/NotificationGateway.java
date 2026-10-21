package com.aureusfinserve.notification;

/** Outbound SMS / e-mail. Replace {@link LoggingNotificationGateway} with a real provider integration. */
public interface NotificationGateway {

    void sendSms(String mobile, String message);

    void sendEmail(String email, String subject, String body);
}
