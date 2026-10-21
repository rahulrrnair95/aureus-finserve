package com.aureusfinserve.portfolio;

import com.aureusfinserve.common.AssetClass;
import com.aureusfinserve.common.Fmt;
import com.aureusfinserve.common.RegistrationType;
import com.aureusfinserve.common.SipStatus;
import com.aureusfinserve.common.TxnType;
import com.aureusfinserve.investor.Investor;
import com.aureusfinserve.investor.InvestorRepository;
import com.aureusfinserve.portfolio.PortfolioDtos.*;
import com.aureusfinserve.portfolio.PortfolioRepos.FolioRepository;
import com.aureusfinserve.portfolio.PortfolioRepos.MfTransactionRepository;
import com.aureusfinserve.portfolio.PortfolioRepos.SipRegistrationRepository;
import com.aureusfinserve.publicsite.PublicRepos.SchemeRepository;
import com.aureusfinserve.publicsite.Scheme;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Derives holdings, valuations, XIRR and value history from transactions + NAV history. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class PortfolioService {

    private static final double EPS = 1e-4;

    /** Everything needed to value a set of investors. */
    public record Book(Map<Long, Investor> investors, List<Folio> folios, Map<Long, Scheme> schemes,
                       Map<Long, List<MfTransaction>> txnsByFolio, List<SipRegistration> sips) {
        public List<MfTransaction> txns(Long folioId) {
            return txnsByFolio.getOrDefault(folioId, List.of());
        }
    }

    private final InvestorRepository investorRepo;
    private final FolioRepository folioRepo;
    private final MfTransactionRepository txnRepo;
    private final SipRegistrationRepository sipRepo;
    private final SchemeRepository schemeRepo;
    private final NavService navService;

    public Book load(Collection<Long> investorIds) {
        if (investorIds.isEmpty()) {
            return new Book(Map.of(), List.of(), Map.of(), Map.of(), List.of());
        }
        Map<Long, Investor> investors = investorRepo.findAllById(investorIds).stream()
                .collect(Collectors.toMap(Investor::getId, Function.identity()));
        List<Folio> folios = folioRepo.findByInvestorIdIn(investorIds);
        Map<Long, List<MfTransaction>> byFolio = txnRepo.findByInvestorIdInOrderByDateAscIdAsc(investorIds).stream()
                .collect(Collectors.groupingBy(MfTransaction::getFolioId, LinkedHashMap::new, Collectors.toList()));
        List<SipRegistration> sips = sipRepo.findByInvestorIdInOrderByIdAsc(investorIds);
        Set<Long> schemeIds = new HashSet<>();
        folios.forEach(f -> schemeIds.add(f.getSchemeId()));
        sips.forEach(s -> {
            schemeIds.add(s.getSchemeId());
            if (s.getTargetSchemeId() != null) {
                schemeIds.add(s.getTargetSchemeId());
            }
        });
        Map<Long, Scheme> schemes = schemeRepo.findAllById(schemeIds).stream()
                .collect(Collectors.toMap(Scheme::getId, Function.identity()));
        return new Book(investors, folios, schemes, byFolio, sips);
    }

    // ------------------------------------------------------------------ holdings

    public Holding holding(Book b, Folio f) {
        Scheme s = b.schemes().get(f.getSchemeId());
        List<MfTransaction> txns = b.txns(f.getId());
        Fifo.State st = Fifo.replay(txns, null);
        double units = Math.max(0, st.units());
        double nav = navService.latestNav(s);
        double value = units * nav;
        double invested = st.cost();
        double gain = value - invested;
        Double xirr = xirrPct(txns, value);
        Investor inv = b.investors().get(f.getInvestorId());
        return new Holding(f.getId(), f.getFolioNo(), f.getInvestorId(), inv == null ? null : inv.getName(),
                s.getId(), s.getName(), s.getAmc(), s.getCategory(), s.getSubCategory(), s.getRisk(),
                Fmt.units(units), Fmt.nav(BigDecimal.valueOf(nav)), s.getNavDate(), Fmt.money(value),
                Fmt.money(invested), Fmt.money(gain), invested > 0 ? Fmt.pct(gain / invested * 100) : null, xirr);
    }

    /** Non-zero holdings, largest first. */
    public List<Holding> holdings(Book b) {
        List<Holding> out = new ArrayList<>();
        for (Folio f : b.folios()) {
            if (!b.schemes().containsKey(f.getSchemeId())) {
                continue;
            }
            Holding h = holding(b, f);
            if (h.units().doubleValue() > EPS) {
                out.add(h);
            }
        }
        out.sort(Comparator.comparing(Holding::value).reversed());
        return out;
    }

    private Double xirrPct(List<MfTransaction> txns, double currentValue) {
        List<Xirr.CashFlow> flows = new ArrayList<>();
        for (MfTransaction t : txns) {
            double amt = t.getAmount().doubleValue();
            flows.add(new Xirr.CashFlow(t.getDate(), t.getType().isInflow() ? -amt : amt));
        }
        if (currentValue > 0) {
            flows.add(new Xirr.CashFlow(Fmt.today(), currentValue));
        }
        Double r = Xirr.compute(flows);
        return r == null ? null : Fmt.pct(r * 100);
    }

    public double aum(Book b) {
        return holdings(b).stream().mapToDouble(h -> h.value().doubleValue()).sum();
    }

    // ------------------------------------------------------------------ summary

    public Summary summary(Book b) {
        List<Holding> holdings = holdings(b);
        double value = holdings.stream().mapToDouble(h -> h.value().doubleValue()).sum();
        double invested = holdings.stream().mapToDouble(h -> h.invested().doubleValue()).sum();
        double gain = value - invested;

        List<MfTransaction> all = b.txnsByFolio().values().stream().flatMap(List::stream).toList();
        Double xirr = xirrPct(all, value);

        Map<AssetClass, Double> byClass = new EnumMap<>(AssetClass.class);
        holdings.forEach(h -> byClass.merge(h.category(), h.value().doubleValue(), Double::sum));
        List<Allocation> allocation = byClass.entrySet().stream()
                .map(e -> new Allocation(e.getKey(), Fmt.money(e.getValue()),
                        value > 0 ? Fmt.pct(e.getValue() / value * 100) : 0.0))
                .toList();

        List<SipRegistration> activeSips = b.sips().stream()
                .filter(s -> s.getRegType() == RegistrationType.SIP && s.getStatus() == SipStatus.ACTIVE).toList();
        double sipAmount = activeSips.stream().mapToDouble(s -> s.getAmount().doubleValue()).sum();

        LocalDate asOf = holdings.stream().map(Holding::navDate).filter(Objects::nonNull)
                .max(Comparator.naturalOrder()).orElse(Fmt.today());

        return new Summary(Fmt.money(value), Fmt.money(invested), Fmt.money(gain),
                invested > 0 ? Fmt.pct(gain / invested * 100) : null, xirr, asOf, holdings.size(),
                activeSips.size(), Fmt.money(sipAmount), allocation,
                holdings.stream().limit(5).toList(), valueHistory(b));
    }

    /** 24 monthly points: month-ends of the previous 23 months plus today. */
    public List<ValuePoint> valueHistory(Book b) {
        LocalDate today = Fmt.today();
        List<LocalDate> dates = new ArrayList<>();
        YearMonth now = YearMonth.from(today);
        for (int i = 23; i >= 1; i--) {
            dates.add(now.minusMonths(i).atEndOfMonth());
        }
        dates.add(today);
        List<ValuePoint> out = new ArrayList<>();
        for (LocalDate d : dates) {
            double value = 0;
            double invested = 0;
            for (Folio f : b.folios()) {
                Scheme s = b.schemes().get(f.getSchemeId());
                if (s == null) {
                    continue;
                }
                Fifo.State st = Fifo.replay(b.txns(f.getId()), d);
                double units = st.units();
                if (units > EPS) {
                    value += units * navService.navOn(s, d);
                    invested += st.cost();
                }
            }
            out.add(new ValuePoint(d, Fmt.money(value), Fmt.money(invested)));
        }
        return out;
    }

    // ------------------------------------------------------------------ transactions

    public List<Txn> transactions(Book b, LocalDate from, LocalDate to, TxnType type) {
        Map<Long, Folio> folios = b.folios().stream().collect(Collectors.toMap(Folio::getId, Function.identity()));
        List<Txn> out = new ArrayList<>();
        for (List<MfTransaction> list : b.txnsByFolio().values()) {
            for (MfTransaction t : list) {
                if (from != null && t.getDate().isBefore(from)) {
                    continue;
                }
                if (to != null && t.getDate().isAfter(to)) {
                    continue;
                }
                if (type != null && t.getType() != type) {
                    continue;
                }
                out.add(toTxn(t, folios.get(t.getFolioId()), b));
            }
        }
        out.sort(Comparator.comparing(Txn::date).thenComparing(Txn::id).reversed());
        return out;
    }

    public Txn toTxn(MfTransaction t, Folio f, Book b) {
        Scheme s = b.schemes().get(t.getSchemeId());
        Investor inv = b.investors().get(t.getInvestorId());
        return new Txn(t.getId(), t.getDate(), f == null ? null : f.getFolioNo(), t.getFolioId(), t.getSchemeId(),
                s == null ? null : s.getName(), inv == null ? null : inv.getName(), t.getType(),
                Fmt.money(t.getAmount()), Fmt.units(t.getUnits()), Fmt.nav(t.getNav()));
    }

    public double currentUnits(Long folioId) {
        return Math.max(0, Fifo.replay(txnRepo.findByFolioIdOrderByDateAscIdAsc(folioId), null).units());
    }
}
