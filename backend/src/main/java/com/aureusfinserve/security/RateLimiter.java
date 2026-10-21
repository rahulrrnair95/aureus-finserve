package com.aureusfinserve.security;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory sliding-window rate limiter (per IP / per user id). Good enough for a single instance;
 * replace with a shared store (e.g. Redis) when running multiple instances.
 */
@Component
public class RateLimiter {

    private static final long MAX_WINDOW_MS = 60L * 60 * 1000;

    private final Map<String, Deque<Long>> hits = new ConcurrentHashMap<>();

    /** @return true if the call is allowed (and records it), false if the limit is exceeded. */
    public boolean tryAcquire(String key, int limit, long windowMillis) {
        long now = System.currentTimeMillis();
        Deque<Long> q = hits.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (q) {
            while (!q.isEmpty() && q.peekFirst() <= now - windowMillis) {
                q.pollFirst();
            }
            if (q.size() >= limit) {
                return false;
            }
            q.addLast(now);
            return true;
        }
    }

    public void reset() {
        hits.clear();
    }

    @Scheduled(fixedDelay = 300_000)
    void cleanup() {
        long cutoff = System.currentTimeMillis() - MAX_WINDOW_MS;
        hits.entrySet().removeIf(e -> {
            synchronized (e.getValue()) {
                Long last = e.getValue().peekLast();
                return last == null || last < cutoff;
            }
        });
    }
}
