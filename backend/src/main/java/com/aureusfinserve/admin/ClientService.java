package com.aureusfinserve.admin;

import com.aureusfinserve.admin.AdminDtos.*;
import com.aureusfinserve.audit.AuditService;
import com.aureusfinserve.auth.AppUser;
import com.aureusfinserve.auth.AppUserRepository;
import com.aureusfinserve.auth.AuthService;
import com.aureusfinserve.auth.SessionService;
import com.aureusfinserve.common.*;
import com.aureusfinserve.investor.Investor;
import com.aureusfinserve.investor.InvestorRepository;
import com.aureusfinserve.order.OrderService;
import com.aureusfinserve.portfolio.PortfolioDtos.Holding;
import com.aureusfinserve.portfolio.PortfolioService;
import com.aureusfinserve.portfolio.SipService;
import com.aureusfinserve.security.AuthUser;
import com.aureusfinserve.security.CryptoService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Client (investor) management for RMs and admins. */
@Service
@RequiredArgsConstructor
public class ClientService {

    private final InvestorRepository investorRepo;
    private final AppUserRepository userRepo;
    private final StaffScope scope;
    private final PortfolioService portfolio;
    private final SipService sipService;
    private final OrderService orderService;
    private final AuthService authService;
    private final SessionService sessionService;
    private final CryptoService crypto;
    private final AuditService audit;
    private final ObjectMapper mapper;

    @Transactional(readOnly = true)
    public List<ClientRow> list(AuthUser u, String q, Long rmId) {
        List<Investor> investors = u.isAdmin() ? investorRepo.findAll() : investorRepo.findByRmId(u.userId());
        if (rmId != null) {
            investors = investors.stream().filter(i -> rmId.equals(i.getRmId())).toList();
        }
        if (q != null && !q.isBlank()) {
            String n = q.trim().toLowerCase(Locale.ROOT);
            String digits = n.replaceAll("\\D", "");
            investors = investors.stream().filter(i -> i.getName().toLowerCase(Locale.ROOT).contains(n)
                    || (i.getEmail() != null && i.getEmail().toLowerCase(Locale.ROOT).contains(n))
                    || (i.getPan() != null && i.getPan().toLowerCase(Locale.ROOT).contains(n))
                    || (digits.length() >= 4 && i.getMobile() != null && i.getMobile().contains(digits))).toList();
        }
        return rows(investors);
    }

    public List<ClientRow> rows(List<Investor> investors) {
        if (investors.isEmpty()) {
            return List.of();
        }
        List<Long> ids = investors.stream().map(Investor::getId).toList();
        PortfolioService.Book book = portfolio.load(ids);
        Map<Long, Double> aum = new HashMap<>();
        portfolio.holdings(book).forEach(h -> aum.merge(h.investorId(), h.value().doubleValue(), Double::sum));
        Map<Long, Long> sipCount = book.sips().stream()
                .filter(s -> s.getRegType() == RegistrationType.SIP && s.getStatus() != SipStatus.CANCELLED)
                .collect(Collectors.groupingBy(s -> s.getInvestorId(), Collectors.counting()));
        Map<Long, AppUser> rms = userRepo.findAllById(investors.stream().map(Investor::getRmId).filter(Objects::nonNull)
                .collect(Collectors.toSet())).stream().collect(Collectors.toMap(AppUser::getId, Function.identity()));
        Map<Long, AppUser> logins = userRepo.findByInvestorIdIn(ids).stream()
                .collect(Collectors.toMap(AppUser::getInvestorId, Function.identity(), (a, b) -> a));
        Set<Long> headIds = investors.stream().map(Investor::getFamilyHeadId).filter(Objects::nonNull).collect(Collectors.toSet());
        Map<Long, String> heads = investorRepo.findAllById(headIds).stream().collect(Collectors.toMap(Investor::getId, Investor::getName));
        return investors.stream().sorted(Comparator.comparing(Investor::getName)).map(i -> {
            AppUser login = logins.get(i.getId());
            LoginStatus ls = login == null ? LoginStatus.NOT_ACTIVATED : effectiveStatus(login);
            return new ClientRow(i.getId(), i.getName(), Fmt.maskPan(i.getPan()), Fmt.maskMobile(i.getMobile()), i.getEmail(),
                    i.getRmId(), i.getRmId() == null || !rms.containsKey(i.getRmId()) ? null : rms.get(i.getRmId()).getName(),
                    Fmt.money(aum.getOrDefault(i.getId(), 0.0)), sipCount.getOrDefault(i.getId(), 0L), i.getKycStatus(), ls,
                    i.getFamilyHeadId(), i.getFamilyHeadId() == null ? null : heads.get(i.getFamilyHeadId()),
                    i.getRelation(), i.getCreatedAt());
        }).toList();
    }

    static LoginStatus effectiveStatus(AppUser u) {
        if (!u.isEnabled()) {
            return LoginStatus.DISABLED;
        }
        if (u.getLoginStatus() == LoginStatus.LOCKED && u.getLockedUntil() != null
                && u.getLockedUntil().isBefore(java.time.LocalDateTime.now(Fmt.IST))) {
            return LoginStatus.ACTIVE;
        }
        return u.getLoginStatus();
    }

    @SuppressWarnings("unchecked")
    @Transactional
    public Map<String, Object> detail(AuthUser u, Long id) {
        Investor inv = scope.client(u, id);
        Map<String, Object> out = mapper.convertValue(rows(List.of(inv)).get(0), LinkedHashMap.class);
        out.put("dob", inv.getDob());
        out.put("address", inv.getAddress());
        Long headId = inv.getFamilyHeadId() == null ? inv.getId() : inv.getFamilyHeadId();
        List<FamilyRef> fam = new ArrayList<>();
        investorRepo.findById(headId).ifPresent(h -> fam.add(new FamilyRef(h.getId(), h.getName(), Relation.SELF)));
        investorRepo.findByFamilyHeadId(headId).forEach(m -> fam.add(new FamilyRef(m.getId(), m.getName(), m.getRelation())));
        out.put("family", fam.stream().filter(f -> !f.id().equals(inv.getId())).toList());
        PortfolioService.Book book = portfolio.load(List.of(inv.getId()));
        List<Holding> holdings = portfolio.holdings(book);
        out.put("holdings", holdings);
        out.put("sips", sipService.list(List.of(inv.getId())));
        out.put("orders", orderService.list(List.of(inv.getId()), null));
        return out;
    }

    // ---------------------------------------------------------------- create / update

    public record Created(ClientRow client, String activationLink) {
    }

    @Transactional
    public Created create(AuthUser u, ClientRequest r) {
        Long rmId = u.isAdmin() ? r.rmId() : u.userId();
        if (rmId != null) {
            AppUser rm = userRepo.findById(rmId).filter(x -> x.getRole() == Role.RM || x.getRole() == Role.ADMIN)
                    .orElseThrow(() -> ApiException.validation("rmId", "Select a valid relationship manager"));
            rmId = rm.getId();
        }
        String pan = r.pan().trim().toUpperCase(Locale.ROOT);
        String mobile = CryptoService.normaliseMobile(r.mobile());
        String email = r.email().trim().toLowerCase(Locale.ROOT);
        if (investorRepo.findFirstByPanHash(crypto.panHash(pan)).isPresent()) {
            throw ApiException.conflict("A client with this PAN already exists");
        }
        if (userRepo.findFirstByMobileHash(crypto.mobileHash(mobile)).isPresent()) {
            throw ApiException.conflict("This mobile number is already registered to another login");
        }
        if (userRepo.findFirstByEmailHash(crypto.emailHash(email)).isPresent()) {
            throw ApiException.conflict("This e-mail is already registered to another login");
        }
        Investor inv = new Investor();
        applyFamily(u, inv, r.familyHeadId(), r.relation());
        apply(inv, r, pan, mobile, email);
        inv.setRmId(rmId);
        inv.setCreatedAt(Fmt.now());
        investorRepo.save(inv);

        AppUser login = new AppUser();
        login.setName(inv.getName());
        login.setRole(Role.INVESTOR);
        login.setInvestorId(inv.getId());
        login.setLoginStatus(LoginStatus.NOT_ACTIVATED);
        login.setEnabled(true);
        login.setCreatedAt(Fmt.now());
        syncLogin(login, mobile, email);
        userRepo.save(login);
        String link = authService.createActivationLink(login);
        audit.log("CLIENT_CREATED", "INVESTOR", inv.getId(), inv.getName() + " (RM " + rmId + ")");
        return new Created(rows(List.of(inv)).get(0), link);
    }

    @Transactional
    public ClientRow update(AuthUser u, Long id, ClientRequest r) {
        Investor inv = investorRepo.findById(id).orElseThrow(() -> ApiException.notFound("Client"));
        String pan = r.pan().trim().toUpperCase(Locale.ROOT);
        String mobile = CryptoService.normaliseMobile(r.mobile());
        String email = r.email().trim().toLowerCase(Locale.ROOT);
        investorRepo.findFirstByPanHash(crypto.panHash(pan)).filter(o -> !o.getId().equals(id)).ifPresent(o -> {
            throw ApiException.conflict("Another client has this PAN");
        });
        Optional<AppUser> login = userRepo.findFirstByInvestorId(id);
        Long loginId = login.map(AppUser::getId).orElse(-1L);
        userRepo.findFirstByMobileHash(crypto.mobileHash(mobile)).filter(o -> !o.getId().equals(loginId)).ifPresent(o -> {
            throw ApiException.conflict("This mobile number is already registered to another login");
        });
        userRepo.findFirstByEmailHash(crypto.emailHash(email)).filter(o -> !o.getId().equals(loginId)).ifPresent(o -> {
            throw ApiException.conflict("This e-mail is already registered to another login");
        });
        if (r.familyHeadId() != null && r.familyHeadId().equals(id)) {
            throw ApiException.validation("familyHeadId", "A client cannot be their own family head");
        }
        applyFamily(u, inv, r.familyHeadId(), r.relation());
        apply(inv, r, pan, mobile, email);
        if (r.rmId() != null) {
            userRepo.findById(r.rmId()).filter(x -> x.getRole() == Role.RM || x.getRole() == Role.ADMIN)
                    .orElseThrow(() -> ApiException.validation("rmId", "Select a valid relationship manager"));
        }
        inv.setRmId(r.rmId());
        investorRepo.save(inv);
        login.ifPresent(l -> {
            l.setName(inv.getName());
            syncLogin(l, mobile, email);
            userRepo.save(l);
        });
        audit.log("CLIENT_UPDATED", "INVESTOR", inv.getId(), "Profile updated");
        return rows(List.of(inv)).get(0);
    }

    private void apply(Investor inv, ClientRequest r, String pan, String mobile, String email) {
        inv.setName(r.name().trim());
        inv.setPan(pan);
        inv.setPanHash(crypto.panHash(pan));
        inv.setDob(r.dob().toString());
        inv.setMobile(mobile);
        inv.setMobileHash(crypto.mobileHash(mobile));
        inv.setEmail(email);
        inv.setEmailHash(crypto.emailHash(email));
        inv.setAddress(r.address());
        inv.setKycStatus(r.kycStatus() == null ? KycStatus.REGISTERED : r.kycStatus());
    }

    private void applyFamily(AuthUser u, Investor inv, Long headId, Relation relation) {
        if (headId == null) {
            inv.setFamilyHeadId(null);
            inv.setRelation(Relation.SELF);
            return;
        }
        Investor head = scope.client(u, headId);
        if (head.getFamilyHeadId() != null) {
            throw ApiException.validation("familyHeadId", "The selected family head is itself a member of another family");
        }
        inv.setFamilyHeadId(head.getId());
        inv.setRelation(relation == null || relation == Relation.SELF ? Relation.OTHER : relation);
    }

    private void syncLogin(AppUser l, String mobile, String email) {
        l.setMobile(mobile);
        l.setMobileHash(crypto.mobileHash(mobile));
        l.setEmail(email);
        l.setEmailHash(crypto.emailHash(email));
    }

    // ---------------------------------------------------------------- activation / status

    @Transactional
    public String activationLink(AuthUser u, Long id) {
        Investor inv = scope.client(u, id);
        AppUser login = userRepo.findFirstByInvestorId(inv.getId()).orElseGet(() -> {
            if (inv.getMobile() == null || userRepo.findFirstByMobileHash(inv.getMobileHash()).isPresent()) {
                throw ApiException.conflict("This client has no unique mobile number for an online login");
            }
            AppUser n = new AppUser();
            n.setName(inv.getName());
            n.setRole(Role.INVESTOR);
            n.setInvestorId(inv.getId());
            n.setLoginStatus(LoginStatus.NOT_ACTIVATED);
            n.setCreatedAt(Fmt.now());
            syncLogin(n, inv.getMobile(), inv.getEmail());
            return userRepo.save(n);
        });
        if (login.getLoginStatus() != LoginStatus.NOT_ACTIVATED) {
            throw ApiException.conflict("This client's online account is already activated");
        }
        String link = authService.createActivationLink(login);
        audit.log("CLIENT_UPDATED", "INVESTOR", inv.getId(), "Activation link sent");
        return link;
    }

    @Transactional
    public ClientRow setEnabled(Long id, boolean enabled) {
        Investor inv = investorRepo.findById(id).orElseThrow(() -> ApiException.notFound("Client"));
        AppUser login = userRepo.findFirstByInvestorId(id)
                .orElseThrow(() -> ApiException.conflict("This client has no online login"));
        applyEnabled(login, enabled, sessionService);
        userRepo.save(login);
        audit.log("CLIENT_UPDATED", "INVESTOR", id, enabled ? "Login enabled" : "Login disabled");
        return rows(List.of(inv)).get(0);
    }

    static void applyEnabled(AppUser login, boolean enabled, SessionService sessions) {
        login.setEnabled(enabled);
        if (enabled) {
            login.setFailedAttempts(0);
            login.setLockedUntil(null);
            if (login.getLoginStatus() == LoginStatus.DISABLED || login.getLoginStatus() == LoginStatus.LOCKED) {
                login.setLoginStatus(login.getPasswordHash() == null ? LoginStatus.NOT_ACTIVATED : LoginStatus.ACTIVE);
            }
        } else {
            login.setLoginStatus(LoginStatus.DISABLED);
            sessions.revokeAll(login.getId(), "DISABLED");
        }
    }
}
