package com.aureusfinserve.sync;

import com.aureusfinserve.common.ApiException;
import com.aureusfinserve.common.Fmt;
import com.aureusfinserve.config.AppProperties;
import com.aureusfinserve.sync.SyncService.SyncRunDto;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.scheduling.support.CronExpression;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Supplier;

/**
 * Automatic data updates ({@code app.auto-sync.*}): daily NAV import (+ morning retry), daily scheme details and
 * new-schemes check, daily NFO import, NAV / NFO catch-up on startup. Scheduled jobs run on a dedicated background thread; manual triggers
 * run on the request thread. At most one sync job (scheduled or manual, any type) runs at a time.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AutoSync {

    public static final String SCHEDULER = "Scheduler";
    /** A NAV import is "recent" when one succeeded within this many hours. */
    static final int NAV_FRESH_HOURS = 20;
    static final List<String> OK_STATUSES = List.of("SUCCESS", "PARTIAL");

    private final SyncService sync;
    private final SchemeDataSync data;
    private final NfoSync nfo;
    private final SyncRunRepository runRepo;
    private final AppProperties props;

    private final AtomicReference<String> running = new AtomicReference<>();
    private final ScheduledExecutorService executor = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "auto-sync");
        t.setDaemon(true);
        return t;
    });

    // ---------------------------------------------------------------- lock

    /** Runs the job unless another sync job is running (then 409 CONFLICT). */
    public <T> T exclusive(String job, Supplier<T> work) {
        if (!running.compareAndSet(null, job)) {
            throw ApiException.conflict(label(running.get()) + " is running right now. Try again when it has finished.");
        }
        try {
            return work.get();
        } finally {
            running.set(null);
        }
    }

    /** Type of the job running now, or null. */
    public String running() {
        return running.get();
    }

    static String label(String type) {
        if (type == null) {
            return "A sync job";
        }
        return switch (type) {
            case "NAV" -> "The NAV import";
            case "RTA" -> "The RTA import";
            case "DETAILS" -> "The scheme details refresh";
            case "SCHEMES" -> "The new-schemes check";
            case "NFO" -> "The NFO import";
            default -> "A sync job";
        };
    }

    // ---------------------------------------------------------------- schedule

    @Scheduled(cron = "${app.auto-sync.nav-cron:0 30 23 * * *}", zone = "${app.auto-sync.zone:Asia/Kolkata}")
    public void scheduledNav() {
        submit("NAV", false);
    }

    @Scheduled(cron = "${app.auto-sync.nav-retry-cron:0 0 7 * * *}", zone = "${app.auto-sync.zone:Asia/Kolkata}")
    public void scheduledNavRetry() {
        submit("NAV", true);
    }

    @Scheduled(cron = "${app.auto-sync.details-cron:0 30 0 * * *}", zone = "${app.auto-sync.zone:Asia/Kolkata}")
    public void scheduledDetails() {
        submit("DETAILS", false);
    }

    @Scheduled(cron = "${app.auto-sync.schemes-cron:0 0 0 * * *}", zone = "${app.auto-sync.zone:Asia/Kolkata}")
    public void scheduledSchemes() {
        submit("SCHEMES", false);
    }

    @Scheduled(cron = "${app.auto-sync.nfo-cron:0 0 8 * * *}", zone = "${app.auto-sync.zone:Asia/Kolkata}")
    public void scheduledNfo() {
        submit("NFO", false);
    }

    /**
     * On startup: every daily job (NAV, new schemes, scheme details, NFOs) whose last successful run is older than
     * 20 hours runs once in the background (queued one after the other on the background thread).
     */
    @EventListener(ApplicationReadyEvent.class)
    public void catchUpOnStart() {
        AppProperties.AutoSync cfg = props.getAutoSync();
        if (!cfg.isEnabled() || !cfg.isCatchUpOnStart()) {
            return;
        }
        long delay = Math.max(0, cfg.getCatchUpDelaySeconds());
        for (String job : List.of("NAV", "SCHEMES", "DETAILS", "NFO")) {
            if (isFresh(job)) {
                log.info("Auto sync: last {} run is recent, no catch-up needed", job);
                continue;
            }
            log.info("Auto sync: last successful {} run is older than {} h - catch-up run in {} s", job, NAV_FRESH_HOURS, delay);
            executor.schedule(() -> runScheduled(job, true), delay, TimeUnit.SECONDS);
        }
    }

    /**
     * Queues a scheduled job on the background thread. Returns false (and does nothing) when auto sync is disabled.
     *
     * @param onlyIfStale skip when a run of the same type succeeded within the last 20 hours (NAV retry, catch-up)
     */
    public boolean submit(String job, boolean onlyIfStale) {
        if (!props.getAutoSync().isEnabled()) {
            log.debug("Auto sync disabled - scheduled {} job skipped", job);
            return false;
        }
        executor.execute(() -> runScheduled(job, onlyIfStale));
        return true;
    }

    private void runScheduled(String job, boolean onlyIfStale) {
        if (onlyIfStale && isFresh(job)) {
            log.info("Auto sync: {} already succeeded within {} h - skipped", job, NAV_FRESH_HOURS);
            return;
        }
        // a manual job may be running: wait for it (up to an hour), then run
        for (int attempt = 0; attempt < 120; attempt++) {
            try {
                SyncRunDto r = exclusive(job, () -> switch (job) {
                    case "NAV" -> sync.navSync(null, SCHEDULER);
                    case "DETAILS" -> data.detailsSync(SCHEDULER);
                    case "SCHEMES" -> data.schemesSync(SCHEDULER);
                    case "NFO" -> nfo.nfoSync(SCHEDULER);
                    default -> throw new IllegalArgumentException(job);
                });
                log.info("Auto sync {}: {} processed={} failed={}{}", job, r.status(), r.processed(), r.failed(),
                        r.summary() == null ? "" : " - " + r.summary());
                return;
            } catch (ApiException busy) {
                try {
                    Thread.sleep(30_000);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    return;
                }
            } catch (RuntimeException e) {
                log.error("Auto sync {} failed", job, e);
                return;
            }
        }
        log.warn("Auto sync {}: another sync job kept running for an hour - skipped", job);
    }

    private boolean isFresh(String type) {
        return runRepo.findFirstByTypeAndStatusInAndFinishedAtNotNullOrderByFinishedAtDescIdDesc(type, OK_STATUSES)
                .map(r -> r.getFinishedAt().isAfter(Fmt.now().minusHours(NAV_FRESH_HOURS)))
                .orElse(false);
    }

    @PreDestroy
    void shutdown() {
        executor.shutdownNow();
    }

    // ---------------------------------------------------------------- GET /api/admin/sync/schedule

    public Map<String, Object> schedule() {
        AppProperties.AutoSync cfg = props.getAutoSync();
        ZoneId zone = ZoneId.of(cfg.getZone());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("enabled", cfg.isEnabled());
        out.put("zone", cfg.getZone());
        out.put("running", running.get());
        out.put("catchUpOnStart", cfg.isCatchUpOnStart());
        Map<String, Object> nav = job(cfg.getNavCron(), zone, cfg.isEnabled());
        nav.put("retryCron", cfg.getNavRetryCron());
        nav.put("nextRetry", cfg.isEnabled() ? next(cfg.getNavRetryCron(), zone) : null);
        out.put("nav", nav);
        out.put("details", job(cfg.getDetailsCron(), zone, cfg.isEnabled()));
        out.put("schemes", job(cfg.getSchemesCron(), zone, cfg.isEnabled()));
        out.put("nfo", job(cfg.getNfoCron(), zone, cfg.isEnabled()));
        Map<String, Object> last = new LinkedHashMap<>();
        for (String type : List.of("NAV", "DETAILS", "SCHEMES", "NFO")) {
            last.put(type, runRepo.findFirstByTypeAndStatusInAndFinishedAtNotNullOrderByFinishedAtDescIdDesc(type, OK_STATUSES)
                    .map(SyncRun::getFinishedAt).orElse(null));
        }
        out.put("lastSuccess", last);
        return out;
    }

    private static Map<String, Object> job(String cron, ZoneId zone, boolean enabled) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("cron", cron);
        m.put("nextRun", enabled ? next(cron, zone) : null);
        return m;
    }

    /** Next run as local date-time in the schedule's zone; null for "-" (disabled) or an invalid expression. */
    static LocalDateTime next(String cron, ZoneId zone) {
        if (cron == null || cron.isBlank() || "-".equals(cron.trim())) {
            return null;
        }
        try {
            ZonedDateTime n = CronExpression.parse(cron).next(ZonedDateTime.now(zone));
            return n == null ? null : n.toLocalDateTime();
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
