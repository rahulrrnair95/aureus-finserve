package com.aureusfinserve;

import com.aureusfinserve.common.AssetClass;
import com.aureusfinserve.common.Risk;
import com.aureusfinserve.publicsite.Scheme;
import com.aureusfinserve.sync.AmfiData;
import com.aureusfinserve.sync.AmfiData.NavRow;
import com.aureusfinserve.sync.SchemeDataSync;
import com.aureusfinserve.sync.SchemeRules;
import com.aureusfinserve.sync.SchemeRules.Classification;
import com.aureusfinserve.sync.SchemeRules.NavPt;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/** Pure logic ported from tools/build-scheme-seed.mjs and tools/enrich-scheme-details.mjs (expected values = JS output). */
class SchemeSyncRulesTest {

    @Test
    void cleanNameMatchesTheSeedTool() {
        assertThat(SchemeRules.cleanName("HDFC FLEXI CAP FUND")).isEqualTo("HDFC Flexi Cap Fund");
        assertThat(SchemeRules.cleanName("UTI - Nifty 50 Index Fund")).isEqualTo("UTI Nifty 50 Index Fund");
        assertThat(SchemeRules.cleanName("Quant Small Cap Fund")).isEqualTo("quant Small Cap Fund");
        assertThat(SchemeRules.cleanName("SBI LONG TERM EQUITY FUND - Tax Saver")).isEqualTo("SBI Long Term Equity Fund Tax Saver");
        assertThat(SchemeRules.cleanName("Aditya Birla Sun Life ELSS Tax Saver Fund (formerly known as Aditya Birla Sun Life Tax Relief 96)"))
                .isEqualTo("Aditya Birla Sun Life ELSS Tax Saver Fund");
        assertThat(SchemeRules.cleanName("Kotak FLEXICAP Fund")).isEqualTo("Kotak Flexi Cap Fund");
        assertThat(SchemeRules.cleanName("Nippon India Nifty G-SEC Jun 2036 Maturity Index Fund"))
                .isEqualTo("Nippon India Nifty G-Sec Jun 2036 Maturity Index Fund");
        assertThat(SchemeRules.cleanName("DSP US Specific Equity Omni FoF")).isEqualTo("DSP US Specific Equity Omni FoF");
        assertThat(SchemeRules.cleanName("Axis Gold ETF fund -")).isEqualTo("Axis Gold Etf Fund");
        assertThat(SchemeRules.cleanName("Tata Banking & PSU Fund (existing number of segregated portfolios - 1)"))
                .isEqualTo("Tata Banking & PSU Fund");
        assertThat(SchemeRules.cleanName("Motilal Oswal NASDAQ 100 FOF")).isEqualTo("Motilal Oswal NASDAQ 100 Fof");
    }

    private static void cls(String cat, String name, AssetClass c, String sub, Risk risk) {
        assertThat(SchemeRules.classify(cat, name)).as(cat).isEqualTo(new Classification(c, sub, risk));
    }

    @Test
    void classifyMapsAmfiCategories() {
        cls("Equity Scheme - Flexi Cap Fund", "x", AssetClass.EQUITY, "Flexi Cap", Risk.VERY_HIGH);
        cls("Equity Scheme - ELSS", "x", AssetClass.EQUITY, "ELSS", Risk.VERY_HIGH);
        cls("Equity Scheme - Sectoral/ Thematic", "x", AssetClass.EQUITY, "Sectoral / Thematic", Risk.VERY_HIGH);
        cls("Equity Scheme - Thematic", "x", AssetClass.EQUITY, "Sectoral / Thematic", Risk.VERY_HIGH);
        cls("Equity Scheme - Mid Cap Fund", "x", AssetClass.EQUITY, "Mid Cap", Risk.VERY_HIGH);
        cls("Growth", "x", AssetClass.EQUITY, "Growth", Risk.VERY_HIGH);
        cls("Other Scheme - Index Funds", "Nifty 50 Index Fund", AssetClass.EQUITY, "Index", Risk.VERY_HIGH);
        cls("Other Scheme - Index Funds", "Nifty SDL Apr 2027 Index Fund", AssetClass.DEBT, "Index (Debt)", Risk.MODERATE);
        cls("Hybrid Scheme - Arbitrage Fund", "x", AssetClass.HYBRID, "Arbitrage", Risk.LOW);
        cls("Hybrid Scheme - Dynamic Asset Allocation or Balanced Advantage", "x", AssetClass.HYBRID, "Balanced Advantage", Risk.VERY_HIGH);
        cls("Hybrid Scheme - Conservative Hybrid Fund", "x", AssetClass.HYBRID, "Conservative Hybrid", Risk.MODERATELY_HIGH);
        cls("Hybrid Scheme - Aggressive Hybrid Fund", "x", AssetClass.HYBRID, "Aggressive Hybrid", Risk.VERY_HIGH);
        cls("Debt Scheme - Overnight Fund", "x", AssetClass.DEBT, "Overnight", Risk.LOW);
        cls("Debt Scheme - Liquid Fund", "x", AssetClass.DEBT, "Liquid", Risk.LOW_TO_MODERATE);
        cls("Debt Scheme - Floater Fund", "x", AssetClass.DEBT, "Floater", Risk.LOW_TO_MODERATE);
        cls("Debt Scheme - Credit Risk Fund", "x", AssetClass.DEBT, "Credit Risk", Risk.MODERATELY_HIGH);
        cls("Debt Scheme - Banking and PSU Fund", "x", AssetClass.DEBT, "Banking & PSU", Risk.MODERATE);
        cls("Debt Scheme - Corporate Bond Fund", "x", AssetClass.DEBT, "Corporate Bond", Risk.MODERATE);
        cls("Debt Scheme - Gilt Fund with 10 year constant duration", "x", AssetClass.DEBT,
                "Gilt Fund with 10 year constant duration", Risk.MODERATE);
        cls("Income/Debt Oriented Schemes - Medium Term", "x", AssetClass.DEBT, "Medium Duration", Risk.MODERATE);
        cls("Solution Oriented Scheme - Retirement Fund", "x", AssetClass.HYBRID, "Retirement", Risk.VERY_HIGH);
        cls("Children’s Fund - Childrens' Fund", "x", AssetClass.HYBRID, "Children's", Risk.VERY_HIGH);
    }

    @Test
    void regularGrowthDetectionAndExclusions() {
        // 8-column file: plan + option
        assertThat(SchemeRules.isRegularGrowth("Regular Plan", "Growth Option", null, "X Fund")).isTrue();
        assertThat(SchemeRules.isRegularGrowth("Direct Plan", "Growth Option", null, "X Fund")).isFalse();
        assertThat(SchemeRules.isRegularGrowth("Regular Plan", "IDCW Option", null, "X Fund")).isFalse();
        assertThat(SchemeRules.isRegularGrowth("Regular Plan", "Bonus Option", null, "X Fund")).isFalse();
        assertThat(SchemeRules.isRegularGrowth("Regular Plan", "Discontinued Growth", null, "X Fund")).isFalse();
        // 6-column file: scheme master NAV name, else scheme name
        assertThat(SchemeRules.isRegularGrowth("", "", "X Fund - Regular Growth", "X Fund - Growth")).isTrue();
        assertThat(SchemeRules.isRegularGrowth("", "", null, "X Fund - Regular Plan - Growth Option")).isTrue();
        assertThat(SchemeRules.isRegularGrowth("", "", "", "X Fund - Growth")).isFalse();
        assertThat(SchemeRules.isRegularGrowth("", "", "X Fund -Regular - IDCW", "X Fund")).isFalse();
        // names / categories left out
        assertThat(SchemeRules.isExcludedName("Axis Gold ETF")).isTrue();
        assertThat(SchemeRules.isExcludedName("DSP US Specific Equity Omni FoF")).isTrue();
        assertThat(SchemeRules.isExcludedName("SBI Interval Income Fund")).isTrue();
        assertThat(SchemeRules.isExcludedName("HDFC FMP 1100D March 2023")).isTrue();
        assertThat(SchemeRules.isExcludedName("Nippon India Credit Risk Fund (Segregated - 17022020)")).isTrue();
        assertThat(SchemeRules.isExcludedName("X Fund Segregated Portfolio - 1")).isTrue();
        assertThat(SchemeRules.isExcludedName("HDFC Unclaimed Redemption Plan")).isTrue();
        assertThat(SchemeRules.isExcludedName("ICICI Prudential Unit Linked Insurance Plan")).isTrue();
        assertThat(SchemeRules.isExcludedName("Tata Banking & PSU Fund (existing number of segregated portfolios - 1)")).isFalse();
        assertThat(SchemeRules.isExcludedName("HDFC Flexi Cap Fund")).isFalse();
        assertThat(SchemeRules.isExcludedCategory("Other Scheme - Other  ETFs")).isTrue();
        assertThat(SchemeRules.isExcludedCategory("Other Scheme - FoF Domestic")).isTrue();
        assertThat(SchemeRules.isExcludedCategory("Equity Scheme - Flexi Cap Fund")).isFalse();
    }

    private static List<NavPt> series(Object... dateNav) {
        List<NavPt> l = new ArrayList<>();
        for (int i = 0; i < dateNav.length; i += 2) {
            l.add(new NavPt(LocalDate.parse((String) dateNav[i]), ((Number) dateNav[i + 1]).doubleValue()));
        }
        return l;
    }

    @Test
    void splitAdjustmentScalesEarlierNavs() {
        // 1:10 split on 2024-01-03: NAV drops from 1000 to ~100 -> earlier points divided by 10
        List<NavPt> adj = SchemeRules.adjustForSplits(series("2024-01-01", 990.0, "2024-01-02", 1000.0, "2024-01-03", 101.0, "2024-01-04", 102.0));
        assertThat(adj).extracting(NavPt::nav).containsExactly(99.0, 100.0, 101.0, 102.0);
        // a normal 20% move is not a split
        List<NavPt> normal = SchemeRules.adjustForSplits(series("2024-01-01", 100.0, "2024-01-02", 120.0));
        assertThat(normal).extracting(NavPt::nav).containsExactly(100.0, 120.0);
        // consolidation (x10) is scaled up
        List<NavPt> cons = SchemeRules.adjustForSplits(series("2024-01-01", 10.0, "2024-01-02", 10.1, "2024-01-03", 102.0));
        assertThat(cons).extracting(NavPt::nav).containsExactly(100.0, 101.0, 102.0);
    }

    @Test
    void thinningKeepsDailyRecentAndWeeklyOlderPoints() {
        LocalDate today = LocalDate.of(2026, 10, 20);
        List<NavPt> daily = new ArrayList<>();
        for (LocalDate d = today.minusDays(4000); !d.isAfter(today); d = d.plusDays(1)) {
            daily.add(new NavPt(d, 10 + d.toEpochDay() % 7));
        }
        List<NavPt> t = SchemeRules.thin(daily, today);
        LocalDate cut = today.minusDays(400);
        LocalDate start = today.minusDays(Math.round(10.3 * 365));
        assertThat(t.get(0).date()).isAfterOrEqualTo(start);
        assertThat(t.get(t.size() - 1).date()).isEqualTo(today);
        assertThat(t.stream().filter(p -> !p.date().isBefore(cut)).count()).isEqualTo(401);
        List<NavPt> older = t.stream().filter(p -> p.date().isBefore(cut)).toList();
        // one point per (Monday-based) week, the week's last available day (Sunday here)
        assertThat(older).allMatch(p -> p.date().getDayOfWeek() == java.time.DayOfWeek.SUNDAY);
        for (int i = 1; i < older.size(); i++) {
            assertThat(older.get(i).date()).isEqualTo(older.get(i - 1).date().plusWeeks(1));
        }
        assertThat(older.size()).isBetween(480, 485);
        // ascending order
        for (int i = 1; i < t.size(); i++) {
            assertThat(t.get(i).date()).isAfter(t.get(i - 1).date());
        }
    }

    @Test
    void minSipParsesTheVariousSsdFormats() {
        assertThat(SchemeRules.minSip("Frequency: Daily, Weekly, Monthly | Minimum amount: For SIP DSIP, WSIP, MSIP - Rs. 100; "
                + "QSIP - Rs. 1500; HSIP - Rs. 2500; YSIP - Rs. 5000. | In multiples of: Re. 1/- thereafter")).isEqualTo(100);
        assertThat(SchemeRules.minSip("MSIP - Rs. 100")).isEqualTo(100);
        assertThat(SchemeRules.minSip("SIP - D-500/W-500/M-500")).isEqualTo(500);
        assertThat(SchemeRules.minSip("Monthly 1000.00")).isEqualTo(1000);
        assertThat(SchemeRules.minSip("SIP - 100/500")).isEqualTo(100);
        assertThat(SchemeRules.minSip("SIP - Minimum amount: 1000")).isEqualTo(1000);
        assertThat(SchemeRules.minSip("MinimumAmount: Rs.500.00")).isEqualTo(500);
        assertThat(SchemeRules.minSip("Minimum amount: 100")).isEqualTo(100);
        assertThat(SchemeRules.minSip("Frequency: Daily, Weekly | Minimum amount: Monthly SIP - Rs. 1,000 and in multiples of Re 1 | Dates: any"))
                .isEqualTo(1000);
        assertThat(SchemeRules.minSip("Nothing here")).isNull();
        assertThat(SchemeRules.minSip("SIP - Rs. 10")).isNull(); // below the plausible range
        assertThat(SchemeRules.minSip(null)).isNull();
    }

    @Test
    void lumpSumRiskAndManagers() {
        assertThat(SchemeRules.rupees("Rs.100")).isEqualTo(100);
        assertThat(SchemeRules.rupees("₹ 5,000")).isEqualTo(5000);
        assertThat(SchemeRules.rupees("1000")).isEqualTo(1000);
        assertThat(SchemeRules.rupees("INR 500.50")).isEqualTo(501);
        assertThat(SchemeRules.rupees("abc")).isNull();
        assertThat(SchemeRules.rupees("Rs. 0")).isNull();
        assertThat(SchemeRules.toRisk("Very High Risk")).isEqualTo(Risk.VERY_HIGH);
        assertThat(SchemeRules.toRisk("Moderately  High")).isEqualTo(Risk.MODERATELY_HIGH);
        assertThat(SchemeRules.toRisk("low to moderate")).isEqualTo(Risk.LOW_TO_MODERATE);
        assertThat(SchemeRules.toRisk("Unknown")).isNull();
        assertThat(SchemeRules.managers(List.of(new SchemeRules.Manager("Gopal Agrawal", "Fund Manager for Overseas Investments"),
                new SchemeRules.Manager(" Amit  Ganatra ", "Fund Manager of the Scheme"),
                new SchemeRules.Manager("Amit Ganatra", "Fund Manager")))).isEqualTo("Amit Ganatra, Gopal Agrawal");
        assertThat(SchemeRules.cap("one two three", 8)).isEqualTo("one…");
    }

    @Test
    void parsesBothNavFileFormats() {
        String text = """
                Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Plan;Option;Net Asset Value;Date
                \s
                Open Ended Schemes(Equity Scheme - Flexi Cap Fund)
                \s
                HDFC Mutual Fund
                \s
                101762;INF179K01608;-;HDFC Flexi Cap Fund;Regular Plan;Growth Option;1961.801;19-Oct-2026
                118955;INF179K01UT0;-;HDFC Flexi Cap Fund;Direct Plan;Growth Option;2150.10;19-Oct-2026
                Open Ended Schemes(Debt Scheme - Liquid Fund)
                SBI Mutual Fund
                119800;INF200K01RY0;-;SBI Liquid Fund - Regular Plan - Growth;4012.3456;17-Oct-2026
                119801;-;-;SBI Liquid Fund - Regular Plan - IDCW;N.A.;17-Oct-2026
                Close Ended Schemes(Income)
                SBI Mutual Fund
                100001;-;-;SBI FMP Series 1 - Regular Growth;12.0;17-Oct-2026
                """;
        List<NavRow> rows = AmfiData.parseNavAll(text);
        assertThat(rows).extracting(NavRow::code).containsExactly("101762", "118955", "119800", "119801", "100001");
        NavRow hdfc = rows.get(0);
        assertThat(hdfc.amc()).isEqualTo("HDFC Mutual Fund");
        assertThat(hdfc.cat()).isEqualTo("Equity Scheme - Flexi Cap Fund");
        assertThat(hdfc.plan()).isEqualTo("Regular Plan");
        assertThat(hdfc.option()).isEqualTo("Growth Option");
        assertThat(hdfc.nav()).isEqualTo(1961.801);
        assertThat(hdfc.date()).isEqualTo(LocalDate.of(2026, 10, 19));
        assertThat(hdfc.validIsin()).isEqualTo("INF179K01608");
        NavRow sbi = rows.get(2);
        assertThat(sbi.amc()).isEqualTo("SBI Mutual Fund");
        assertThat(sbi.plan()).isEmpty();
        assertThat(sbi.nav()).isEqualTo(4012.3456);
        assertThat(sbi.date()).isEqualTo(LocalDate.of(2026, 10, 17));
        assertThat(rows.get(3).nav()).isNaN();
        assertThat(rows.get(3).validIsin()).isNull();

        // selection: open-ended, regular growth, positive NAV, wanted AMCs only
        List<NavRow> picked = AmfiData.candidates(rows, Map.of(), Set.of("HDFC Mutual Fund", "SBI Mutual Fund"));
        assertThat(picked).extracting(NavRow::code).containsExactly("101762", "119800");
        assertThat(AmfiData.candidates(rows, Map.of(), Set.of("HDFC Mutual Fund"))).extracting(NavRow::code).containsExactly("101762");
    }

    @Test
    void onePerSchemePrefersLatestNavThenLowerCode() {
        NavRow a = new NavRow(1, "X MF", "c", "Open Ended Schemes(c)", "200", "", "X FLEXI CAP FUND", "Regular Plan", "Growth", "10", "17-Oct-2026");
        NavRow b = new NavRow(2, "X MF", "c", "Open Ended Schemes(c)", "150", "", "X Flexi Cap Fund", "Regular Plan", "Growth", "10", "17-Oct-2026");
        NavRow c = new NavRow(3, "X MF", "c", "Open Ended Schemes(c)", "300", "", "X Flexi Cap Fund", "Regular Plan", "Growth", "10", "19-Oct-2026");
        assertThat(AmfiData.onePerScheme(List.of(a, b))).extracting(NavRow::code).containsExactly("150");
        assertThat(AmfiData.onePerScheme(List.of(a, b, c))).extracting(NavRow::code).containsExactly("300");
    }

    @Test
    void parsesSchemeMaster() {
        String csv = "AMC,Code,Scheme Name,Scheme Type,Scheme Category,Scheme NAV Name,Scheme Minimum Amount,Launch Date, Closure Date,ISIN\n"
                + "Aditya Birla Sun Life AMC Limited,100033,ABSL Large & Mid Cap Fund,Open Ended,Equity Scheme - Large & Mid Cap Fund,"
                + "ABSL Large & Mid Cap Fund - Regular Growth,5000,24-Feb-1995,24-Feb-1995,INF209K01165\n"
                + "X AMC,100034,X Fund,Open Ended,Debt Scheme - Liquid Fund,X Fund - Regular Growth,Rs. 1,000 and in multiples of Re 1 thereafter,"
                + "01-Jan-2020,,INF0\n"
                + "X AMC,100035,X Fund 2,Open Ended,Debt,X Fund 2 - Regular Growth,Re 1/-,05-Mar-2021,,\n";
        Map<String, AmfiData.MasterRow> m = AmfiData.parseMaster(csv);
        assertThat(m.get("100033")).isEqualTo(new AmfiData.MasterRow("ABSL Large & Mid Cap Fund - Regular Growth", LocalDate.of(1995, 2, 24), 5000));
        assertThat(m.get("100034").minAmount()).isEqualTo(1000);
        assertThat(m.get("100034").launch()).isEqualTo(LocalDate.of(2020, 1, 1));
        assertThat(m.get("100035").minAmount()).isNull();
    }

    @Test
    void detailsKeepExistingValuesWhenTheSourceHasNone() throws Exception {
        String json = """
                {"scheme_code":101762,"amfi_daily":{"fund_aum_cr_all_plans":110006.774,"riskometer":"Very High","benchmark":"Nifty 500 TRI"},
                 "ssd":{"fund_managers":[{"name":"Amit Ganatra","role":"Fund Manager of the Scheme"}],"allotment_date":"1995-01-01",
                        "benchmark_tier1_std":"Nifty 500 TRI","terms_sip":"Minimum amount: MSIP - Rs. 100","min_application_amount":"Rs.100",
                        "objective":"To generate  capital appreciation."},
                 "ter":{"date":"2026-10-18","regular":1.36}}""";
        SchemeDataSync.Details d = SchemeDataSync.parseDetails(new ObjectMapper().readTree(json));
        assertThat(d.risk()).isEqualTo(Risk.VERY_HIGH);
        assertThat(d.expenseRatio()).isEqualByComparingTo("1.36");
        assertThat(d.aumCr()).isEqualByComparingTo("110006.77");
        assertThat(d.fundManager()).isEqualTo("Amit Ganatra");
        assertThat(d.benchmark()).isEqualTo("Nifty 500 TRI");
        assertThat(d.objective()).isEqualTo("To generate capital appreciation.");
        assertThat(d.minSip()).isEqualTo(100);
        assertThat(d.minLumpsum()).isEqualTo(100);
        assertThat(d.allotmentDate()).isEqualTo(LocalDate.of(1995, 1, 1));
        assertThat(d.exitLoad()).isNull();

        Scheme s = new Scheme();
        s.setRisk(Risk.HIGH);
        s.setExitLoad("1% within 1 year");
        s.setExpenseRatio(new BigDecimal("1.3600"));
        assertThat(SchemeDataSync.apply(s, d)).isTrue();
        assertThat(s.getRisk()).isEqualTo(Risk.VERY_HIGH);
        assertThat(s.getExitLoad()).isEqualTo("1% within 1 year"); // not in the response -> kept
        assertThat(SchemeDataSync.apply(s, d)).isFalse(); // nothing new the second time

        // a partial response (no daily / ter / ssd blocks) changes nothing
        SchemeDataSync.Details empty = SchemeDataSync.parseDetails(new ObjectMapper().readTree("{\"scheme_code\":101762}"));
        assertThat(SchemeDataSync.apply(s, empty)).isFalse();
        assertThat(s.getFundManager()).isEqualTo("Amit Ganatra");
        assertThat(s.getMinSip()).isEqualByComparingTo("100");
    }
}
