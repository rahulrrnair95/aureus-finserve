package com.aureusfinserve.admin;

import com.aureusfinserve.admin.AdminDtos.*;
import com.aureusfinserve.audit.AuditService;
import com.aureusfinserve.auth.AppUser;
import com.aureusfinserve.auth.AppUserRepository;
import com.aureusfinserve.common.*;
import com.aureusfinserve.investor.Investor;
import com.aureusfinserve.investor.InvestorRepos.TicketRepository;
import com.aureusfinserve.investor.InvestorRepository;
import com.aureusfinserve.kyc.KycApplicationService;
import com.aureusfinserve.notification.NotificationService;
import com.aureusfinserve.order.OrderRepos.MfOrderRepository;
import com.aureusfinserve.portfolio.MfTransaction;
import com.aureusfinserve.portfolio.PortfolioDtos.Holding;
import com.aureusfinserve.portfolio.PortfolioService;
import com.aureusfinserve.publicsite.Lead;
import com.aureusfinserve.publicsite.LeadAttachment;
import com.aureusfinserve.publicsite.PublicRepos.LeadAttachmentRepository;
import com.aureusfinserve.publicsite.PublicRepos.LeadRepository;
import com.aureusfinserve.report.Brokerage;
import com.aureusfinserve.report.BrokerageRepository;
import com.aureusfinserve.security.AuthUser;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.YearMonth;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Staff dashboard, leads and brokerage reconciliation. */
@Service
@RequiredArgsConstructor
public class AdminService {

    private final StaffScope scope;
    private final InvestorRepository investorRepo;
    private final PortfolioService portfolio;
    private final LeadRepository leadRepo;
    private final LeadAttachmentRepository attachmentRepo;
    private final TicketRepository ticketRepo;
    private final MfOrderRepository orderRepo;
    private final AppUserRepository userRepo;
    private final BrokerageRepository brokerageRepo;
    private final NotificationService notifications;
    private final AuditService audit;
    private final KycApplicationService kyc;

    // ---------------------------------------------------------------- dashboard

    @Transactional(readOnly = true)
    public Dashboard dashboard(AuthUser u) {
        List<Long> ids = scope.clientIds(u);
        PortfolioService.Book book = portfolio.load(ids);
        List<Holding> holdings = portfolio.holdings(book);
        double aum = holdings.stream().mapToDouble(h -> h.value().doubleValue()).sum();

        var activeSips = book.sips().stream()
                .filter(s -> s.getRegType() == RegistrationType.SIP && s.getStatus() == SipStatus.ACTIVE).toList();
        double sipBook = activeSips.stream().mapToDouble(s -> s.getAmount().doubleValue()).sum();

        List<Lead> leads = u.isAdmin() ? leadRepo.findAll() : leadRepo.findByAssignedRmIdOrderByCreatedAtDesc(u.userId());
        long newLeads = leads.stream().filter(l -> l.getStatus() == LeadStatus.NEW).count();
        long openTickets = ticketRepo.findByInvestorIdInOrderByCreatedAtDesc(ids).stream()
                .filter(t -> t.getStatus() == TicketStatus.OPEN || t.getStatus() == TicketStatus.IN_PROGRESS).count();
        long pendingOrders = orderRepo.findByInvestorIdInOrderByCreatedAtDescIdDesc(ids).stream()
                .filter(o -> o.getStatus() == OrderStatus.PENDING_APPROVAL || o.getStatus() == OrderStatus.PLACED
                        || o.getStatus() == OrderStatus.PAYMENT_RECEIVED).count();

        YearMonth now = YearMonth.from(Fmt.today());
        Map<YearMonth, double[]> flows = new LinkedHashMap<>();
        for (int i = 11; i >= 0; i--) {
            flows.put(now.minusMonths(i), new double[2]);
        }
        for (List<MfTransaction> list : book.txnsByFolio().values()) {
            for (MfTransaction t : list) {
                double[] f = flows.get(YearMonth.from(t.getDate()));
                if (f == null) {
                    continue;
                }
                switch (t.getType()) {
                    case PURCHASE, SIP -> f[0] += t.getAmount().doubleValue();
                    case REDEMPTION, SWP -> f[1] += t.getAmount().doubleValue();
                    default -> { /* switches / STPs move money within the book */ }
                }
            }
        }
        List<Flow> flowList = flows.entrySet().stream().map(e -> new Flow(e.getKey().toString(), Fmt.money(e.getValue()[0]),
                Fmt.money(e.getValue()[1]), Fmt.money(e.getValue()[0] - e.getValue()[1]))).toList();

        Map<String, Double> byCat = new TreeMap<>();
        Map<String, Double> byAmc = new TreeMap<>();
        Map<Long, Double> byClient = new HashMap<>();
        for (Holding h : holdings) {
            byCat.merge(h.category().name(), h.value().doubleValue(), Double::sum);
            byAmc.merge(h.amc(), h.value().doubleValue(), Double::sum);
            byClient.merge(h.investorId(), h.value().doubleValue(), Double::sum);
        }
        List<TopClient> top = byClient.entrySet().stream().sorted(Map.Entry.<Long, Double>comparingByValue().reversed())
                .limit(5).map(e -> new TopClient(e.getKey(), book.investors().get(e.getKey()).getName(), Fmt.money(e.getValue())))
                .toList();
        return new Dashboard(Fmt.money(aum), ids.size(), activeSips.size(), Fmt.money(sipBook), newLeads, openTickets,
                pendingOrders, flowList, toNameValue(byCat), toNameValue(byAmc), top, kyc.pendingCount(u));
    }

    private static List<NameValue> toNameValue(Map<String, Double> m) {
        return m.entrySet().stream().sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                .map(e -> new NameValue(e.getKey(), Fmt.money(e.getValue()))).toList();
    }

    public List<RmRef> rms() {
        return userRepo.findByRoleOrderByNameAsc(Role.RM).stream().filter(AppUser::isEnabled)
                .map(r -> new RmRef(r.getId(), r.getName(), r.getEuin())).toList();
    }

    // ---------------------------------------------------------------- leads

    public List<LeadRow> leads(AuthUser u, LeadStatus status, String q) {
        List<Lead> leads = u.isAdmin() ? leadRepo.findAllByOrderByCreatedAtDesc()
                : leadRepo.findByAssignedRmIdOrderByCreatedAtDesc(u.userId());
        String n = q == null ? null : q.trim().toLowerCase(Locale.ROOT);
        return leadRows(leads.stream()
                .filter(l -> status == null || l.getStatus() == status)
                .filter(l -> n == null || n.isEmpty() || l.getName().toLowerCase(Locale.ROOT).contains(n)
                        || (l.getEmail() != null && l.getEmail().toLowerCase(Locale.ROOT).contains(n))
                        || (l.getCity() != null && l.getCity().toLowerCase(Locale.ROOT).contains(n))
                        || (l.getMobile() != null && l.getMobile().contains(n)))
                .toList());
    }

    private List<LeadRow> leadRows(List<Lead> leads) {
        Map<Long, String> rms = userRepo.findAllById(leads.stream().map(Lead::getAssignedRmId).filter(Objects::nonNull)
                .collect(Collectors.toSet())).stream().collect(Collectors.toMap(AppUser::getId, AppUser::getName));
        return leads.stream().map(l -> new LeadRow(l.getId(), l.getName(), l.getMobile(), l.getEmail(), l.getCity(),
                l.getInterest(), l.getMessage(), l.getSource(), l.getStatus(), l.getFollowUpDate(), l.getNotes(),
                l.getAssignedRmId(), l.getAssignedRmId() == null ? null : rms.get(l.getAssignedRmId()), l.getCreatedAt(),
                l.isHasAttachment())).toList();
    }

    private Lead scopedLead(AuthUser u, Long id) {
        Lead l = leadRepo.findById(id).orElseThrow(() -> ApiException.notFound("Lead"));
        if (!u.isAdmin() && !u.userId().equals(l.getAssignedRmId())) {
            throw ApiException.forbidden("This lead is assigned to another relationship manager");
        }
        return l;
    }

    @Transactional
    public LeadRow updateLead(AuthUser u, Long id, LeadUpdate r) {
        Lead l = scopedLead(u, id);
        StringBuilder d = new StringBuilder();
        if (r.assignedRmId() != null && !r.assignedRmId().equals(l.getAssignedRmId())) {
            if (!u.isAdmin()) {
                throw ApiException.forbidden("Only an admin can reassign leads");
            }
            AppUser rm = userRepo.findById(r.assignedRmId()).filter(x -> x.getRole() == Role.RM || x.getRole() == Role.ADMIN)
                    .orElseThrow(() -> ApiException.validation("assignedRmId", "Select a valid relationship manager"));
            l.setAssignedRmId(rm.getId());
            d.append("assigned to ").append(rm.getName()).append("; ");
            notifications.notifyUser(rm.getId(), NotificationType.GENERAL, "Lead assigned to you", l.getName());
        }
        if (r.status() != null && r.status() != l.getStatus()) {
            d.append(l.getStatus()).append(" -> ").append(r.status()).append("; ");
            l.setStatus(r.status());
        }
        l.setFollowUpDate(r.followUpDate());
        if (r.notes() != null) {
            l.setNotes(r.notes());
        }
        leadRepo.save(l);
        audit.log("LEAD_UPDATED", "LEAD", l.getId(), d.length() == 0 ? "Follow-up / notes updated" : d.toString());
        return leadRows(List.of(l)).get(0);
    }

    @Transactional(readOnly = true)
    public LeadAttachment attachment(AuthUser u, Long id) {
        Lead l = scopedLead(u, id);
        LeadAttachment a = attachmentRepo.findFirstByLeadIdOrderByIdDesc(l.getId())
                .orElseThrow(() -> ApiException.notFound("Attachment"));
        audit.log("ATTACHMENT_DOWNLOADED", "LEAD", l.getId(), "CAS " + a.getFileName());
        return a;
    }

    // ---------------------------------------------------------------- brokerage

    public BrokerageReport brokerage(String month) {
        if (month != null && !month.isBlank() && !month.matches("\\d{4}-\\d{2}")) {
            throw ApiException.validation("month", "month must look like 2026-05");
        }
        List<Brokerage> list = month == null || month.isBlank() ? brokerageRepo.findAllByOrderByMonthDescAmcAscSchemeNameAsc()
                : brokerageRepo.findByMonthOrderByAmcAscSchemeNameAsc(month);
        double exp = 0;
        double rec = 0;
        List<BrokerageRow> rows = new ArrayList<>();
        for (Brokerage b : list) {
            double e = b.getExpected().doubleValue();
            double r = b.getReceived() == null ? 0 : b.getReceived().doubleValue();
            exp += e;
            rec += r;
            rows.add(new BrokerageRow(b.getAmc(), b.getSchemeName(), b.getMonth(), Fmt.money(b.getAum()),
                    b.getRatePct().setScale(2, java.math.RoundingMode.HALF_UP), Fmt.money(b.getExpected()),
                    Fmt.money(BigDecimal.valueOf(r)), Fmt.money(r - e), b.isReconciled()));
        }
        return new BrokerageReport(rows, new BrokerageTotals(Fmt.money(exp), Fmt.money(rec)));
    }

    public Map<Long, Investor> investorsById(Collection<Long> ids) {
        return investorRepo.findAllById(ids).stream().collect(Collectors.toMap(Investor::getId, Function.identity()));
    }
}
