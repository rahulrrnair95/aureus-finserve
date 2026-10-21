package com.aureusfinserve.sync;

import com.aureusfinserve.common.AssetClass;
import com.aureusfinserve.common.Risk;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Pure scheme rules ported from {@code tools/build-scheme-seed.mjs} (names, category mapping, Regular-Growth selection,
 * NAV history split adjustment / thinning) and {@code tools/enrich-scheme-details.mjs} (minimum SIP / lump sum,
 * risk-o-meter, fund managers). Keep both in step: the seed file and the daily jobs must pick the same schemes.
 */
public final class SchemeRules {

    private SchemeRules() {
    }

    public static final double YEARS_OF_HISTORY = 10.3;
    public static final int DAILY_DAYS = 400;

    private static final int CI = Pattern.CASE_INSENSITIVE;

    // ---------------------------------------------------------------- category -> asset class / sub-category / risk

    public record Classification(AssetClass cls, String sub, Risk risk) {
    }

    private static final Pattern DEBT_LOW = Pattern.compile("Overnight");
    private static final Pattern DEBT_LOW_MOD = Pattern.compile("Liquid|Money Market|Ultra Short|Low Duration|Floater|Floating");
    private static final Pattern DEBT_MOD_HIGH = Pattern.compile("Credit Risk");

    private static boolean find(String regex, int flags, String s) {
        return Pattern.compile(regex, flags).matcher(s).find();
    }

    private static boolean find(String regex, String s) {
        return find(regex, 0, s);
    }

    private static String first(String s, String regex, int flags, String replacement) {
        return Pattern.compile(regex, flags).matcher(s).replaceFirst(Matcher.quoteReplacement(replacement));
    }

    private static String first(String s, String regex, String replacement) {
        return first(s, regex, 0, replacement);
    }

    private static String all(String s, String regex, int flags, String replacement) {
        return Pattern.compile(regex, flags).matcher(s).replaceAll(Matcher.quoteReplacement(replacement));
    }

    /** AMFI category (text inside "Open Ended Schemes(...)") + scheme name -> asset class, sub-category, category-typical risk. */
    public static Classification classify(String cat, String name) {
        String[] parts = cat.split("\\s-\\s", -1);
        String joined = String.join(" - ", Arrays.asList(parts).subList(1, parts.length));
        String tail = (joined.isEmpty() ? cat : joined).trim();
        if (find("Index Funds|Other Scheme - Index", CI, cat)) {
            boolean debt = find("Debt|SDL|G-?Sec|Gilt|Bond|PSU|T-?Bill|Treasury|Crisil IBX|Liquid|Target Maturity", CI, cat + " " + name);
            return debt ? new Classification(AssetClass.DEBT, "Index (Debt)", Risk.MODERATE)
                    : new Classification(AssetClass.EQUITY, "Index", Risk.VERY_HIGH);
        }
        if (find("Solution Oriented|Retirement|Children", CI, cat)) {
            return new Classification(AssetClass.HYBRID, find("Retirement", CI, cat) ? "Retirement" : "Children's", Risk.VERY_HIGH);
        }
        if (find("^Equity|Growth|ELSS", CI, cat) || find("ELSS", CI, tail)) {
            String sub = first(tail, "\\s*Fund$", CI, "");
            sub = first(sub, "ELSS.*", CI, "ELSS");
            sub = first(sub, "Sectoral\\s*/\\s*Thematic", CI, "Sectoral / Thematic");
            if (find("^Thematic$|Sectoral$", CI, sub)) {
                sub = "Sectoral / Thematic";
            }
            sub = first(sub, "\\bFlexicap\\b", CI, "Flexi Cap");
            sub = first(sub, "\\bMidcap\\b", CI, "Mid Cap");
            sub = first(sub, "\\bSmallcap\\b", CI, "Small Cap");
            return new Classification(AssetClass.EQUITY, sub, Risk.VERY_HIGH);
        }
        if (find("Hybrid", CI, cat)) {
            String sub = first(tail, "\\s*Fund$", CI, "");
            if (find("Balanced Advantage|Dynamic Asset Allocation", CI, sub)) {
                sub = "Balanced Advantage";
            }
            Risk risk = find("Arbitrage", CI, sub) ? Risk.LOW : find("Conservative|Equity Savings", CI, sub) ? Risk.MODERATELY_HIGH : Risk.VERY_HIGH;
            return new Classification(AssetClass.HYBRID, sub, risk);
        }
        // debt (incl. older "Income/Debt Oriented Schemes - ..." labels)
        String sub = first(tail, "\\s*Fund$", CI, "");
        sub = first(sub, "^Ultra Short to Short Term$", CI, "Ultra Short Duration");
        sub = first(sub, "Short Term$", CI, "Short Duration");
        sub = first(sub, "^Medium Term$", CI, "Medium Duration");
        sub = first(sub, "^Medium to Long Term$", CI, "Medium to Long Duration");
        sub = first(sub, "^Long Term$", CI, "Long Duration");
        sub = first(sub, "^Dynamic Term$", CI, "Dynamic Bond");
        sub = first(sub, "Banking and PSU( Debt)?", CI, "Banking & PSU");
        sub = first(sub, "Floating Interest Rates", CI, "Floater");
        if (find("^Income$", CI, sub)) {
            sub = "Debt";
        }
        if (find("^Sectoral$", CI, sub)) {
            sub = "Sectoral Debt";
        }
        if (find("Constant Maturity Gilt", CI, sub)) {
            sub = "Gilt (10-year Constant Maturity)";
        }
        Risk risk = DEBT_LOW.matcher(sub).find() ? Risk.LOW : DEBT_LOW_MOD.matcher(sub).find() ? Risk.LOW_TO_MODERATE
                : DEBT_MOD_HIGH.matcher(sub).find() ? Risk.MODERATELY_HIGH : Risk.MODERATE;
        return new Classification(AssetClass.DEBT, sub, risk);
    }

    // ---------------------------------------------------------------- names

    private static final Set<String> ACRONYMS = Set.of("SBI", "ICICI", "HDFC", "UTI", "DSP", "ITI", "ELSS", "PSU", "IDCW", "BAF",
            "ESG", "MNC", "PSE", "CPSE", "IT", "US", "BSE", "NSE", "SDL", "AAA", "BHARAT", "G-SEC", "II", "III", "IV", "FMCG", "EV", "AI",
            "REIT", "REITS", "TRI", "NASDAQ", "S&P", "CRISIL", "IBX", "PSBs");
    private static final Pattern UPPER_WORD = Pattern.compile("\\b[A-Z]{2,}\\b");
    private static final Pattern DIGIT = Pattern.compile("\\d");

    /** AMFI scheme name -> display name (title case except acronyms, "formerly known as" removed, ...). */
    public static String cleanName(String n) {
        String s = first(n, "\\s*\\(existing number of segregated portfolios[^)]*\\)", CI, "");
        s = all(s, "\\s*\\(\\s*(formerly know[n]? as|erstwhile)\\b[^)]*\\)", CI, "");
        s = first(s, "^UTI\\s*-\\s*", "UTI ");
        s = first(s, "\\s*-\\s*(?=Tax Saver)", CI, " ");
        s = first(s, "\\bFLEXICAP\\b", "Flexi Cap");
        s = first(s, "\\bFlexicap\\b", "Flexi Cap");
        s = UPPER_WORD.matcher(s).replaceAll(m -> {
            String w = m.group();
            return Matcher.quoteReplacement(ACRONYMS.contains(w) || DIGIT.matcher(w).find() ? w
                    : w.charAt(0) + w.substring(1).toLowerCase(Locale.ROOT));
        });
        s = all(s, "\\bNifty\\b", CI, "Nifty");
        s = all(s, "\\bfund\\b", 0, "Fund");
        s = first(s, "^Quant\\b", "quant"); // the AMC's brand is lower-case
        s = all(s, "\\s{2,}", 0, " ");
        s = first(s, "[\\s.-]+$", "");
        return s.trim();
    }

    // ---------------------------------------------------------------- selection

    private static final Pattern EXCLUDE_NAME = Pattern.compile("segregated portfolio\\s*-?\\s*\\d|\\(\\s*segregated\\s*-|unclaimed|bonus|unit linked"
            + "|insurance|fund of funds?\\b|\\bfof\\b|\\betf\\b|exchange traded|interval|fixed maturity|\\bfmp\\b|direct", CI);
    private static final Pattern EXCLUDE_CAT = Pattern.compile("ETF|FoF|Fund of Funds|Interval|Exchange Traded", CI);

    /**
     * Regular plan, growth option. {@code plan}/{@code option} come from the 8-column NAV file; for the older 6-column
     * file the scheme master's NAV name (else the scheme name) is used.
     */
    public static boolean isRegularGrowth(String plan, String option, String masterNavName, String name) {
        String p = plan == null ? "" : plan;
        String o = option == null ? "" : option;
        String label = !p.isEmpty() || !o.isEmpty() ? p + " " + o
                : masterNavName != null && !masterNavName.isEmpty() ? masterNavName : name;
        return find("regular", CI, label) && find("growth", CI, label)
                && !find("direct|idcw|dividend|bonus|unclaimed|discontinued|payout|reinvest", CI, label);
    }

    /** ETFs, FoFs, interval / FMP, unclaimed, bonus, side-pocket "(Segregated - ...)", unit-linked insurance, direct. */
    public static boolean isExcludedName(String name) {
        return EXCLUDE_NAME.matcher(first(name, "\\(existing number of segregated portfolios[^)]*\\)", CI, "")).find();
    }

    public static boolean isExcludedCategory(String cat) {
        return cat != null && EXCLUDE_CAT.matcher(cat).find();
    }

    // ---------------------------------------------------------------- dates

    private static final String MONTHS = "JanFebMarAprMayJunJulAugSepOctNovDec";
    private static final Pattern DD_MON_YYYY = Pattern.compile("^(\\d{2})-([A-Za-z]{3})-(\\d{4})$");

    /** "19-Oct-2026" -> 2026-10-19 (null when not in that format). */
    public static LocalDate fromDdMonYyyy(String d) {
        if (d == null) {
            return null;
        }
        Matcher m = DD_MON_YYYY.matcher(d.trim());
        if (!m.matches()) {
            return null;
        }
        String mon = m.group(2).substring(0, 1).toUpperCase(Locale.ROOT) + m.group(2).substring(1).toLowerCase(Locale.ROOT);
        int idx = MONTHS.indexOf(mon);
        if (idx < 0 || idx % 3 != 0) {
            return null;
        }
        try {
            return LocalDate.of(Integer.parseInt(m.group(3)), idx / 3 + 1, Integer.parseInt(m.group(1)));
        } catch (java.time.DateTimeException e) {
            return null;
        }
    }

    /** "19-10-2026" (mfapi) -> 2026-10-19, null when invalid. */
    public static LocalDate fromDdMmYyyy(String d) {
        if (d == null) {
            return null;
        }
        String[] p = d.trim().split("-");
        try {
            return p.length == 3 ? LocalDate.of(Integer.parseInt(p[2]), Integer.parseInt(p[1]), Integer.parseInt(p[0])) : null;
        } catch (RuntimeException e) {
            return null;
        }
    }

    // ---------------------------------------------------------------- NAV history

    public record NavPt(LocalDate date, double nav) {
    }

    /**
     * Unit splits / consolidations show up as a jump by a power of ten between two consecutive NAVs; all earlier points
     * are scaled so the series is continuous (as in build-scheme-seed.mjs). Input sorted by date ascending.
     */
    public static List<NavPt> adjustForSplits(List<NavPt> series) {
        int n = series.size();
        LocalDate[] dates = new LocalDate[n];
        double[] navs = new double[n];
        for (int i = 0; i < n; i++) {
            dates[i] = series.get(i).date();
            navs[i] = series.get(i).nav();
        }
        for (int i = n - 1; i > 0; i--) {
            double ratio = navs[i] / navs[i - 1];
            long pow = Math.round(Math.log10(ratio));
            if (pow != 0 && Math.abs(ratio / Math.pow(10, pow) - 1) < 0.05) {
                double f = Math.pow(10, pow);
                for (int j = 0; j < i; j++) {
                    navs[j] = round4(navs[j] * f);
                }
            }
        }
        List<NavPt> out = new ArrayList<>(n);
        for (int i = 0; i < n; i++) {
            out.add(new NavPt(dates[i], navs[i]));
        }
        return out;
    }

    public static double round4(double v) {
        return BigDecimal.valueOf(v).setScale(4, RoundingMode.HALF_UP).doubleValue();
    }

    /** Daily points for the last {@value #DAILY_DAYS} days, one per week (the week's last trading day) before, ~10.3 years in all. */
    public static List<NavPt> thin(List<NavPt> series, LocalDate today) {
        LocalDate cut = today.minusDays(DAILY_DAYS);
        LocalDate start = today.minusDays(Math.round(YEARS_OF_HISTORY * 365));
        List<NavPt> out = new ArrayList<>();
        Long lastWeek = null;
        for (int i = series.size() - 1; i >= 0; i--) { // newest -> oldest
            NavPt p = series.get(i);
            if (p.date().isBefore(start)) {
                break;
            }
            if (!p.date().isBefore(cut)) {
                out.add(p);
                continue;
            }
            long week = Math.floorDiv(p.date().toEpochDay() + 3, 7);
            if (lastWeek == null || week != lastWeek) {
                out.add(p);
                lastWeek = week;
            }
        }
        Collections.reverse(out);
        return out;
    }

    // ---------------------------------------------------------------- scheme details (enrich-scheme-details.mjs)

    private static final Map<String, Risk> RISK = Map.of("low", Risk.LOW, "low to moderate", Risk.LOW_TO_MODERATE,
            "moderate", Risk.MODERATE, "moderately high", Risk.MODERATELY_HIGH, "high", Risk.HIGH, "very high", Risk.VERY_HIGH);

    /** "Very High Risk" / "Moderately High" -> Risk, null when unknown. */
    public static Risk toRisk(String s) {
        if (s == null) {
            return null;
        }
        String k = s.toLowerCase(Locale.ROOT).replaceFirst("\\s*risk\\s*$", "").replaceAll("\\s+", " ").trim();
        return RISK.get(k);
    }

    /** Whitespace collapsed, blank -> null. */
    public static String clean(String s) {
        if (s == null) {
            return null;
        }
        String c = s.replaceAll("\\s+", " ").trim();
        return c.isEmpty() ? null : c;
    }

    /** Cut at a word boundary with an ellipsis when longer than n. */
    public static String cap(String s, int n) {
        if (s == null || s.length() <= n) {
            return s;
        }
        return s.substring(0, n - 1).replaceFirst("\\s+\\S*$", "") + "…";
    }

    private static final Pattern RUPEES = Pattern.compile("(?:Rs\\.?|₹|INR)\\s*([\\d,]+(?:\\.\\d+)?)", CI);
    private static final Pattern BARE_NUMBER = Pattern.compile("^\\s*([\\d,]+)\\s*$");

    /** "Rs.100" / "₹ 5,000" / "1000" -> rupees (1 .. 10 lakh), else null. */
    public static Integer rupees(String s) {
        if (s == null) {
            return null;
        }
        Matcher m = RUPEES.matcher(s);
        if (!m.find()) {
            m = BARE_NUMBER.matcher(s);
            if (!m.find()) {
                return null;
            }
        }
        Long v = number(m.group(1));
        return v != null && v >= 1 && v <= 1_000_000 ? v.intValue() : null;
    }

    private static Long number(String digits) {
        String d = digits.replace(",", "");
        if (d.isEmpty()) {
            return null;
        }
        try {
            return Math.round(Double.parseDouble(d));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static final String NUM = "(?:Rs\\.?|₹|INR)?\\s*([\\d,]+(?:\\.\\d+)?)";
    private static final List<Pattern> MIN_SIP = List.of(
            Pattern.compile("MSIP[^\\d;|]{0,20}?" + NUM, CI),
            Pattern.compile("\\bM\\s*-\\s*" + NUM),
            Pattern.compile("Monthly(?:\\s*SIP)?\\s*[-:]?\\s*" + NUM, CI),
            Pattern.compile("SIP[^\\d;|]{0,40}?" + NUM, CI),
            Pattern.compile("Minimum\\s*amount\\s*:?[^\\d;|]{0,30}?" + NUM, CI));
    private static final Pattern MINIMUM_AMOUNT = Pattern.compile("minimum amount", CI);

    /**
     * Minimum monthly SIP from the Scheme Summary Document "terms_sip" text, e.g.
     * "Minimum amount: For SIP DSIP, WSIP, MSIP - Rs. 100; QSIP - Rs. 1500". AMCs word it differently:
     * "MSIP - Rs. 100", "SIP - D-500/W-500/M-500", "Monthly 1000.00", "SIP - 100/500", "SIP - Minimum amount: 1000",
     * "MinimumAmount: Rs.500.00", "Minimum amount: 100".
     */
    public static Integer minSip(String text) {
        if (text == null || text.isEmpty()) {
            return null;
        }
        String seg = text;
        for (String part : text.split("\\|", -1)) {
            if (MINIMUM_AMOUNT.matcher(part).find()) {
                seg = part;
                break;
            }
        }
        seg = seg.replaceAll("\\s+", " ");
        for (Pattern re : MIN_SIP) {
            Matcher m = re.matcher(seg);
            if (m.find()) {
                Long v = number(m.group(1));
                if (v != null && v >= 50 && v <= 100_000) {
                    return v.intValue();
                }
            }
        }
        return null;
    }

    public record Manager(String name, String role) {
    }

    private static final Pattern SECONDARY_MANAGER = Pattern.compile("overseas|foreign|gold|silver|commodit|debt|arbitrage|dedicated", CI);

    /** Scheme managers first, then dedicated overseas / commodity / debt managers; unique, comma separated, max 150 chars. */
    public static String managers(List<Manager> list) {
        if (list == null || list.isEmpty()) {
            return null;
        }
        List<Manager> sorted = new ArrayList<>(list);
        sorted.sort(Comparator.comparingInt(m -> SECONDARY_MANAGER.matcher(m.role() == null ? "" : m.role()).find() ? 1 : 0));
        LinkedHashSet<String> names = new LinkedHashSet<>();
        for (Manager m : sorted) {
            String c = clean(m.name());
            if (c != null) {
                names.add(c);
            }
        }
        return names.isEmpty() ? null : cap(String.join(", ", names), 150);
    }
}
