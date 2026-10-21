package com.aureusfinserve.auth;

import com.aureusfinserve.common.Role;

/** Contract "User" object. */
public record UserDto(Long id, String name, Role role, String email, String mobileMasked, String panMasked,
                      Long investorId, String euin, int idleTimeoutMinutes) {
}
