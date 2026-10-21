package com.aureusfinserve.order;

import com.aureusfinserve.common.OrderStatus;
import com.aureusfinserve.common.OrderType;
import com.aureusfinserve.common.PaymentMode;
import com.aureusfinserve.common.Role;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public final class OrderDtos {

    private OrderDtos() {
    }

    public record CartItem(@NotNull(message = "Order type is required") OrderType type, Long schemeId, Long folioId,
                           Long targetSchemeId, BigDecimal amount, BigDecimal units, Boolean allUnits,
                           Integer sipDay, Integer installments) {
        public boolean all() {
            return Boolean.TRUE.equals(allUnits);
        }
    }

    public record CartRequest(Long investorId, PaymentMode paymentMode, Boolean riskAcknowledged,
                              @NotEmpty(message = "Add at least one item") @Size(max = 20, message = "Too many items in cart")
                              List<@Valid CartItem> items) {
    }

    public record HistoryEntry(OrderStatus status, LocalDateTime at, String note) {
    }

    public record Order(Long id, String ref, Long investorId, String investorName, OrderType type, Long schemeId,
                        String schemeName, Long targetSchemeId, String targetSchemeName, Long folioId, String folioNo,
                        BigDecimal amount, BigDecimal units, boolean allUnits, Integer sipDay, Integer installments,
                        PaymentMode paymentMode, OrderStatus status, String placedBy, Role placedByRole,
                        String exchangeRef, LocalDateTime createdAt, List<HistoryEntry> history) {
    }
}
