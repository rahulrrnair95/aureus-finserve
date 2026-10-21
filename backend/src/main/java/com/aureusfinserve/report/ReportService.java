package com.aureusfinserve.report;

import com.aureusfinserve.common.AssetClass;
import com.aureusfinserve.common.Fmt;
import com.aureusfinserve.portfolio.Fifo;
import com.aureusfinserve.portfolio.Folio;
import com.aureusfinserve.portfolio.MfTransaction;
import com.aureusfinserve.portfolio.PortfolioService;
import com.aureusfinserve.portfolio.TaxRules;
import com.aureusfinserve.publicsite.Scheme;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

/** Capital gains (FIFO per folio, Indian FY) and the list of financial years with data. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ReportService {

    public record GainRow(String schemeName, String folioNo, AssetClass assetClass, LocalDate purchaseDate,
                          LocalDate redemptionDate, BigDecimal units, BigDecimal costValue, BigDecimal saleValue,
                          BigDecimal gain, String term) {
    }

    public record Totals(BigDecimal stcg, BigDecimal ltcg, BigDecimal total) {
    }

    public record CapitalGains(String fy, List<GainRow> rows, Totals totals) {
    }

    private final PortfolioService portfolio;

    public CapitalGains capitalGains(PortfolioService.Book b, String fy) {
        LocalDate from = Fmt.fyStart(fy);
        LocalDate to = Fmt.fyEnd(fy);
        List<GainRow> rows = new ArrayList<>();
        double stcg = 0;
        double ltcg = 0;
        for (Folio f : b.folios()) {
            Scheme s = b.schemes().get(f.getSchemeId());
            if (s == null) {
                continue;
            }
            Fifo.State st = Fifo.replay(b.txns(f.getId()), to);
            for (Fifo.Realised r : st.realised) {
                if (r.saleDate().isBefore(from)) {
                    continue;
                }
                String term = TaxRules.term(s.getCategory(), r.purchaseDate(), r.saleDate());
                double gain = r.sale() - r.cost();
                if ("LTCG".equals(term)) {
                    ltcg += gain;
                } else {
                    stcg += gain;
                }
                rows.add(new GainRow(s.getName(), f.getFolioNo(), s.getCategory(), r.purchaseDate(), r.saleDate(),
                        Fmt.units(r.units()), Fmt.money(r.cost()), Fmt.money(r.sale()), Fmt.money(gain), term));
            }
        }
        rows.sort(Comparator.comparing(GainRow::redemptionDate).thenComparing(GainRow::schemeName)
                .thenComparing(GainRow::purchaseDate));
        return new CapitalGains(fy, rows, new Totals(Fmt.money(stcg), Fmt.money(ltcg), Fmt.money(stcg + ltcg)));
    }

    /** Current FY first, back to the FY of the earliest transaction. */
    public List<String> financialYears(PortfolioService.Book b) {
        LocalDate earliest = b.txnsByFolio().values().stream().flatMap(List::stream).map(MfTransaction::getDate)
                .min(Comparator.naturalOrder()).orElse(Fmt.today());
        List<String> out = new ArrayList<>();
        LocalDate d = Fmt.fyStart(Fmt.fyOf(Fmt.today()));
        LocalDate stop = Fmt.fyStart(Fmt.fyOf(earliest));
        while (!d.isBefore(stop)) {
            out.add(Fmt.fyOf(d));
            d = d.minusYears(1);
        }
        return out;
    }
}
