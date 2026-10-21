package com.aureusfinserve.portfolio;

import com.aureusfinserve.common.AssetClass;

import java.time.LocalDate;

/**
 * Capital-gains term classification used for the (indicative) capital gains statement.
 * EQUITY / HYBRID: long term when held for more than 12 months.
 * DEBT: long term only when held for more than 24 months AND purchased before 1 April 2023
 * (units bought on/after that date are always short term, per Finance Act 2023).
 */
public final class TaxRules {

    public static final LocalDate DEBT_CUTOFF = LocalDate.of(2023, 4, 1);

    private TaxRules() {
    }

    public static String term(AssetClass assetClass, LocalDate purchaseDate, LocalDate saleDate) {
        if (assetClass == AssetClass.DEBT) {
            boolean grandfathered = purchaseDate.isBefore(DEBT_CUTOFF);
            return grandfathered && saleDate.isAfter(purchaseDate.plusMonths(24)) ? "LTCG" : "STCG";
        }
        return saleDate.isAfter(purchaseDate.plusMonths(12)) ? "LTCG" : "STCG";
    }
}
