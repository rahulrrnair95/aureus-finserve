package com.aureusfinserve.order;

import com.aureusfinserve.common.OrderStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public final class OrderRepos {

    private OrderRepos() {
    }

    public interface MfOrderRepository extends JpaRepository<MfOrder, Long> {
        List<MfOrder> findByInvestorIdInOrderByCreatedAtDescIdDesc(Collection<Long> investorIds);

        List<MfOrder> findAllByOrderByCreatedAtDescIdDesc();

        List<MfOrder> findByStatusIn(Collection<OrderStatus> statuses);
    }

    public interface OrderHistoryRepository extends JpaRepository<OrderHistory, Long> {
        List<OrderHistory> findByOrderIdInOrderByAtAscIdAsc(Collection<Long> orderIds);
    }
}
