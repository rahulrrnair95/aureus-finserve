package com.aureusfinserve.auth;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ActivationTokenRepository extends JpaRepository<ActivationToken, Long> {

    Optional<ActivationToken> findByTokenHash(String tokenHash);

    List<ActivationToken> findByUserIdAndUsedAtIsNull(Long userId);
}
