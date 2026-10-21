package com.aureusfinserve;

import com.aureusfinserve.auth.PasswordPolicy;
import com.aureusfinserve.common.AssetClass;
import com.aureusfinserve.common.Fmt;
import com.aureusfinserve.common.TxnType;
import com.aureusfinserve.portfolio.Fifo;
import com.aureusfinserve.portfolio.MfTransaction;
import com.aureusfinserve.portfolio.TaxRules;
import com.aureusfinserve.portfolio.Xirr;
import com.aureusfinserve.security.RateLimiter;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class UnitRulesTest {

    @Test
    void xirrOfSimpleOneYearInvestment() {
        Double r = Xirr.compute(List.of(
                new Xirr.CashFlow(LocalDate.of(2025, 1, 1), -10000),
                new Xirr.CashFlow(LocalDate.of(2026, 1, 1), 11000)));
        assertThat(r).isNotNull();
        assertThat(r).isCloseTo(0.10, within(1e-4));
    }

    @Test
    void xirrMatchesSpreadsheetForIrregularFlows() {
        // Reference value computed with Excel/LibreOffice XIRR: 0.373362535
        Double r = Xirr.compute(List.of(
                new Xirr.CashFlow(LocalDate.of(2008, 1, 1), -10000),
                new Xirr.CashFlow(LocalDate.of(2008, 3, 1), 2750),
                new Xirr.CashFlow(LocalDate.of(2008, 10, 30), 4250),
                new Xirr.CashFlow(LocalDate.of(2009, 2, 15), 3250),
                new Xirr.CashFlow(LocalDate.of(2009, 4, 1), 2750)));
        assertThat(r).isCloseTo(0.373362535, within(1e-6));
    }

    @Test
    void xirrHandlesLossesAndDegenerateInput() {
        Double loss = Xirr.compute(List.of(
                new Xirr.CashFlow(LocalDate.of(2024, 1, 1), -10000),
                new Xirr.CashFlow(LocalDate.of(2025, 1, 1), 5000)));
        assertThat(loss).isCloseTo(-0.5, within(1e-3));
        assertThat(Xirr.compute(List.of(new Xirr.CashFlow(LocalDate.of(2024, 1, 1), -100)))).isNull();
        assertThat(Xirr.compute(List.of(new Xirr.CashFlow(LocalDate.of(2024, 1, 1), -100),
                new Xirr.CashFlow(LocalDate.of(2024, 2, 1), -100)))).isNull();
    }

    @Test
    void capitalGainsTermClassification() {
        LocalDate sale = LocalDate.of(2025, 12, 15);
        // Equity / hybrid: > 12 months is long term
        assertThat(TaxRules.term(AssetClass.EQUITY, LocalDate.of(2024, 12, 14), sale)).isEqualTo("LTCG");
        assertThat(TaxRules.term(AssetClass.EQUITY, LocalDate.of(2024, 12, 15), sale)).isEqualTo("STCG");
        assertThat(TaxRules.term(AssetClass.HYBRID, LocalDate.of(2024, 6, 1), sale)).isEqualTo("LTCG");
        assertThat(TaxRules.term(AssetClass.HYBRID, LocalDate.of(2025, 6, 1), sale)).isEqualTo("STCG");
        // Debt: long term only when bought before 2023-04-01 AND held > 24 months
        assertThat(TaxRules.term(AssetClass.DEBT, LocalDate.of(2023, 3, 31), sale)).isEqualTo("LTCG");
        assertThat(TaxRules.term(AssetClass.DEBT, LocalDate.of(2023, 4, 1), sale)).isEqualTo("STCG");
        assertThat(TaxRules.term(AssetClass.DEBT, LocalDate.of(2023, 3, 1), LocalDate.of(2025, 2, 1))).isEqualTo("STCG");
    }

    @Test
    void fifoConsumesOldestLotsFirst() {
        List<MfTransaction> txns = List.of(
                txn(LocalDate.of(2024, 1, 10), TxnType.SIP, 1000, 100),
                txn(LocalDate.of(2025, 1, 10), TxnType.SIP, 1000, 50),
                txn(LocalDate.of(2025, 6, 10), TxnType.REDEMPTION, 3000, 120));
        Fifo.State st = Fifo.replay(txns, null);
        assertThat(st.units()).isCloseTo(30, within(1e-9));
        assertThat(st.cost()).isCloseTo(600, within(1e-9)); // 30 units of the 2025 lot @ 20
        assertThat(st.realised).hasSize(2);
        assertThat(st.realised.get(0).purchaseDate()).isEqualTo(LocalDate.of(2024, 1, 10));
        assertThat(st.realised.get(0).units()).isCloseTo(100, within(1e-9));
        assertThat(st.realised.get(1).units()).isCloseTo(20, within(1e-9));
    }

    private static MfTransaction txn(LocalDate d, TxnType type, double amount, double units) {
        MfTransaction t = new MfTransaction();
        t.setDate(d);
        t.setType(type);
        t.setAmount(BigDecimal.valueOf(amount));
        t.setUnits(BigDecimal.valueOf(units));
        t.setNav(BigDecimal.valueOf(amount / units));
        return t;
    }

    @Test
    void passwordPolicy() {
        assertThat(PasswordPolicy.violation("Short1!", null, null)).isPresent();
        assertThat(PasswordPolicy.violation("NoDigits!!", null, null)).isPresent();
        assertThat(PasswordPolicy.violation("NoSymbol123", null, null)).isPresent();
        assertThat(PasswordPolicy.violation("12345678!", null, null)).isPresent();
        assertThat(PasswordPolicy.violation("x".repeat(60) + "1!aaaa", null, null)).isPresent();
        assertThat(PasswordPolicy.violation("Abcde1234f", "ABCDE1234F", null)).isPresent(); // equals PAN (no symbol either)
        assertThat(PasswordPolicy.violation("Priya@2026", "ABCPM1234F", "9876543210")).isEmpty();
    }

    @Test
    void financialYearHelpers() {
        assertThat(Fmt.fyOf(LocalDate.of(2026, 3, 31))).isEqualTo("2025-26");
        assertThat(Fmt.fyOf(LocalDate.of(2026, 4, 1))).isEqualTo("2026-27");
        assertThat(Fmt.fyStart("2025-26")).isEqualTo(LocalDate.of(2025, 4, 1));
        assertThat(Fmt.fyEnd("2025-26")).isEqualTo(LocalDate.of(2026, 3, 31));
    }

    @Test
    void rateLimiterBlocksAfterLimit() {
        RateLimiter rl = new RateLimiter();
        for (int i = 0; i < 20; i++) {
            assertThat(rl.tryAcquire("ip:1.2.3.4", 20, 60_000)).isTrue();
        }
        assertThat(rl.tryAcquire("ip:1.2.3.4", 20, 60_000)).isFalse();
        assertThat(rl.tryAcquire("ip:5.6.7.8", 20, 60_000)).isTrue();
    }
}
