package com.aureusfinserve.auth;

import com.aureusfinserve.common.Role;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface AppUserRepository extends JpaRepository<AppUser, Long> {

    Optional<AppUser> findFirstByEmailHash(String emailHash);

    Optional<AppUser> findFirstByMobileHash(String mobileHash);

    Optional<AppUser> findFirstByInvestorId(Long investorId);

    List<AppUser> findByInvestorIdIn(Collection<Long> investorIds);

    List<AppUser> findByRoleInOrderByNameAsc(Collection<Role> roles);

    List<AppUser> findByRoleOrderByNameAsc(Role role);
}
