package com.aureusfinserve.security;

import com.aureusfinserve.common.Role;

/** Authenticated principal placed in the SecurityContext by {@link SessionAuthFilter}. */
public record AuthUser(Long userId, String name, Role role, Long investorId, Long sessionId) {

    public boolean isAdmin() {
        return role == Role.ADMIN;
    }

    public boolean isRm() {
        return role == Role.RM;
    }

    public boolean isInvestor() {
        return role == Role.INVESTOR;
    }
}
