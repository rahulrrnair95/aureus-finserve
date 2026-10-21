package com.aureusfinserve.security;

import com.aureusfinserve.config.AppProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Set;

/**
 * Per-IP limit on /api/auth/** and the public OTP-issuing / lead / online-KYC endpoints (default 20 requests/minute).
 * Session-maintenance calls (/me, /logout) are excluded so normal app navigation is never throttled.
 * Per-user OTP limits are enforced in OtpService.
 */
public class RateLimitFilter extends OncePerRequestFilter {

    private static final Set<String> EXCLUDED = Set.of("/api/auth/me", "/api/auth/logout");

    private final RateLimiter limiter;
    private final AppProperties props;
    private final ObjectMapper mapper;

    public RateLimitFilter(RateLimiter limiter, AppProperties props, ObjectMapper mapper) {
        this.limiter = limiter;
        this.props = props;
        this.mapper = mapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        String p = request.getRequestURI();
        if (EXCLUDED.contains(p)) {
            return true;
        }
        return !(p.startsWith("/api/auth/") || p.startsWith("/api/public/leads") || p.startsWith("/api/public/kyc"));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String ip = RequestInfo.clientIp(req);
        if (!limiter.tryAcquire("ip:" + ip, props.getRateLimit().getAuthPerIpPerMinute(), 60_000)) {
            JsonErrorWriter.write(res, mapper, 429, "RATE_LIMITED",
                    "Too many requests. Please wait a minute and try again.");
            return;
        }
        chain.doFilter(req, res);
    }
}
