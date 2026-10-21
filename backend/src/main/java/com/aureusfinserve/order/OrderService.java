package com.aureusfinserve.order;

import com.aureusfinserve.audit.AuditService;
import com.aureusfinserve.auth.AppUser;
import com.aureusfinserve.auth.OtpChallenge;
import com.aureusfinserve.auth.OtpService;
import com.aureusfinserve.common.*;
import com.aureusfinserve.investor.Investor;
import com.aureusfinserve.investor.InvestorRepos.MandateRepository;
import com.aureusfinserve.investor.InvestorRepository;
import com.aureusfinserve.notification.NotificationService;
import com.aureusfinserve.order.OrderDtos.CartItem;
import com.aureusfinserve.order.OrderDtos.CartRequest;
import com.aureusfinserve.order.OrderDtos.HistoryEntry;
import com.aureusfinserve.order.OrderDtos.Order;
import com.aureusfinserve.order.OrderRepos.MfOrderRepository;
import com.aureusfinserve.order.OrderRepos.OrderHistoryRepository;
import com.aureusfinserve.portfolio.Folio;
import com.aureusfinserve.portfolio.NavService;
import com.aureusfinserve.portfolio.PortfolioRepos.FolioRepository;
import com.aureusfinserve.portfolio.PortfolioService;
import com.aureusfinserve.publicsite.PublicRepos.SchemeRepository;
import com.aureusfinserve.publicsite.Scheme;
import com.aureusfinserve.security.AuthUser;
import com.aureusfinserve.security.RequestInfo;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Cart validation, order creation (direct or RM-raised for client approval), approvals and listing. */
@Service
@RequiredArgsConstructor
public class OrderService {

    private static final EnumSet<OrderType> FOLIO_TYPES =
            EnumSet.of(OrderType.REDEEM, OrderType.SWITCH, OrderType.STP, OrderType.SWP);

    private final MfOrderRepository orderRepo;
    private final OrderHistoryRepository historyRepo;
    private final InvestorRepository investorRepo;
    private final SchemeRepository schemeRepo;
    private final FolioRepository folioRepo;
    private final MandateRepository mandateRepo;
    private final PortfolioService portfolio;
    private final NavService navService;
    private final KycService kyc;
    private final OrderPlatformGateway gateway;
    private final OrderLifecycle lifecycle;
    private final OtpService otpService;
    private final NotificationService notifications;
    private final AuditService audit;

    // ------------------------------------------------------------------ create

    /**
     * @param raisedByStaff true when an RM / admin raises the order: it is created PENDING_APPROVAL and the
     *                      client approves with an OTP; otherwise it is placed on the exchange immediately.
     */
    @Transactional
    public List<Order> placeCart(CartRequest req, Long investorId, AuthUser by, boolean raisedByStaff) {
        Map<String, String> errors = new LinkedHashMap<>();
        if (!Boolean.TRUE.equals(req.riskAcknowledged())) {
            errors.put("riskAcknowledged", "Please confirm you have read the scheme documents and understand the risks");
        }
        if (req.paymentMode() == null) {
            errors.put("paymentMode", "Select a payment mode");
        }
        if (!errors.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION", errors.values().iterator().next(), errors);
        }
        Investor inv = investorRepo.findById(investorId).orElseThrow(() -> ApiException.notFound("Investor"));
        if (!kyc.canTransact(inv)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "KYC_NOT_VALID",
                    "KYC status is " + kyc.status(inv) + ". Orders can be placed only when KYC is VALIDATED.");
        }
        if (req.paymentMode() == PaymentMode.MANDATE
                && mandateRepo.findByInvestorId(inv.getId()).stream().noneMatch(m -> m.getStatus() == MandateStatus.ACTIVE)) {
            throw ApiException.validation("paymentMode", "An ACTIVE bank mandate is required to pay by mandate");
        }

        List<Folio> folios = folioRepo.findByInvestorId(inv.getId());
        Map<Long, Folio> folioMap = folios.stream().collect(Collectors.toMap(Folio::getId, Function.identity()));
        Map<Long, Double> unitsLeft = new HashMap<>();

        List<MfOrder> created = new ArrayList<>();
        for (int i = 0; i < req.items().size(); i++) {
            CartItem it = req.items().get(i);
            String p = "items[" + i + "].";
            MfOrder o = new MfOrder();
            o.setInvestorId(inv.getId());
            o.setType(it.type());
            o.setPaymentMode(req.paymentMode());
            o.setRiskAcknowledged(true);
            Scheme scheme;
            if (FOLIO_TYPES.contains(it.type())) {
                Folio f = it.folioId() == null ? null : folioMap.get(it.folioId());
                if (f == null) {
                    throw ApiException.validation(p + "folioId", "Select a folio held by this investor");
                }
                scheme = schemeRepo.findById(f.getSchemeId()).orElseThrow();
                o.setFolioId(f.getId());
                double nav = navService.latestNav(scheme);
                double available = unitsLeft.computeIfAbsent(f.getId(), portfolio::currentUnits);
                double reqUnits = validateQuantity(it, p, nav, available, scheme);
                unitsLeft.put(f.getId(), available - reqUnits);
                o.setAmount(it.all() ? null : it.amount());
                o.setUnits(it.all() || it.amount() != null ? null : it.units());
                o.setAllUnits(it.all());
                if (it.type() == OrderType.SWITCH || it.type() == OrderType.STP) {
                    Scheme target = it.targetSchemeId() == null ? null : schemeRepo.findById(it.targetSchemeId()).orElse(null);
                    if (target == null || !target.isActive()) {
                        throw ApiException.validation(p + "targetSchemeId", "Select a target scheme");
                    }
                    if (!target.getAmc().equals(scheme.getAmc())) {
                        throw ApiException.validation(p + "targetSchemeId", "Switch / STP target must be a scheme of the same AMC");
                    }
                    if (target.getId().equals(scheme.getId())) {
                        throw ApiException.validation(p + "targetSchemeId", "Target scheme must be different from the source scheme");
                    }
                    if (!target.isRegularPlan()) {
                        throw ApiException.validation(p + "targetSchemeId", "Only regular plans can be transacted");
                    }
                    o.setTargetSchemeId(target.getId());
                }
                if (it.type() == OrderType.STP || it.type() == OrderType.SWP) {
                    Scheme minScheme = it.type() == OrderType.STP ? schemeRepo.findById(o.getTargetSchemeId()).orElseThrow() : scheme;
                    if (it.amount() == null || it.amount().compareTo(minScheme.getMinSip()) < 0) {
                        throw ApiException.validation(p + "amount", "Minimum instalment is ₹" + minScheme.getMinSip().stripTrailingZeros().toPlainString());
                    }
                    validateSchedule(it, p);
                    o.setSipDay(it.sipDay());
                    o.setInstallments(it.installments());
                }
            } else {
                scheme = it.schemeId() == null ? null : schemeRepo.findById(it.schemeId()).orElse(null);
                if (scheme == null || !scheme.isActive()) {
                    throw ApiException.validation(p + "schemeId", "Select a scheme");
                }
                if (!scheme.isRegularPlan()) {
                    throw ApiException.validation(p + "schemeId", "Only regular plans can be transacted");
                }
                BigDecimal min = it.type() == OrderType.SIP ? scheme.getMinSip() : scheme.getMinLumpsum();
                if (it.amount() == null || it.amount().compareTo(min) < 0) {
                    throw ApiException.validation(p + "amount", "Minimum amount for this scheme is ₹" + min.stripTrailingZeros().toPlainString());
                }
                if (it.amount().compareTo(new BigDecimal("100000000")) > 0) {
                    throw ApiException.validation(p + "amount", "Amount is too large");
                }
                if (it.type() == OrderType.SIP) {
                    validateSchedule(it, p);
                    o.setSipDay(it.sipDay());
                    o.setInstallments(it.installments());
                }
                o.setAmount(it.amount());
                folios.stream().filter(f -> f.getSchemeId().equals(scheme.getId())).findFirst()
                        .ifPresent(f -> o.setFolioId(f.getId()));
            }
            o.setSchemeId(scheme.getId());
            created.add(o);
        }

        AppUser placer = new AppUser();
        placer.setId(by.userId());
        String rmNote = null;
        for (MfOrder o : created) {
            var now = Fmt.now();
            o.setCreatedAt(now);
            o.setUpdatedAt(now);
            o.setPlacedByUserId(by.userId());
            o.setPlacedByName(by.name());
            o.setPlacedByRole(by.role());
            o.setStatus(raisedByStaff ? OrderStatus.PENDING_APPROVAL : OrderStatus.PLACED);
            orderRepo.save(o);
            o.setRef("AF" + now.format(DateTimeFormatter.ofPattern("yyMMdd")) + String.format("%04d", o.getId() % 10000));
            if (raisedByStaff) {
                orderRepo.save(o);
                history(o, OrderStatus.PENDING_APPROVAL, "Raised by " + by.name() + " - awaiting client approval (OTP)");
                rmNote = by.name();
            } else {
                sendToExchange(o, "Order placed on exchange");
            }
            audit.log("ORDER_PLACED", "ORDER", o.getId(), o.getRef() + " " + o.getType() + " for investor " + inv.getId()
                    + (raisedByStaff ? " (pending client approval)" : ""));
        }
        if (raisedByStaff) {
            notifications.notifyInvestor(inv.getId(), NotificationType.ORDER, "Order awaiting your approval",
                    rmNote + " has raised " + created.size() + " order(s) for " + inv.getName()
                            + ". Open Orders to review and approve with an OTP.");
        } else {
            notifications.notifyInvestor(inv.getId(), NotificationType.ORDER, "Order placed",
                    created.size() + " order(s) placed on the exchange for " + inv.getName() + ".");
        }
        return toDtos(created);
    }

    private double validateQuantity(CartItem it, String p, double nav, double available, Scheme scheme) {
        if (available <= 0.0001) {
            throw ApiException.validation(p + "folioId", "This folio has no units");
        }
        if (it.type() == OrderType.STP || it.type() == OrderType.SWP) {
            // instalment amount must not exceed the current holding value
            if (it.amount() != null && it.amount().doubleValue() > available * nav) {
                throw ApiException.validation(p + "amount", "Instalment exceeds the current holding value");
            }
            return 0;
        }
        int given = (it.all() ? 1 : 0) + (it.amount() != null ? 1 : 0) + (it.units() != null ? 1 : 0);
        if (given != 1) {
            throw ApiException.validation(p + "amount", "Specify exactly one of amount, units or all units");
        }
        if (it.all()) {
            return available;
        }
        if (it.amount() != null) {
            if (it.amount().signum() <= 0) {
                throw ApiException.validation(p + "amount", "Amount must be positive");
            }
            double u = it.amount().doubleValue() / nav;
            if (u > available + 0.0001) {
                throw ApiException.validation(p + "amount", "Amount exceeds the current holding value of ₹"
                        + Fmt.money(available * nav).toPlainString());
            }
            return u;
        }
        if (it.units().signum() <= 0) {
            throw ApiException.validation(p + "units", "Units must be positive");
        }
        if (it.units().doubleValue() > available + 0.0001) {
            throw ApiException.validation(p + "units", "Units exceed the " + Fmt.units(available).toPlainString() + " units held");
        }
        return it.units().doubleValue();
    }

    private void validateSchedule(CartItem it, String p) {
        if (it.sipDay() == null || it.sipDay() < 1 || it.sipDay() > 28) {
            throw ApiException.validation(p + "sipDay", "Choose an instalment date between 1 and 28");
        }
        if (it.installments() != null && (it.installments() < 1 || it.installments() > 1200)) {
            throw ApiException.validation(p + "installments", "Instalments must be between 1 and 1200");
        }
    }

    private void sendToExchange(MfOrder o, String note) {
        o.setExchangeRef(gateway.placeOrder(o));
        o.setPlacedAt(Fmt.now());
        lifecycle.changeStatus(o, OrderStatus.PLACED, note);
    }

    private void history(MfOrder o, OrderStatus s, String note) {
        OrderHistory h = new OrderHistory();
        h.setOrderId(o.getId());
        h.setStatus(s);
        h.setAt(Fmt.now());
        h.setNote(note);
        historyRepo.save(h);
    }

    // ------------------------------------------------------------------ approvals (investor)

    private MfOrder pendingFor(Long orderId, Collection<Long> family) {
        MfOrder o = orderRepo.findById(orderId).orElseThrow(() -> ApiException.notFound("Order"));
        if (!family.contains(o.getInvestorId())) {
            throw ApiException.notFound("Order");
        }
        if (o.getStatus() != OrderStatus.PENDING_APPROVAL) {
            throw ApiException.conflict("This order is not awaiting approval");
        }
        return o;
    }

    @Transactional
    public OtpService.OtpIssued approveOtp(Long orderId, Collection<Long> family, AppUser user) {
        MfOrder o = pendingFor(orderId, family);
        OtpService.OtpIssued r = otpService.issue(new OtpService.OtpTarget(OtpChallenge.Purpose.ORDER_APPROVAL,
                user.getId(), user.getMobile(), user.getEmail(), o.getId(), null, "user:" + user.getId()), RequestInfo.deviceId());
        return new OtpService.OtpIssued(r.challengeId(), null, null, r.devOtp());
    }

    @Transactional(noRollbackFor = ApiException.class)
    public Order approve(Long orderId, String challengeId, String otp, Collection<Long> family, AuthUser by) {
        MfOrder o = pendingFor(orderId, family);
        OtpChallenge pre = otpService.get(challengeId);
        if (pre.getRefId() == null || !pre.getRefId().equals(o.getId()) || !by.userId().equals(pre.getUserId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "OTP_INVALID", "This OTP was not issued for this order");
        }
        otpService.verify(challengeId, otp, OtpChallenge.Purpose.ORDER_APPROVAL);
        sendToExchange(o, "Approved by client via OTP; order placed on exchange");
        audit.log("ORDER_APPROVED", "ORDER", o.getId(), o.getRef());
        return toDto(o);
    }

    @Transactional
    public Order reject(Long orderId, Collection<Long> family) {
        MfOrder o = pendingFor(orderId, family);
        lifecycle.changeStatus(o, OrderStatus.CANCELLED, "Rejected by client");
        audit.log("ORDER_STATUS", "ORDER", o.getId(), o.getRef() + " rejected by client -> CANCELLED");
        return toDto(o);
    }

    // ------------------------------------------------------------------ admin override

    @Transactional
    public Order overrideStatus(Long orderId, OrderStatus status, String note) {
        MfOrder o = orderRepo.findById(orderId).orElseThrow(() -> ApiException.notFound("Order"));
        if (status == null) {
            throw ApiException.validation("status", "Status is required");
        }
        if (o.getStatus() == OrderStatus.ALLOTTED && status != OrderStatus.ALLOTTED) {
            throw ApiException.conflict("An allotted order cannot be changed; record a reversal through RTA sync instead");
        }
        OrderStatus old = o.getStatus();
        String n = note == null || note.isBlank() ? "Manual status update" : note.trim();
        if (status == OrderStatus.ALLOTTED && old != OrderStatus.ALLOTTED) {
            if (o.getPlacedAt() == null) {
                o.setPlacedAt(Fmt.now());
            }
            lifecycle.allot(o);
        } else if (status == OrderStatus.PLACED && o.getPlacedAt() == null) {
            sendToExchange(o, n);
        } else {
            lifecycle.changeStatus(o, status, n);
        }
        audit.log("ORDER_STATUS", "ORDER", o.getId(), o.getRef() + " " + old + " -> " + o.getStatus() + ": " + n);
        return toDto(o);
    }

    // ------------------------------------------------------------------ queries

    public List<Order> list(Collection<Long> investorIds, OrderStatus status) {
        List<MfOrder> orders = investorIds == null ? orderRepo.findAllByOrderByCreatedAtDescIdDesc()
                : orderRepo.findByInvestorIdInOrderByCreatedAtDescIdDesc(investorIds);
        if (status != null) {
            orders = orders.stream().filter(o -> o.getStatus() == status).toList();
        }
        return toDtos(orders);
    }

    public Order toDto(MfOrder o) {
        return toDtos(List.of(o)).get(0);
    }

    public List<Order> toDtos(List<MfOrder> orders) {
        if (orders.isEmpty()) {
            return List.of();
        }
        Set<Long> schemeIds = new HashSet<>();
        Set<Long> investorIds = new HashSet<>();
        Set<Long> folioIds = new HashSet<>();
        orders.forEach(o -> {
            schemeIds.add(o.getSchemeId());
            if (o.getTargetSchemeId() != null) {
                schemeIds.add(o.getTargetSchemeId());
            }
            investorIds.add(o.getInvestorId());
            if (o.getFolioId() != null) {
                folioIds.add(o.getFolioId());
            }
        });
        Map<Long, String> schemes = schemeRepo.findAllById(schemeIds).stream().collect(Collectors.toMap(Scheme::getId, Scheme::getName));
        Map<Long, String> investors = investorRepo.findAllById(investorIds).stream().collect(Collectors.toMap(Investor::getId, Investor::getName));
        Map<Long, String> folios = folioRepo.findAllById(folioIds).stream().collect(Collectors.toMap(Folio::getId, Folio::getFolioNo));
        Map<Long, List<HistoryEntry>> hist = new HashMap<>();
        historyRepo.findByOrderIdInOrderByAtAscIdAsc(orders.stream().map(MfOrder::getId).toList())
                .forEach(h -> hist.computeIfAbsent(h.getOrderId(), k -> new ArrayList<>())
                        .add(new HistoryEntry(h.getStatus(), h.getAt(), h.getNote())));
        return orders.stream().map(o -> new Order(o.getId(), o.getRef(), o.getInvestorId(), investors.get(o.getInvestorId()),
                o.getType(), o.getSchemeId(), schemes.get(o.getSchemeId()), o.getTargetSchemeId(),
                o.getTargetSchemeId() == null ? null : schemes.get(o.getTargetSchemeId()), o.getFolioId(),
                o.getFolioId() == null ? null : folios.get(o.getFolioId()), Fmt.money(o.getAmount()), Fmt.units(o.getUnits()),
                o.isAllUnits(), o.getSipDay(), o.getInstallments(), o.getPaymentMode(), o.getStatus(), o.getPlacedByName(),
                o.getPlacedByRole(), o.getExchangeRef(), o.getCreatedAt(), hist.getOrDefault(o.getId(), List.of()))).toList();
    }
}
