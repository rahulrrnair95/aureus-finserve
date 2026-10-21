package com.aureusfinserve.notification;

import com.aureusfinserve.common.Fmt;
import com.aureusfinserve.config.AppProperties;
import jakarta.mail.internet.MimeMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Primary;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Sends e-mail over SMTP (spring.mail.*) when app.mail.enabled=true. SMS still goes to the logging stub until an
 * SMS provider is integrated. Mail is sent on a background thread so a slow or failing SMTP server never blocks or
 * fails the request that triggered it (failures are logged).
 */
@Slf4j
@Primary
@Component
@ConditionalOnProperty(name = "app.mail.enabled", havingValue = "true")
public class SmtpNotificationGateway implements NotificationGateway {

    private final JavaMailSender mailSender;
    private final LoggingNotificationGateway smsFallback;
    private final String from;
    private final ExecutorService executor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "mail-sender");
        t.setDaemon(true);
        return t;
    });

    public SmtpNotificationGateway(JavaMailSender mailSender, LoggingNotificationGateway smsFallback, AppProperties props,
                                   @Value("${spring.mail.username:}") String smtpUser) {
        this.mailSender = mailSender;
        this.smsFallback = smsFallback;
        String configured = props.getMail().getFrom();
        this.from = configured != null && !configured.isBlank() ? configured : smtpUser;
    }

    @Override
    public void sendSms(String mobile, String message) {
        smsFallback.sendSms(mobile, message);
    }

    @Override
    public void sendEmail(String email, String subject, String body) {
        if (email == null || email.isBlank()) {
            return;
        }
        executor.submit(() -> {
            try {
                MimeMessage msg = mailSender.createMimeMessage();
                MimeMessageHelper h = new MimeMessageHelper(msg, false, StandardCharsets.UTF_8.name());
                h.setFrom(from, "Aureus Finserve");
                h.setTo(email.trim());
                h.setSubject(subject);
                h.setText(body, false);
                mailSender.send(msg);
                log.info("[Email] sent to {}: {}", Fmt.maskEmail(email), subject);
            } catch (Exception e) {
                log.error("[Email] could not send to {} ({}): {}", Fmt.maskEmail(email), subject, e.getMessage());
            }
        });
    }
}
