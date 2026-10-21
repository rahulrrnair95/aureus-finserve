package com.aureusfinserve.config;

import com.aureusfinserve.auth.SessionService;
import com.aureusfinserve.security.JsonErrorWriter;
import com.aureusfinserve.security.RateLimitFilter;
import com.aureusfinserve.security.RateLimiter;
import com.aureusfinserve.security.SessionAuthFilter;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, SessionService sessions, RateLimiter limiter,
                                           AppProperties props, ObjectMapper mapper) throws Exception {
        // Filters are created here (not as @Components) so Spring Boot does not also register them
        // as plain servlet filters, which would run them twice.
        SessionAuthFilter sessionFilter = new SessionAuthFilter(sessions);
        RateLimitFilter rateLimitFilter = new RateLimitFilter(limiter, props, mapper);

        http
                // CSRF protection is disabled on purpose: the API never uses cookies for authentication.
                // Every protected call must carry an "Authorization: Bearer <token>" header, which a
                // cross-site form/request cannot attach, so CSRF attacks are not applicable.
                .csrf(AbstractHttpConfigurer::disable)
                .cors(c -> c.configurationSource(corsConfigurationSource(props)))
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .requestCache(AbstractHttpConfigurer::disable)
                .headers(h -> h
                        .httpStrictTransportSecurity(hsts -> hsts.includeSubDomains(true).maxAgeInSeconds(31_536_000))
                        .contentTypeOptions(c -> { })
                        .frameOptions(f -> f.deny())
                        .referrerPolicy(r -> r.policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.NO_REFERRER))
                        .contentSecurityPolicy(csp -> csp.policyDirectives(
                                "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'")))
                .authorizeHttpRequests(a -> a
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/api/auth/me", "/api/auth/logout",
                                "/api/auth/change-password", "/api/auth/change-password/**").authenticated()
                        .requestMatchers("/api/auth/**", "/api/public/**", "/error").permitAll()
                        .requestMatchers("/api/investor/**").hasRole("INVESTOR")
                        .requestMatchers("/api/admin/**").hasAnyRole("RM", "ADMIN")
                        .anyRequest().denyAll())
                .exceptionHandling(e -> e
                        .authenticationEntryPoint((req, res, ex) -> {
                            Object code = req.getAttribute(SessionAuthFilter.AUTH_ERROR_ATTR);
                            if ("SESSION_EXPIRED".equals(code)) {
                                JsonErrorWriter.write(res, mapper, 401, "SESSION_EXPIRED",
                                        "Your session has expired. Please log in again.");
                            } else {
                                JsonErrorWriter.write(res, mapper, 401, "UNAUTHORIZED", "Please log in to continue");
                            }
                        })
                        .accessDeniedHandler((req, res, ex) -> JsonErrorWriter.write(res, mapper, 403, "FORBIDDEN",
                                "You do not have permission to perform this action")))
                .addFilterBefore(rateLimitFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterAfter(sessionFilter, RateLimitFilter.class);
        return http.build();
    }

    private CorsConfigurationSource corsConfigurationSource(AppProperties props) {
        CorsConfiguration cfg = new CorsConfiguration();
        cfg.setAllowedOrigins(Arrays.stream(props.getFrontendUrl().split(",")).map(String::trim).toList());
        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        cfg.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-Device-Id", "Accept"));
        cfg.setExposedHeaders(List.of("Content-Disposition", "X-Cas-Password"));
        cfg.setAllowCredentials(false);
        cfg.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource src = new UrlBasedCorsConfigurationSource();
        src.registerCorsConfiguration("/api/**", cfg);
        return src;
    }
}
