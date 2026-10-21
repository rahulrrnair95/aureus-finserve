package com.aureusfinserve.seed;

import com.aureusfinserve.common.AssetClass;
import com.aureusfinserve.common.Risk;
import com.aureusfinserve.portfolio.NavService;
import com.aureusfinserve.publicsite.PublicRepos.SchemeRepository;
import com.aureusfinserve.publicsite.Scheme;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Date;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.*;

/**
 * Every open-ended Regular Plan - Growth scheme (ETFs and fund-of-funds excluded) of the AMCs listed in the file from {@code seed/schemes.json}, which
 * {@code tools/build-scheme-seed.mjs} builds from the AMFI NAV file (scheme codes, names, categories, latest NAV)
 * and AMFI-sourced daily NAV history (~10 years, split-adjusted).
 *
 * <p>Scheme details (disclosed risk-o-meter, Regular-plan TER, fund size, fund managers, benchmark, exit load, objective,
 * minimum amounts, allotment date) come from {@code tools/enrich-scheme-details.mjs}; where a scheme has none, the
 * category-typical risk level and default minimums are used. The firm's trail rate is not public and stays empty.
 */
@Component
@RequiredArgsConstructor
public class SchemeSeed {

    public record AmcInfo(String name, String slug, String website) {
    }

    record SchemeJson(String code, String isin, String name, String amc, String category, String subCategory, String risk,
                      Double return1y, Double return3y, Double return5y, Double return10y, String launchDate, Integer minAmount,
                      List<String> aliases, List<List<Object>> history, Details details) {
    }

    /** From tools/enrich-scheme-details.mjs: AMFI daily disclosures, TER filings and Scheme Summary Documents. */
    record Details(String risk, Double expenseRatio, Double aumCr, String fundManager, String benchmark, String exitLoad,
                   String objective, Integer minSip, Integer minLumpsum, String allotmentDate) {
    }

    record SeedFile(List<AmcInfo> amcs, List<SchemeJson> schemes) {
    }

    private final SchemeRepository schemeRepo;
    private final JdbcTemplate jdbc;
    private final NavService navService;

    private List<AmcInfo> amcs = List.of();

    public static LocalDate lastBusinessDay(LocalDate d) {
        LocalDate x = d;
        while (x.getDayOfWeek() == DayOfWeek.SATURDAY || x.getDayOfWeek() == DayOfWeek.SUNDAY) {
            x = x.minusDays(1);
        }
        return x;
    }

    /** AMCs from the seed file, in display order (valid after {@link #seed}). */
    public List<AmcInfo> amcs() {
        return amcs;
    }

    /**
     * Creates schemes + NAV history. The returned map is keyed by scheme name and by every alias
     * (the sample-portfolio names DemoSeed uses), so several keys can point to one scheme.
     */
    public Map<String, Scheme> seed(Map<Long, TreeMap<LocalDate, Double>> seriesOut) {
        SeedFile file = read();
        amcs = file.amcs();
        Map<String, Scheme> out = new LinkedHashMap<>();
        for (SchemeJson j : file.schemes()) {
            Scheme s = new Scheme();
            s.setCode(j.code());
            s.setIsinGrowth(j.isin());
            s.setName(j.name());
            s.setAmc(j.amc());
            s.setCategory(AssetClass.valueOf(j.category()));
            s.setSubCategory(j.subCategory());
            Details d = j.details();
            // the AMC's disclosed risk-o-meter level; the category-typical level only when none was found
            s.setRisk(Risk.valueOf(d != null && d.risk() != null ? d.risk() : j.risk()));
            // minimum lump sum: Scheme Summary Document, else AMFI scheme master, else a common default
            int minLump = d != null && d.minLumpsum() != null ? d.minLumpsum()
                    : j.minAmount() != null ? j.minAmount() : "ELSS".equals(j.subCategory()) ? 500 : 1000;
            s.setMinLumpsum(BigDecimal.valueOf(minLump));
            // minimum monthly SIP from the Scheme Summary Document, else ₹500 (or the lump-sum minimum if lower)
            s.setMinSip(BigDecimal.valueOf(d != null && d.minSip() != null ? d.minSip() : Math.min(500, minLump)));
            String launch = d != null && d.allotmentDate() != null ? d.allotmentDate() : j.launchDate();
            s.setLaunchDate(launch != null ? LocalDate.parse(launch) : null);
            if (d != null) {
                s.setExpenseRatio(d.expenseRatio() != null ? BigDecimal.valueOf(d.expenseRatio()) : null);
                s.setAumCr(d.aumCr() != null ? BigDecimal.valueOf(d.aumCr()) : null);
                s.setFundManager(d.fundManager());
                s.setBenchmark(d.benchmark());
                s.setExitLoad(d.exitLoad());
                s.setObjective(d.objective());
            }
            String website = file.amcs().stream().filter(a -> a.name().equals(j.amc())).map(AmcInfo::website).findFirst().orElse(null);
            s.setSidUrl(website);
            s.setFactsheetUrl(null); // SID, KIM and factsheet are published on the AMC website (sidUrl)
            s.setRegularPlan(true);
            s.setActive(true);
            schemeRepo.save(s);

            TreeMap<LocalDate, Double> series = new TreeMap<>();
            for (List<Object> p : j.history()) {
                series.put(LocalDate.parse((String) p.get(0)), ((Number) p.get(1)).doubleValue());
            }
            seriesOut.put(s.getId(), series);
            List<Object[]> batch = new ArrayList<>(series.size());
            series.forEach((date, nav) -> batch.add(new Object[]{s.getId(), Date.valueOf(date),
                    BigDecimal.valueOf(nav).setScale(4, RoundingMode.HALF_UP)}));
            jdbc.batchUpdate("INSERT INTO nav_history (scheme_id, nav_date, nav) VALUES (?, ?, ?)", batch);

            s.setNav(BigDecimal.valueOf(series.lastEntry().getValue()).setScale(4, RoundingMode.HALF_UP));
            s.setNavDate(series.lastKey());
            // returns were computed from the full NAV history when the seed file was built
            s.setReturn1y(j.return1y());
            s.setReturn3y(j.return3y());
            s.setReturn5y(j.return5y());
            s.setReturn10y(j.return10y());
            schemeRepo.save(s);
            out.put(j.name(), s);
            j.aliases().forEach(a -> out.put(a, s));
        }
        navService.invalidateAll();
        return out;
    }

    private static SeedFile read() {
        try (InputStream in = new ClassPathResource("seed/schemes.json").getInputStream()) {
            return new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false).readValue(in, SeedFile.class);
        } catch (IOException e) {
            throw new UncheckedIOException("Could not read seed/schemes.json", e);
        }
    }
}
