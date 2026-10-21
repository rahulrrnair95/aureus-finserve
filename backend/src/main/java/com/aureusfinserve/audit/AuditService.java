package com.aureusfinserve.audit;

import com.aureusfinserve.common.Fmt;
import com.aureusfinserve.security.AuthUser;
import com.aureusfinserve.security.CurrentUser;
import com.aureusfinserve.security.RequestInfo;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Writes audit entries in their own transaction so that a failed business operation (e.g. a wrong
 * password that is rejected) is still recorded.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuditService {

    private final AuditLogRepository repo;

    /** Audit as the currently authenticated user (or anonymous). */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void log(String action, String entity, Object entityId, String detail) {
        AuthUser u = CurrentUser.optional().orElse(null);
        write(u == null ? null : u.userId(), u == null ? null : u.name(), u == null ? null : u.role().name(),
                action, entity, entityId, detail);
    }

    /** Audit on behalf of an explicit user (login flows, where nobody is authenticated yet). */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void logAs(Long userId, String userName, String role, String action, String entity, Object entityId,
                      String detail) {
        write(userId, userName, role, action, entity, entityId, detail);
    }

    private void write(Long userId, String userName, String role, String action, String entity, Object entityId,
                       String detail) {
        AuditLog a = new AuditLog();
        a.setAt(Fmt.now());
        a.setUserId(userId);
        a.setUserName(userName);
        a.setRole(role);
        a.setAction(action);
        a.setEntity(entity);
        a.setEntityId(entityId == null ? null : String.valueOf(entityId));
        a.setDetail(detail == null ? null : detail.length() > 2000 ? detail.substring(0, 2000) : detail);
        a.setIp(RequestInfo.ip());
        try {
            repo.save(a);
        } catch (RuntimeException e) {
            log.error("Failed to write audit entry {} {}", action, entity, e);
        }
    }
}
