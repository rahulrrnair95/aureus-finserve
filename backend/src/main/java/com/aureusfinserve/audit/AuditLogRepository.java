package com.aureusfinserve.audit;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.repository.Repository;

import java.util.List;

/**
 * Deliberately extends the bare {@link Repository}: only insert and read methods are exposed,
 * so there is no code path that can update or delete audit entries.
 */
public interface AuditLogRepository extends Repository<AuditLog, Long> {

    AuditLog save(AuditLog log);

    long count();

    Page<AuditLog> findAll(Specification<AuditLog> spec, Pageable pageable);

    List<AuditLog> findAll(Specification<AuditLog> spec, org.springframework.data.domain.Sort sort);
}
