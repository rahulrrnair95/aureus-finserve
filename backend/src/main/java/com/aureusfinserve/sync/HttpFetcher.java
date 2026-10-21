package com.aureusfinserve.sync;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

/** GET with timeouts and retries (linear backoff) for the data sources of the sync jobs. */
@Slf4j
@Component
public class HttpFetcher {

    private static final String USER_AGENT = "Mozilla/5.0 (compatible; AureusFinserve-Sync/1.0)";

    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(20))
            .followRedirects(HttpClient.Redirect.NORMAL).build();

    /**
     * @param attempts   total tries (>= 1)
     * @param backoffMs  wait before retry n is n * backoffMs
     */
    public String get(String url, Duration timeout, int attempts, long backoffMs) throws IOException, InterruptedException {
        IOException last = null;
        for (int attempt = 1; attempt <= Math.max(1, attempts); attempt++) {
            try {
                HttpRequest req = HttpRequest.newBuilder(URI.create(url)).timeout(timeout).header("User-Agent", USER_AGENT)
                        .header("Accept", "*/*").GET().build();
                HttpResponse<String> res = client.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
                if (res.statusCode() != 200) {
                    throw new IOException("HTTP " + res.statusCode());
                }
                String body = res.body();
                return body.startsWith("﻿") ? body.substring(1) : body;
            } catch (IOException e) {
                last = e;
                if (attempt < attempts) {
                    log.debug("GET {} failed (attempt {}): {}", url, attempt, e.toString());
                    Thread.sleep(backoffMs * attempt);
                }
            }
        }
        throw last;
    }
}
