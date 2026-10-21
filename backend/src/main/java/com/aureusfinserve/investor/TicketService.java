package com.aureusfinserve.investor;

import com.aureusfinserve.audit.AuditService;
import com.aureusfinserve.common.ApiException;
import com.aureusfinserve.common.Fmt;
import com.aureusfinserve.common.NotificationType;
import com.aureusfinserve.common.TicketCategory;
import com.aureusfinserve.common.TicketStatus;
import com.aureusfinserve.investor.InvestorDtos.Comment;
import com.aureusfinserve.investor.InvestorDtos.TicketDto;
import com.aureusfinserve.investor.InvestorRepos.TicketCommentRepository;
import com.aureusfinserve.investor.InvestorRepos.TicketRepository;
import com.aureusfinserve.notification.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TicketService {

    private final TicketRepository ticketRepo;
    private final TicketCommentRepository commentRepo;
    private final InvestorRepository investorRepo;
    private final NotificationService notifications;
    private final AuditService audit;

    @Transactional
    public Ticket create(Long investorId, TicketCategory category, String subject, String description) {
        Ticket t = new Ticket();
        t.setInvestorId(investorId);
        t.setCategory(category);
        t.setSubject(subject.trim());
        t.setDescription(description == null ? null : description.trim());
        t.setStatus(TicketStatus.OPEN);
        t.setCreatedAt(Fmt.now());
        t.setUpdatedAt(Fmt.now());
        ticketRepo.save(t);
        t.setRef(String.format("SR%06d", t.getId()));
        ticketRepo.save(t);
        Investor inv = investorRepo.findById(investorId).orElse(null);
        if (inv != null && inv.getRmId() != null) {
            notifications.notifyUser(inv.getRmId(), NotificationType.GENERAL, "New service request " + t.getRef(),
                    inv.getName() + ": " + t.getSubject());
        }
        return t;
    }

    public List<TicketDto> list(Collection<Long> investorIds, TicketStatus status, boolean withInvestor) {
        List<Ticket> tickets = investorIds == null ? ticketRepo.findAllByOrderByCreatedAtDesc()
                : ticketRepo.findByInvestorIdInOrderByCreatedAtDesc(investorIds);
        if (status != null) {
            tickets = tickets.stream().filter(t -> t.getStatus() == status).toList();
        }
        return toDtos(tickets, withInvestor);
    }

    public List<TicketDto> toDtos(List<Ticket> tickets, boolean withInvestor) {
        if (tickets.isEmpty()) {
            return List.of();
        }
        Map<Long, List<Comment>> comments = new HashMap<>();
        commentRepo.findByTicketIdInOrderByCreatedAtAscIdAsc(tickets.stream().map(Ticket::getId).toList())
                .forEach(c -> comments.computeIfAbsent(c.getTicketId(), k -> new ArrayList<>())
                        .add(new Comment(c.getByName(), c.getText(), c.getCreatedAt())));
        Map<Long, Investor> investors = withInvestor
                ? investorRepo.findAllById(tickets.stream().map(Ticket::getInvestorId).collect(Collectors.toSet()))
                .stream().collect(Collectors.toMap(Investor::getId, Function.identity()))
                : Map.of();
        return tickets.stream().map(t -> new TicketDto(t.getId(), t.getRef(), t.getCategory(), t.getSubject(),
                t.getDescription(), t.getStatus(), t.getCreatedAt(), t.getUpdatedAt(),
                comments.getOrDefault(t.getId(), List.of()),
                withInvestor ? t.getInvestorId() : null,
                withInvestor && investors.containsKey(t.getInvestorId()) ? investors.get(t.getInvestorId()).getName() : null)).toList();
    }

    @Transactional
    public TicketDto staffUpdate(Long id, TicketStatus status, String comment, String byName, Collection<Long> scope) {
        Ticket t = ticketRepo.findById(id).orElseThrow(() -> ApiException.notFound("Ticket"));
        if (scope != null && !scope.contains(t.getInvestorId())) {
            throw ApiException.forbidden("This ticket belongs to another RM's client");
        }
        StringBuilder detail = new StringBuilder(t.getRef());
        if (status != null && status != t.getStatus()) {
            detail.append(" ").append(t.getStatus()).append(" -> ").append(status);
            t.setStatus(status);
        }
        if (comment != null && !comment.isBlank()) {
            TicketComment c = new TicketComment();
            c.setTicketId(t.getId());
            c.setByName(byName);
            c.setText(comment.trim().length() > 2000 ? comment.trim().substring(0, 2000) : comment.trim());
            c.setCreatedAt(Fmt.now());
            commentRepo.save(c);
            detail.append(" + comment");
        }
        t.setUpdatedAt(Fmt.now());
        ticketRepo.save(t);
        audit.log("TICKET_UPDATED", "TICKET", t.getId(), detail.toString());
        notifications.notifyInvestor(t.getInvestorId(), NotificationType.GENERAL, "Service request " + t.getRef() + " updated",
                "Status: " + t.getStatus() + (comment != null && !comment.isBlank() ? ". " + comment.trim() : ""));
        return toDtos(List.of(t), true).get(0);
    }
}
