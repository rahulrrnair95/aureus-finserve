package com.aureusfinserve.portfolio;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * XIRR on dated cash flows (investments negative, redemptions / current value positive).
 * Newton-Raphson first, bisection fallback. Returns the annual rate as a fraction (0.12 = 12%) or null.
 */
public final class Xirr {

    public record CashFlow(LocalDate date, double amount) {
    }

    private static final double TOL = 1e-7;

    private Xirr() {
    }

    public static Double compute(List<CashFlow> flows) {
        if (flows == null || flows.size() < 2) {
            return null;
        }
        boolean pos = false;
        boolean neg = false;
        LocalDate first = flows.get(0).date();
        LocalDate last = first;
        for (CashFlow f : flows) {
            if (f.amount() > 0) {
                pos = true;
            } else if (f.amount() < 0) {
                neg = true;
            }
            if (f.date().isBefore(first)) {
                first = f.date();
            }
            if (f.date().isAfter(last)) {
                last = f.date();
            }
        }
        if (!pos || !neg || ChronoUnit.DAYS.between(first, last) < 1) {
            return null;
        }
        final LocalDate t0 = first;
        double[] t = new double[flows.size()];
        double[] cf = new double[flows.size()];
        for (int i = 0; i < flows.size(); i++) {
            t[i] = ChronoUnit.DAYS.between(t0, flows.get(i).date()) / 365.0;
            cf[i] = flows.get(i).amount();
        }

        // Newton-Raphson
        double r = 0.1;
        for (int i = 0; i < 100; i++) {
            double f = npv(r, t, cf);
            double d = dnpv(r, t, cf);
            if (Math.abs(f) < TOL) {
                return valid(r) ? r : bisect(t, cf);
            }
            if (d == 0 || Double.isNaN(d)) {
                break;
            }
            double next = r - f / d;
            if (Double.isNaN(next) || Double.isInfinite(next) || next <= -0.999999) {
                break;
            }
            if (Math.abs(next - r) < TOL) {
                return valid(next) ? next : bisect(t, cf);
            }
            r = next;
        }
        return bisect(t, cf);
    }

    private static boolean valid(double r) {
        return !Double.isNaN(r) && !Double.isInfinite(r) && r > -0.999999;
    }

    private static Double bisect(double[] t, double[] cf) {
        double lo = -0.9999;
        double hi = 1.0;
        double flo = npv(lo, t, cf);
        double fhi = npv(hi, t, cf);
        int expand = 0;
        while (flo * fhi > 0 && expand < 20) {
            hi *= 2;
            fhi = npv(hi, t, cf);
            expand++;
        }
        if (Double.isNaN(flo) || Double.isNaN(fhi) || flo * fhi > 0) {
            return null;
        }
        for (int i = 0; i < 300; i++) {
            double mid = (lo + hi) / 2;
            double fm = npv(mid, t, cf);
            if (Math.abs(fm) < TOL || (hi - lo) / 2 < 1e-10) {
                return mid;
            }
            if (fm * flo < 0) {
                hi = mid;
            } else {
                lo = mid;
                flo = fm;
            }
        }
        return (lo + hi) / 2;
    }

    private static double npv(double r, double[] t, double[] cf) {
        double s = 0;
        for (int i = 0; i < t.length; i++) {
            s += cf[i] / Math.pow(1 + r, t[i]);
        }
        return s;
    }

    private static double dnpv(double r, double[] t, double[] cf) {
        double s = 0;
        for (int i = 0; i < t.length; i++) {
            s += -t[i] * cf[i] / Math.pow(1 + r, t[i] + 1);
        }
        return s;
    }
}
