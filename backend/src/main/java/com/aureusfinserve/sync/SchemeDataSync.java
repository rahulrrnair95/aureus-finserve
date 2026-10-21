package com.aureusfinserve.sync;

import com.aureusfinserve.common.Fmt;
import com.aureusfinserve.common.Risk;
import com.aureusfinserve.config.AppProperties;
import com.aureusfinserve.portfolio.NavService;
import com.aureusfinserve.publicsite.Amc;
import com.aureusfinserve.publicsite.PublicRepos.AmcRepository;
import com.aureusfinserve.publicsite.PublicRepos.SchemeRepository;
import com.aureusfinserve.publicsite.Scheme;
import com.aureusfinserve.sync.AmfiData.MasterRow;
import com.aureusfinserve.sync.AmfiData.NavRow;
import com.aureusfinserve.sync.SchemeRules.Classification;
import com.aureusfinserve.sync.SchemeRules.NavPt;
import com.aureusfinserve.sync.SyncService.SyncRunDto;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Date;
import java.time.Duration;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Daily jobs: scheme details refresh (port of tools/enrich-scheme-details.mjs) and new / closed scheme detection
 * (selection logic of tools/build-scheme-seed.mjs) for the active AMCs in the {@code amc} table. Schemes are never
 * deleted - closed ones are only deactivated (folios and transactions may reference them).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SchemeDataSync {

    static final int BATCH = 50; // details API maximum per call
    private static final int HISTORY_CONCURRENCY = 6;
    /** A NAV file with fewer codes than this is treated as truncated: no scheme is deactivated. */
    static final int MIN_NAV_CODES_FOR_DEACTIVATION = 1000;

    private final SyncService sync;
    private final SchemeRepository schemeRepo;
    private final AmcRepository amcRepo;
    private final NavService navService;
    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private final HttpFetcher http;
    private final AppProperties props;
    private final ObjectMapper mapper;

    // ================================================================ details

    /** Scheme details from AMFI disclosures (TigZig compilation). Null = not disclosed / not found. */
    public record Details(Risk risk, BigDecimal expenseRatio, BigDecimal aumCr, String fundManager, String benchmark,
                          String exitLoad, String objective, Integer minSip, Integer minLumpsum, LocalDate allotmentDate) {
    }

    record DetailsResult(int found, int changed, int failedCodes) {
    }

    public SyncRunDto detailsSync(String triggeredBy) {
        SyncRun run = sync.start("DETAILS", triggeredBy);
        List<String> errors = new ArrayList<>();
        List<String> codes = schemeRepo.findAll().stream().map(Scheme::getCode).filter(c -> c != null && c.matches("\\d+"))
                .distinct().sorted().toList();
        DetailsResult r = refreshDetails(codes, errors);
        String summary = "Details found for " + r.found() + " of " + codes.size() + " schemes, " + r.changed() + " changed"
                + (r.failedCodes() > 0 ? ", " + r.failedCodes() + " could not be fetched" : "");
        log.info("Scheme details sync: {}", summary);
        return sync.finish(run, r.found(), r.failedCodes(), errors, summary);
    }

    DetailsResult refreshDetails(List<String> codes, List<String> errors) {
        int found = 0;
        int changed = 0;
        int failedCodes = 0;
        for (int i = 0; i < codes.size(); i += BATCH) {
            List<String> batch = codes.subList(i, Math.min(i + BATCH, codes.size()));
            String url = props.getAutoSync().getDetailsUrl().replace("{codes}", String.join(",", batch));
            JsonNode json;
            try {
                json = mapper.readTree(http.get(url, Duration.ofSeconds(60), 4, 2000));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                SyncService.addError(errors, "Interrupted");
                failedCodes += codes.size() - i;
                break;
            } catch (Exception e) {
                failedCodes += batch.size();
                SyncService.addError(errors, "Details for schemes " + batch.get(0) + ".." + batch.get(batch.size() - 1) + " failed: "
                        + describe(e));
                continue;
            }
            Map<String, Details> byCode = new HashMap<>();
            for (JsonNode d : json.path("data")) {
                String code = d.path("scheme_code").asText("");
                if (!code.isEmpty()) {
                    try {
                        byCode.put(code, parseDetails(d));
                    } catch (RuntimeException e) {
                        SyncService.addError(errors, "Scheme " + code + ": unreadable details (" + describe(e) + ")");
                    }
                }
            }
            if (byCode.isEmpty()) {
                continue;
            }
            Integer changedInBatch = tx.execute(st -> {
                int c = 0;
                for (Scheme s : schemeRepo.findByCodeIn(byCode.keySet())) {
                    if (apply(s, byCode.get(s.getCode()))) {
                        schemeRepo.save(s);
                        c++;
                    }
                }
                return c;
            });
            found += byCode.size();
            changed += changedInBatch == null ? 0 : changedInBatch;
        }
        return new DetailsResult(found, changed, failedCodes);
    }

    private static String text(JsonNode n, String field) {
        JsonNode v = n.path(field);
        return v.isTextual() ? v.asText() : null;
    }

    /** First non-empty of the values (JavaScript {@code a || b || c}). */
    private static String firstNonEmpty(String... values) {
        for (String v : values) {
            if (v != null && !v.isEmpty()) {
                return v;
            }
        }
        return null;
    }

    private static LocalDate date10(String s) {
        if (s == null || s.length() < 10) {
            return null;
        }
        try {
            return LocalDate.parse(s.substring(0, 10));
        } catch (RuntimeException e) {
            return null;
        }
    }

    /** One element of the details API "data" array -> Details (mapping of enrich-scheme-details.mjs). */
    public static Details parseDetails(JsonNode d) {
        JsonNode daily = d.path("amfi_daily");
        JsonNode ssd = d.path("ssd");
        JsonNode ter = d.path("ter");
        Risk risk = SchemeRules.toRisk(text(daily, "riskometer"));
        if (risk == null) {
            risk = SchemeRules.toRisk(text(ssd, "riskometer_level"));
        }
        if (risk == null) {
            risk = SchemeRules.toRisk(text(ssd, "riskometer"));
        }
        JsonNode regular = ter.path("regular");
        BigDecimal expense = regular.isNumber() ? BigDecimal.valueOf(regular.asDouble()) : null;
        JsonNode aum = daily.path("fund_aum_cr_all_plans");
        BigDecimal aumCr = aum.isNumber() ? BigDecimal.valueOf(aum.asDouble()).setScale(2, RoundingMode.HALF_UP) : null;
        List<SchemeRules.Manager> managers = new ArrayList<>();
        for (JsonNode m : ssd.path("fund_managers")) {
            managers.add(new SchemeRules.Manager(text(m, "name"), text(m, "role")));
        }
        return new Details(risk, expense, aumCr, SchemeRules.managers(managers),
                SchemeRules.cap(SchemeRules.clean(firstNonEmpty(text(ssd, "benchmark_tier1_std"), text(daily, "benchmark"),
                        text(ssd, "benchmark_tier1_filed"))), 150),
                SchemeRules.cap(SchemeRules.clean(text(ssd, "exit_load")), 1000),
                SchemeRules.cap(SchemeRules.clean(text(ssd, "objective")), 2000),
                SchemeRules.minSip(text(ssd, "terms_sip")),
                SchemeRules.rupees(text(ssd, "min_application_amount")),
                date10(text(ssd, "allotment_date")));
    }

    /**
     * Copies the disclosed values onto the scheme; a field the source has no value for keeps its current value
     * (a partial response never wipes data). Returns true when something changed.
     */
    public static boolean apply(Scheme s, Details d) {
        if (d == null) {
            return false;
        }
        boolean changed = false;
        if (d.risk() != null && d.risk() != s.getRisk()) {
            s.setRisk(d.risk());
            changed = true;
        }
        if (d.expenseRatio() != null && !sameNumber(d.expenseRatio(), s.getExpenseRatio())) {
            s.setExpenseRatio(d.expenseRatio());
            changed = true;
        }
        if (d.aumCr() != null && !sameNumber(d.aumCr(), s.getAumCr())) {
            s.setAumCr(d.aumCr());
            changed = true;
        }
        if (d.minSip() != null && !sameNumber(BigDecimal.valueOf(d.minSip()), s.getMinSip())) {
            s.setMinSip(BigDecimal.valueOf(d.minSip()));
            changed = true;
        }
        if (d.minLumpsum() != null && !sameNumber(BigDecimal.valueOf(d.minLumpsum()), s.getMinLumpsum())) {
            s.setMinLumpsum(BigDecimal.valueOf(d.minLumpsum()));
            changed = true;
        }
        if (d.allotmentDate() != null && !d.allotmentDate().equals(s.getLaunchDate())) {
            s.setLaunchDate(d.allotmentDate());
            changed = true;
        }
        if (d.fundManager() != null && !d.fundManager().equals(s.getFundManager())) {
            s.setFundManager(d.fundManager());
            changed = true;
        }
        if (d.benchmark() != null && !d.benchmark().equals(s.getBenchmark())) {
            s.setBenchmark(d.benchmark());
            changed = true;
        }
        if (d.exitLoad() != null && !d.exitLoad().equals(s.getExitLoad())) {
            s.setExitLoad(d.exitLoad());
            changed = true;
        }
        if (d.objective() != null && !d.objective().equals(s.getObjective())) {
            s.setObjective(d.objective());
            changed = true;
        }
        return changed;
    }

    private static boolean sameNumber(BigDecimal a, BigDecimal b) {
        return b != null && a.compareTo(b) == 0;
    }

    // ================================================================ new / closed schemes

    public SyncRunDto schemesSync(String triggeredBy) {
        SyncRun run = sync.start("SCHEMES", triggeredBy);
        List<String> errors = new ArrayList<>();
        List<Amc> amcs = amcRepo.findAll().stream().filter(Amc::isActive).toList();
        if (amcs.isEmpty()) {
            errors.add("No active AMCs in the AMC list - nothing to check.");
            return sync.finish(run, 0, 1, errors, null);
        }
        Map<String, String> websiteByAmc = amcs.stream().collect(Collectors.toMap(Amc::getName,
                a -> a.getWebsite() == null ? "" : a.getWebsite(), (a, b) -> a));
        String navUrl = props.getAmfi().getNavUrl();
        String navText;
        try {
            navText = http.get(navUrl, Duration.ofSeconds(90), 3, 5000);
        } catch (Exception e) {
            errors.add("Download from " + navUrl + " failed: " + describe(e));
            return sync.finish(run, 0, 1, errors, null);
        }
        int failed = 0;
        Map<String, MasterRow> masterRows = Map.of();
        String masterUrl = props.getAmfi().getSchemeMasterUrl();
        try {
            masterRows = AmfiData.parseMaster(http.get(masterUrl, Duration.ofSeconds(120), 3, 5000));
        } catch (Exception e) {
            failed++;
            errors.add("Scheme master download from " + masterUrl + " failed (" + describe(e)
                    + "); new schemes get default launch dates / minimums.");
        }
        final Map<String, MasterRow> master = masterRows;

        List<NavRow> rows = AmfiData.parseNavAll(navText);
        Set<String> navCodes = rows.stream().map(NavRow::code).collect(Collectors.toSet());
        List<NavRow> candidates = AmfiData.candidates(rows, master, websiteByAmc.keySet());

        List<Scheme> existing = schemeRepo.findAll();
        Map<String, Scheme> byCode = existing.stream().collect(Collectors.toMap(Scheme::getCode, Function.identity(), (a, b) -> a));
        Set<String> existingNames = existing.stream().map(s -> s.getAmc() + "|" + s.getName().toLowerCase(Locale.ROOT))
                .collect(Collectors.toSet());
        // a scheme (AMC + cleaned name) already in the database under any of its codes is not added again
        Set<String> knownKeys = candidates.stream().filter(r -> byCode.containsKey(r.code())).map(AmfiData::schemeKey)
                .collect(Collectors.toSet());
        List<NavRow> fresh = AmfiData.onePerScheme(candidates.stream().filter(r -> !knownKeys.contains(AmfiData.schemeKey(r))).toList())
                .stream().filter(r -> !existingNames.contains(r.amc() + "|" + displayName(r).toLowerCase(Locale.ROOT))).toList();
        int checked = knownKeys.size() + fresh.size();

        // deactivate schemes no longer in the AMFI file at all; reactivate those that are back
        int deactivated = 0;
        int reactivated = 0;
        if (navCodes.size() < MIN_NAV_CODES_FOR_DEACTIVATION) {
            failed++;
            errors.add("The AMFI NAV file has only " + navCodes.size() + " scheme codes - it looks incomplete, so no scheme was deactivated.");
        } else {
            List<Scheme> changedSchemes = new ArrayList<>();
            for (Scheme s : existing) {
                boolean listed = navCodes.contains(s.getCode());
                if (s.isActive() && !listed) {
                    s.setActive(false);
                    changedSchemes.add(s);
                    deactivated++;
                    log.info("Scheme {} {} is no longer in the AMFI NAV file - deactivated", s.getCode(), s.getName());
                } else if (!s.isActive() && listed) {
                    s.setActive(true);
                    changedSchemes.add(s);
                    reactivated++;
                    log.info("Scheme {} {} is back in the AMFI NAV file - reactivated", s.getCode(), s.getName());
                }
            }
            if (!changedSchemes.isEmpty()) {
                tx.executeWithoutResult(st -> schemeRepo.saveAll(changedSchemes));
            }
        }

        // add new schemes with their NAV history (fetched in parallel, stored one scheme per transaction)
        List<String> added = new ArrayList<>();
        if (!fresh.isEmpty()) {
            ExecutorService pool = Executors.newFixedThreadPool(Math.min(HISTORY_CONCURRENCY, fresh.size()));
            try {
                Map<NavRow, Future<List<NavPt>>> futures = new LinkedHashMap<>();
                for (NavRow r : fresh) {
                    futures.put(r, pool.submit(() -> history(r)));
                }
                LocalDate today = Fmt.today();
                for (Map.Entry<NavRow, Future<List<NavPt>>> e : futures.entrySet()) {
                    NavRow r = e.getKey();
                    try {
                        List<NavPt> full = e.getValue().get();
                        List<NavPt> thinned = SchemeRules.thin(full, today);
                        if (thinned.isEmpty()) {
                            throw new IllegalStateException("no NAV history in the last " + SchemeRules.YEARS_OF_HISTORY + " years");
                        }
                        Scheme s = tx.execute(st -> create(r, master.get(r.code()), websiteByAmc.get(r.amc()), thinned));
                        added.add(s.getCode());
                        log.info("New scheme added: {} {} ({} NAV points)", s.getCode(), s.getName(), thinned.size());
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        failed++;
                        SyncService.addError(errors, "Interrupted while adding schemes");
                        break;
                    } catch (Exception ex) {
                        failed++;
                        Throwable c = ex instanceof ExecutionException && ex.getCause() != null ? ex.getCause() : ex;
                        SyncService.addError(errors, "New scheme " + r.code() + " " + displayName(r) + " not added: " + describe(c));
                    }
                }
            } finally {
                pool.shutdownNow();
            }
        }
        DetailsResult details = added.isEmpty() ? new DetailsResult(0, 0, 0) : refreshDetails(added, errors);
        failed += details.failedCodes();

        String summary = "Added " + added.size() + ", deactivated " + deactivated + ", reactivated " + reactivated + " ("
                + checked + " Regular Growth schemes of " + amcs.size() + " AMCs in the AMFI file"
                + (added.isEmpty() ? "" : "; details found for " + details.found() + " of " + added.size() + " new") + ")";
        log.info("New-schemes sync: {}", summary);
        return sync.finish(run, checked, failed, errors, summary);
    }

    static String displayName(NavRow r) {
        return SchemeRules.cleanName(r.name()) + " - Regular Plan - Growth";
    }

    private static String cut(String s, int n) {
        return s == null || s.length() <= n ? s : s.substring(0, n);
    }

    /** New Scheme + its NAV history; returns are computed from the stored history. Runs inside a transaction. */
    private Scheme create(NavRow r, MasterRow m, String website, List<NavPt> history) {
        Classification c = SchemeRules.classify(r.cat(), r.name());
        Scheme s = new Scheme();
        s.setCode(r.code());
        s.setIsinGrowth(r.validIsin());
        s.setName(cut(displayName(r), 250));
        s.setAmc(r.amc());
        s.setCategory(c.cls());
        s.setSubCategory(cut(c.sub(), 60));
        s.setRisk(c.risk()); // category-typical until the disclosed risk-o-meter is fetched
        int minLump = m != null && m.minAmount() != null ? m.minAmount() : "ELSS".equals(c.sub()) ? 500 : 1000;
        s.setMinLumpsum(BigDecimal.valueOf(minLump));
        s.setMinSip(BigDecimal.valueOf(Math.min(500, minLump)));
        s.setLaunchDate(m == null ? null : m.launch());
        s.setSidUrl(website == null || website.isBlank() ? null : website);
        s.setFactsheetUrl(null);
        s.setRegularPlan(true);
        s.setActive(true);
        schemeRepo.saveAndFlush(s);
        List<Object[]> batch = new ArrayList<>(history.size());
        for (NavPt p : history) {
            batch.add(new Object[]{s.getId(), Date.valueOf(p.date()), BigDecimal.valueOf(p.nav()).setScale(4, RoundingMode.HALF_UP)});
        }
        jdbc.batchUpdate("INSERT INTO nav_history (scheme_id, nav_date, nav) VALUES (?, ?, ?)", batch);
        navService.refreshScheme(s);
        return s;
    }

    /** Full split-adjusted NAV history from the NAV history API, plus the NAV file's point when it is newer. */
    private List<NavPt> history(NavRow r) throws Exception {
        String url = props.getAutoSync().getNavHistoryUrl().replace("{code}", r.code());
        JsonNode json = mapper.readTree(http.get(url, Duration.ofSeconds(60), 4, 1500));
        TreeMap<LocalDate, Double> m = new TreeMap<>();
        for (JsonNode p : json.path("data")) {
            LocalDate d = SchemeRules.fromDdMmYyyy(p.path("date").asText(null));
            double nav;
            try {
                nav = SchemeRules.round4(Double.parseDouble(p.path("nav").asText("")));
            } catch (NumberFormatException e) {
                continue;
            }
            if (d != null && nav > 0) {
                m.putIfAbsent(d, nav);
            }
        }
        LocalDate fileDate = r.date();
        if (fileDate != null && r.nav() > 0 && (m.isEmpty() || fileDate.isAfter(m.lastKey()))) {
            m.put(fileDate, SchemeRules.round4(r.nav()));
        }
        if (m.isEmpty()) {
            throw new IllegalStateException("no NAV history");
        }
        List<NavPt> series = new ArrayList<>(m.size());
        m.forEach((d, v) -> series.add(new NavPt(d, v)));
        return SchemeRules.adjustForSplits(series);
    }

    static String describe(Throwable e) {
        return e.getClass().getSimpleName() + (e.getMessage() == null ? "" : " - " + e.getMessage());
    }
}
