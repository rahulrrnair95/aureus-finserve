package com.aureusfinserve.common;

/** Progress of an online KYC application (distinct from {@link KycStatus}, the KRA status of an existing client). */
public enum KycApplicationStatus {
    SUBMITTED, UNDER_REVIEW, VIPV_SCHEDULED, SUBMITTED_TO_KRA, KYC_REGISTERED, ACTION_REQUIRED, REJECTED;

    /** Statuses that still need work by the firm (dashboard "Pending KYC"). */
    public boolean isPending() {
        return this == SUBMITTED || this == UNDER_REVIEW || this == VIPV_SCHEDULED || this == ACTION_REQUIRED;
    }
}
