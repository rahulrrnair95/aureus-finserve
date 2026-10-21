package com.aureusfinserve.nfo;

import com.aureusfinserve.sync.AmfiData.SchemeMasterRow;
import com.aureusfinserve.sync.SchemeRules;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Pure NFO rules: status / close-date estimate, selection and grouping of scheme master rows, category, AMC name. */
public final class NfoRules {

    private NfoRules() {
    }

    /** SEBI: an NFO may stay open for at most 15 days (ELSS excepted) - used to estimate a missing close date. */
    public static final int MAX_OPEN_DAYS = 15;
    /** Closed NFOs stay in the public "Recently closed" list for this many days after closing. */
    public static final int RECENTLY_CLOSED_DAYS = 30;
    /** The import picks schemes launched within this many days (or with a closure date today or later). */
    public static final int LOOKBACK_DAYS = 45;

    public static final List<String> ASSET_CLASSES = List.of("EQUITY", "DEBT", "HYBRID", "OTHER");

    public enum Status { UPCOMING, OPEN, CLOSED }

    private static final int CI = Pattern.CASE_INSENSITIVE;

    private static boolean find(String regex, String s) {
        return s != null && Pattern.compile(regex, CI).matcher(s).find();
    }

    // ---------------------------------------------------------------- status

    /** Close date, or the latest possible one (open date + 15 days) while it is not known. */
    public static LocalDate closesBy(LocalDate open, LocalDate close) {
        return close != null ? close : open.plusDays(MAX_OPEN_DAYS);
    }

    public static Status status(LocalDate open, LocalDate close, LocalDate today) {
        if (open.isAfter(today)) {
            return Status.UPCOMING;
        }
        return today.isAfter(closesBy(open, close)) ? Status.CLOSED : Status.OPEN;
    }

    /** Days from today until the (possibly estimated) close date; 0 = closes today; null once closed. */
    public static Integer daysLeft(LocalDate open, LocalDate close, LocalDate today) {
        if (status(open, close, today) == Status.CLOSED) {
            return null;
        }
        return (int) ChronoUnit.DAYS.between(today, closesBy(open, close));
    }

    /** Days until the offer opens (UPCOMING only), else null. */
    public static Integer opensInDays(LocalDate open, LocalDate today) {
        return open.isAfter(today) ? (int) ChronoUnit.DAYS.between(today, open) : null;
    }

    /** Shown publicly: open, upcoming, or closed within the last 30 days. */
    public static boolean isPublicWindow(LocalDate open, LocalDate close, LocalDate today) {
        return !closesBy(open, close).isBefore(today.minusDays(RECENTLY_CLOSED_DAYS));
    }

    // ---------------------------------------------------------------- category

    public record Category(String assetClass, String subCategory) {
    }

    /**
     * Asset class + sub-category of an NFO. ETFs, fund of funds, FMPs, interval and life-cycle funds are {@code OTHER};
     * everything else goes through the explorer's {@link SchemeRules#classify} (Index Funds - Hybrid -> HYBRID).
     */
    public static Category classify(String schemeType, String category, String name) {
        String c = category == null ? "" : category;
        String n = name == null ? "" : name;
        if (find("Fund of Funds|\\bFoF\\b", c) || (find("\\bFoF\\b|Fund of Funds?\\b", n) && !find("Index Funds", c))) {
            return new Category("OTHER", find("Overseas", c) ? "Fund of Funds (Overseas)" : "Fund of Funds");
        }
        if (find("Exchange Traded|\\bETFs?\\b", c) || find("\\bETF\\b|Exchange Traded", n)) {
            return new Category("OTHER", "ETF");
        }
        if (find("Fixed Term|Fixed Maturity|\\bFMP\\b", c + " " + n)) {
            return new Category("OTHER", "Fixed Maturity Plan");
        }
        if (find("Interval", schemeType) || find("Interval", c + " " + n)) {
            return new Category("OTHER", "Interval Fund");
        }
        if (find("Life Cycle", c)) {
            return new Category("OTHER", "Life Cycle Fund");
        }
        if (find("Index Funds\\s*-\\s*Hybrid", c)) {
            return new Category("HYBRID", "Index (Hybrid)");
        }
        if (c.isBlank()) {
            return new Category("OTHER", null);
        }
        try {
            SchemeRules.Classification k = SchemeRules.classify(c, n);
            return new Category(k.cls().name(), cut(k.sub(), 60));
        } catch (RuntimeException e) {
            return new Category("OTHER", null);
        }
    }

    // ---------------------------------------------------------------- minimum amount

    private static final Pattern RE_1 = Pattern.compile("Re\\.?\\s*1\\b.*$", CI);
    private static final Pattern NUMBER = Pattern.compile("(\\d[\\d,]*(?:\\.\\d+)?)");

    /** First rupee amount in AMFI's free text ("Rs. 500/- and any amount thereafter" -> 500); null when none. */
    public static BigDecimal minAmount(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        Matcher m = NUMBER.matcher(RE_1.matcher(text).replaceFirst(""));
        while (m.find()) {
            String d = m.group(1).replace(",", "");
            try {
                BigDecimal v = new BigDecimal(d);
                if (v.compareTo(BigDecimal.ONE) >= 0 && v.compareTo(BigDecimal.valueOf(100_000_000)) <= 0) {
                    return v.setScale(2, java.math.RoundingMode.HALF_UP);
                }
            } catch (NumberFormatException ignored) {
                // try the next number
            }
        }
        return null;
    }

    // ---------------------------------------------------------------- AMC name

    private static final Pattern WORD = Pattern.compile("[A-Za-z0-9&]+");

    private static String firstWord(String s) {
        if (s == null) {
            return "";
        }
        Matcher m = WORD.matcher(s);
        String w = m.find() ? m.group() : "";
        if (w.equalsIgnoreCase("the") && m.find()) {
            w = m.group();
        }
        return w.toLowerCase(Locale.ROOT);
    }

    /**
     * Display name of an AMC: the AMC partner name whose first word equals the legal name's first word ("HDFC Asset
     * Management Company Limited" -> "HDFC Mutual Fund", "Wealth Company Asset Management Holdings ..." -> "The Wealth
     * Company Mutual Fund"), else the legal name without the company suffix ("Choice AMC Private Limited" -> "Choice AMC").
     */
    public static String amcDisplay(String legalName, Collection<String> partnerNames) {
        String w = firstWord(legalName);
        if (w.length() >= 2 && partnerNames != null) {
            for (String p : partnerNames) {
                if (w.equals(firstWord(p))) {
                    return p;
                }
            }
        }
        return shortAmcName(legalName);
    }

    private static final List<Pattern> SUFFIXES = List.of(
            Pattern.compile("[\\s,.]+$"),
            Pattern.compile("\\s+(Private|Pvt\\.?)\\s+(Limited|Limite|Ltd\\.?)$", CI),
            Pattern.compile("\\s+(Limited|Limite|Ltd\\.?)$", CI),
            Pattern.compile("\\s+(Co\\.?|Company)$", CI));

    /** Legal name without "Private Limited" / "Pvt. Ltd" / "Limited" / "Co." / "Company"; ALL CAPS words title-cased. */
    public static String shortAmcName(String legal) {
        if (legal == null) {
            return null;
        }
        String s = legal.trim().replaceAll("\\s+", " ");
        for (int pass = 0; pass < 4; pass++) {
            String before = s;
            for (Pattern p : SUFFIXES) {
                s = p.matcher(s).replaceFirst("");
            }
            if (s.equals(before)) {
                break;
            }
        }
        if (s.isBlank()) {
            return legal.trim();
        }
        if (s.equals(s.toUpperCase(Locale.ROOT))) { // "ASK ASSET MANAGEMENT" -> "ASK Asset Management"
            StringBuilder b = new StringBuilder();
            for (String part : s.split(" ")) {
                b.append(b.length() == 0 ? "" : " ").append(part.length() <= 3 ? part
                        : part.charAt(0) + part.substring(1).toLowerCase(Locale.ROOT));
            }
            s = b.toString();
        }
        return s;
    }

    // ---------------------------------------------------------------- scheme name

    private static final Map<String, String> NAME_ACRONYMS = Map.of("ETF", "ETF", "ETFS", "ETFs", "FOF", "FoF", "FMP", "FMP",
            "FAR", "FAR", "FTSE", "FTSE", "MSCI", "MSCI", "CPSE", "CPSE", "PSU", "PSU", "NASDAQ", "NASDAQ");
    private static final Pattern ROMAN = Pattern.compile("^(?=[IVXL]+$)L?X{0,3}(IX|IV|V?I{0,3})$");
    private static final Pattern CAPS_WORD = Pattern.compile("\\b[A-Z]{2,6}\\b");

    /**
     * {@link SchemeRules#cleanName} (same rules as the fund explorer) plus the acronyms common in NFO names that the
     * seed tool does not know: "ETF", "FoF", "FMP", roman series numbers ("Series VI") and "Series VB".
     */
    public static String schemeName(String raw) {
        String s = SchemeRules.cleanName(raw);
        Set<String> upperInRaw = new HashSet<>();
        Matcher m = CAPS_WORD.matcher(raw == null ? "" : raw);
        while (m.find()) {
            upperInRaw.add(m.group());
        }
        String[] words = s.split(" ");
        for (int i = 0; i < words.length; i++) {
            String up = words[i].toUpperCase(Locale.ROOT);
            if (!upperInRaw.contains(up)) {
                continue;
            }
            if (NAME_ACRONYMS.containsKey(up)) {
                words[i] = NAME_ACRONYMS.get(up);
            } else if ((i > 0 && words[i - 1].toLowerCase(Locale.ROOT).endsWith("series")) || ROMAN.matcher(up).matches()) {
                words[i] = up;
            }
        }
        return String.join(" ", words);
    }

    // ---------------------------------------------------------------- selection + grouping

    /** One NFO from the scheme master: all plans / options of a scheme of one AMC. */
    public record Candidate(String key, String amc, String code, String schemeName, String schemeType, String category,
                            String minText, LocalDate open, LocalDate close) {
    }

    public static String key(String amc, String cleanedName) {
        return (amc == null ? "" : amc.trim()) + "|" + (cleanedName == null ? "" : cleanedName.toLowerCase(Locale.ROOT));
    }

    /**
     * Groups the master rows per AMC + cleaned scheme name and keeps the schemes (open- and close-ended, all
     * categories) whose earliest launch date is within the last 45 days or later, or whose closure date is today or
     * later. A scheme with an older plan (new plan of an existing scheme) is not an NFO. The close date is the latest
     * closure date after the launch date (null when AMFI has none).
     */
    public static List<Candidate> candidates(List<SchemeMasterRow> rows, LocalDate today) {
        Map<String, List<SchemeMasterRow>> groups = new LinkedHashMap<>();
        for (SchemeMasterRow r : rows) {
            if (r.amc().isEmpty() || r.schemeName().isEmpty()) {
                continue;
            }
            groups.computeIfAbsent(key(r.amc(), SchemeRules.cleanName(r.schemeName())), k -> new ArrayList<>()).add(r);
        }
        LocalDate from = today.minusDays(LOOKBACK_DAYS);
        List<Candidate> out = new ArrayList<>();
        for (Map.Entry<String, List<SchemeMasterRow>> e : groups.entrySet()) {
            List<SchemeMasterRow> g = e.getValue();
            LocalDate open = g.stream().map(SchemeMasterRow::launch).min(Comparator.naturalOrder()).orElse(null);
            if (open == null) {
                continue;
            }
            LocalDate close = g.stream().map(SchemeMasterRow::closure).filter(c -> c != null && c.isAfter(open))
                    .max(Comparator.naturalOrder()).orElse(null);
            if (open.isBefore(from) && (close == null || close.isBefore(today))) {
                continue;
            }
            SchemeMasterRow rep = g.stream().min(Comparator.comparingInt((SchemeMasterRow r) -> planRank(r.navName(), r.schemeName()))
                    .thenComparingLong(r -> Long.parseLong(r.code()))).orElseThrow();
            out.add(new Candidate(e.getKey(), rep.amc(), rep.code(), schemeName(rep.schemeName()), rep.schemeType(),
                    rep.category(), rep.minText(), open, close));
        }
        out.sort(Comparator.comparing(Candidate::open).thenComparing(Candidate::schemeName));
        return out;
    }

    /** 0 = Regular Growth, 1 = growth (not direct / IDCW; e.g. HDFC's "Growth Option"), 2 = not direct, 3 = other. */
    static int planRank(String navName, String schemeName) {
        String n = navName == null || navName.isBlank() ? schemeName : navName;
        boolean direct = find("direct", n);
        boolean income = find("idcw|dividend|payout|reinvest|bonus", n);
        boolean growth = find("growth", n);
        if (!direct && !income && growth && find("regular", n)) {
            return 0;
        }
        if (!direct && !income && growth) {
            return 1;
        }
        return direct ? 3 : 2;
    }

    static String cut(String s, int n) {
        return s == null || s.length() <= n ? s : s.substring(0, n);
    }
}
