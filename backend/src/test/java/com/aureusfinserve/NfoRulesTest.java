package com.aureusfinserve;

import com.aureusfinserve.common.Risk;
import com.aureusfinserve.nfo.Nfo;
import com.aureusfinserve.nfo.NfoRules;
import com.aureusfinserve.nfo.NfoRules.Candidate;
import com.aureusfinserve.nfo.NfoRules.Category;
import com.aureusfinserve.nfo.NfoRules.Status;
import com.aureusfinserve.nfo.NfoService;
import com.aureusfinserve.sync.AmfiData;
import com.aureusfinserve.sync.AmfiData.SchemeMasterRow;
import com.aureusfinserve.sync.NfoSync;
import com.aureusfinserve.sync.SchemeDataSync.Details;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** NFO status / close-date estimate, scheme master grouping, category, AMC name and the import merge rules. */
class NfoRulesTest {

    static final LocalDate TODAY = LocalDate.of(2026, 10, 20);

    @Test
    void statusUpcomingOpenEstimatedAndClosed() {
        // upcoming: opens in 2 days, close unknown -> latest close = open + 15
        assertThat(NfoRules.status(TODAY.plusDays(2), null, TODAY)).isEqualTo(Status.UPCOMING);
        assertThat(NfoRules.opensInDays(TODAY.plusDays(2), TODAY)).isEqualTo(2);
        assertThat(NfoRules.closesBy(TODAY.plusDays(2), null)).isEqualTo(TODAY.plusDays(17));
        // open with a confirmed close date
        assertThat(NfoRules.status(TODAY.minusDays(3), TODAY.plusDays(4), TODAY)).isEqualTo(Status.OPEN);
        assertThat(NfoRules.daysLeft(TODAY.minusDays(3), TODAY.plusDays(4), TODAY)).isEqualTo(4);
        // closes today -> still open, 0 days left
        assertThat(NfoRules.status(TODAY.minusDays(5), TODAY, TODAY)).isEqualTo(Status.OPEN);
        assertThat(NfoRules.daysLeft(TODAY.minusDays(5), TODAY, TODAY)).isZero();
        // opens today
        assertThat(NfoRules.status(TODAY, null, TODAY)).isEqualTo(Status.OPEN);
        assertThat(NfoRules.daysLeft(TODAY, null, TODAY)).isEqualTo(15);
        // estimated close: open 15 days ago, no close date -> last possible day is today
        assertThat(NfoRules.status(TODAY.minusDays(15), null, TODAY)).isEqualTo(Status.OPEN);
        assertThat(NfoRules.status(TODAY.minusDays(16), null, TODAY)).isEqualTo(Status.CLOSED);
        assertThat(NfoRules.daysLeft(TODAY.minusDays(16), null, TODAY)).isNull();
        // closed with a confirmed date
        assertThat(NfoRules.status(LocalDate.of(2026, 10, 5), LocalDate.of(2026, 10, 19), TODAY)).isEqualTo(Status.CLOSED);
        // recently closed window: 30 days after closing
        assertThat(NfoRules.isPublicWindow(TODAY.minusDays(40), TODAY.minusDays(30), TODAY)).isTrue();
        assertThat(NfoRules.isPublicWindow(TODAY.minusDays(40), TODAY.minusDays(31), TODAY)).isFalse();
    }

    @Test
    void classifyPutsEtfsFofsFmpsInOther() {
        assertThat(NfoRules.classify("Open Ended", "Equity Schemes - Large & Mid Cap Fund", "Choice Large & Mid Cap Fund"))
                .isEqualTo(new Category("EQUITY", "Large & Mid Cap"));
        assertThat(NfoRules.classify("Open Ended", "Index Funds - Equity Funds", "UTI Nifty India New Age Consumption Index Fund"))
                .isEqualTo(new Category("EQUITY", "Index"));
        assertThat(NfoRules.classify("Open Ended", "Index Funds - Debt Funds", "Tata CRISIL-IBX Financial Services 3-6 Months Debt Index Fund"))
                .isEqualTo(new Category("DEBT", "Index (Debt)"));
        assertThat(NfoRules.classify("Open Ended", "Index Funds - Hybrid Fund", "HDFC Nifty LargeMidcap250 Plus 8-13 yr G-sec 70 30 Index Fund"))
                .isEqualTo(new Category("HYBRID", "Index (Hybrid)"));
        assertThat(NfoRules.classify("Open Ended", "Equity Schemes - Thematic Fund", "Bajaj Finserv Business Cycle Fund"))
                .isEqualTo(new Category("EQUITY", "Sectoral / Thematic"));
        assertThat(NfoRules.classify("Open Ended", "Income/Debt Oriented Schemes - Liquid Fund", "Carnelian Liquid Fund"))
                .isEqualTo(new Category("DEBT", "Liquid"));
        assertThat(NfoRules.classify("Open Ended", "Exchange Traded Funds (ETFs) - Equity ETF", "HDFC FTSE India Equity ETF").assetClass())
                .isEqualTo("OTHER");
        assertThat(NfoRules.classify("Open Ended", "Fund of Funds Scheme (Domestic) - Fund of Funds Scheme (Domestic)", "Shriram Gold ETF Passive FOF"))
                .isEqualTo(new Category("OTHER", "Fund of Funds"));
        assertThat(NfoRules.classify("Close Ended", "Income/Debt Oriented Schemes - Fixed Term Plan", "Mirae Asset Fixed Maturity Plan Series VI"))
                .isEqualTo(new Category("OTHER", "Fixed Maturity Plan"));
        assertThat(NfoRules.classify("Open Ended", "Life Cycle Funds - Life Cycle Fund with Maturity of 30 Years", "Mirae Asset Life Cycle Fund 2056"))
                .isEqualTo(new Category("OTHER", "Life Cycle Fund"));
    }

    @Test
    void minimumAmountAndAmcNames() {
        assertThat(NfoRules.minAmount("Rs. 500/- and any amount thereafter.")).isEqualByComparingTo("500");
        assertThat(NfoRules.minAmount("Rs. 100/- per application and multiples of Re. 1")).isEqualByComparingTo("100");
        assertThat(NfoRules.minAmount("For Lumpsum  Minimum of Rs.500/- and in multiples of Re.1")).isEqualByComparingTo("500");
        assertThat(NfoRules.minAmount("Rs. 1,000 and in multiples of Re. 1/-thereafter")).isEqualByComparingTo("1000");
        assertThat(NfoRules.minAmount("5000")).isEqualByComparingTo("5000");
        assertThat(NfoRules.minAmount("")).isNull();
        assertThat(NfoRules.minAmount("Any amount")).isNull();

        List<String> partners = List.of("HDFC Mutual Fund", "The Wealth Company Mutual Fund", "quant Mutual Fund", "UTI Mutual Fund");
        assertThat(NfoRules.amcDisplay("HDFC Asset Management Company Limited", partners)).isEqualTo("HDFC Mutual Fund");
        assertThat(NfoRules.amcDisplay("Wealth Company Asset Management Holdings Private Limited", partners)).isEqualTo("The Wealth Company Mutual Fund");
        assertThat(NfoRules.amcDisplay("quant Money Managers Limited", partners)).isEqualTo("quant Mutual Fund");
        assertThat(NfoRules.amcDisplay("UTI Asset Mgmt. Co. Ltd.", partners)).isEqualTo("UTI Mutual Fund");
        assertThat(NfoRules.amcDisplay("Choice AMC Private Limited", partners)).isEqualTo("Choice AMC");
        assertThat(NfoRules.shortAmcName("Shriram Asset Management Co. Ltd.")).isEqualTo("Shriram Asset Management");
        assertThat(NfoRules.shortAmcName("Mirae Asset Investment Managers (India) Pvt. Ltd")).isEqualTo("Mirae Asset Investment Managers (India)");
        assertThat(NfoRules.shortAmcName("PGIM India Asset Management Private Limite")).isEqualTo("PGIM India Asset Management");
        assertThat(NfoRules.shortAmcName("ASK ASSET MANAGEMENT PRIVATE LIMITED")).isEqualTo("ASK Asset Management");
    }

    @Test
    void nfoSchemeNamesKeepTheirAcronyms() {
        assertThat(NfoRules.schemeName("Zerodha BSE TOP 10 BANKS ETF")).isEqualTo("Zerodha BSE Top 10 Banks ETF");
        assertThat(NfoRules.schemeName("JioBlackRock Income Plus Arbitrage Omni FOF")).isEqualTo("JioBlackRock Income Plus Arbitrage Omni FoF");
        assertThat(NfoRules.schemeName("Mirae Asset Fixed Maturity Plan   Series VI  3 to 6 Months"))
                .isEqualTo("Mirae Asset Fixed Maturity Plan Series VI 3 to 6 Months");
        assertThat(NfoRules.schemeName("Aditya Birla Sun Life Fixed Maturity Plan-Series VB (136 Days)"))
                .isEqualTo("Aditya Birla Sun Life Fixed Maturity Plan-Series VB (136 Days)");
        assertThat(NfoRules.schemeName("Nippon India CRISIL-IBX FAR Gilt ETF")).isEqualTo("Nippon India CRISIL-IBX FAR Gilt ETF");
        assertThat(NfoRules.schemeName("LAKSHYA OVERNIGHT FUND")).isEqualTo("Lakshya Overnight Fund");
        assertThat(NfoRules.schemeName("Choice Large & Mid Cap Fund")).isEqualTo("Choice Large & Mid Cap Fund");
    }

    private static SchemeMasterRow row(String amc, String code, String name, String nav, String min, LocalDate launch, LocalDate closure) {
        return new SchemeMasterRow(amc, code, name, "Open Ended", "Equity Schemes - Large & Mid Cap Fund", nav, min, launch, closure);
    }

    @Test
    void schemeMasterRowsAreGroupedPerScheme() {
        String csv = "AMC,Code,Scheme Name,Scheme Type,Scheme Category,Scheme NAV Name,Scheme Minimum Amount,Launch Date, Closure Date,ISIN\n"
                + "Choice AMC Private Limited,154841,Choice Large & Mid Cap Fund,Open Ended,Equity Schemes - Large & Mid Cap Fund,"
                + "Choice Large & Mid Cap Fund - Growth - Direct Plan,Rs. 1,000 and in multiples of Re. 1/-thereafter,20-Oct-2026,,INF0\n"
                + "Choice AMC Private Limited,154840,Choice Large & Mid Cap Fund,Open Ended,Equity Schemes - Large & Mid Cap Fund,"
                + "Choice Large & Mid Cap Fund - Growth - Regular Plan,Rs. 1,000 and in multiples of Re. 1/-thereafter,20-Oct-2026,,INF1\n"
                + "HDFC Asset Management Company Limited,154790,HDFC Nifty LargeMidcap250 Plus 8-13 yr G-sec 70 30 Index Fund,Open Ended,"
                + "Index Funds - Hybrid Fund,HDFC Nifty LargeMidcap250 Fund-Direct Plan-IDCW Option,100,05-Oct-2026,19-Oct-2026,INF2\n"
                + "HDFC Asset Management Company Limited,154792,HDFC Nifty LargeMidcap250 Plus 8-13 yr G-sec 70 30 Index Fund,Open Ended,"
                + "Index Funds - Hybrid Fund,HDFC Nifty LargeMidcap250 Fund-Growth Option,100,05-Oct-2026,19-Oct-2026,INF3\n"
                + "Old AMC Limited,100001,Old Flexi Cap Fund,Open Ended,Equity Scheme - Flexi Cap Fund,Old Flexi Cap Fund - Regular Plan - Growth,500,01-Jan-2010,01-Jan-2010,INF4\n";
        List<SchemeMasterRow> rows = AmfiData.parseMasterRows(csv);
        assertThat(rows).hasSize(5);
        assertThat(rows.get(0).minText()).isEqualTo("Rs. 1,000 and in multiples of Re. 1/-thereafter");
        assertThat(rows.get(0).closure()).isNull();
        assertThat(rows.get(2).closure()).isEqualTo(LocalDate.of(2026, 10, 19));

        List<Candidate> c = NfoRules.candidates(rows, TODAY);
        assertThat(c).hasSize(2); // the 2010 scheme is not an NFO
        Candidate hdfc = c.get(0);
        assertThat(hdfc.code()).isEqualTo("154792"); // growth, not direct / IDCW (HDFC has no "Regular" in the name)
        assertThat(hdfc.open()).isEqualTo(LocalDate.of(2026, 10, 5));
        assertThat(hdfc.close()).isEqualTo(LocalDate.of(2026, 10, 19));
        Candidate choice = c.get(1);
        assertThat(choice.code()).isEqualTo("154840"); // Regular Growth preferred over Direct
        assertThat(choice.schemeName()).isEqualTo("Choice Large & Mid Cap Fund");
        assertThat(choice.close()).isNull();

        // a new plan of an existing scheme is not an NFO
        List<Candidate> none = NfoRules.candidates(List.of(
                row("X AMC", "1", "X Fund", "X Fund - Regular Plan - Growth", "500", LocalDate.of(2015, 1, 1), null),
                row("X AMC", "2", "X Fund", "X Fund - Regular Plan - IDCW", "500", TODAY.minusDays(3), null)), TODAY);
        assertThat(none).isEmpty();
    }

    @Test
    void importNeverOverwritesStaffEditsAndDetailsOnlyFillGaps() {
        Candidate c = new Candidate("Choice AMC Private Limited|choice large & mid cap fund", "Choice AMC Private Limited", "154840",
                "Choice Large & Mid Cap Fund", "Open Ended", "Equity Schemes - Large & Mid Cap Fund", "Rs. 1000 and in multiples of Re. 1",
                TODAY, null);
        Nfo n = new Nfo();
        assertThat(NfoSync.applyCandidate(n, c, "Choice AMC")).isTrue();
        assertThat(n.getAssetClass()).isEqualTo("EQUITY");
        assertThat(n.getMinAmount()).isEqualByComparingTo("1000");
        assertThat(n.getCloseDate()).isNull();
        assertThat(NfoSync.applyCandidate(n, c, "Choice AMC")).isFalse(); // unchanged

        // staff corrected the close date and the name: a later import (now with an AMFI closure date) keeps them
        n.setCloseDate(TODAY.plusDays(10));
        n.setCloseDateSource("STAFF");
        n.setSchemeName("Choice Large and Midcap Fund");
        n.setStaffEditedFields("closeDate,schemeName");
        Candidate later = new Candidate(c.key(), c.amc(), c.code(), c.schemeName(), c.schemeType(), c.category(), c.minText(), TODAY,
                TODAY.plusDays(14));
        NfoSync.applyCandidate(n, later, "Choice AMC");
        assertThat(n.getCloseDate()).isEqualTo(TODAY.plusDays(10));
        assertThat(n.getCloseDateSource()).isEqualTo("STAFF");
        assertThat(n.getSchemeName()).isEqualTo("Choice Large and Midcap Fund");

        // details fill only empty fields; the SSD close date only when there is none
        n.setBenchmark("Staff benchmark");
        Details d = new Details(Risk.VERY_HIGH, null, null, "A Manager, B Manager", "NIFTY LargeMidcap 250 TRI", "Nil", "Long-term growth",
                null, 1000, null);
        assertThat(NfoSync.applyDetails(n, d, TODAY.plusDays(12))).isTrue();
        assertThat(n.getRiskometer()).isEqualTo(Risk.VERY_HIGH);
        assertThat(n.getBenchmark()).isEqualTo("Staff benchmark");
        assertThat(n.getFundManagers()).isEqualTo("A Manager, B Manager");
        assertThat(n.getCloseDate()).isEqualTo(TODAY.plusDays(10));

        Nfo fresh = new Nfo();
        NfoSync.applyCandidate(fresh, c, "Choice AMC");
        NfoSync.applyDetails(fresh, null, TODAY.minusYears(1)); // implausible (before the open date): ignored
        assertThat(fresh.getCloseDate()).isNull();
        NfoSync.applyDetails(fresh, null, TODAY.plusDays(14));
        assertThat(fresh.getCloseDate()).isEqualTo(TODAY.plusDays(14));
        assertThat(fresh.getCloseDateSource()).isEqualTo("SSD");
        // AMFI's closure date (once published) replaces the SSD one
        NfoSync.applyCandidate(fresh, later, "Choice AMC");
        assertThat(fresh.getCloseDateSource()).isEqualTo("AMFI");
    }

    @Test
    void pdfMagicBytes() {
        assertThat(NfoService.isPdf("%PDF-1.4\n...".getBytes())).isTrue();
        assertThat(NfoService.isPdf("PK\u0003\u0004 zip".getBytes())).isFalse();
        assertThat(NfoService.isPdf(new byte[0])).isFalse();
    }
}
