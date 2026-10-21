package com.aureusfinserve.security;

import com.aureusfinserve.common.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Optional;

/** Static access to the authenticated {@link AuthUser}. */
public final class CurrentUser {

    private CurrentUser() {
    }

    public static Optional<AuthUser> optional() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        if (a != null && a.getPrincipal() instanceof AuthUser u) {
            return Optional.of(u);
        }
        return Optional.empty();
    }

    public static AuthUser get() {
        return optional().orElseThrow(() ->
                new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Please log in to continue"));
    }
}
