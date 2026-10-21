package com.aureusfinserve.auth;

import com.aureusfinserve.security.CryptoService;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/** Simple arithmetic CAPTCHA kept in memory (5 minute expiry, single use). */
@Service
@RequiredArgsConstructor
public class CaptchaService {

    public record Captcha(String captchaId, String question) {
    }

    private record Entry(int answer, long expiresAt) {
    }

    private static final long TTL_MS = 5 * 60_000L;

    private final CryptoService crypto;
    private final Map<String, Entry> store = new ConcurrentHashMap<>();

    public Captcha create() {
        int a = 1 + crypto.random().nextInt(9);
        int b = 1 + crypto.random().nextInt(9);
        String id = UUID.randomUUID().toString();
        store.put(id, new Entry(a + b, System.currentTimeMillis() + TTL_MS));
        return new Captcha(id, "What is " + a + " + " + b + "?");
    }

    /** Validates and consumes the captcha. */
    public boolean check(String id, String answer) {
        if (id == null || answer == null) {
            return false;
        }
        Entry e = store.remove(id);
        if (e == null || e.expiresAt() < System.currentTimeMillis()) {
            return false;
        }
        try {
            return Integer.parseInt(answer.trim()) == e.answer();
        } catch (NumberFormatException ex) {
            return false;
        }
    }

    @Scheduled(fixedDelay = 300_000)
    void cleanup() {
        long now = System.currentTimeMillis();
        store.entrySet().removeIf(en -> en.getValue().expiresAt() < now);
    }
}
