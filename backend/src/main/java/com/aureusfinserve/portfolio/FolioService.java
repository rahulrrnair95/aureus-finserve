package com.aureusfinserve.portfolio;

import com.aureusfinserve.common.Fmt;
import com.aureusfinserve.portfolio.PortfolioRepos.FolioRepository;
import com.aureusfinserve.publicsite.PublicRepos.SchemeRepository;
import com.aureusfinserve.publicsite.Scheme;
import com.aureusfinserve.security.CryptoService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Finds or opens a folio. An investor's folios in the same AMC share one folio number. */
@Service
@RequiredArgsConstructor
public class FolioService {

    private final FolioRepository folioRepo;
    private final SchemeRepository schemeRepo;
    private final CryptoService crypto;

    @Transactional
    public Folio getOrCreate(Long investorId, Long schemeId) {
        return folioRepo.findByInvestorIdAndSchemeId(investorId, schemeId).orElseGet(() -> create(investorId, schemeId, null));
    }

    @Transactional
    public Folio create(Long investorId, Long schemeId, String folioNo) {
        Scheme scheme = schemeRepo.findById(schemeId).orElseThrow();
        String no = folioNo;
        if (no == null) {
            Map<Long, Scheme> schemes = schemeRepo.findAll().stream()
                    .collect(Collectors.toMap(Scheme::getId, Function.identity()));
            no = folioRepo.findByInvestorId(investorId).stream()
                    .filter(f -> schemes.containsKey(f.getSchemeId())
                            && schemes.get(f.getSchemeId()).getAmc().equals(scheme.getAmc()))
                    .map(Folio::getFolioNo).findFirst().orElse(null);
        }
        if (no == null) {
            do {
                no = String.format("%07d/%02d", 1_000_000 + crypto.random().nextInt(9_000_000), crypto.random().nextInt(100));
            } while (folioRepo.findFirstByFolioNo(no).isPresent());
        }
        Folio f = new Folio();
        f.setFolioNo(no);
        f.setInvestorId(investorId);
        f.setSchemeId(schemeId);
        f.setCreatedAt(Fmt.now());
        return folioRepo.save(f);
    }
}
