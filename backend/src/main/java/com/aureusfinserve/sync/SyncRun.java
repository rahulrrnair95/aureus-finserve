package com.aureusfinserve.sync;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.Length;

import java.time.LocalDateTime;

/** One data sync run: NAV import, RTA feed, scheme details refresh or new-schemes check. */
@Getter
@Setter
@Entity
@Table(name = "sync_run")
public class SyncRun {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** NAV | RTA | DETAILS | SCHEMES | NFO (column is 10 characters) */
    @Column(name = "run_type", nullable = false, length = 10)
    private String type;

    @Column(name = "started_at", nullable = false)
    private LocalDateTime startedAt;

    @Column(name = "finished_at")
    private LocalDateTime finishedAt;

    /** SUCCESS | PARTIAL | FAILED */
    @Column(nullable = false, length = 10)
    private String status;

    @Column(nullable = false)
    private int processed;

    @Column(nullable = false)
    private int failed;

    /** Newline separated error messages (capped). */
    @Column(length = Length.LONG32)
    private String errors;

    @Column(name = "triggered_by", length = 150)
    private String triggeredBy;

    /** One-line outcome, e.g. "Added 2, deactivated 1, reactivated 0" (DETAILS / SCHEMES runs). */
    @Column(length = 500)
    private String summary;
}
