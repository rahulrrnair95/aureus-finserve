package com.aureusfinserve.order;

import com.aureusfinserve.common.Fmt;
import com.aureusfinserve.common.OrderStatus;
import com.aureusfinserve.common.OrderType;
import com.aureusfinserve.config.AppProperties;
import com.aureusfinserve.order.OrderRepos.MfOrderRepository;
import com.aureusfinserve.security.CryptoService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Simulated exchange: PLACED -> PAYMENT_RECEIVED after ~20 s -> ALLOTTED after ~40 s (from placement).
 * Allotment creates the transaction at the current NAV and updates the folio.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MockExchangeGateway implements OrderPlatformGateway {

    private final MfOrderRepository orderRepo;
    private final OrderLifecycle lifecycle;
    private final AppProperties props;
    private final CryptoService crypto;
    private final TransactionTemplate tx;

    @Override
    public String placeOrder(MfOrder order) {
        return "BSE" + String.format("%06d", crypto.random().nextInt(1_000_000));
    }

    @Scheduled(fixedDelayString = "${app.mock-exchange.poll-millis:5000}", initialDelay = 5000)
    public void advance() {
        if (!props.getMockExchange().isEnabled()) {
            return;
        }
        LocalDateTime now = Fmt.now();
        List<Long> ids = orderRepo.findByStatusIn(List.of(OrderStatus.PLACED, OrderStatus.PAYMENT_RECEIVED))
                .stream().map(MfOrder::getId).toList();
        for (Long id : ids) {
            try {
                tx.executeWithoutResult(s -> step(id, now));
            } catch (RuntimeException e) {
                log.error("Mock exchange failed to advance order {}", id, e);
                tx.executeWithoutResult(s -> orderRepo.findById(id).ifPresent(o ->
                        lifecycle.changeStatus(o, OrderStatus.FAILED, "Rejected by exchange: processing error")));
            }
        }
    }

    private void step(Long id, LocalDateTime now) {
        MfOrder o = orderRepo.findById(id).orElse(null);
        if (o == null || o.getPlacedAt() == null) {
            return;
        }
        var mx = props.getMockExchange();
        if (o.getStatus() == OrderStatus.PLACED && !now.isBefore(o.getPlacedAt().plusSeconds(mx.getPaymentAfterSeconds()))) {
            boolean purchase = o.getType() == OrderType.LUMPSUM || o.getType() == OrderType.SIP;
            lifecycle.changeStatus(o, OrderStatus.PAYMENT_RECEIVED,
                    purchase ? "Payment received via " + o.getPaymentMode() : "Order confirmed by exchange");
        } else if (o.getStatus() == OrderStatus.PAYMENT_RECEIVED
                && !now.isBefore(o.getPlacedAt().plusSeconds(mx.getAllotAfterSeconds()))) {
            lifecycle.allot(o);
        }
    }
}
