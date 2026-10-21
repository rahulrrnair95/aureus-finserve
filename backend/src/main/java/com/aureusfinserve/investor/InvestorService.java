package com.aureusfinserve.investor;

import com.aureusfinserve.audit.AuditService;
import com.aureusfinserve.auth.AppUser;
import com.aureusfinserve.auth.AppUserRepository;
import com.aureusfinserve.common.ApiException;
import com.aureusfinserve.common.Fmt;
import com.aureusfinserve.common.NotificationType;
import com.aureusfinserve.common.TicketCategory;
import com.aureusfinserve.config.AppProperties;
import com.aureusfinserve.investor.InvestorDtos.*;
import com.aureusfinserve.investor.InvestorRepos.*;
import com.aureusfinserve.notification.Notification;
import com.aureusfinserve.notification.NotificationRepository;
import com.aureusfinserve.notification.NotificationService;
import com.aureusfinserve.portfolio.PortfolioDtos.Holding;
import com.aureusfinserve.portfolio.PortfolioRepos.FolioRepository;
import com.aureusfinserve.portfolio.PortfolioService;
import com.aureusfinserve.security.AuthUser;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

/** Investor self-service: family, profile, goals, RM details, notifications. */
@Service
@RequiredArgsConstructor
public class InvestorService {

    private final FamilyService family;
    private final InvestorRepository investorRepo;
    private final NomineeRepository nomineeRepo;
    private final BankAccountRepository bankRepo;
    private final MandateRepository mandateRepo;
    private final GoalRepository goalRepo;
    private final FolioRepository folioRepo;
    private final AppUserRepository userRepo;
    private final NotificationRepository notificationRepo;
    private final NotificationService notifications;
    private final PortfolioService portfolio;
    private final TicketService tickets;
    private final AuditService audit;
    private final AppProperties props;

    public List<FamilyMember> family(AuthUser u) {
        Investor self = family.self(u);
        return family.family(self).stream()
                .map(i -> new FamilyMember(i.getId(), i.getName(), FamilyService.relationLabel(self, i), Fmt.maskPan(i.getPan())))
                .toList();
    }

    public Profile profile(AuthUser u) {
        Investor i = family.self(u);
        return new Profile(i.getName(), Fmt.maskPan(i.getPan()), i.dobDate(), i.getEmail(), Fmt.maskMobile(i.getMobile()),
                i.getAddress(), i.getKycStatus(), i.getTaxStatus() == null ? "Resident Individual" : i.getTaxStatus(),
                nomineeRepo.findByInvestorId(i.getId()).stream().map(n -> new NomineeDto(n.getName(), n.getRelation(), n.getSharePct())).toList(),
                bankRepo.findByInvestorIdOrderByIdAsc(i.getId()).stream()
                        .map(b -> new BankDto(b.getBankName(), Fmt.maskAccount(b.getAccountNumber()), b.getIfsc(), b.isPrimaryAccount())).toList(),
                mandateRepo.findByInvestorId(i.getId()).stream()
                        .map(m -> new MandateDto(m.getId(), m.getUmrn(), m.getBankName(), Fmt.money(m.getLimitAmount()), m.getStatus())).toList());
    }

    // ------------------------------------------------------------------ goals

    public List<GoalDto> goals(AuthUser u) {
        List<Long> fam = family.familyIds(u);
        List<Goal> goals = goalRepo.findByInvestorIdInOrderByIdAsc(fam);
        Map<Long, Holding> holdings = portfolio.holdings(portfolio.load(fam)).stream()
                .collect(Collectors.toMap(Holding::folioId, h -> h));
        return goals.stream().map(g -> toDto(g, holdings)).toList();
    }

    private GoalDto toDto(Goal g, Map<Long, Holding> holdings) {
        double value = g.getFolioIds().stream().map(holdings::get).filter(Objects::nonNull)
                .mapToDouble(h -> h.value().doubleValue()).sum();
        double target = g.getTargetAmount().doubleValue();
        return new GoalDto(g.getId(), g.getName(), g.getType(), Fmt.money(g.getTargetAmount()), g.getTargetDate(),
                List.copyOf(g.getFolioIds()), Fmt.money(value), target > 0 ? Fmt.pct(Math.min(100, value / target * 100)) : 0.0);
    }

    @Transactional
    public GoalDto saveGoal(AuthUser u, Long id, GoalRequest r) {
        Investor self = family.self(u);
        List<Long> fam = family.familyIds(u);
        Goal g;
        if (id == null) {
            g = new Goal();
            g.setInvestorId(self.getId());
        } else {
            g = goalRepo.findById(id).filter(x -> fam.contains(x.getInvestorId()))
                    .orElseThrow(() -> ApiException.notFound("Goal"));
        }
        List<Long> folioIds = r.folioIds() == null ? List.of() : r.folioIds().stream().distinct().toList();
        Set<Long> allowed = folioRepo.findByInvestorIdIn(fam).stream().map(f -> f.getId()).collect(Collectors.toSet());
        if (!allowed.containsAll(folioIds)) {
            throw ApiException.validation("folioIds", "One or more folios do not belong to your family");
        }
        g.setName(r.name().trim());
        g.setType(r.type());
        g.setTargetAmount(r.targetAmount());
        g.setTargetDate(r.targetDate());
        g.getFolioIds().clear();
        g.getFolioIds().addAll(folioIds);
        goalRepo.save(g);
        Map<Long, Holding> holdings = portfolio.holdings(portfolio.load(fam)).stream()
                .collect(Collectors.toMap(Holding::folioId, h -> h));
        return toDto(g, holdings);
    }

    @Transactional
    public void deleteGoal(AuthUser u, Long id) {
        List<Long> fam = family.familyIds(u);
        Goal g = goalRepo.findById(id).filter(x -> fam.contains(x.getInvestorId()))
                .orElseThrow(() -> ApiException.notFound("Goal"));
        goalRepo.delete(g);
    }

    // ------------------------------------------------------------------ RM

    public RmDto rm(AuthUser u) {
        Investor self = family.self(u);
        AppUser rm = self.getRmId() == null ? null : userRepo.findById(self.getRmId()).orElse(null);
        if (rm == null) {
            AppProperties.Firm f = props.getFirm();
            return new RmDto(f.getName() + " Client Desk", f.getPhone(), f.getWhatsapp(), f.getEmail(), null);
        }
        return new RmDto(rm.getName(), rm.getMobile(), rm.getMobile(), rm.getEmail(), rm.getEuin());
    }

    @Transactional
    public void callback(AuthUser u, CallbackRequest r) {
        Investor self = family.self(u);
        String desc = "Preferred time: " + (r.preferredTime() == null || r.preferredTime().isBlank() ? "Any time" : r.preferredTime())
                + (r.note() == null || r.note().isBlank() ? "" : "\nNote: " + r.note().trim());
        Ticket t = tickets.create(self.getId(), TicketCategory.OTHER, "Call back request", desc);
        if (self.getRmId() != null) {
            notifications.notifyUser(self.getRmId(), NotificationType.GENERAL, "Call back requested by " + self.getName(), desc);
        }
        notifications.notifyFirm("Call back requested by client " + self.getName(),
                "An existing client has asked for a call back.\n\nClient: " + self.getName()
                        + "\nMobile: +91 " + self.getMobile() + "\nEmail: " + (self.getEmail() == null ? "-" : self.getEmail())
                        + "\n" + desc + "\nService request: " + t.getRef());
        audit.log("TICKET_UPDATED", "TICKET", t.getId(), "Call back request " + t.getRef());
    }

    // ------------------------------------------------------------------ notifications

    public List<NotificationDto> notifications(AuthUser u) {
        return notificationRepo.findByUserIdOrderByCreatedAtDescIdDesc(u.userId()).stream()
                .map(n -> new NotificationDto(n.getId(), n.getType(), n.getTitle(), n.getMessage(), n.isRead(), n.getCreatedAt()))
                .toList();
    }

    @Transactional
    public void markRead(AuthUser u, Long id) {
        Notification n = notificationRepo.findById(id).filter(x -> x.getUserId().equals(u.userId()))
                .orElseThrow(() -> ApiException.notFound("Notification"));
        n.setRead(true);
        notificationRepo.save(n);
    }

    @Transactional
    public void markAllRead(AuthUser u) {
        notificationRepo.markAllRead(u.userId());
    }

    public String familyLabel(List<Long> ids) {
        return investorRepo.findAllById(ids).stream().map(Investor::getName).sorted().collect(Collectors.joining(", "));
    }

    static BigDecimal zero() {
        return BigDecimal.ZERO;
    }
}
