package com.aureusfinserve.sync;

import com.aureusfinserve.audit.AuditService;
import com.aureusfinserve.common.Fmt;
import com.aureusfinserve.common.TxnType;
import com.aureusfinserve.config.AppProperties;
import com.aureusfinserve.investor.Investor;
import com.aureusfinserve.investor.InvestorRepository;
import com.aureusfinserve.portfolio.Folio;
import com.aureusfinserve.portfolio.FolioService;
import com.aureusfinserve.portfolio.MfTransaction;
import com.aureusfinserve.portfolio.NavService;
import com.aureusfinserve.portfolio.PortfolioRepos.FolioRepository;
import com.aureusfinserve.portfolio.PortfolioRepos.MfTransactionRepository;
import com.aureusfinserve.publicsite.NavPoint;
import com.aureusfinserve.publicsite.PublicRepos.NavPointRepository;
import com.aureusfinserve.publicsite.PublicRepos.SchemeRepository;
import com.aureusfinserve.publicsite.Scheme;
import com.aureusfinserve.security.CryptoService;
import com.aureusfinserve.security.CurrentUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.StringReader;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * NAV sync (AMFI NAVAll.txt) and RTA transaction feed import (CSV). Every run is recorded as a SyncRun;
 * download failures produce a FAILED run instead of an error.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SyncService {

    public record SyncRunDto(Long id, String type, java.time.LocalDateTime startedAt, java.time.LocalDateTime finishedAt,
                             String status, int processed, int failed, List<String> errors, String summary, String triggeredBy) {
    }

    private static final int MAX_ERRORS = 200;
    private static final DateTimeFormatter AMFI_DATE = new DateTimeFormatterBuilder().parseCaseInsensitive()
            .appendPattern("dd-MMM-yyyy").toFormatter(Locale.ENGLISH);

    private final SyncRunRepository runRepo;
    private final SchemeRepository schemeRepo;
    private final NavPointRepository navRepo;
    private final NavService navService;
    private final InvestorRepository investorRepo;
    private final FolioRepository folioRepo;
    private final FolioService folioService;
    private final MfTransactionRepository txnRepo;
    private final CryptoService crypto;
    private final AuditService audit;
    private final AppProperties props;
    private final HttpFetcher http;

    public List<SyncRunDto> runs() {
        return runRepo.findAllByOrderByStartedAtDescIdDesc().stream().map(SyncService::dto).toList();
    }

    public static SyncRunDto dto(SyncRun r) {
        List<String> errors = r.getErrors() == null || r.getErrors().isBlank() ? List.of()
                : Arrays.asList(r.getErrors().split("\n"));
        return new SyncRunDto(r.getId(), r.getType(), r.getStartedAt(), r.getFinishedAt(), r.getStatus(), r.getProcessed(),
                r.getFailed(), errors, r.getSummary(), r.getTriggeredBy());
    }

    // ---------------------------------------------------------------- NAV

    @Transactional
    public SyncRunDto navSync(String fileContent, String triggeredBy) {
        SyncRun run = start("NAV", triggeredBy);
        List<String> errors = new ArrayList<>();
        String text = fileContent;
        if (text == null) {
            try {
                text = download(props.getAmfi().getNavUrl());
            } catch (Exception e) {
                log.warn("AMFI NAV download failed: {}", e.toString());
                errors.add("Download from " + props.getAmfi().getNavUrl() + " failed: " + e.getClass().getSimpleName()
                        + (e.getMessage() == null ? "" : " - " + e.getMessage()));
                return finish(run, 0, 1, errors);
            }
        }
        Map<String, Scheme> byCode = schemeRepo.findAll().stream().collect(Collectors.toMap(Scheme::getCode, Function.identity(), (a, b) -> a));
        int processed = 0;
        int failed = 0;
        Set<Scheme> touched = new HashSet<>();
        // Data lines have a numeric scheme code; AMC / category headers and blanks are skipped. Both the 6-field and the
        // 8-field (…;Plan;Option;NAV;Date) formats are accepted - see AmfiData.parseNavAll.
        for (AmfiData.NavRow row : AmfiData.parseNavAll(text)) {
            Scheme s = byCode.get(row.code());
            if (s == null) {
                continue;
            }
            try {
                BigDecimal nav = new BigDecimal(row.navText()).setScale(4, RoundingMode.HALF_UP);
                if (nav.signum() <= 0) {
                    throw new NumberFormatException("non-positive NAV");
                }
                LocalDate date = LocalDate.parse(row.dateText(), AMFI_DATE);
                NavPoint np = navRepo.findBySchemeIdAndNavDate(s.getId(), date).orElseGet(NavPoint::new);
                np.setSchemeId(s.getId());
                np.setNavDate(date);
                np.setNav(nav);
                navRepo.save(np);
                if (row.validIsin() != null) {
                    s.setIsinGrowth(row.validIsin());
                }
                touched.add(s);
                processed++;
            } catch (NumberFormatException | DateTimeParseException e) {
                failed++;
                addError(errors, "Line " + row.lineNo() + " (scheme " + row.code() + "): invalid NAV/date '" + row.navText()
                        + "' / '" + row.dateText() + "'");
            }
        }
        navRepo.flush();
        touched.forEach(navService::refreshScheme);
        if (processed == 0 && failed == 0) {
            errors.add("No NAV lines matched the scheme codes in the database (" + byCode.size() + " schemes).");
        }
        return finish(run, processed, failed, errors);
    }

    private String download(String url) throws IOException, InterruptedException {
        return http.get(url, Duration.ofSeconds(90), 3, 5000);
    }

    // ---------------------------------------------------------------- RTA

    /** CSV: pan,folio_no,scheme_code,date,type,amount,units,nav (header row optional). */
    @Transactional
    public SyncRunDto rtaSync(String csv, String triggeredBy) {
        SyncRun run = start("RTA", triggeredBy);
        List<String> errors = new ArrayList<>();
        int processed = 0;
        int failed = 0;
        Map<String, Scheme> byCode = schemeRepo.findAll().stream().collect(Collectors.toMap(Scheme::getCode, Function.identity(), (a, b) -> a));
        try (BufferedReader br = new BufferedReader(new StringReader(csv == null ? "" : csv))) {
            String line;
            int lineNo = 0;
            while ((line = br.readLine()) != null) {
                lineNo++;
                if (line.isBlank()) {
                    continue;
                }
                String[] p = line.split(",", -1);
                if (lineNo == 1 && p[0].trim().equalsIgnoreCase("pan")) {
                    continue;
                }
                try {
                    if (p.length < 8) {
                        throw new IllegalArgumentException("expected 8 columns, found " + p.length);
                    }
                    String pan = p[0].trim().toUpperCase(Locale.ROOT);
                    String folioNo = p[1].trim();
                    Scheme s = byCode.get(p[2].trim());
                    if (s == null) {
                        throw new IllegalArgumentException("unknown scheme code " + p[2].trim());
                    }
                    Investor inv = investorRepo.findFirstByPanHash(crypto.panHash(pan))
                            .orElseThrow(() -> new IllegalArgumentException("no investor with PAN " + Fmt.maskPan(pan)));
                    LocalDate date = parseDate(p[3].trim());
                    TxnType type = TxnType.valueOf(p[4].trim().toUpperCase(Locale.ROOT));
                    BigDecimal amount = new BigDecimal(p[5].trim()).abs();
                    BigDecimal units = new BigDecimal(p[6].trim()).abs().setScale(4, RoundingMode.HALF_UP);
                    BigDecimal nav = new BigDecimal(p[7].trim()).setScale(4, RoundingMode.HALF_UP);
                    if (folioNo.isEmpty()) {
                        throw new IllegalArgumentException("folio_no is required");
                    }
                    Folio f = folioRepo.findByInvestorIdAndSchemeId(inv.getId(), s.getId())
                            .orElseGet(() -> folioService.create(inv.getId(), s.getId(), folioNo));
                    if (txnRepo.existsByFolioIdAndDateAndTypeAndUnits(f.getId(), date, type, units)) {
                        continue; // already imported
                    }
                    MfTransaction t = new MfTransaction();
                    t.setFolioId(f.getId());
                    t.setInvestorId(inv.getId());
                    t.setSchemeId(s.getId());
                    t.setDate(date);
                    t.setType(type);
                    t.setAmount(amount.setScale(4, RoundingMode.HALF_UP));
                    t.setUnits(units);
                    t.setNav(nav);
                    t.setSource("RTA");
                    t.setCreatedAt(Fmt.now());
                    txnRepo.save(t);
                    processed++;
                } catch (RuntimeException e) {
                    failed++;
                    addError(errors, "Line " + lineNo + ": " + (e instanceof NumberFormatException ? "invalid number"
                            : e.getMessage()));
                }
            }
        } catch (IOException e) {
            failed++;
            addError(errors, "Could not read file: " + e.getMessage());
        }
        return finish(run, processed, failed, errors);
    }

    private static LocalDate parseDate(String s) {
        try {
            return LocalDate.parse(s);
        } catch (DateTimeParseException e) {
            try {
                return LocalDate.parse(s, DateTimeFormatter.ofPattern("dd-MM-yyyy"));
            } catch (DateTimeParseException e2) {
                return LocalDate.parse(s, AMFI_DATE);
            }
        }
    }

    // ---------------------------------------------------------------- run bookkeeping

    SyncRun start(String type, String by) {
        SyncRun r = new SyncRun();
        r.setType(type);
        r.setStartedAt(Fmt.now());
        r.setStatus("FAILED"); // until finished: a run that crashes stays FAILED (finishedAt null)
        r.setTriggeredBy(by);
        return runRepo.save(r);
    }

    private SyncRunDto finish(SyncRun r, int processed, int failed, List<String> errors) {
        return finish(r, processed, failed, errors, null);
    }

    SyncRunDto finish(SyncRun r, int processed, int failed, List<String> errors, String summary) {
        r.setProcessed(processed);
        r.setFailed(failed);
        r.setStatus(failed == 0 ? "SUCCESS" : processed > 0 ? "PARTIAL" : "FAILED");
        r.setErrors(String.join("\n", errors));
        r.setSummary(summary == null ? null : summary.length() > 500 ? summary.substring(0, 500) : summary);
        r.setFinishedAt(Fmt.now());
        runRepo.save(r);
        String detail = r.getType() + " " + r.getStatus() + " processed=" + processed + " failed=" + failed
                + (summary == null ? "" : " - " + summary);
        if (CurrentUser.optional().isPresent()) {
            audit.log("SYNC_RUN", "SYNC_RUN", r.getId(), detail);
        } else { // scheduled run: no logged-in user
            audit.logAs(null, r.getTriggeredBy(), null, "SYNC_RUN", "SYNC_RUN", r.getId(), detail);
        }
        return dto(r);
    }

    static void addError(List<String> errors, String e) {
        if (errors.size() < MAX_ERRORS) {
            errors.add(e.replace('\n', ' '));
        } else if (errors.size() == MAX_ERRORS) {
            errors.add("... further errors truncated");
        }
    }
}
