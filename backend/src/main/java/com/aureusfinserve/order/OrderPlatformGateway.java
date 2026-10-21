package com.aureusfinserve.order;

/**
 * Exchange / order platform integration (BSE StAR MF, NSE NMF II, MF Central...).
 * {@link MockExchangeGateway} simulates the exchange for development.
 */
public interface OrderPlatformGateway {

    /** Sends the order to the exchange; returns the exchange order reference. */
    String placeOrder(MfOrder order);
}
