package com.aureusfinserve.audit;

import com.aureusfinserve.admin.AdminDtos.AuditPage;
import com.aureusfinserve.admin.AdminDtos.AuditRow;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Read-only audit search and CSV export. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AuditQueryService {

    private static final Sort NEWEST = Sort.by(Sort.Order.desc("at"), Sort.Order.desc("id"));

    private final AuditLogRepository repo;

    private Specification<AuditLog> spec(String q, String action, LocalDate from, LocalDate to) {
        return (root, query, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            if (q != null && !q.isBlank()) {
                String like = "%" + q.trim().toLowerCase(Locale.ROOT) + "%";
                ps.add(cb.or(cb.like(cb.lower(root.get("userName")), like), cb.like(cb.lower(root.get("detail")), like),
                        cb.like(cb.lower(root.get("entity")), like), cb.like(cb.lower(root.get("entityId")), like),
                        cb.like(cb.lower(root.get("ip")), like), cb.like(cb.lower(root.get("action")), like)));
            }
            if (action != null && !action.isBlank()) {
                ps.add(cb.equal(root.get("action"), action.trim().toUpperCase(Locale.ROOT)));
            }
            if (from != null) {
                ps.add(cb.greaterThanOrEqualTo(root.get("at"), from.atStartOfDay()));
            }
            if (to != null) {
                ps.add(cb.lessThan(root.get("at"), to.plusDays(1).atStartOfDay()));
            }
            return cb.and(ps.toArray(new Predicate[0]));
        };
    }

    public AuditPage search(String q, String action, LocalDate from, LocalDate to, int page, int size) {
        int sz = Math.max(1, Math.min(size, 500));
        Page<AuditLog> p = repo.findAll(spec(q, action, from, to), PageRequest.of(Math.max(0, page), sz, NEWEST));
        return new AuditPage(p.getContent().stream().map(AuditQueryService::row).toList(), p.getTotalElements());
    }

    private static AuditRow row(AuditLog a) {
        return new AuditRow(a.getId(), a.getAt(), a.getUserId(), a.getUserName(), a.getRole(), a.getAction(), a.getEntity(),
                a.getEntityId(), a.getDetail(), a.getIp());
    }

    public byte[] csv(String q, String action, LocalDate from, LocalDate to) {
        StringBuilder sb = new StringBuilder("id,at,userId,userName,role,action,entity,entityId,detail,ip\n");
        DateTimeFormatter f = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");
        for (AuditLog a : repo.findAll(spec(q, action, from, to), NEWEST)) {
            sb.append(a.getId()).append(',').append(a.getAt().format(f)).append(',')
                    .append(a.getUserId() == null ? "" : a.getUserId()).append(',')
                    .append(esc(a.getUserName())).append(',').append(esc(a.getRole())).append(',')
                    .append(esc(a.getAction())).append(',').append(esc(a.getEntity())).append(',')
                    .append(esc(a.getEntityId())).append(',').append(esc(a.getDetail())).append(',')
                    .append(esc(a.getIp())).append('\n');
        }
        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    /** CSV escaping, also neutralising spreadsheet formula injection. */
    private static String esc(String s) {
        if (s == null) {
            return "";
        }
        String v = s;
        if (!v.isEmpty() && "=+-@".indexOf(v.charAt(0)) >= 0) {
            v = "'" + v;
        }
        if (v.contains(",") || v.contains("\"") || v.contains("\n") || v.contains("\r")) {
            v = "\"" + v.replace("\"", "\"\"") + "\"";
        }
        return v;
    }
}
