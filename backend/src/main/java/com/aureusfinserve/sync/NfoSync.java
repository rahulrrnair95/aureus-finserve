package com.aureusfinserve.sync;

import com.aureusfinserve.common.Fmt;
import com.aureusfinserve.config.AppProperties;
import com.aureusfinserve.nfo.Nfo;
import com.aureusfinserve.nfo.NfoRepos.NfoRepository;
import com.aureusfinserve.nfo.NfoRules;
import com.aureusfinserve.nfo.NfoRules.Candidate;
import com.aureusfinserve.nfo.NfoRules.Category;
import com.aureusfinserve.nfo.NfoRules.Status;
import com.aureusfinserve.nfo.NfoService;
import com.aureusfinserve.publicsite.Amc;
import com.aureusfinserve.publicsite.PublicRepos.AmcRepository;
import com.aureusfinserve.sync.SchemeDataSync.Details;
import com.aureusfinserve.sync.SyncService.SyncRunDto;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Daily NFO import ({@code SyncRun.type = "NFO"}): new fund offers of all AMCs from the AMFI scheme master ("Launch
 * Date" = NFO opens, "Closure Date" = NFO closes, often empty for current NFOs), one record per scheme, then the
 * Scheme Summary Document details (risk-o-meter, benchmark, fund managers, exit load, objective, NFO dates) from the
 * details API for the codes that still miss them. The import fills / refreshes only fields that staff have not
 * edited and never deletes anything.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NfoSync {

    private final SyncService sync;
    private final NfoRepository repo;
    private final AmcRepository amcRepo;
    private final TransactionTemplate tx;
    private final HttpFetcher http;
    private final AppProperties props;
    private final ObjectMapper mapper;

    public record UpsertResult(int added, int updated) {
    }

    public SyncRunDto nfoSync(String triggeredBy) {
        SyncRun run = sync.start("NFO", triggeredBy);
        List<String> errors = new ArrayList<>();
        String url = props.getAmfi().getSchemeMasterUrl();
        String text;
        try {
            text = http.get(url, Duration.ofSeconds(120), 3, 5000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            errors.add("Interrupted while downloading the AMFI scheme master");
            return sync.finish(run, 0, 1, errors, null);
        } catch (Exception e) {
            errors.add("Scheme master download from " + url + " failed: " + SchemeDataSync.describe(e));
            return sync.finish(run, 0, 1, errors, null);
        }
        LocalDate today = Fmt.today();
        List<AmfiData.SchemeMasterRow> rows = AmfiData.parseMasterRows(text);
        if (rows.size() < 1000) {
            errors.add("The AMFI scheme master has only " + rows.size() + " rows - it looks incomplete, nothing was imported.");
            return sync.finish(run, 0, 1, errors, null);
        }
        List<Candidate> candidates = NfoRules.candidates(rows, today);
        UpsertResult up = upsert(candidates, today);

        // Scheme Summary Document details for NFOs that still miss some of them
        List<String> codes = tx.execute(st -> repo.findAll().stream()
                .filter(n -> n.getSchemeCode() != null && n.getSchemeCode().matches("\\d+"))
                .filter(n -> NfoRules.isPublicWindow(n.getOpenDate(), n.getCloseDate(), today))
                .filter(NfoSync::missingDetails)
                .map(Nfo::getSchemeCode).distinct().sorted().toList());
        int[] found = {0};
        int failedCodes = fetchDetails(codes == null ? List.of() : codes, errors, found);

        Map<Status, Integer> counts = new EnumMap<>(Status.class);
        for (Nfo n : repo.findAll()) {
            if (!n.isHidden() && NfoRules.isPublicWindow(n.getOpenDate(), n.getCloseDate(), today)) {
                counts.merge(NfoRules.status(n.getOpenDate(), n.getCloseDate(), today), 1, Integer::sum);
            }
        }
        String summary = counts.getOrDefault(Status.OPEN, 0) + " open, " + counts.getOrDefault(Status.UPCOMING, 0) + " upcoming, "
                + counts.getOrDefault(Status.CLOSED, 0) + " recently closed; " + up.added() + " new, " + up.updated() + " updated ("
                + candidates.size() + " NFOs in the AMFI scheme master"
                + (codes == null || codes.isEmpty() ? "" : "; scheme summary details found for " + found[0] + " of " + codes.size()) + ")";
        log.info("NFO import: {}", summary);
        return sync.finish(run, candidates.size(), failedCodes, errors, summary);
    }

    static boolean missingDetails(Nfo n) {
        return n.getRiskometer() == null || n.getBenchmark() == null || n.getFundManagers() == null || n.getExitLoad() == null
                || n.getObjective() == null || n.getCloseDate() == null || n.getMinAmount() == null;
    }

    /** Inserts new NFOs and refreshes the AMFI fields of known ones (matched by scheme key, else by scheme code). */
    public UpsertResult upsert(List<Candidate> candidates, LocalDate today) {
        UpsertResult r = tx.execute(st -> {
            List<String> partners = amcRepo.findAll().stream().map(Amc::getName).toList();
            List<Nfo> existing = repo.findAll();
            Map<String, Nfo> byKey = new HashMap<>();
            Map<String, Nfo> byCode = new HashMap<>();
            for (Nfo n : existing) {
                if (n.getSchemeKey() != null) {
                    byKey.putIfAbsent(n.getSchemeKey(), n);
                }
                if (n.getSchemeCode() != null) {
                    byCode.putIfAbsent(n.getSchemeCode(), n);
                }
            }
            int added = 0;
            int updated = 0;
            LocalDateTime now = Fmt.now();
            for (Candidate c : candidates) {
                Nfo n = byKey.get(c.key());
                if (n == null) {
                    n = byCode.get(c.code());
                }
                boolean isNew = n == null;
                if (isNew) {
                    n = new Nfo();
                    n.setSource("AMFI");
                    n.setCreatedAt(now);
                }
                if (applyCandidate(n, c, NfoRules.amcDisplay(c.amc(), partners)) || isNew) {
                    n.setUpdatedAt(now);
                    repo.save(n);
                    byKey.put(c.key(), n);
                    if (isNew) {
                        added++;
                    } else {
                        updated++;
                    }
                }
            }
            return new UpsertResult(added, updated);
        });
        return r == null ? new UpsertResult(0, 0) : r;
    }

    private static boolean edited(Nfo n, String field) {
        return NfoService.isStaffEdited(n, field);
    }

    /**
     * Copies the AMFI scheme master values onto the NFO, except fields edited by staff. Returns true when something changed.
     */
    public static boolean applyCandidate(Nfo n, Candidate c, String amcDisplay) {
        boolean ch = false;
        Category cat = NfoRules.classify(c.schemeType(), c.category(), c.schemeName());
        ch |= set(n.getSchemeKey(), c.key(), n::setSchemeKey);
        ch |= set(n.getSchemeCode(), c.code(), n::setSchemeCode);
        ch |= set(n.getAmcName(), cut(c.amc(), 150), n::setAmcName);
        ch |= set(n.getSchemeType(), cut(c.schemeType(), 30), n::setSchemeType);
        ch |= set(n.getAmfiCategory(), cut(c.category(), 150), n::setAmfiCategory);
        if (!edited(n, "amc")) {
            ch |= set(n.getAmcDisplay(), cut(amcDisplay, 150), n::setAmcDisplay);
        }
        if (!edited(n, "schemeName")) {
            ch |= set(n.getSchemeName(), cut(c.schemeName(), 250), n::setSchemeName);
        }
        if (!edited(n, "assetClass")) {
            ch |= set(n.getAssetClass(), cat.assetClass(), n::setAssetClass);
        }
        if (!edited(n, "subCategory")) {
            ch |= set(n.getSubCategory(), cat.subCategory(), n::setSubCategory);
        }
        if (!edited(n, "minAmountText")) {
            ch |= set(n.getMinAmountText(), cut(SchemeRules.clean(c.minText()), 300), n::setMinAmountText);
        }
        BigDecimal min = NfoRules.minAmount(c.minText());
        if (!edited(n, "minAmount") && min != null && (n.getMinAmount() == null || n.getMinAmount().compareTo(min) != 0)) {
            n.setMinAmount(min);
            ch = true;
        }
        if (!edited(n, "openDate")) {
            ch |= set(n.getOpenDate(), c.open(), n::setOpenDate);
        }
        if (!edited(n, "closeDate") && c.close() != null
                && (!c.close().equals(n.getCloseDate()) || !"AMFI".equals(n.getCloseDateSource()))) {
            n.setCloseDate(c.close());
            n.setCloseDateSource("AMFI");
            ch = true;
        }
        return ch;
    }

    /**
     * Fills the Scheme Summary Document values the NFO does not have yet (never overwrites a value or a staff edit).
     * The SSD close date is used only when AMFI has none and it is plausible (after the open date, within 60 days).
     */
    public static boolean applyDetails(Nfo n, Details d, LocalDate ssdClose) {
        boolean ch = false;
        if (d != null) {
            if (n.getRiskometer() == null && d.risk() != null && !edited(n, "riskometer")) {
                n.setRiskometer(d.risk());
                ch = true;
            }
            if (n.getBenchmark() == null && d.benchmark() != null && !edited(n, "benchmark")) {
                n.setBenchmark(d.benchmark());
                ch = true;
            }
            if (n.getFundManagers() == null && d.fundManager() != null && !edited(n, "fundManagers")) {
                n.setFundManagers(cut(d.fundManager(), 300));
                ch = true;
            }
            if (n.getExitLoad() == null && d.exitLoad() != null && !edited(n, "exitLoad")) {
                n.setExitLoad(d.exitLoad());
                ch = true;
            }
            if (n.getObjective() == null && d.objective() != null && !edited(n, "objective")) {
                n.setObjective(d.objective());
                ch = true;
            }
            if (n.getMinAmount() == null && d.minLumpsum() != null && !edited(n, "minAmount")) {
                n.setMinAmount(BigDecimal.valueOf(d.minLumpsum()).setScale(2, java.math.RoundingMode.HALF_UP));
                ch = true;
            }
        }
        if (ssdClose != null && n.getCloseDate() == null && !edited(n, "closeDate") && ssdClose.isAfter(n.getOpenDate())
                && !ssdClose.isAfter(n.getOpenDate().plusDays(60))) {
            n.setCloseDate(ssdClose);
            n.setCloseDateSource("SSD");
            ch = true;
        }
        return ch;
    }

    /** Details API in batches of 50; returns the number of codes whose batch could not be fetched. */
    private int fetchDetails(List<String> codes, List<String> errors, int[] found) {
        int failed = 0;
        for (int i = 0; i < codes.size(); i += SchemeDataSync.BATCH) {
            List<String> batch = codes.subList(i, Math.min(i + SchemeDataSync.BATCH, codes.size()));
            String url = props.getAutoSync().getDetailsUrl().replace("{codes}", String.join(",", batch));
            JsonNode json;
            try {
                json = mapper.readTree(http.get(url, Duration.ofSeconds(60), 4, 2000));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                failed += codes.size() - i;
                SyncService.addError(errors, "Interrupted");
                break;
            } catch (Exception e) {
                failed += batch.size();
                SyncService.addError(errors, "Scheme summary details for " + batch.size() + " NFO codes failed: " + SchemeDataSync.describe(e));
                continue;
            }
            Map<String, JsonNode> byCode = new HashMap<>();
            for (JsonNode d : json.path("data")) {
                String code = d.path("scheme_code").asText("");
                if (!code.isEmpty()) {
                    byCode.put(code, d);
                }
            }
            if (byCode.isEmpty()) {
                continue;
            }
            Integer f = tx.execute(st -> {
                int c = 0;
                for (Nfo n : repo.findAll()) {
                    JsonNode d = n.getSchemeCode() == null ? null : byCode.get(n.getSchemeCode());
                    if (d == null) {
                        continue;
                    }
                    c++;
                    Details det;
                    try {
                        det = SchemeDataSync.parseDetails(d);
                    } catch (RuntimeException e) {
                        SyncService.addError(errors, "NFO " + n.getSchemeCode() + ": unreadable details (" + SchemeDataSync.describe(e) + ")");
                        continue;
                    }
                    if (applyDetails(n, det, date10(d.path("ssd").path("nfo_close_date").asText(null)))) {
                        n.setUpdatedAt(Fmt.now());
                        repo.save(n);
                    }
                }
                return c;
            });
            found[0] += f == null ? 0 : f;
        }
        return failed;
    }

    static LocalDate date10(String s) {
        if (s == null || s.length() < 10) {
            return null;
        }
        try {
            return LocalDate.parse(s.substring(0, 10));
        } catch (RuntimeException e) {
            return null;
        }
    }

    private static <T> boolean set(T current, T value, java.util.function.Consumer<T> setter) {
        if (Objects.equals(current, value)) {
            return false;
        }
        setter.accept(value);
        return true;
    }

    private static String cut(String s, int n) {
        return s == null || s.length() <= n ? s : s.substring(0, n);
    }
}
