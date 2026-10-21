package com.aureusfinserve.sync;

import java.time.LocalDate;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Parsers for the AMFI NAV file (NAVAll.txt) and scheme master CSV, plus the Regular-Growth scheme selection. */
public final class AmfiData {

    private AmfiData() {
    }

    /**
     * One data line of NAVAll.txt with the AMC and category headers in force. Formats:
     * {@code Code;ISIN growth;ISIN reinvest;Name;NAV;Date} (6 fields) or, since 2026,
     * {@code Code;ISIN growth;ISIN reinvest;Name;Plan;Option;NAV;Date} (8 fields).
     */
    public record NavRow(int lineNo, String amc, String cat, String catFull, String code, String isin, String name,
                         String plan, String option, String navText, String dateText) {

        /** NAV as a number; NaN for "N.A." and other non-numeric values. */
        public double nav() {
            try {
                return Double.parseDouble(navText.trim());
            } catch (NumberFormatException e) {
                return Double.NaN;
            }
        }

        public LocalDate date() {
            return SchemeRules.fromDdMonYyyy(dateText);
        }

        /** ISIN when it looks like one (12 characters), else null. */
        public String validIsin() {
            String i = isin == null ? "" : isin.trim();
            return i.length() == 12 ? i : null;
        }
    }

    private static final Pattern DIGITS = Pattern.compile("^\\d+$");

    public static List<NavRow> parseNavAll(String text) {
        List<NavRow> rows = new ArrayList<>();
        String amc = null;
        String cat = null;
        String catFull = null;
        int lineNo = 0;
        for (String raw : text.split("\\r?\\n", -1)) {
            lineNo++;
            String line = raw.trim();
            if (line.isEmpty()) {
                continue;
            }
            String[] f = line.split(";", -1);
            if (f.length == 1) {
                if (line.contains("Schemes(")) {
                    catFull = line;
                    int open = line.indexOf('(');
                    int close = line.lastIndexOf(')');
                    cat = close > open ? line.substring(open + 1, close) : line.substring(open + 1);
                } else {
                    amc = line;
                }
                continue;
            }
            if (f.length < 6 || !DIGITS.matcher(f[0].trim()).matches()) {
                continue; // column header line or malformed
            }
            boolean hasPlan = f.length >= 8;
            int navIdx = hasPlan ? 6 : 4;
            rows.add(new NavRow(lineNo, amc, cat, catFull, f[0].trim(), f[1].trim(), f[3].trim(), hasPlan ? f[4].trim() : "",
                    hasPlan ? f[5].trim() : "", f[navIdx].trim(), f[navIdx + 1].trim()));
        }
        return rows;
    }

    /** Scheme master row: NAV name (plan / option), launch date, minimum amount (100 .. 1 lakh, else null). */
    public record MasterRow(String navName, LocalDate launch, Integer minAmount) {
    }

    private static final Pattern DD_MON_YYYY = Pattern.compile("^\\d{2}-[A-Za-z]{3}-\\d{4}$");
    private static final Pattern RE_1 = Pattern.compile("Re\\.?\\s*1\\b.*$", Pattern.CASE_INSENSITIVE);
    private static final Pattern FIRST_NUMBER = Pattern.compile("(\\d[\\d,]*)");

    /** CSV without quoting: AMC,Code,Scheme Name,Type,Category,NAV Name,Minimum Amount...,Launch Date,Closure Date,ISINs. */
    public static Map<String, MasterRow> parseMaster(String text) {
        Map<String, MasterRow> master = new HashMap<>();
        String[] lines = text.split("\\r?\\n", -1);
        for (int li = 1; li < lines.length; li++) {
            String[] f = lines[li].split(",", -1);
            if (f.length < 2 || !DIGITS.matcher(f[1]).matches()) {
                continue;
            }
            int dateIdx = -1;
            for (int i = 6; i < f.length; i++) {
                if (DD_MON_YYYY.matcher(f[i].trim()).matches()) {
                    dateIdx = i;
                    break;
                }
            }
            String minText = dateIdx > 6 ? String.join(",", Arrays.asList(f).subList(6, dateIdx)) : "";
            Matcher m = FIRST_NUMBER.matcher(RE_1.matcher(minText).replaceFirst(""));
            long minNum = 0;
            if (m.find()) {
                try {
                    minNum = Long.parseLong(m.group(1).replace(",", ""));
                } catch (NumberFormatException ignored) {
                    minNum = 0;
                }
            }
            master.put(f[1], new MasterRow(f.length > 5 ? f[5].trim() : "", dateIdx > 0 ? SchemeRules.fromDdMonYyyy(f[dateIdx]) : null,
                    minNum >= 100 && minNum <= 100_000 ? (int) minNum : null));
        }
        return master;
    }

    /**
     * Every column of one scheme master row (used by the NFO import). {@code minText} is the free-text "Scheme Minimum
     * Amount" (it may itself contain commas, so it is the text between the NAV name and the launch date);
     * {@code closure} is null when the column is empty.
     */
    public record SchemeMasterRow(String amc, String code, String schemeName, String schemeType, String category,
                                  String navName, String minText, LocalDate launch, LocalDate closure) {
    }

    /** All data rows of the scheme master CSV that have a launch date. */
    public static List<SchemeMasterRow> parseMasterRows(String text) {
        List<SchemeMasterRow> out = new ArrayList<>();
        String[] lines = text.split("\\r?\\n", -1);
        for (int li = 1; li < lines.length; li++) {
            String[] f = lines[li].split(",", -1);
            if (f.length < 8 || !DIGITS.matcher(f[1].trim()).matches()) {
                continue;
            }
            int dateIdx = -1;
            for (int i = 6; i < f.length; i++) {
                if (DD_MON_YYYY.matcher(f[i].trim()).matches()) {
                    dateIdx = i;
                    break;
                }
            }
            if (dateIdx < 0) {
                continue;
            }
            LocalDate launch = SchemeRules.fromDdMonYyyy(f[dateIdx]);
            if (launch == null) {
                continue;
            }
            LocalDate closure = dateIdx + 1 < f.length ? SchemeRules.fromDdMonYyyy(f[dateIdx + 1]) : null;
            String minText = dateIdx > 6 ? String.join(",", Arrays.asList(f).subList(6, dateIdx)).trim() : "";
            out.add(new SchemeMasterRow(f[0].trim(), f[1].trim(), f[2].trim(), f[3].trim(), f[4].trim(), f[5].trim(),
                    minText, launch, closure));
        }
        return out;
    }

    /** Open-ended Regular Plan - Growth rows of the given AMCs (ETFs, FoFs, interval, FMP, side pockets ... excluded). */
    public static List<NavRow> candidates(List<NavRow> rows, Map<String, MasterRow> master, Set<String> amcs) {
        List<NavRow> out = new ArrayList<>();
        for (NavRow r : rows) {
            if (r.amc() == null || !amcs.contains(r.amc()) || r.catFull() == null || !r.catFull().startsWith("Open Ended")
                    || SchemeRules.isExcludedCategory(r.cat())) {
                continue;
            }
            if (!(r.nav() > 0)) {
                continue;
            }
            MasterRow mr = master.get(r.code());
            if (!SchemeRules.isRegularGrowth(r.plan(), r.option(), mr == null ? null : mr.navName(), r.name())
                    || SchemeRules.isExcludedName(r.name())) {
                continue;
            }
            out.add(r);
        }
        return out;
    }

    /** Grouping key: one code per scheme (AMC + cleaned name). */
    public static String schemeKey(NavRow r) {
        return r.amc() + "|" + SchemeRules.cleanName(r.name()).toLowerCase(Locale.ROOT);
    }

    /** One code per scheme: prefer the most recent NAV date, then the lower (older) code. */
    public static List<NavRow> onePerScheme(List<NavRow> candidates) {
        Map<String, NavRow> byScheme = new LinkedHashMap<>();
        for (NavRow r : candidates) {
            String k = schemeKey(r);
            NavRow cur = byScheme.get(k);
            if (cur == null || better(r, cur)) {
                byScheme.put(k, r);
            }
        }
        return new ArrayList<>(byScheme.values());
    }

    private static boolean better(NavRow r, NavRow cur) {
        String a = r.date() == null ? "" : r.date().toString();
        String b = cur.date() == null ? "" : cur.date().toString();
        int c = a.compareTo(b);
        return c > 0 || (c == 0 && Long.parseLong(r.code()) < Long.parseLong(cur.code()));
    }
}
