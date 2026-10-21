package com.aureusfinserve.seed;

import com.aureusfinserve.audit.AuditLog;
import com.aureusfinserve.audit.AuditLogRepository;
import com.aureusfinserve.auth.AppUser;
import com.aureusfinserve.auth.AppUserRepository;
import com.aureusfinserve.auth.AuthService;
import com.aureusfinserve.common.*;
import com.aureusfinserve.investor.*;
import com.aureusfinserve.investor.InvestorRepos.*;
import com.aureusfinserve.notification.Notification;
import com.aureusfinserve.notification.NotificationRepository;
import com.aureusfinserve.order.MfOrder;
import com.aureusfinserve.order.OrderHistory;
import com.aureusfinserve.order.OrderRepos.MfOrderRepository;
import com.aureusfinserve.order.OrderRepos.OrderHistoryRepository;
import com.aureusfinserve.portfolio.*;
import com.aureusfinserve.portfolio.PortfolioRepos.FolioRepository;
import com.aureusfinserve.portfolio.PortfolioRepos.MfTransactionRepository;
import com.aureusfinserve.portfolio.PortfolioRepos.SipRegistrationRepository;
import com.aureusfinserve.publicsite.Lead;
import com.aureusfinserve.publicsite.LeadAttachment;
import com.aureusfinserve.publicsite.PublicRepos.LeadAttachmentRepository;
import com.aureusfinserve.publicsite.PublicRepos.LeadRepository;
import com.aureusfinserve.publicsite.Scheme;
import com.aureusfinserve.report.Brokerage;
import com.aureusfinserve.report.BrokerageRepository;
import com.aureusfinserve.security.CryptoService;
import com.aureusfinserve.sync.SyncRun;
import com.aureusfinserve.sync.SyncRunRepository;
import com.lowagie.text.Document;
import com.lowagie.text.Paragraph;
import com.lowagie.text.pdf.PdfWriter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.*;

/** Demo users, investors, portfolios, orders, leads, tickets, notifications, goals, audit, brokerage, sync runs. */
@Slf4j
@Component
@RequiredArgsConstructor
public class DemoSeed {

    private final AppUserRepository userRepo;
    private final InvestorRepository investorRepo;
    private final NomineeRepository nomineeRepo;
    private final BankAccountRepository bankRepo;
    private final MandateRepository mandateRepo;
    private final GoalRepository goalRepo;
    private final TicketRepository ticketRepo;
    private final TicketCommentRepository commentRepo;
    private final FolioRepository folioRepo;
    private final MfTransactionRepository txnRepo;
    private final SipRegistrationRepository sipRepo;
    private final MfOrderRepository orderRepo;
    private final OrderHistoryRepository historyRepo;
    private final NotificationRepository notificationRepo;
    private final LeadRepository leadRepo;
    private final LeadAttachmentRepository attachmentRepo;
    private final AuditLogRepository auditRepo;
    private final BrokerageRepository brokerageRepo;
    private final SyncRunRepository syncRepo;
    private final PasswordEncoder encoder;
    private final CryptoService crypto;
    private final AuthService authService;

    private Map<String, Scheme> schemes;
    private Map<Long, TreeMap<LocalDate, Double>> series;
    private LocalDate lastNav;
    private LocalDate today;

    /** Real deployments (app.seed.sample-data=false): only the administrator login, no sample clients. */
    public void seedAdminOnly(String email, String password) {
        user("Operations Admin", email, "9000000001", Role.ADMIN, password, null, null);
        log.info("Created administrator login {} (no sample clients)", email);
    }

    public void seed(Map<String, Scheme> schemes, Map<Long, TreeMap<LocalDate, Double>> series) {
        this.schemes = schemes;
        this.series = series;
        this.today = Fmt.today();
        this.lastNav = series.values().iterator().next().lastKey();

        // ------------------------------------------------------------ staff
        AppUser admin = user("Operations Admin", "admin@aureusfinserve.in", "9000000001", Role.ADMIN, "Admin@2026", null, null);
        AppUser ananya = user("Ananya Sharma", "ananya@aureusfinserve.in", "9000000002", Role.RM, "Rm@2026!", "E123456", null);
        AppUser vikram = user("Vikram Nair", "vikram@aureusfinserve.in", "9000000003", Role.RM, "Rm@2026!", "E654321", null);

        // ------------------------------------------------------------ investors
        Investor priya = investor("Priya Menon", "ABCPM1234F", "1988-06-14", "priya@example.com", "9876543210",
                "Flat 12B, Lakeview Residency, Indiranagar, Bengaluru 560038", KycStatus.VALIDATED, ananya, null, Relation.SELF, 40);
        Investor arjun = investor("Arjun Menon", "ABCPM5678G", "1986-02-03", "arjun.menon@example.com", "9876543211",
                "Flat 12B, Lakeview Residency, Indiranagar, Bengaluru 560038", KycStatus.VALIDATED, ananya, priya, Relation.SPOUSE, 38);
        Investor rao = investor("Venkat Rao", "ABCPR5678K", "1959-09-21", "venkat.rao@example.com", "9876500001",
                "22, Temple Street, Basavanagudi, Bengaluru 560004", KycStatus.VALIDATED, ananya, null, Relation.SELF, 36);
        Investor kavita = investor("Kavita Iyer", "ABCPI4321L", "1992-11-30", "kavita.iyer@example.com", "9876500002",
                "B-704, Hiranandani Gardens, Powai, Mumbai 400076", KycStatus.VALIDATED, vikram, null, Relation.SELF, 12);
        Investor rohan = investor("Rohan Desai", "ABCPD2468H", "1995-04-09", "rohan.desai@example.com", "9876500003",
                "14, Koregaon Park Lane 5, Pune 411001", KycStatus.VALIDATED, vikram, null, Relation.SELF, 16);
        Investor meera = investor("Meera Shah", "ABCPS1357J", "1990-01-25", "meera.shah@example.com", "9876500004",
                "3rd Floor, Navrangpura Heights, Ahmedabad 380009", KycStatus.ON_HOLD, vikram, null, Relation.SELF, 20);

        AppUser priyaU = user("Priya Menon", priya.getEmail(), priya.getMobile(), Role.INVESTOR, "Priya@2026", null, priya.getId());
        AppUser raoU = user("Venkat Rao", rao.getEmail(), rao.getMobile(), Role.INVESTOR, "Rao@2026", null, rao.getId());
        AppUser kavitaU = user("Kavita Iyer", kavita.getEmail(), kavita.getMobile(), Role.INVESTOR, null, null, kavita.getId());
        String link = authService.createActivationLink(kavitaU);
        log.info("Demo activation link for Kavita Iyer (PAN ABCPI4321L, DOB 1992-11-30): {}", link);

        // ------------------------------------------------------------ profiles
        nominee(priya, "Arjun Menon", "SPOUSE", 100);
        nominee(arjun, "Priya Menon", "SPOUSE", 100);
        nominee(rao, "Lakshmi Rao", "SPOUSE", 60);
        nominee(rao, "Karthik Rao", "SON", 40);
        nominee(rohan, "Sunita Desai", "MOTHER", 100);
        bank(priya, "HDFC Bank", "50100123456789", "HDFC0001234", true);
        bank(priya, "ICICI Bank", "002101556677", "ICIC0000021", false);
        bank(arjun, "Axis Bank", "917010045678123", "UTIB0000009", true);
        bank(rao, "State Bank of India", "30123456789", "SBIN0000813", true);
        bank(kavita, "Kotak Mahindra Bank", "4512889900", "KKBK0000652", true);
        bank(rohan, "HDFC Bank", "50100987654321", "HDFC0000123", true);
        bank(meera, "Bank of Baroda", "27980100012345", "BARB0NAVRAN", true);
        mandate(priya, "HDFC7000000012345678", "HDFC Bank", 50000, MandateStatus.ACTIVE);
        mandate(rao, "SBIN7000000087654321", "State Bank of India", 25000, MandateStatus.PENDING);
        mandate(rohan, "HDFC7000000055554444", "HDFC Bank", 20000, MandateStatus.ACTIVE);
        mandate(meera, null, "Bank of Baroda", 10000, MandateStatus.REJECTED);

        // ------------------------------------------------------------ Priya: 6 SIPs across 4 AMCs
        Folio pMLarge = folio(priya, "Meridian Large Cap Fund", "4512367/21");
        Folio pMFlexi = folio(priya, "Meridian Flexi Cap Fund", "4512367/21");
        Folio pNMid = folio(priya, "Northstar Mid Cap Fund", "7781203/45");
        Folio pNElss = folio(priya, "Northstar ELSS Tax Saver Fund", "7781203/45");
        Folio pBSmall = folio(priya, "Banyan Small Cap Fund", "1093847/62");
        Folio pKFlexi = folio(priya, "Kestrel Flexi Cap Fund", "3349012/08");
        List<MfTransaction> largeCapSips = sipHistory(priya, pMLarge, 5000, 5, today.minusMonths(34), null);
        sipHistory(priya, pMFlexi, 4000, 10, today.minusMonths(30), 10);
        sipHistory(priya, pNMid, 3000, 15, today.minusMonths(28), null);
        sipHistory(priya, pNElss, 2500, 5, today.minusMonths(26), null);
        sipHistory(priya, pBSmall, 2000, 20, today.minusMonths(24), null);
        sipHistory(priya, pKFlexi, 3000, 25, today.minusMonths(27), null);

        // one redemption in FY 2025-26 (consumes the first 16 SIP lots FIFO -> both LTCG and STCG rows)
        LocalDate redDate = bizOnOrAfter(LocalDate.of(2025, 12, 15));
        double redUnits = largeCapSips.stream().limit(16).mapToDouble(t -> t.getUnits().doubleValue()).sum();
        MfOrder redOrder = order(priya, OrderType.REDEEM, pMLarge.getSchemeId(), null, pMLarge.getId(), null,
                BigDecimal.valueOf(redUnits).setScale(4, RoundingMode.HALF_UP), null, OrderStatus.ALLOTTED,
                priyaU, redDate.atTime(11, 5), PaymentMode.NETBANKING);
        MfTransaction red = sellUnits(pMLarge, redDate, TxnType.REDEMPTION, redUnits);
        red.setOrderId(redOrder.getId());
        txnRepo.save(red);

        // a recent lump sum (allotted) for Priya
        Folio pNHybrid = folio(priya, "Northstar Aggressive Hybrid Fund", "7781203/45");
        LocalDate lsDate = bizOnOrAfter(lastNav.minusDays(20));
        MfOrder lsOrder = order(priya, OrderType.LUMPSUM, pNHybrid.getSchemeId(), null, pNHybrid.getId(), BigDecimal.valueOf(25000),
                null, null, OrderStatus.ALLOTTED, priyaU, lsDate.atTime(10, 20), PaymentMode.UPI);
        MfTransaction lsTxn = buy(pNHybrid, lsDate, TxnType.PURCHASE, 25000);
        lsTxn.setOrderId(lsOrder.getId());
        txnRepo.save(lsTxn);

        // ------------------------------------------------------------ Arjun (spouse): 2 holdings
        Folio aSaffron = folio(arjun, "Saffron Bluechip Fund", "6620419/33");
        Folio aHarbor = folio(arjun, "Harbor Value Fund", "8854120/17");
        buy(aSaffron, bizOnOrAfter(today.minusMonths(22)), TxnType.PURCHASE, 100000);
        buy(aSaffron, bizOnOrAfter(today.minusMonths(9)), TxnType.PURCHASE, 40000);
        buy(aHarbor, bizOnOrAfter(today.minusMonths(15)), TxnType.PURCHASE, 50000);

        // ------------------------------------------------------------ Rao: lump-sum debt + hybrid, monthly SWP
        Folio rBaf = folio(rao, "Meridian Balanced Advantage Fund", "4598821/02");
        Folio rLiquid = folio(rao, "Meridian Liquid Fund", "4598821/02");
        Folio rShort = folio(rao, "Northstar Short Duration Fund", "7700345/91");
        Folio rCorp = folio(rao, "Banyan Corporate Bond Fund", "1045566/40");
        Folio rCons = folio(rao, "Harbor Conservative Hybrid Fund", "8890011/55");
        LocalDate raoStart = bizOnOrAfter(today.minusMonths(32));
        buy(rBaf, raoStart, TxnType.PURCHASE, 800000);
        buy(rShort, raoStart, TxnType.PURCHASE, 400000);
        buy(rCorp, bizOnOrAfter(raoStart.plusDays(7)), TxnType.PURCHASE, 300000);
        buy(rCons, bizOnOrAfter(raoStart.plusDays(7)), TxnType.PURCHASE, 200000);
        buy(rLiquid, bizOnOrAfter(today.minusMonths(30)), TxnType.PURCHASE, 150000);
        LocalDate swpStart = today.minusMonths(20).withDayOfMonth(1);
        int swpCount = 0;
        for (LocalDate d = swpStart; ; d = d.plusMonths(1)) {
            LocalDate bd = bizOnOrAfter(d);
            if (bd.isAfter(lastNav)) {
                break;
            }
            sellAmount(rBaf, bd, TxnType.SWP, 15000);
            swpCount++;
        }
        registration(rao, rBaf, RegistrationType.SWP, 15000, 1, swpStart, swpCount, null, null);

        // ------------------------------------------------------------ Vikram's clients
        Folio kSaffron = folio(kavita, "Saffron Bluechip Fund", "6620788/12");
        buy(kSaffron, bizOnOrAfter(today.minusMonths(10)), TxnType.PURCHASE, 25000);
        Folio roKestrel = folio(rohan, "Kestrel Large & Mid Cap Fund", "3341298/76");
        Folio roHarbor = folio(rohan, "Harbor Money Market Fund", "8851234/09");
        sipHistory(rohan, roKestrel, 5000, 7, today.minusMonths(14), null);
        buy(roHarbor, bizOnOrAfter(today.minusMonths(6)), TxnType.PURCHASE, 50000);
        Folio mBanyan = folio(meera, "Banyan Nifty 50 Index Fund", "1099876/23");
        sipHistory(meera, mBanyan, 2000, 12, today.minusMonths(18), null);

        // ------------------------------------------------------------ other orders
        MfOrder pending = order(priya, OrderType.LUMPSUM, schemes.get("Banyan Nifty 50 Index Fund").getId(), null, null,
                BigDecimal.valueOf(50000), null, null, OrderStatus.PENDING_APPROVAL, ananya, Fmt.now().minusHours(20), PaymentMode.UPI);
        order(rao, OrderType.LUMPSUM, schemes.get("Saffron Banking & PSU Debt Fund").getId(), null, null, BigDecimal.valueOf(100000),
                null, null, OrderStatus.FAILED, raoU, Fmt.now().minusDays(5).withHour(14), PaymentMode.NETBANKING);
        MfOrder cancelled = order(arjun, OrderType.SIP, schemes.get("Harbor Focused Fund").getId(), null, null, BigDecimal.valueOf(3000),
                null, null, OrderStatus.CANCELLED, ananya, Fmt.now().minusDays(40).withHour(12), PaymentMode.MANDATE);
        cancelled.setSipDay(10);
        cancelled.setInstallments(60);
        orderRepo.save(cancelled);

        // ------------------------------------------------------------ goals
        goal(priya, "Retirement corpus", GoalType.RETIREMENT, 20000000, LocalDate.of(2050, 3, 31),
                List.of(pMFlexi.getId(), pNMid.getId(), pBSmall.getId(), pKFlexi.getId()));
        goal(priya, "Daughter's higher education", GoalType.EDUCATION, 3500000, LocalDate.of(2038, 6, 1),
                List.of(pMLarge.getId(), pNElss.getId()));

        // ------------------------------------------------------------ tickets
        Ticket t1 = ticket(priya, TicketCategory.ADDRESS_CHANGE, "Update communication address",
                "We have moved within Bengaluru. Please update my address across all folios.", TicketStatus.RESOLVED, 60);
        comment(t1, "Ananya Sharma", "Address change form submitted to Meridian and Northstar RTAs.", 58);
        comment(t1, "Ananya Sharma", "Address updated in all folios. Closing this request.", 52);
        ticket(priya, TicketCategory.STATEMENT, "Need consolidated statement for visa application",
                "Please share a consolidated statement of holdings as of last month.", TicketStatus.OPEN, 2);
        Ticket t3 = ticket(rao, TicketCategory.BANK_CHANGE, "Change SWP credit bank account",
                "I would like my SWP credited to my new SBI account ending 6789.", TicketStatus.IN_PROGRESS, 6);
        comment(t3, "Ananya Sharma", "Bank change request needs a cancelled cheque; requested from Mr. Rao.", 5);
        ticket(rohan, TicketCategory.MISSING_TRANSACTION, "SIP instalment not reflecting",
                "My Kestrel SIP debited on the 7th is not showing in the dashboard.", TicketStatus.OPEN, 1);

        // ------------------------------------------------------------ notifications
        notification(priyaU, NotificationType.ORDER, "Order awaiting your approval",
                "Ananya Sharma has raised an order of Rs 50,000 in Banyan Nifty 50 Index Fund (" + pending.getRef()
                        + "). Open Orders to review and approve with an OTP.", false, 20);
        notification(priyaU, NotificationType.SIP, "SIP instalment processed",
                "Your SIP of Rs 5,000 in Meridian Large Cap Fund was processed.", false, 24 * 15);
        notification(priyaU, NotificationType.NAV, "NAVs updated", "Latest NAVs have been updated for your holdings.", true, 24);
        notification(priyaU, NotificationType.ORDER, "Order " + lsOrder.getRef() + ": allotted",
                "LUMPSUM order in Northstar Aggressive Hybrid Fund allotted.", true, 24 * 20);
        notification(priyaU, NotificationType.GENERAL, "Service request SR" + String.format("%06d", t1.getId()) + " resolved",
                "Your address change request has been completed.", true, 24 * 52);
        notification(raoU, NotificationType.SIP, "SWP instalment credited", "Rs 15,000 SWP from Meridian Balanced Advantage Fund credited to your bank account.", false, 24 * 18);
        notification(raoU, NotificationType.ORDER, "Order failed", "Your lump-sum order in Saffron Banking & PSU Debt Fund failed as payment was not received.", false, 24 * 5);
        notification(ananya, NotificationType.GENERAL, "New lead assigned", "Sanjay Kulkarni (SIP) via website", false, 30);
        notification(vikram, NotificationType.GENERAL, "New service request", "Rohan Desai: SIP instalment not reflecting", false, 20);

        // ------------------------------------------------------------ leads
        lead("Sanjay Kulkarni", "9811122233", "sanjay.k@example.com", "Bengaluru", LeadInterest.SIP, "Want to start a SIP for my son's education.", LeadStatus.NEW, ananya, 1, "WEBSITE");
        lead("Pooja Reddy", "9822233344", "pooja.r@example.com", "Hyderabad", LeadInterest.ELSS, "Looking for tax saving options before March.", LeadStatus.CONTACTED, ananya, 4, "WEBSITE");
        lead("Imran Sheikh", "9833344455", "imran.s@example.com", "Mumbai", LeadInterest.RETIREMENT, "Retiring in 8 years, need a plan.", LeadStatus.CONTACTED, vikram, 7, "WEBSITE");
        lead("Deepa Nair", "9844455566", null, "Kochi", LeadInterest.NRI, "I live in Dubai and want to invest in India.", LeadStatus.NEW, vikram, 2, "WEBSITE");
        lead("Harish Gupta", "9855566677", "harish.g@example.com", "Delhi", LeadInterest.LUMPSUM, "Have a bonus to invest.", LeadStatus.CONVERTED, ananya, 30, "WEBSITE");
        lead("Anita Joseph", "9866677788", "anita.j@example.com", "Chennai", LeadInterest.CHILD_EDUCATION, null, LeadStatus.LOST, vikram, 45, "WEBSITE");
        lead("Karan Malhotra", "9877788899", "karan.m@example.com", "Gurugram", LeadInterest.OTHER, "Want to understand my existing funds.", LeadStatus.NEW, null, 0, "WEBSITE");
        Lead review = lead("Nikhil Bhat", "9888899900", "nikhil.b@example.com", null, LeadInterest.PORTFOLIO_REVIEW,
                "Please review my CAS.", LeadStatus.NEW, ananya, 1, "PORTFOLIO_REVIEW");
        attachSampleCas(review);

        // ------------------------------------------------------------ audit, brokerage, sync
        audit(admin, "LOGIN_SUCCESS", "USER", admin.getId(), "Seed history", 3 * 24);
        audit(ananya, "CLIENT_CREATED", "INVESTOR", priya.getId(), "Priya Menon onboarded", 34 * 30 * 24);
        audit(ananya, "ORDER_PLACED", "ORDER", pending.getId(), pending.getRef() + " LUMPSUM for investor " + priya.getId() + " (pending client approval)", 20);
        audit(priyaU, "LOGIN_SUCCESS", "USER", priyaU.getId(), null, 26);
        audit(priyaU, "ORDER_PLACED", "ORDER", lsOrder.getId(), lsOrder.getRef() + " LUMPSUM", 20 * 24);
        audit(raoU, "LOGIN_FAILED", "USER", raoU.getId(), "Wrong password (attempt 1)", 50);
        audit(raoU, "LOGIN_SUCCESS", "USER", raoU.getId(), null, 49);
        audit(admin, "SYNC_RUN", "SYNC_RUN", null, "NAV SUCCESS processed=24 failed=0", 14);
        audit(admin, "CMS_CHANGED", "PAGE", "commission", "Updated", 15 * 24);
        brokerage();
        syncRuns(admin);
        log.info("Demo data seeded: {} investors, {} transactions", investorRepo.count(), txnRepo.count());
    }

    // ================================================================ helpers

    private AppUser user(String name, String email, String mobile, Role role, String password, String euin, Long investorId) {
        AppUser u = new AppUser();
        u.setName(name);
        u.setEmail(email);
        u.setEmailHash(crypto.emailHash(email));
        u.setMobile(mobile);
        u.setMobileHash(crypto.mobileHash(mobile));
        u.setRole(role);
        u.setEuin(euin);
        u.setInvestorId(investorId);
        u.setEnabled(true);
        if (password != null) {
            u.setPasswordHash(encoder.encode(password));
            u.setPasswordChangedAt(Fmt.now().minusMonths(2));
            u.setLoginStatus(LoginStatus.ACTIVE);
        } else {
            u.setLoginStatus(LoginStatus.NOT_ACTIVATED);
        }
        u.setCreatedAt(Fmt.now().minusMonths(investorId == null ? 36 : 30));
        return userRepo.save(u);
    }

    private Investor investor(String name, String pan, String dob, String email, String mobile, String address, KycStatus kyc,
                              AppUser rm, Investor head, Relation rel, int monthsAgo) {
        Investor i = new Investor();
        i.setName(name);
        i.setPan(pan);
        i.setPanHash(crypto.panHash(pan));
        i.setDob(dob);
        i.setEmail(email);
        i.setEmailHash(crypto.emailHash(email));
        i.setMobile(mobile);
        i.setMobileHash(crypto.mobileHash(mobile));
        i.setAddress(address);
        i.setKycStatus(kyc);
        i.setTaxStatus("Resident Individual");
        i.setRmId(rm.getId());
        i.setFamilyHeadId(head == null ? null : head.getId());
        i.setRelation(rel);
        i.setCreatedAt(Fmt.now().minusMonths(monthsAgo));
        return investorRepo.save(i);
    }

    private void nominee(Investor i, String name, String rel, int share) {
        Nominee n = new Nominee();
        n.setInvestorId(i.getId());
        n.setName(name);
        n.setRelation(rel);
        n.setSharePct(BigDecimal.valueOf(share));
        nomineeRepo.save(n);
    }

    private void bank(Investor i, String bank, String acc, String ifsc, boolean primary) {
        BankAccount b = new BankAccount();
        b.setInvestorId(i.getId());
        b.setBankName(bank);
        b.setAccountNumber(acc);
        b.setIfsc(ifsc);
        b.setPrimaryAccount(primary);
        bankRepo.save(b);
    }

    private void mandate(Investor i, String umrn, String bank, int limit, MandateStatus st) {
        Mandate m = new Mandate();
        m.setInvestorId(i.getId());
        m.setUmrn(umrn);
        m.setBankName(bank);
        m.setLimitAmount(BigDecimal.valueOf(limit));
        m.setStatus(st);
        mandateRepo.save(m);
    }

    private Folio folio(Investor i, String schemeName, String folioNo) {
        Folio f = new Folio();
        f.setInvestorId(i.getId());
        f.setSchemeId(scheme(schemeName).getId());
        f.setFolioNo(folioNo);
        f.setCreatedAt(Fmt.now().minusMonths(30));
        return folioRepo.save(f);
    }

    private Scheme scheme(String name) {
        Scheme s = schemes.get(name);
        if (s == null) {
            throw new IllegalStateException("Unknown seed scheme " + name);
        }
        return s;
    }

    private static LocalDate bizOnOrAfter(LocalDate d) {
        LocalDate x = d;
        while (x.getDayOfWeek() == DayOfWeek.SATURDAY || x.getDayOfWeek() == DayOfWeek.SUNDAY) {
            x = x.plusDays(1);
        }
        return x;
    }

    private double nav(Long schemeId, LocalDate d) {
        Map.Entry<LocalDate, Double> e = series.get(schemeId).floorEntry(d);
        return e == null ? series.get(schemeId).firstEntry().getValue() : e.getValue();
    }

    private MfTransaction txn(Folio f, LocalDate d, TxnType type, double amount, double units, double nav) {
        MfTransaction t = new MfTransaction();
        t.setFolioId(f.getId());
        t.setInvestorId(f.getInvestorId());
        t.setSchemeId(f.getSchemeId());
        t.setDate(d);
        t.setType(type);
        t.setAmount(BigDecimal.valueOf(amount).setScale(2, RoundingMode.HALF_UP));
        t.setUnits(BigDecimal.valueOf(units).setScale(4, RoundingMode.HALF_UP));
        t.setNav(BigDecimal.valueOf(nav).setScale(4, RoundingMode.HALF_UP));
        t.setSource("SEED");
        t.setCreatedAt(d.atTime(18, 0));
        return txnRepo.save(t);
    }

    private MfTransaction buy(Folio f, LocalDate d, TxnType type, double amount) {
        double nav = nav(f.getSchemeId(), d);
        return txn(f, d, type, amount, Math.round(amount / nav * 10000.0) / 10000.0, nav);
    }

    private MfTransaction sellUnits(Folio f, LocalDate d, TxnType type, double units) {
        double nav = nav(f.getSchemeId(), d);
        double u = Math.round(units * 10000.0) / 10000.0;
        return txn(f, d, type, u * nav, u, nav);
    }

    private MfTransaction sellAmount(Folio f, LocalDate d, TxnType type, double amount) {
        double nav = nav(f.getSchemeId(), d);
        return txn(f, d, type, amount, Math.round(amount / nav * 10000.0) / 10000.0, nav);
    }

    /** Monthly SIP instalments from start to the last NAV date, plus an ACTIVE SIP registration. */
    private List<MfTransaction> sipHistory(Investor inv, Folio f, double amount, int day, LocalDate startMonth, Integer stepUp) {
        List<MfTransaction> out = new ArrayList<>();
        LocalDate first = startMonth.withDayOfMonth(day);
        for (LocalDate d = first; ; d = d.plusMonths(1)) {
            LocalDate bd = bizOnOrAfter(d);
            if (bd.isAfter(lastNav)) {
                break;
            }
            out.add(buy(f, bd, TxnType.SIP, amount));
        }
        registration(inv, f, RegistrationType.SIP, amount, day, first, out.size(), stepUp, null);
        return out;
    }

    private void registration(Investor inv, Folio f, RegistrationType type, double amount, int day, LocalDate start,
                              int done, Integer stepUp, Integer installments) {
        SipRegistration s = new SipRegistration();
        s.setRegType(type);
        s.setInvestorId(inv.getId());
        s.setSchemeId(f.getSchemeId());
        s.setFolioId(f.getId());
        s.setAmount(BigDecimal.valueOf(amount));
        s.setSipDay(day);
        s.setStartDate(start);
        s.setInstallments(installments);
        s.setInstallmentsDone(done);
        s.setStepUpPct(stepUp);
        s.setStatus(SipStatus.ACTIVE);
        s.setCreatedAt(start.atTime(10, 0));
        sipRepo.save(s);
    }

    private MfOrder order(Investor inv, OrderType type, Long schemeId, Long targetSchemeId, Long folioId, BigDecimal amount,
                          BigDecimal units, Boolean all, OrderStatus status, AppUser by, LocalDateTime at, PaymentMode mode) {
        MfOrder o = new MfOrder();
        o.setInvestorId(inv.getId());
        o.setType(type);
        o.setSchemeId(schemeId);
        o.setTargetSchemeId(targetSchemeId);
        o.setFolioId(folioId);
        o.setAmount(amount);
        o.setUnits(units);
        o.setAllUnits(Boolean.TRUE.equals(all));
        o.setPaymentMode(mode);
        o.setStatus(status);
        o.setPlacedByUserId(by.getId());
        o.setPlacedByName(by.getName());
        o.setPlacedByRole(by.getRole());
        o.setRiskAcknowledged(true);
        o.setCreatedAt(at);
        o.setUpdatedAt(at);
        orderRepo.save(o);
        o.setRef("AF" + at.format(java.time.format.DateTimeFormatter.ofPattern("yyMMdd")) + String.format("%04d", o.getId() % 10000));
        if (status != OrderStatus.PENDING_APPROVAL) {
            o.setExchangeRef("BSE" + String.format("%06d", 100000 + o.getId() * 7919 % 900000));
            o.setPlacedAt(at);
        }
        orderRepo.save(o);
        switch (status) {
            case PENDING_APPROVAL -> hist(o, OrderStatus.PENDING_APPROVAL, at, "Raised by " + by.getName() + " - awaiting client approval (OTP)");
            case ALLOTTED -> {
                hist(o, OrderStatus.PLACED, at, "Order placed on exchange");
                hist(o, OrderStatus.PAYMENT_RECEIVED, at.plusMinutes(40), type == OrderType.REDEEM ? "Order confirmed by exchange" : "Payment received via " + mode);
                hist(o, OrderStatus.ALLOTTED, at.plusHours(6), "Units processed at applicable NAV");
            }
            case FAILED -> {
                hist(o, OrderStatus.PLACED, at, "Order placed on exchange");
                hist(o, OrderStatus.FAILED, at.plusHours(3), "Payment not received before cut-off");
            }
            case CANCELLED -> {
                hist(o, OrderStatus.PENDING_APPROVAL, at, "Raised by " + by.getName() + " - awaiting client approval (OTP)");
                hist(o, OrderStatus.CANCELLED, at.plusDays(1), "Rejected by client");
            }
            default -> hist(o, status, at, null);
        }
        return o;
    }

    private void hist(MfOrder o, OrderStatus s, LocalDateTime at, String note) {
        OrderHistory h = new OrderHistory();
        h.setOrderId(o.getId());
        h.setStatus(s);
        h.setAt(at);
        h.setNote(note);
        historyRepo.save(h);
    }

    private void goal(Investor inv, String name, GoalType type, double target, LocalDate date, List<Long> folios) {
        Goal g = new Goal();
        g.setInvestorId(inv.getId());
        g.setName(name);
        g.setType(type);
        g.setTargetAmount(BigDecimal.valueOf(target));
        g.setTargetDate(date);
        g.getFolioIds().addAll(folios);
        goalRepo.save(g);
    }

    private Ticket ticket(Investor inv, TicketCategory cat, String subject, String desc, TicketStatus st, int daysAgo) {
        Ticket t = new Ticket();
        t.setInvestorId(inv.getId());
        t.setCategory(cat);
        t.setSubject(subject);
        t.setDescription(desc);
        t.setStatus(st);
        t.setCreatedAt(Fmt.now().minusDays(daysAgo));
        t.setUpdatedAt(Fmt.now().minusDays(Math.max(0, daysAgo - 3)));
        ticketRepo.save(t);
        t.setRef(String.format("SR%06d", t.getId()));
        return ticketRepo.save(t);
    }

    private void comment(Ticket t, String by, String text, int daysAgo) {
        TicketComment c = new TicketComment();
        c.setTicketId(t.getId());
        c.setByName(by);
        c.setText(text);
        c.setCreatedAt(Fmt.now().minusDays(daysAgo));
        commentRepo.save(c);
    }

    private void notification(AppUser u, NotificationType type, String title, String msg, boolean read, int hoursAgo) {
        Notification n = new Notification();
        n.setUserId(u.getId());
        n.setType(type);
        n.setTitle(title);
        n.setMessage(msg);
        n.setRead(read);
        n.setCreatedAt(Fmt.now().minusHours(hoursAgo));
        notificationRepo.save(n);
    }

    private Lead lead(String name, String mobile, String email, String city, LeadInterest interest, String msg, LeadStatus st,
                      AppUser rm, int daysAgo, String source) {
        Lead l = new Lead();
        l.setName(name);
        l.setMobile(mobile);
        l.setEmail(email);
        l.setCity(city);
        l.setInterest(interest);
        l.setMessage(msg);
        l.setStatus(st);
        l.setSource(source);
        l.setConsent(true);
        l.setAssignedRmId(rm == null ? null : rm.getId());
        l.setCreatedAt(Fmt.now().minusDays(daysAgo).minusHours(3));
        if (st == LeadStatus.CONTACTED) {
            l.setFollowUpDate(today.plusDays(3));
            l.setNotes("Spoke on phone; sharing scheme information documents. Follow up after they review.");
        }
        return leadRepo.save(l);
    }

    private void attachSampleCas(Lead l) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document doc = new Document();
        PdfWriter.getInstance(doc, out);
        doc.open();
        doc.add(new Paragraph("SAMPLE Consolidated Account Statement (demo data)"));
        doc.add(new Paragraph("This is a placeholder CAS file created by the seed for testing the portfolio-review flow."));
        doc.close();
        LeadAttachment a = new LeadAttachment();
        a.setLeadId(l.getId());
        a.setFileName("sample-cas.pdf");
        a.setContentType("application/pdf");
        a.setData(out.toByteArray());
        a.setSizeBytes(a.getData().length);
        a.setCasPassword("NIKH1990");
        a.setCreatedAt(l.getCreatedAt());
        attachmentRepo.save(a);
        l.setHasAttachment(true);
        leadRepo.save(l);
    }

    private void audit(AppUser u, String action, String entity, Object entityId, String detail, int hoursAgo) {
        AuditLog a = new AuditLog();
        a.setAt(Fmt.now().minusHours(hoursAgo));
        a.setUserId(u.getId());
        a.setUserName(u.getName());
        a.setRole(u.getRole().name());
        a.setAction(action);
        a.setEntity(entity);
        a.setEntityId(entityId == null ? null : String.valueOf(entityId));
        a.setDetail(detail);
        a.setIp("10.0.0." + (10 + u.getId()));
        auditRepo.save(a);
    }

    /** Trail commission: expected = month-end AUM x annual rate / 12; the latest month is not yet received. */
    private void brokerage() {
        List<Folio> folios = folioRepo.findAll();
        List<MfTransaction> all = txnRepo.findAllByOrderByDateAscIdAsc();
        Map<Long, List<MfTransaction>> byFolio = new HashMap<>();
        all.forEach(t -> byFolio.computeIfAbsent(t.getFolioId(), k -> new ArrayList<>()).add(t));
        Map<Long, Scheme> byId = new HashMap<>();
        schemes.values().forEach(s -> byId.put(s.getId(), s));
        YearMonth now = YearMonth.from(today);
        int row = 0;
        for (int i = 6; i >= 1; i--) {
            YearMonth ym = now.minusMonths(i);
            LocalDate end = ym.atEndOfMonth();
            Map<Long, Double> aum = new TreeMap<>();
            for (Folio f : folios) {
                double units = Fifo.replay(byFolio.getOrDefault(f.getId(), List.of()), end).units();
                if (units > 0) {
                    aum.merge(f.getSchemeId(), units * nav(f.getSchemeId(), end), Double::sum);
                }
            }
            for (Map.Entry<Long, Double> e : aum.entrySet()) {
                Scheme s = byId.get(e.getKey());
                // the firm's actual trail rates are not seeded; the sample brokerage uses an indicative rate by category
                double rate = s.getTrailCommissionPct() != null ? s.getTrailCommissionPct().doubleValue()
                        : switch (s.getCategory()) { case EQUITY -> 0.85; case HYBRID -> 0.75; case DEBT -> 0.25; };
                double expected = e.getValue() * rate / 100 / 12;
                double received;
                if (i == 1) {
                    received = 0;
                } else if (++row % 7 == 0) {
                    received = expected * 0.93;
                } else {
                    received = expected;
                }
                Brokerage b = new Brokerage();
                b.setAmc(s.getAmc());
                b.setSchemeName(s.getName());
                b.setMonth(ym.toString());
                b.setAum(BigDecimal.valueOf(e.getValue()).setScale(2, RoundingMode.HALF_UP));
                b.setRatePct(BigDecimal.valueOf(rate));
                b.setExpected(BigDecimal.valueOf(expected).setScale(2, RoundingMode.HALF_UP));
                b.setReceived(BigDecimal.valueOf(received).setScale(2, RoundingMode.HALF_UP));
                b.setReconciled(received > 0 && Math.abs(received - expected) < 1);
                brokerageRepo.save(b);
            }
        }
    }

    private void syncRuns(AppUser admin) {
        SyncRun nav = new SyncRun();
        nav.setType("NAV");
        nav.setStartedAt(lastNav.atTime(21, 30));
        nav.setFinishedAt(lastNav.atTime(21, 31, 12));
        nav.setStatus("SUCCESS");
        nav.setProcessed(24);
        nav.setFailed(0);
        nav.setErrors("");
        nav.setTriggeredBy("Scheduler");
        syncRepo.save(nav);
        SyncRun rta = new SyncRun();
        rta.setType("RTA");
        rta.setStartedAt(Fmt.now().minusDays(3).withHour(10).withMinute(5));
        rta.setFinishedAt(Fmt.now().minusDays(3).withHour(10).withMinute(6));
        rta.setStatus("PARTIAL");
        rta.setProcessed(41);
        rta.setFailed(2);
        rta.setErrors("Line 17: no investor with PAN XXXXX9999Z\nLine 33: unknown scheme code 119551");
        rta.setTriggeredBy(admin.getName());
        syncRepo.save(rta);
    }
}
