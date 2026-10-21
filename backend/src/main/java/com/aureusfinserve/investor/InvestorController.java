package com.aureusfinserve.investor;

import com.aureusfinserve.auth.AppUser;
import com.aureusfinserve.auth.AppUserRepository;
import com.aureusfinserve.auth.OtpService;
import com.aureusfinserve.common.ApiException;
import com.aureusfinserve.common.OrderStatus;
import com.aureusfinserve.common.TxnType;
import com.aureusfinserve.investor.InvestorDtos.*;
import com.aureusfinserve.order.OrderDtos.CartRequest;
import com.aureusfinserve.order.OrderDtos.Order;
import com.aureusfinserve.order.OrderService;
import com.aureusfinserve.portfolio.Folio;
import com.aureusfinserve.portfolio.PortfolioDtos.*;
import com.aureusfinserve.portfolio.PortfolioRepos.FolioRepository;
import com.aureusfinserve.portfolio.PortfolioService;
import com.aureusfinserve.portfolio.SipService;
import com.aureusfinserve.report.ReportDownloadService;
import com.aureusfinserve.report.ReportService;
import com.aureusfinserve.security.AuthUser;
import com.aureusfinserve.security.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/investor")
@RequiredArgsConstructor
public class InvestorController {

    public record PauseRequest(Integer months) {
    }

    public record StepUpRequest(Integer stepUpPct) {
    }

    public record ApproveRequest(@NotBlank(message = "Challenge is required") String challengeId,
                                 @NotBlank(message = "OTP is required") String otp) {
    }

    private static final Map<String, Object> OK = Map.of("ok", true);

    private final FamilyService family;
    private final InvestorService investors;
    private final PortfolioService portfolio;
    private final SipService sips;
    private final OrderService orders;
    private final ReportService reports;
    private final ReportDownloadService downloads;
    private final TicketService tickets;
    private final FolioRepository folioRepo;
    private final AppUserRepository userRepo;

    private AuthUser me() {
        return CurrentUser.get();
    }

    @GetMapping("/family")
    public List<FamilyMember> family() {
        return investors.family(me());
    }

    @GetMapping("/portfolio")
    public Summary portfolio(@RequestParam(required = false) String member) {
        return portfolio.summary(portfolio.load(family.resolveMember(me(), member)));
    }

    @GetMapping("/holdings")
    public List<Holding> holdings(@RequestParam(required = false) String member) {
        return portfolio.holdings(portfolio.load(family.resolveMember(me(), member)));
    }

    @GetMapping("/holdings/{folioId}/transactions")
    public List<Txn> folioTransactions(@PathVariable Long folioId) {
        List<Long> fam = family.familyIds(me());
        Folio f = folioRepo.findById(folioId).filter(x -> fam.contains(x.getInvestorId()))
                .orElseThrow(() -> ApiException.notFound("Folio"));
        var book = portfolio.load(List.of(f.getInvestorId()));
        return portfolio.transactions(book, null, null, null).stream().filter(t -> t.folioId().equals(folioId)).toList();
    }

    @GetMapping("/transactions")
    public List<Txn> transactions(@RequestParam(required = false) String member,
                                  @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                  @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                                  @RequestParam(required = false) TxnType type) {
        return portfolio.transactions(portfolio.load(family.resolveMember(me(), member)), from, to, type);
    }

    // ------------------------------------------------------------------ SIPs

    @GetMapping("/sips")
    public List<Sip> sips(@RequestParam(required = false) String member) {
        return sips.list(family.resolveMember(me(), member));
    }

    @PostMapping("/sips/{id}/pause")
    public Sip pause(@PathVariable Long id, @RequestBody PauseRequest r) {
        return sips.pause(id, r.months(), family.familyIds(me()));
    }

    @PostMapping("/sips/{id}/resume")
    public Sip resume(@PathVariable Long id) {
        return sips.resume(id, family.familyIds(me()));
    }

    @PostMapping("/sips/{id}/step-up")
    public Sip stepUp(@PathVariable Long id, @RequestBody StepUpRequest r) {
        return sips.stepUp(id, r.stepUpPct(), family.familyIds(me()));
    }

    @PostMapping("/sips/{id}/cancel")
    public Sip cancel(@PathVariable Long id) {
        return sips.cancel(id, family.familyIds(me()));
    }

    // ------------------------------------------------------------------ orders

    @GetMapping("/orders")
    public List<Order> orders(@RequestParam(required = false) OrderStatus status) {
        return orders.list(family.familyIds(me()), status);
    }

    @PostMapping("/orders")
    public List<Order> placeOrders(@Valid @RequestBody CartRequest r) {
        AuthUser u = me();
        Long investorId = r.investorId() == null ? u.investorId() : r.investorId();
        family.assertInFamily(u, investorId);
        return orders.placeCart(r, investorId, u, false);
    }

    @PostMapping("/orders/{id}/approve-otp")
    public Map<String, Object> approveOtp(@PathVariable Long id) {
        AuthUser u = me();
        AppUser user = userRepo.findById(u.userId()).orElseThrow();
        OtpService.OtpIssued r = orders.approveOtp(id, family.familyIds(u), user);
        return r.devOtp() == null ? Map.of("challengeId", r.challengeId())
                : Map.of("challengeId", r.challengeId(), "devOtp", r.devOtp());
    }

    @PostMapping("/orders/{id}/approve")
    public Order approve(@PathVariable Long id, @Valid @RequestBody ApproveRequest r) {
        AuthUser u = me();
        return orders.approve(id, r.challengeId(), r.otp(), family.familyIds(u), u);
    }

    @PostMapping("/orders/{id}/reject")
    public Order reject(@PathVariable Long id) {
        return orders.reject(id, family.familyIds(me()));
    }

    // ------------------------------------------------------------------ reports

    @GetMapping("/reports/capital-gains")
    public ReportService.CapitalGains capitalGains(@RequestParam(required = false) String fy,
                                                   @RequestParam(required = false) String member) {
        String year = fy == null || fy.isBlank() ? com.aureusfinserve.common.Fmt.fyOf(com.aureusfinserve.common.Fmt.today()) : fy;
        return reports.capitalGains(portfolio.load(family.resolveMember(me(), member)), year);
    }

    @GetMapping("/reports/financial-years")
    public List<String> financialYears() {
        return reports.financialYears(portfolio.load(family.familyIds(me())));
    }

    @GetMapping("/reports/{kind}/download")
    public ResponseEntity<byte[]> download(@PathVariable String kind,
                                           @RequestParam(required = false, defaultValue = "pdf") String format,
                                           @RequestParam(required = false) String fy,
                                           @RequestParam(required = false) String member,
                                           @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                           @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        List<Long> ids = family.resolveMember(me(), member);
        return downloads.download(kind, format, portfolio.load(ids), investors.familyLabel(ids), fy, from, to);
    }

    // ------------------------------------------------------------------ goals

    @GetMapping("/goals")
    public List<GoalDto> goals() {
        return investors.goals(me());
    }

    @PostMapping("/goals")
    public GoalDto createGoal(@Valid @RequestBody GoalRequest r) {
        return investors.saveGoal(me(), null, r);
    }

    @PutMapping("/goals/{id}")
    public GoalDto updateGoal(@PathVariable Long id, @Valid @RequestBody GoalRequest r) {
        return investors.saveGoal(me(), id, r);
    }

    @DeleteMapping("/goals/{id}")
    public Map<String, Object> deleteGoal(@PathVariable Long id) {
        investors.deleteGoal(me(), id);
        return OK;
    }

    // ------------------------------------------------------------------ profile, tickets, RM, notifications

    @GetMapping("/profile")
    public Profile profile() {
        return investors.profile(me());
    }

    @GetMapping("/tickets")
    public List<TicketDto> tickets() {
        return tickets.list(family.familyIds(me()), null, false);
    }

    @PostMapping("/tickets")
    public TicketDto createTicket(@Valid @RequestBody TicketRequest r) {
        AuthUser u = me();
        var t = tickets.create(u.investorId(), r.category(), r.subject(), r.description());
        return tickets.toDtos(List.of(t), false).get(0);
    }

    @GetMapping("/rm")
    public RmDto rm() {
        return investors.rm(me());
    }

    @PostMapping("/rm/callback")
    public Map<String, Object> callback(@Valid @RequestBody CallbackRequest r) {
        investors.callback(me(), r);
        return OK;
    }

    @GetMapping("/notifications")
    public List<NotificationDto> notifications() {
        return investors.notifications(me());
    }

    @PostMapping("/notifications/{id}/read")
    public Map<String, Object> read(@PathVariable Long id) {
        investors.markRead(me(), id);
        return OK;
    }

    @PostMapping("/notifications/read-all")
    public Map<String, Object> readAll() {
        investors.markAllRead(me());
        return OK;
    }
}
