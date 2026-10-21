package com.aureusfinserve.report;

import com.aureusfinserve.audit.AuditService;
import com.aureusfinserve.common.ApiException;
import com.aureusfinserve.common.Fmt;
import com.aureusfinserve.portfolio.PortfolioDtos.Holding;
import com.aureusfinserve.portfolio.PortfolioDtos.Summary;
import com.aureusfinserve.portfolio.PortfolioDtos.Txn;
import com.aureusfinserve.portfolio.PortfolioService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Builds statement / transactions / capital-gains downloads as PDF or XLSX. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ReportDownloadService {

    private static final MediaType XLSX =
            MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    private final PortfolioService portfolio;
    private final ReportService reports;
    private final ReportExporter exporter;
    private final AuditService audit;

    public ResponseEntity<byte[]> download(String kind, String format, PortfolioService.Book b, String forWhom,
                                           String fy, LocalDate from, LocalDate to) {
        String fmt = format == null ? "pdf" : format.toLowerCase(Locale.ROOT);
        if (!fmt.equals("pdf") && !fmt.equals("xlsx")) {
            throw ApiException.validation("format", "format must be pdf or xlsx");
        }
        ReportExporter.Report r = switch (kind) {
            case "statement" -> statement(b, forWhom);
            case "transactions" -> transactions(b, forWhom, from, to);
            case "capital-gains" -> capitalGains(b, forWhom, fy == null || fy.isBlank() ? Fmt.fyOf(Fmt.today()) : fy);
            default -> throw ApiException.notFound("Report");
        };
        byte[] bytes = fmt.equals("pdf") ? exporter.pdf(r) : exporter.xlsx(r);
        audit.log("REPORT_EXPORTED", "REPORT", kind, kind + " " + fmt + " for " + forWhom
                + (fy != null ? " FY " + fy : "") + (from != null || to != null ? " " + from + ".." + to : ""));
        String filename = "aureus-" + kind + "-" + LocalDate.now().format(DateTimeFormatter.BASIC_ISO_DATE) + "." + fmt;
        return ResponseEntity.ok()
                .contentType(fmt.equals("pdf") ? MediaType.APPLICATION_PDF : XLSX)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(filename).build().toString())
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(bytes);
    }

    private ReportExporter.Report statement(PortfolioService.Book b, String forWhom) {
        Summary s = portfolio.summary(b);
        List<String[]> summary = List.of(
                new String[]{"Investor(s)", forWhom},
                new String[]{"Valuation as of", s.asOf().toString()},
                new String[]{"Current value (Rs)", String.format("%,.2f", s.currentValue())},
                new String[]{"Amount invested (Rs)", String.format("%,.2f", s.invested())},
                new String[]{"Gain / loss (Rs)", String.format("%,.2f", s.gain())},
                new String[]{"XIRR", s.xirr() == null ? "n/a" : s.xirr() + "%"},
                new String[]{"Active SIPs", s.activeSips() + " (Rs " + String.format("%,.2f", s.monthlySipAmount()) + " / month)"});
        List<List<Object>> rows = new ArrayList<>();
        for (Holding h : portfolio.holdings(b)) {
            rows.add(List.of(h.schemeName(), h.folioNo(), h.investorName(), h.category().name(), h.units(), h.nav(),
                    h.value(), h.invested(), h.gain(), h.xirr() == null ? "" : h.xirr() + "%"));
        }
        return new ReportExporter.Report("Portfolio Statement", null, summary,
                List.of("Scheme", "Folio", "Investor", "Asset class", "Units", "NAV", "Value", "Invested", "Gain", "XIRR"), rows);
    }

    private ReportExporter.Report transactions(PortfolioService.Book b, String forWhom, LocalDate from, LocalDate to) {
        List<List<Object>> rows = new ArrayList<>();
        for (Txn t : portfolio.transactions(b, from, to, null)) {
            rows.add(List.of(t.date(), t.schemeName(), t.folioNo(), t.investorName(), t.type().name(), t.amount(),
                    t.units(), t.nav()));
        }
        String period = (from == null ? "inception" : from.toString()) + " to " + (to == null ? "today" : to.toString());
        return new ReportExporter.Report("Transaction Statement", "Investor(s): " + forWhom + " | Period: " + period,
                List.of(), List.of("Date", "Scheme", "Folio", "Investor", "Type", "Amount", "Units", "NAV"), rows);
    }

    private ReportExporter.Report capitalGains(PortfolioService.Book b, String forWhom, String fy) {
        ReportService.CapitalGains cg = reports.capitalGains(b, fy);
        List<List<Object>> rows = new ArrayList<>();
        for (ReportService.GainRow g : cg.rows()) {
            rows.add(List.of(g.schemeName(), g.folioNo(), g.assetClass().name(), g.purchaseDate(), g.redemptionDate(),
                    g.units(), g.costValue(), g.saleValue(), g.gain(), g.term()));
        }
        List<String[]> summary = List.of(
                new String[]{"Investor(s)", forWhom},
                new String[]{"Financial year", fy + " (" + Fmt.fyStart(fy) + " to " + Fmt.fyEnd(fy) + ")"},
                new String[]{"Short-term gains (Rs)", String.format("%,.2f", cg.totals().stcg())},
                new String[]{"Long-term gains (Rs)", String.format("%,.2f", cg.totals().ltcg())},
                new String[]{"Total (Rs)", String.format("%,.2f", cg.totals().total())});
        return new ReportExporter.Report("Capital Gains Statement (FIFO, indicative)",
                "Indicative computation without indexation / grandfathering; consult your tax adviser before filing.",
                summary, List.of("Scheme", "Folio", "Asset class", "Purchase date", "Redemption date", "Units", "Cost",
                "Sale value", "Gain", "Term"), rows);
    }
}
