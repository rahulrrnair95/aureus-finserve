package com.aureusfinserve.investor;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface InvestorRepository extends JpaRepository<Investor, Long> {

    Optional<Investor> findFirstByPanHash(String panHash);

    List<Investor> findByFamilyHeadId(Long familyHeadId);

    List<Investor> findByRmId(Long rmId);

    List<Investor> findByIdIn(Collection<Long> ids);
}
