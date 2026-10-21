package com.aureusfinserve.portfolio;

import com.aureusfinserve.common.AssetClass;
import com.aureusfinserve.common.RegistrationType;
import com.aureusfinserve.common.Risk;
import com.aureusfinserve.common.SipStatus;
import com.aureusfinserve.common.TxnType;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** JSON shapes for holdings, transactions, SIPs and the portfolio summary (field names per contract). */
public final class PortfolioDtos {

    private PortfolioDtos() {
    }

    public record Holding(Long folioId, String folioNo, Long investorId, String investorName, Long schemeId,
                          String schemeName, String amc, AssetClass category, String subCategory, Risk risk,
                          BigDecimal units, BigDecimal nav, LocalDate navDate, BigDecimal value, BigDecimal invested,
                          BigDecimal gain, Double gainPct, Double xirr) {
    }

    public record Txn(Long id, LocalDate date, String folioNo, Long folioId, Long schemeId, String schemeName,
                      String investorName, TxnType type, BigDecimal amount, BigDecimal units, BigDecimal nav) {
    }

    /** Contract Sip object; {@code type}, {@code installments} and {@code targetSchemeName} are additive extras. */
    public record Sip(Long id, Long investorId, String investorName, Long schemeId, String schemeName, String folioNo,
                      BigDecimal amount, int sipDay, LocalDate nextDebitDate, SipStatus status, Integer stepUpPct,
                      LocalDate startDate, int installmentsDone, LocalDate pausedUntil,
                      RegistrationType type, Integer installments, String targetSchemeName) {
    }

    public record Allocation(AssetClass assetClass, BigDecimal value, Double pct) {
    }

    public record ValuePoint(LocalDate date, BigDecimal value, BigDecimal invested) {
    }

    public record Summary(BigDecimal currentValue, BigDecimal invested, BigDecimal gain, Double gainPct, Double xirr,
                          LocalDate asOf, int holdingsCount, int activeSips, BigDecimal monthlySipAmount,
                          List<Allocation> allocation, List<Holding> topHoldings, List<ValuePoint> valueHistory) {
    }
}
