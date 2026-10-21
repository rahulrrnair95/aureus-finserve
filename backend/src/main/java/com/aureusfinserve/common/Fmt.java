package com.aureusfinserve.common;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.Locale;

/** Formatting / masking / rounding helpers shared across features. */
public final class Fmt {

    public static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    private Fmt() {
    }

    public static LocalDateTime now() {
        return LocalDateTime.now(IST).truncatedTo(ChronoUnit.SECONDS);
    }

    public static LocalDate today() {
        return LocalDate.now(IST);
    }

    public static BigDecimal money(BigDecimal v) {
        return v == null ? null : v.setScale(2, RoundingMode.HALF_UP);
    }

    public static BigDecimal money(double v) {
        return BigDecimal.valueOf(v).setScale(2, RoundingMode.HALF_UP);
    }

    public static BigDecimal units(BigDecimal v) {
        return v == null ? null : v.setScale(4, RoundingMode.HALF_UP);
    }

    public static BigDecimal units(double v) {
        return BigDecimal.valueOf(v).setScale(4, RoundingMode.HALF_UP);
    }

    public static BigDecimal nav(BigDecimal v) {
        return v == null ? null : v.setScale(4, RoundingMode.HALF_UP);
    }

    public static Double pct(Double v) {
        return v == null || v.isNaN() || v.isInfinite() ? null : Math.round(v * 100.0) / 100.0;
    }

    public static String maskMobile(String mobile) {
        if (mobile == null || mobile.isBlank()) {
            return null;
        }
        String d = mobile.replaceAll("\\D", "");
        if (d.length() < 4) {
            return "XXXXXX";
        }
        return "XXXXXX" + d.substring(d.length() - 4);
    }

    public static String maskPan(String pan) {
        if (pan == null || pan.length() < 5) {
            return pan == null ? null : "XXXXX";
        }
        return "XXXXX" + pan.substring(5).toUpperCase(Locale.ROOT);
    }

    public static String maskEmail(String email) {
        if (email == null || !email.contains("@")) {
            return null;
        }
        int at = email.indexOf('@');
        String local = email.substring(0, at);
        String keep = local.length() <= 2 ? local.substring(0, 1) : local.substring(0, 2);
        return keep + "***" + email.substring(at);
    }

    public static String maskAccount(String acc) {
        if (acc == null) {
            return null;
        }
        String d = acc.replaceAll("\\s", "");
        if (d.length() <= 4) {
            return "XXXX";
        }
        return "X".repeat(d.length() - 4) + d.substring(d.length() - 4);
    }

    /** Indian financial year label (Apr-Mar) for a date, e.g. 2025-26. */
    public static String fyOf(LocalDate d) {
        int start = d.getMonthValue() >= 4 ? d.getYear() : d.getYear() - 1;
        return String.format("%d-%02d", start, (start + 1) % 100);
    }

    public static LocalDate fyStart(String fy) {
        return LocalDate.of(parseFyStartYear(fy), 4, 1);
    }

    public static LocalDate fyEnd(String fy) {
        return LocalDate.of(parseFyStartYear(fy) + 1, 3, 31);
    }

    private static int parseFyStartYear(String fy) {
        if (fy == null || !fy.matches("\\d{4}-\\d{2}")) {
            throw ApiException.validation("fy", "Financial year must look like 2025-26");
        }
        int start = Integer.parseInt(fy.substring(0, 4));
        int end = Integer.parseInt(fy.substring(5));
        if ((start + 1) % 100 != end) {
            throw ApiException.validation("fy", "Financial year must look like 2025-26");
        }
        return start;
    }
}
