package com.aureusfinserve.security;

import com.aureusfinserve.auth.SessionService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Resolves "Authorization: Bearer &lt;opaque token&gt;" against the user_session table.
 * Invalid / expired tokens leave the request anonymous and record the reason so the entry point can
 * answer 401 SESSION_EXPIRED vs UNAUTHORIZED.
 */
public class SessionAuthFilter extends OncePerRequestFilter {

    public static final String AUTH_ERROR_ATTR = "aureus.authError";

    private final SessionService sessions;

    public SessionAuthFilter(SessionService sessions) {
        this.sessions = sessions;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String header = req.getHeader("Authorization");
        if (header != null && header.regionMatches(true, 0, "Bearer ", 0, 7)) {
            String token = header.substring(7).trim();
            SessionService.AuthResult result = sessions.authenticate(token);
            if (result.user() != null) {
                AuthUser u = result.user();
                var auth = new UsernamePasswordAuthenticationToken(u, null,
                        List.of(new SimpleGrantedAuthority("ROLE_" + u.role().name())));
                SecurityContextHolder.getContext().setAuthentication(auth);
            } else {
                req.setAttribute(AUTH_ERROR_ATTR, result.errorCode());
            }
        }
        try {
            chain.doFilter(req, res);
        } finally {
            SecurityContextHolder.clearContext();
        }
    }
}
