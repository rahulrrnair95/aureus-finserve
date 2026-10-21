package com.aureusfinserve.order;

import com.aureusfinserve.common.Fmt;
import com.aureusfinserve.common.NotificationType;
import com.aureusfinserve.common.OrderStatus;
import com.aureusfinserve.common.OrderType;
import com.aureusfinserve.common.RegistrationType;
import com.aureusfinserve.common.SipStatus;
import com.aureusfinserve.common.TxnType;
import com.aureusfinserve.notification.NotificationService;
import com.aureusfinserve.order.OrderRepos.MfOrderRepository;
import com.aureusfinserve.order.OrderRepos.OrderHistoryRepository;
import com.aureusfinserve.portfolio.Folio;
import com.aureusfinserve.portfolio.FolioService;
import com.aureusfinserve.portfolio.MfTransaction;
import com.aureusfinserve.portfolio.NavService;
import com.aureusfinserve.portfolio.PortfolioRepos.FolioRepository;
import com.aureusfinserve.portfolio.PortfolioRepos.MfTransactionRepository;
import com.aureusfinserve.portfolio.PortfolioRepos.SipRegistrationRepository;
import com.aureusfinserve.portfolio.PortfolioService;
import com.aureusfinserve.portfolio.SipRegistration;
import com.aureusfinserve.publicsite.PublicRepos.SchemeRepository;
import com.aureusfinserve.publicsite.Scheme;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;

/** Status transitions and allotment (creates transactions, folios and SIP/STP/SWP registrations). */
@Service
@RequiredArgsConstructor
public class OrderLifecycle {

    private final MfOrderRepository orderRepo;
    private final OrderHistoryRepository historyRepo;
    private final SchemeRepository schemeRepo;
    private final FolioRepository folioRepo;
    private final FolioService folioService;
    private final MfTransactionRepository txnRepo;
    private final SipRegistrationRepository sipRepo;
    private final PortfolioService portfolio;
    private final NavService navService;
    private final NotificationService notifications;

    @Transactional
    public void changeStatus(MfOrder o, OrderStatus status, String note) {
        o.setStatus(status);
        o.setUpdatedAt(Fmt.now());
        orderRepo.save(o);
        OrderHistory h = new OrderHistory();
        h.setOrderId(o.getId());
        h.setStatus(status);
        h.setAt(Fmt.now());
        h.setNote(note);
        historyRepo.save(h);
        String scheme = schemeRepo.findById(o.getSchemeId()).map(Scheme::getName).orElse("");
        notifications.notifyInvestor(o.getInvestorId(), NotificationType.ORDER,
                "Order " + o.getRef() + ": " + label(status),
                o.getType() + " order in " + scheme + " - " + (note == null ? label(status) : note));
    }

    private static String label(OrderStatus s) {
        return switch (s) {
            case PENDING_APPROVAL -> "awaiting your approval";
            case PLACED -> "placed";
            case PAYMENT_RECEIVED -> "payment received";
            case ALLOTTED -> "allotted";
            case FAILED -> "failed";
            case CANCELLED -> "cancelled";
        };
    }

    /** Executes the order at the current NAV. On insufficient units the order is marked FAILED. */
    @Transactional
    public void allot(MfOrder o) {
        Scheme scheme = schemeRepo.findById(o.getSchemeId()).orElseThrow();
        LocalDate today = Fmt.today();
        BigDecimal nav = BigDecimal.valueOf(navService.latestNav(scheme)).setScale(4, RoundingMode.HALF_UP);
        String note;
        switch (o.getType()) {
            case LUMPSUM, SIP -> {
                Folio f = folioService.getOrCreate(o.getInvestorId(), scheme.getId());
                BigDecimal units = o.getAmount().divide(nav, 4, RoundingMode.HALF_UP);
                txn(f, o, o.getType() == OrderType.SIP ? TxnType.SIP : TxnType.PURCHASE, o.getAmount(), units, nav, today);
                o.setFolioId(f.getId());
                o.setUnits(units);
                if (o.getType() == OrderType.SIP) {
                    registration(o, RegistrationType.SIP, f.getId(), null);
                }
                note = "Units allotted at NAV " + nav.toPlainString() + " in folio " + f.getFolioNo();
            }
            case REDEEM, SWP -> {
                Folio f = folioRepo.findById(o.getFolioId()).orElseThrow();
                BigDecimal units = unitsFor(o, nav, f.getId());
                if (units == null) {
                    changeStatus(o, OrderStatus.FAILED, "Insufficient units in folio");
                    return;
                }
                BigDecimal amount = units.multiply(nav).setScale(2, RoundingMode.HALF_UP);
                txn(f, o, o.getType() == OrderType.SWP ? TxnType.SWP : TxnType.REDEMPTION, amount, units, nav, today);
                o.setUnits(units);
                if (o.getType() == OrderType.SWP) {
                    registration(o, RegistrationType.SWP, f.getId(), null);
                }
                note = "Redeemed " + units.toPlainString() + " units at NAV " + nav.toPlainString();
            }
            case SWITCH, STP -> {
                Folio f = folioRepo.findById(o.getFolioId()).orElseThrow();
                Scheme target = schemeRepo.findById(o.getTargetSchemeId()).orElseThrow();
                BigDecimal units = unitsFor(o, nav, f.getId());
                if (units == null) {
                    changeStatus(o, OrderStatus.FAILED, "Insufficient units in folio");
                    return;
                }
                BigDecimal amount = units.multiply(nav).setScale(2, RoundingMode.HALF_UP);
                BigDecimal tNav = BigDecimal.valueOf(navService.latestNav(target)).setScale(4, RoundingMode.HALF_UP);
                Folio tf = folioService.getOrCreate(o.getInvestorId(), target.getId());
                boolean stp = o.getType() == OrderType.STP;
                txn(f, o, stp ? TxnType.STP_OUT : TxnType.SWITCH_OUT, amount, units, nav, today);
                txn(tf, o, stp ? TxnType.STP_IN : TxnType.SWITCH_IN, amount,
                        amount.divide(tNav, 4, RoundingMode.HALF_UP), tNav, today);
                o.setUnits(units);
                if (stp) {
                    registration(o, RegistrationType.STP, f.getId(), target.getId());
                }
                note = "Switched " + units.toPlainString() + " units to " + target.getName();
            }
            default -> throw new IllegalStateException();
        }
        changeStatus(o, OrderStatus.ALLOTTED, note);
    }

    /** Units to redeem, or null if the folio does not hold enough. */
    private BigDecimal unitsFor(MfOrder o, BigDecimal nav, Long folioId) {
        double available = portfolio.currentUnits(folioId);
        BigDecimal units;
        if (o.isAllUnits()) {
            units = BigDecimal.valueOf(available).setScale(4, RoundingMode.DOWN);
        } else if (o.getUnits() != null) {
            units = o.getUnits().setScale(4, RoundingMode.HALF_UP);
        } else {
            units = o.getAmount().divide(nav, 4, RoundingMode.HALF_UP);
        }
        if (units.signum() <= 0 || units.doubleValue() > available + 0.0001) {
            return null;
        }
        return units;
    }

    private void txn(Folio f, MfOrder o, TxnType type, BigDecimal amount, BigDecimal units, BigDecimal nav, LocalDate d) {
        MfTransaction t = new MfTransaction();
        t.setFolioId(f.getId());
        t.setInvestorId(f.getInvestorId());
        t.setSchemeId(f.getSchemeId());
        t.setDate(d);
        t.setType(type);
        t.setAmount(amount.setScale(4, RoundingMode.HALF_UP));
        t.setUnits(units);
        t.setNav(nav);
        t.setOrderId(o.getId());
        t.setSource("ORDER");
        t.setCreatedAt(Fmt.now());
        txnRepo.save(t);
    }

    private void registration(MfOrder o, RegistrationType type, Long folioId, Long targetSchemeId) {
        SipRegistration s = new SipRegistration();
        s.setRegType(type);
        s.setInvestorId(o.getInvestorId());
        s.setSchemeId(o.getSchemeId());
        s.setTargetSchemeId(targetSchemeId);
        s.setFolioId(folioId);
        s.setAmount(o.getAmount());
        s.setSipDay(o.getSipDay() == null ? Fmt.today().getDayOfMonth() : o.getSipDay());
        s.setStartDate(Fmt.today());
        s.setInstallments(o.getInstallments());
        s.setInstallmentsDone(1);
        s.setStatus(SipStatus.ACTIVE);
        s.setOrderId(o.getId());
        s.setCreatedAt(Fmt.now());
        sipRepo.save(s);
    }
}
