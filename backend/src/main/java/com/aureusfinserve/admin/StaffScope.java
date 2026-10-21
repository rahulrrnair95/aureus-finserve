package com.aureusfinserve.admin;

import com.aureusfinserve.common.ApiException;
import com.aureusfinserve.investor.Investor;
import com.aureusfinserve.investor.InvestorRepository;
import com.aureusfinserve.security.AuthUser;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;

/** RM data scoping: an RM sees only clients where rm_id = their user id; ADMIN sees everything. */
@Component
@RequiredArgsConstructor
public class StaffScope {

    private final InvestorRepository investorRepo;

    /** Investor ids visible to the staff user (ADMIN: all). */
    public List<Long> clientIds(AuthUser u) {
        List<Investor> list = u.isAdmin() ? investorRepo.findAll() : investorRepo.findByRmId(u.userId());
        return list.stream().map(Investor::getId).toList();
    }

    /** null for ADMIN (= no restriction), otherwise the RM's client ids. */
    public List<Long> restriction(AuthUser u) {
        return u.isAdmin() ? null : clientIds(u);
    }

    public Investor client(AuthUser u, Long investorId) {
        Investor inv = investorRepo.findById(investorId).orElseThrow(() -> ApiException.notFound("Client"));
        if (!u.isAdmin() && !u.userId().equals(inv.getRmId())) {
            throw ApiException.forbidden("This client is assigned to another relationship manager");
        }
        return inv;
    }
}
