package com.aureusfinserve.publicsite;

import com.aureusfinserve.common.ApiException;
import com.aureusfinserve.common.AssetClass;
import com.aureusfinserve.common.Fmt;
import com.aureusfinserve.common.Risk;
import com.aureusfinserve.portfolio.NavService;
import com.aureusfinserve.publicsite.PublicRepos.SchemeRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.IsoFields;
import java.util.*;

/** Fund explorer: search / filter / sort, filter values, and scheme detail with ~1 year of weekly NAVs. */
@Service
@RequiredArgsConstructor
public class SchemeService {

    public record SchemeSummary(Long id, String code, String name, String amc, AssetClass category, String subCategory,
                                Risk risk, BigDecimal nav, LocalDate navDate, Double return1y, Double return3y,
                                Double return5y, Double return10y, BigDecimal expenseRatio, BigDecimal minSip, BigDecimal minLumpsum,
                                BigDecimal aumCr, BigDecimal trailCommissionPct, String sidUrl, String factsheetUrl) {
    }

    public record Page<T>(List<T> items, long total, int page, int size) {
    }

    public record Filters(List<String> amcs, List<String> categories, List<String> subCategories, List<String> risks) {
    }

    public record NavPointDto(LocalDate date, BigDecimal nav) {
    }

    private final SchemeRepository schemeRepo;
    private final NavService navService;
    private final ObjectMapper mapper;

    public static SchemeSummary summary(Scheme s) {
        return new SchemeSummary(s.getId(), s.getCode(), s.getName(), s.getAmc(), s.getCategory(), s.getSubCategory(),
                s.getRisk(), Fmt.nav(s.getNav()), s.getNavDate(), s.getReturn1y(), s.getReturn3y(), s.getReturn5y(), s.getReturn10y(),
                strip(s.getExpenseRatio()), Fmt.money(s.getMinSip()), Fmt.money(s.getMinLumpsum()),
                strip(s.getAumCr()), strip(s.getTrailCommissionPct()), s.getSidUrl(), s.getFactsheetUrl());
    }

    private static BigDecimal strip(BigDecimal b) {
        return b == null ? null : b.setScale(2, java.math.RoundingMode.HALF_UP);
    }

    public Page<SchemeSummary> search(String q, String category, String subCategory, String amc, String risk,
                                      String sort, int page, int size) {
        int sz = Math.max(1, Math.min(size, 100));
        int pg = Math.max(0, page);
        String needle = q == null ? null : q.trim().toLowerCase(Locale.ROOT);
        List<Scheme> list = schemeRepo.findByActiveTrue().stream()
                .filter(s -> needle == null || needle.isEmpty() || s.getName().toLowerCase(Locale.ROOT).contains(needle)
                        || s.getAmc().toLowerCase(Locale.ROOT).contains(needle)
                        || (s.getSubCategory() != null && s.getSubCategory().toLowerCase(Locale.ROOT).contains(needle)))
                .filter(s -> blank(category) || s.getCategory().name().equalsIgnoreCase(category))
                .filter(s -> blank(subCategory) || subCategory.equalsIgnoreCase(s.getSubCategory()))
                .filter(s -> blank(amc) || amc.equalsIgnoreCase(s.getAmc()))
                .filter(s -> blank(risk) || s.getRisk().name().equalsIgnoreCase(risk))
                .sorted(comparator(sort))
                .toList();
        List<SchemeSummary> items = list.stream().skip((long) pg * sz).limit(sz).map(SchemeService::summary).toList();
        return new Page<>(items, list.size(), pg, sz);
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    private static Comparator<Scheme> comparator(String sort) {
        Comparator<Scheme> byName = Comparator.comparing(Scheme::getName, String.CASE_INSENSITIVE_ORDER);
        if (sort == null || sort.isBlank()) {
            return byName;
        }
        return switch (sort) {
            case "return1y" -> Comparator.comparing(Scheme::getReturn1y, Comparator.nullsLast(Comparator.reverseOrder())).thenComparing(byName);
            case "return3y" -> Comparator.comparing(Scheme::getReturn3y, Comparator.nullsLast(Comparator.reverseOrder())).thenComparing(byName);
            case "return5y" -> Comparator.comparing(Scheme::getReturn5y, Comparator.nullsLast(Comparator.reverseOrder())).thenComparing(byName);
            case "return10y" -> Comparator.comparing(Scheme::getReturn10y, Comparator.nullsLast(Comparator.reverseOrder())).thenComparing(byName);
            case "aum" -> Comparator.comparing(Scheme::getAumCr, Comparator.nullsLast(Comparator.reverseOrder())).thenComparing(byName);
            case "name" -> byName;
            default -> throw ApiException.validation("sort", "sort must be one of return1y, return3y, return5y, return10y, aum, name");
        };
    }

    public Filters filters() {
        List<Scheme> all = schemeRepo.findByActiveTrue();
        return new Filters(
                all.stream().map(Scheme::getAmc).distinct().sorted().toList(),
                Arrays.stream(AssetClass.values()).map(Enum::name).filter(c -> all.stream().anyMatch(s -> s.getCategory().name().equals(c))).toList(),
                all.stream().map(Scheme::getSubCategory).filter(Objects::nonNull).distinct().sorted().toList(),
                Arrays.stream(Risk.values()).map(Enum::name).toList());
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> detail(Long id) {
        Scheme s = schemeRepo.findById(id).filter(Scheme::isActive).orElseThrow(() -> ApiException.notFound("Scheme"));
        Map<String, Object> out = mapper.convertValue(summary(s), LinkedHashMap.class);
        out.put("fundManager", s.getFundManager());
        out.put("benchmark", s.getBenchmark());
        out.put("launchDate", s.getLaunchDate() == null ? null : s.getLaunchDate().toString());
        out.put("exitLoad", s.getExitLoad());
        out.put("objective", s.getObjective());
        out.put("navHistory", weeklyHistory(s));
        return out;
    }

    /** Last point of each ISO week over the trailing year. */
    private List<NavPointDto> weeklyHistory(Scheme s) {
        TreeMap<LocalDate, Double> m = navService.series(s.getId());
        if (m.isEmpty()) {
            return List.of();
        }
        LocalDate from = m.lastKey().minusYears(1);
        LinkedHashMap<String, Map.Entry<LocalDate, Double>> weeks = new LinkedHashMap<>();
        for (Map.Entry<LocalDate, Double> e : m.tailMap(from, true).entrySet()) {
            String wk = e.getKey().get(IsoFields.WEEK_BASED_YEAR) + "-" + e.getKey().get(IsoFields.WEEK_OF_WEEK_BASED_YEAR);
            weeks.put(wk, e);
        }
        return weeks.values().stream()
                .map(e -> new NavPointDto(e.getKey(), BigDecimal.valueOf(e.getValue()).setScale(4, java.math.RoundingMode.HALF_UP)))
                .toList();
    }
}
