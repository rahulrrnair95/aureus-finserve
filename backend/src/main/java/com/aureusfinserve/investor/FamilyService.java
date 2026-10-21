package com.aureusfinserve.investor;

import com.aureusfinserve.common.ApiException;
import com.aureusfinserve.common.Relation;
import com.aureusfinserve.security.AuthUser;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Family scoping. An investor sees themself, members whose family head is them, and members that share
 * the same family head as them.
 */
@Service
@RequiredArgsConstructor
public class FamilyService {

    private final InvestorRepository investorRepo;

    public Investor self(AuthUser u) {
        if (u.investorId() == null) {
            throw ApiException.forbidden("No investor profile linked to this login");
        }
        return investorRepo.findById(u.investorId()).orElseThrow(() -> ApiException.notFound("Investor"));
    }

    /** Self first, then other members. */
    public List<Investor> family(Investor self) {
        Map<Long, Investor> out = new LinkedHashMap<>();
        out.put(self.getId(), self);
        investorRepo.findByFamilyHeadId(self.getId()).forEach(i -> out.putIfAbsent(i.getId(), i));
        if (self.getFamilyHeadId() != null) {
            investorRepo.findByFamilyHeadId(self.getFamilyHeadId()).forEach(i -> out.putIfAbsent(i.getId(), i));
        }
        return new ArrayList<>(out.values());
    }

    public List<Long> familyIds(AuthUser u) {
        return family(self(u)).stream().map(Investor::getId).toList();
    }

    /** member = null/"" (self), "all", or an investor id from the family. */
    public List<Long> resolveMember(AuthUser u, String member) {
        Investor self = self(u);
        if (member == null || member.isBlank() || member.equalsIgnoreCase("self")) {
            return List.of(self.getId());
        }
        List<Investor> fam = family(self);
        if (member.equalsIgnoreCase("all")) {
            return fam.stream().map(Investor::getId).toList();
        }
        long id;
        try {
            id = Long.parseLong(member.trim());
        } catch (NumberFormatException e) {
            throw ApiException.validation("member", "member must be an investor id or 'all'");
        }
        if (fam.stream().noneMatch(i -> i.getId() == id)) {
            throw ApiException.forbidden("This investor is not part of your family");
        }
        return List.of(id);
    }

    public void assertInFamily(AuthUser u, Long investorId) {
        if (investorId == null || !familyIds(u).contains(investorId)) {
            throw ApiException.forbidden("This investor is not part of your family");
        }
    }

    public static String relationLabel(Investor self, Investor other) {
        if (self.getId().equals(other.getId())) {
            return Relation.SELF.name();
        }
        Relation r = other.getRelation();
        return r == null || r == Relation.SELF ? Relation.OTHER.name() : r.name();
    }
}
