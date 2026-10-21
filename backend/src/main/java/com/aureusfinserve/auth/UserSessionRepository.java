package com.aureusfinserve.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface UserSessionRepository extends JpaRepository<UserSession, Long> {

    Optional<UserSession> findByTokenHash(String tokenHash);

    @Modifying
    @Query("update UserSession s set s.revoked = true, s.revokedReason = :reason where s.userId = :userId and s.revoked = false")
    int revokeAllForUser(@Param("userId") Long userId, @Param("reason") String reason);

    @Modifying
    @Query("update UserSession s set s.revoked = true, s.revokedReason = :reason where s.userId = :userId and s.revoked = false and s.id <> :keepId")
    int revokeOthersForUser(@Param("userId") Long userId, @Param("keepId") Long keepId, @Param("reason") String reason);
}
