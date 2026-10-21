package com.aureusfinserve.auth;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserDeviceRepository extends JpaRepository<UserDevice, Long> {

    Optional<UserDevice> findByUserIdAndDeviceId(Long userId, String deviceId);
}
