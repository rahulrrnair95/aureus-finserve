package com.aureusfinserve.order;

import com.aureusfinserve.common.KycStatus;
import com.aureusfinserve.investor.Investor;
import org.springframework.stereotype.Service;

/**
 * KYC check. Stub: trusts the KYC status stored on the investor record.
 * Replace with a KRA (CVL / NDML / CAMS KRA / KFin KRA) lookup in production.
 */
@Service
public class KycService {

    public KycStatus status(Investor investor) {
        return investor.getKycStatus() == null ? KycStatus.NOT_FOUND : investor.getKycStatus();
    }

    public boolean canTransact(Investor investor) {
        return status(investor) == KycStatus.VALIDATED;
    }
}
