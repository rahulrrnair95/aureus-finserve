package com.aureusfinserve.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/** Client IP (X-Forwarded-For aware) and X-Device-Id of the current request. */
public final class RequestInfo {

    public static final String DEVICE_HEADER = "X-Device-Id";

    private RequestInfo() {
    }

    public static String clientIp(HttpServletRequest req) {
        String xff = req.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            String first = xff.split(",")[0].trim();
            if (!first.isEmpty()) {
                return truncate(first, 64);
            }
        }
        String real = req.getHeader("X-Real-IP");
        if (real != null && !real.isBlank()) {
            return truncate(real.trim(), 64);
        }
        return req.getRemoteAddr();
    }

    public static String ip() {
        HttpServletRequest r = current();
        return r == null ? null : clientIp(r);
    }

    public static String deviceId() {
        HttpServletRequest r = current();
        if (r == null) {
            return null;
        }
        String d = r.getHeader(DEVICE_HEADER);
        if (d == null || d.isBlank()) {
            return null;
        }
        return truncate(d.trim(), 100);
    }

    private static HttpServletRequest current() {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes sra) {
            return sra.getRequest();
        }
        return null;
    }

    private static String truncate(String s, int n) {
        return s.length() > n ? s.substring(0, n) : s;
    }
}
