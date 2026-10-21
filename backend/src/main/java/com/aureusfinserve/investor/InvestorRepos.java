package com.aureusfinserve.investor;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

/** Small repositories for investor sub-records. */
public final class InvestorRepos {

    private InvestorRepos() {
    }

    public interface NomineeRepository extends JpaRepository<Nominee, Long> {
        List<Nominee> findByInvestorId(Long investorId);
    }

    public interface BankAccountRepository extends JpaRepository<BankAccount, Long> {
        List<BankAccount> findByInvestorIdOrderByIdAsc(Long investorId);
    }

    public interface MandateRepository extends JpaRepository<Mandate, Long> {
        List<Mandate> findByInvestorId(Long investorId);
    }

    public interface GoalRepository extends JpaRepository<Goal, Long> {
        List<Goal> findByInvestorIdInOrderByIdAsc(Collection<Long> investorIds);
    }

    public interface TicketRepository extends JpaRepository<Ticket, Long> {
        List<Ticket> findByInvestorIdInOrderByCreatedAtDesc(Collection<Long> investorIds);

        List<Ticket> findAllByOrderByCreatedAtDesc();
    }

    public interface TicketCommentRepository extends JpaRepository<TicketComment, Long> {
        List<TicketComment> findByTicketIdOrderByCreatedAtAscIdAsc(Long ticketId);

        List<TicketComment> findByTicketIdInOrderByCreatedAtAscIdAsc(Collection<Long> ticketIds);
    }
}
