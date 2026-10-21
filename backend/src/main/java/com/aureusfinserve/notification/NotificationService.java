package com.aureusfinserve.notification;

import com.aureusfinserve.auth.AppUser;
import com.aureusfinserve.auth.AppUserRepository;
import com.aureusfinserve.common.Fmt;
import com.aureusfinserve.common.NotificationType;
import com.aureusfinserve.config.AppProperties;
import com.aureusfinserve.investor.Investor;
import com.aureusfinserve.investor.InvestorRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

/** In-app notifications plus SMS / e-mail through the {@link NotificationGateway}. */
@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository repo;
    private final AppUserRepository userRepo;
    private final InvestorRepository investorRepo;
    private final NotificationGateway gateway;
    private final AppProperties props;

    /** E-mails the firm (app.mail.notify-to, else app.firm.email) about a new client submission. */
    public void notifyFirm(String subject, String body) {
        String to = props.getMail().getNotifyTo();
        if (to == null || to.isBlank()) {
            to = props.getFirm().getEmail();
        }
        email(to, subject, body + "\n\n--\nSent automatically by the Aureus Finserve website. "
                + "Open the staff console (" + props.getFrontendUrl() + "/console) for the full record.");
    }

    @Transactional
    public void notifyUser(Long userId, NotificationType type, String title, String message) {
        if (userId == null) {
            return;
        }
        Notification n = new Notification();
        n.setUserId(userId);
        n.setType(type);
        n.setTitle(title);
        n.setMessage(message);
        n.setCreatedAt(Fmt.now());
        repo.save(n);
    }

    /** Notifies the investor's own login, or the family head's login for members without one. */
    @Transactional
    public void notifyInvestor(Long investorId, NotificationType type, String title, String message) {
        loginUserFor(investorId).ifPresent(u -> notifyUser(u.getId(), type, title, message));
    }

    public Optional<AppUser> loginUserFor(Long investorId) {
        Optional<AppUser> own = userRepo.findFirstByInvestorId(investorId);
        if (own.isPresent()) {
            return own;
        }
        return investorRepo.findById(investorId)
                .map(Investor::getFamilyHeadId)
                .flatMap(userRepo::findFirstByInvestorId);
    }

    public void sms(String mobile, String message) {
        if (mobile != null) {
            gateway.sendSms(mobile, message);
        }
    }

    public void email(String email, String subject, String body) {
        if (email != null) {
            gateway.sendEmail(email, subject, body);
        }
    }
}
