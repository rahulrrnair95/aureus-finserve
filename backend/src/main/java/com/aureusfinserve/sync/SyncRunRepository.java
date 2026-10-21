package com.aureusfinserve.sync;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface SyncRunRepository extends JpaRepository<SyncRun, Long> {

    List<SyncRun> findAllByOrderByStartedAtDescIdDesc();

    /** Latest finished run of a type with one of the statuses. */
    Optional<SyncRun> findFirstByTypeAndStatusInAndFinishedAtNotNullOrderByFinishedAtDescIdDesc(String type, Collection<String> statuses);
}
