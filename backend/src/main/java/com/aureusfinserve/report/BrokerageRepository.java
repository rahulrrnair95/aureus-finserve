package com.aureusfinserve.report;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BrokerageRepository extends JpaRepository<Brokerage, Long> {

    List<Brokerage> findByMonthOrderByAmcAscSchemeNameAsc(String month);

    List<Brokerage> findAllByOrderByMonthDescAmcAscSchemeNameAsc();
}
