package com.aureusfinserve.auth;

import com.aureusfinserve.common.Fmt;
import com.aureusfinserve.common.NotificationType;
import com.aureusfinserve.config.AppProperties;
import com.aureusfinserve.notification.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Optional;

/** Known / trusted devices (X-Device-Id) and new-device alerts. */
@Service
@RequiredArgsConstructor
public class DeviceService {

    private final UserDeviceRepository repo;
    private final NotificationService notifications;
    private final AppProperties props;

    public boolean isTrusted(Long userId, String deviceId) {
        if (deviceId == null) {
            return false;
        }
        return repo.findByUserIdAndDeviceId(userId, deviceId)
                .map(d -> d.getTrustedUntil() != null && d.getTrustedUntil().isAfter(LocalDateTime.now(Fmt.IST)))
                .orElse(false);
    }

    /** Records a successful login; alerts (SMS + e-mail + in-app) when the device was never seen before. */
    @Transactional
    public void recordLogin(AppUser user, String deviceId, boolean trust) {
        if (deviceId == null) {
            return;
        }
        LocalDateTime now = Fmt.now();
        Optional<UserDevice> existing = repo.findByUserIdAndDeviceId(user.getId(), deviceId);
        UserDevice d = existing.orElseGet(() -> {
            UserDevice nd = new UserDevice();
            nd.setUserId(user.getId());
            nd.setDeviceId(deviceId);
            nd.setFirstSeenAt(now);
            return nd;
        });
        d.setLastSeenAt(now);
        if (trust) {
            d.setTrustedUntil(now.plusDays(props.getSecurity().getTrustedDeviceDays()));
        }
        repo.save(d);
        if (existing.isEmpty()) {
            String when = now.format(DateTimeFormatter.ofPattern("dd MMM yyyy, hh:mm a"));
            String msg = "Your Aureus Finserve account was accessed from a new device on " + when
                    + ". If this was not you, reset your password immediately and contact us.";
            notifications.sms(user.getMobile(), msg);
            notifications.email(user.getEmail(), "New device login alert", msg);
            notifications.notifyUser(user.getId(), NotificationType.SECURITY, "New device login", msg);
        }
    }
}
