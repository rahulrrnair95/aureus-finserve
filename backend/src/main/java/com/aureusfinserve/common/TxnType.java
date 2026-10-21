package com.aureusfinserve.common;

public enum TxnType {
    PURCHASE(true), SIP(true), REDEMPTION(false), SWITCH_IN(true), SWITCH_OUT(false),
    STP_IN(true), STP_OUT(false), SWP(false);

    private final boolean inflow;

    TxnType(boolean inflow) {
        this.inflow = inflow;
    }

    /** true when units are added to the folio (money invested), false when units leave it. */
    public boolean isInflow() {
        return inflow;
    }
}
