package com.aureusfinserve.portfolio;

import com.aureusfinserve.audit.AuditService;
import com.aureusfinserve.common.ApiException;
import com.aureusfinserve.common.Fmt;
import com.aureusfinserve.common.NotificationType;
import com.aureusfinserve.common.RegistrationType;
import com.aureusfinserve.common.SipStatus;
import com.aureusfinserve.investor.Investor;
import com.aureusfinserve.notification.NotificationService;
import com.aureusfinserve.portfolio.PortfolioDtos.Sip;
import com.aureusfinserve.portfolio.PortfolioRepos.FolioRepository;
import com.aureusfinserve.portfolio.PortfolioRepos.SipRegistrationRepository;
import com.aureusfinserve.publicsite.Scheme;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;

/** SIP / STP / SWP registrations: listing and pause / resume / step-up / cancel. */
@Service
@RequiredArgsConstructor
public class SipService {

    private final SipRegistrationRepository sipRepo;
    private final FolioRepository folioRepo;
    private final PortfolioService portfolio;
    private final AuditService audit;
    private final NotificationService notifications;

    @Transactional
    public List<Sip> list(Collection<Long> investorIds) {
        PortfolioService.Book b = portfolio.load(investorIds);
        return b.sips().stream().map(s -> toDto(autoResume(s), b)).toList();
    }

    public Sip toDto(SipRegistration s, PortfolioService.Book b) {
        Investor inv = b.investors().get(s.getInvestorId());
        Scheme sch = b.schemes().get(s.getSchemeId());
        Scheme target = s.getTargetSchemeId() == null ? null : b.schemes().get(s.getTargetSchemeId());
        String folioNo = s.getFolioId() == null ? null
                : b.folios().stream().filter(f -> f.getId().equals(s.getFolioId())).map(Folio::getFolioNo)
                .findFirst().orElse(null);
        return new Sip(s.getId(), s.getInvestorId(), inv == null ? null : inv.getName(), s.getSchemeId(),
                sch == null ? null : sch.getName(), folioNo, Fmt.money(s.getAmount()), s.getSipDay(),
                nextDebitDate(s, Fmt.today()), s.getStatus(), s.getStepUpPct(), s.getStartDate(),
                s.getInstallmentsDone(), s.getPausedUntil(), s.getRegType(), s.getInstallments(),
                target == null ? null : target.getName());
    }

    public static LocalDate nextDebitDate(SipRegistration s, LocalDate today) {
        if (s.getStatus() == SipStatus.CANCELLED) {
            return null;
        }
        if (s.getInstallments() != null && s.getInstallmentsDone() >= s.getInstallments()) {
            return null;
        }
        LocalDate base = today.plusDays(1);
        if (s.getStatus() == SipStatus.PAUSED && s.getPausedUntil() != null && !s.getPausedUntil().isBefore(base)) {
            base = s.getPausedUntil().plusDays(1);
        }
        LocalDate candidate = base.withDayOfMonth(Math.min(s.getSipDay(), base.lengthOfMonth()));
        if (candidate.isBefore(base)) {
            LocalDate nm = base.plusMonths(1);
            candidate = nm.withDayOfMonth(Math.min(s.getSipDay(), nm.lengthOfMonth()));
        }
        return candidate;
    }

    private SipRegistration autoResume(SipRegistration s) {
        if (s.getStatus() == SipStatus.PAUSED && s.getPausedUntil() != null && s.getPausedUntil().isBefore(Fmt.today())) {
            s.setStatus(SipStatus.ACTIVE);
            s.setPausedUntil(null);
            sipRepo.save(s);
        }
        return s;
    }

    private SipRegistration load(Long id, Collection<Long> allowedInvestors) {
        SipRegistration s = sipRepo.findById(id).orElseThrow(() -> ApiException.notFound("SIP"));
        if (!allowedInvestors.contains(s.getInvestorId())) {
            throw ApiException.notFound("SIP");
        }
        return s;
    }

    private Sip done(SipRegistration s, String what) {
        sipRepo.save(s);
        audit.log("SIP_CHANGED", "SIP", s.getId(), what);
        notifications.notifyInvestor(s.getInvestorId(), NotificationType.SIP, "SIP updated",
                "Your " + s.getRegType() + " (#" + s.getId() + ") was updated: " + what + ".");
        PortfolioService.Book b = portfolio.load(List.of(s.getInvestorId()));
        return toDto(s, b);
    }

    @Transactional
    public Sip pause(Long id, Integer months, Collection<Long> allowed) {
        if (months == null || months < 1 || months > 6) {
            throw ApiException.validation("months", "Pause must be between 1 and 6 months");
        }
        SipRegistration s = load(id, allowed);
        if (s.getStatus() != SipStatus.ACTIVE) {
            throw ApiException.conflict("Only an active SIP can be paused");
        }
        s.setStatus(SipStatus.PAUSED);
        s.setPausedUntil(Fmt.today().plusMonths(months));
        return done(s, "paused for " + months + " month(s) until " + s.getPausedUntil());
    }

    @Transactional
    public Sip resume(Long id, Collection<Long> allowed) {
        SipRegistration s = load(id, allowed);
        if (s.getStatus() != SipStatus.PAUSED) {
            throw ApiException.conflict("Only a paused SIP can be resumed");
        }
        s.setStatus(SipStatus.ACTIVE);
        s.setPausedUntil(null);
        return done(s, "resumed");
    }

    @Transactional
    public Sip stepUp(Long id, Integer pct, Collection<Long> allowed) {
        if (pct == null || pct < 5 || pct > 50) {
            throw ApiException.validation("stepUpPct", "Annual step-up must be between 5% and 50%");
        }
        SipRegistration s = load(id, allowed);
        if (s.getRegType() != RegistrationType.SIP) {
            throw ApiException.validation("Step-up is available only for SIPs");
        }
        if (s.getStatus() == SipStatus.CANCELLED) {
            throw ApiException.conflict("This SIP is cancelled");
        }
        s.setStepUpPct(pct);
        return done(s, "annual step-up set to " + pct + "%");
    }

    @Transactional
    public Sip cancel(Long id, Collection<Long> allowed) {
        SipRegistration s = load(id, allowed);
        if (s.getStatus() == SipStatus.CANCELLED) {
            throw ApiException.conflict("This SIP is already cancelled");
        }
        s.setStatus(SipStatus.CANCELLED);
        s.setPausedUntil(null);
        return done(s, "cancelled");
    }
}
