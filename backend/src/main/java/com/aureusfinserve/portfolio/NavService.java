package com.aureusfinserve.portfolio;

import com.aureusfinserve.publicsite.NavPoint;
import com.aureusfinserve.publicsite.PublicRepos.NavPointRepository;
import com.aureusfinserve.publicsite.PublicRepos.SchemeRepository;
import com.aureusfinserve.publicsite.Scheme;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import java.util.TreeMap;
import java.util.concurrent.ConcurrentHashMap;

/** In-memory cache of daily NAV series per scheme, plus trailing-return computation. */
@Service
@RequiredArgsConstructor
public class NavService {

    private final NavPointRepository navRepo;
    private final SchemeRepository schemeRepo;
    private final Map<Long, TreeMap<LocalDate, Double>> cache = new ConcurrentHashMap<>();

    public TreeMap<LocalDate, Double> series(Long schemeId) {
        return cache.computeIfAbsent(schemeId, id -> {
            TreeMap<LocalDate, Double> m = new TreeMap<>();
            for (NavPoint p : navRepo.findBySchemeIdOrderByNavDateAsc(id)) {
                m.put(p.getNavDate(), p.getNav().doubleValue());
            }
            return m;
        });
    }

    /** NAV on or before the date (falls back to earliest point, then to the scheme's latest NAV). */
    public double navOn(Scheme s, LocalDate date) {
        TreeMap<LocalDate, Double> m = series(s.getId());
        Map.Entry<LocalDate, Double> e = m.floorEntry(date);
        if (e != null) {
            return e.getValue();
        }
        if (!m.isEmpty()) {
            return m.firstEntry().getValue();
        }
        return s.getNav() == null ? 0 : s.getNav().doubleValue();
    }

    public double latestNav(Scheme s) {
        return s.getNav() == null ? navOn(s, LocalDate.now()) : s.getNav().doubleValue();
    }

    public void invalidate(Long schemeId) {
        cache.remove(schemeId);
    }

    public void invalidateAll() {
        cache.clear();
    }

    /** Point-to-point (1y) or CAGR (3y/5y) return in % from NAV history, null when history is too short. */
    public Double trailingReturn(TreeMap<LocalDate, Double> m, int years) {
        if (m.isEmpty()) {
            return null;
        }
        LocalDate last = m.lastKey();
        LocalDate from = last.minusYears(years);
        if (m.firstKey().isAfter(from.plusDays(7))) {
            return null;
        }
        Map.Entry<LocalDate, Double> start = m.floorEntry(from);
        if (start == null) {
            start = m.ceilingEntry(from);
        }
        double end = m.lastEntry().getValue();
        if (start == null || start.getValue() <= 0) {
            return null;
        }
        double ratio = end / start.getValue();
        double r = years == 1 ? ratio - 1 : Math.pow(ratio, 1.0 / years) - 1;
        return Math.round(r * 10000.0) / 100.0;
    }

    /** Refreshes latest NAV / NAV date / 1y-3y-5y returns on the scheme from its history. */
    @Transactional
    public void refreshScheme(Scheme s) {
        invalidate(s.getId());
        TreeMap<LocalDate, Double> m = series(s.getId());
        if (!m.isEmpty()) {
            s.setNav(BigDecimal.valueOf(m.lastEntry().getValue()).setScale(4, java.math.RoundingMode.HALF_UP));
            s.setNavDate(m.lastKey());
        }
        s.setReturn1y(trailingReturn(m, 1));
        s.setReturn3y(trailingReturn(m, 3));
        s.setReturn5y(trailingReturn(m, 5));
        s.setReturn10y(trailingReturn(m, 10));
        schemeRepo.save(s);
    }
}
