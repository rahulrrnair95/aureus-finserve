package com.aureusfinserve.common;

import java.util.List;

/** Documents collected with an online KYC application. The multipart part name is the enum name. */
public enum KycDocType {
    PAN_CARD("PAN card"),
    ADDRESS_PROOF("Address proof"),
    PHOTO("Photograph"),
    SIGNATURE("Signature"),
    CANCELLED_CHEQUE("Cancelled cheque"),
    PASSPORT("Passport"),
    OVERSEAS_ADDRESS_PROOF("Overseas address proof"),
    VISA_OR_OCI("Visa / OCI card");

    private final String label;

    KycDocType(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }

    public static List<KycDocType> required(Residency r) {
        return r == Residency.NRI ? List.of(PAN_CARD, PASSPORT, OVERSEAS_ADDRESS_PROOF, PHOTO, SIGNATURE)
                : List.of(PAN_CARD, ADDRESS_PROOF, PHOTO, SIGNATURE);
    }

    public static List<KycDocType> allowed(Residency r) {
        return r == Residency.NRI
                ? List.of(PAN_CARD, PASSPORT, OVERSEAS_ADDRESS_PROOF, PHOTO, SIGNATURE, ADDRESS_PROOF, VISA_OR_OCI, CANCELLED_CHEQUE)
                : List.of(PAN_CARD, ADDRESS_PROOF, PHOTO, SIGNATURE, CANCELLED_CHEQUE);
    }
}
