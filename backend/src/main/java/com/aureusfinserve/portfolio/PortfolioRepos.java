package com.aureusfinserve.portfolio;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public final class PortfolioRepos {

    private PortfolioRepos() {
    }

    public interface FolioRepository extends JpaRepository<Folio, Long> {
        List<Folio> findByInvestorIdIn(Collection<Long> investorIds);

        List<Folio> findByInvestorId(Long investorId);

        Optional<Folio> findByInvestorIdAndSchemeId(Long investorId, Long schemeId);

        Optional<Folio> findFirstByFolioNo(String folioNo);
    }

    public interface MfTransactionRepository extends JpaRepository<MfTransaction, Long> {
        List<MfTransaction> findByInvestorIdInOrderByDateAscIdAsc(Collection<Long> investorIds);

        List<MfTransaction> findByFolioIdOrderByDateAscIdAsc(Long folioId);

        List<MfTransaction> findAllByOrderByDateAscIdAsc();

        boolean existsByFolioIdAndDateAndTypeAndUnits(Long folioId, java.time.LocalDate date,
                                                      com.aureusfinserve.common.TxnType type, java.math.BigDecimal units);
    }

    public interface SipRegistrationRepository extends JpaRepository<SipRegistration, Long> {
        List<SipRegistration> findByInvestorIdInOrderByIdAsc(Collection<Long> investorIds);

        List<SipRegistration> findAllByOrderByIdAsc();
    }
}
