package com.aureusfinserve.admin;

import com.aureusfinserve.admin.AdminDtos.*;
import com.aureusfinserve.audit.AuditQueryService;
import com.aureusfinserve.audit.AuditService;
import com.aureusfinserve.common.ApiException;
import com.aureusfinserve.security.CurrentUser;
import com.aureusfinserve.sync.AutoSync;
import com.aureusfinserve.sync.NfoSync;
import com.aureusfinserve.sync.SchemeDataSync;
import com.aureusfinserve.sync.SyncService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** ADMIN-only: staff users, audit log, data sync, brokerage. */
@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminSystemController {

    private final StaffUserService users;
    private final AuditQueryService auditQuery;
    private final AuditService audit;
    private final SyncService sync;
    private final SchemeDataSync schemeData;
    private final AutoSync autoSync;
    private final NfoSync nfoSync;
    private final AdminService admin;

    // ---------------------------------------------------------------- users

    @GetMapping("/users")
    public List<StaffUser> users() {
        return users.list();
    }

    @PostMapping("/users")
    public Map<String, Object> createUser(@Valid @RequestBody StaffUserRequest r) {
        return users.create(r);
    }

    @PostMapping("/users/{id}/reset-password")
    public Map<String, Object> resetPassword(@PathVariable Long id) {
        return Map.of("tempPassword", users.resetPassword(id));
    }

    @PostMapping("/users/{id}/force-logout")
    public Map<String, Object> forceLogout(@PathVariable Long id) {
        users.forceLogout(id);
        return Map.of("ok", true);
    }

    @PostMapping("/users/{id}/status")
    public StaffUser userStatus(@PathVariable Long id, @Valid @RequestBody EnabledRequest r) {
        return users.setEnabled(CurrentUser.get(), id, r.enabled());
    }

    // ---------------------------------------------------------------- audit (read-only)

    @GetMapping("/audit")
    public AuditPage audit(@RequestParam(required = false) String q, @RequestParam(required = false) String action,
                           @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                           @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
                           @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "50") int size) {
        return auditQuery.search(q, action, from, to, page, size);
    }

    @GetMapping("/audit/export")
    public ResponseEntity<byte[]> auditExport(@RequestParam(required = false) String q, @RequestParam(required = false) String action,
                                              @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
                                              @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        byte[] csv = auditQuery.csv(q, action, from, to);
        audit.log("REPORT_EXPORTED", "AUDIT", null, "Audit CSV export");
        return ResponseEntity.ok()
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename("audit-" + LocalDate.now() + ".csv").build().toString())
                .body(csv);
    }

    // ---------------------------------------------------------------- sync

    @GetMapping("/sync/runs")
    public List<SyncService.SyncRunDto> runs() {
        return sync.runs();
    }

    @PostMapping("/sync/nav")
    public SyncService.SyncRunDto navSync(@RequestPart(value = "file", required = false) MultipartFile file) {
        String content = file == null || file.isEmpty() ? null : read(file);
        String by = CurrentUser.get().name();
        return autoSync.exclusive("NAV", () -> sync.navSync(content, by));
    }

    @PostMapping("/sync/rta")
    public SyncService.SyncRunDto rtaSync(@RequestPart(value = "file", required = false) MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw ApiException.validation("file", "Upload the RTA CSV file");
        }
        String content = read(file);
        String by = CurrentUser.get().name();
        return autoSync.exclusive("RTA", () -> sync.rtaSync(content, by));
    }

    /** Refreshes risk-o-meter, TER, AUM, fund managers, benchmark, exit load, objective and minimums of all schemes. */
    @PostMapping("/sync/details")
    public SyncService.SyncRunDto detailsSync() {
        String by = CurrentUser.get().name();
        return autoSync.exclusive("DETAILS", () -> schemeData.detailsSync(by));
    }

    /** Adds new Regular Growth schemes of the active AMCs, deactivates schemes that left the AMFI file. */
    @PostMapping("/sync/schemes")
    public SyncService.SyncRunDto schemesSync() {
        String by = CurrentUser.get().name();
        return autoSync.exclusive("SCHEMES", () -> schemeData.schemesSync(by));
    }

    /** New fund offers of all AMCs from the AMFI scheme master + Scheme Summary Document details. */
    @PostMapping("/sync/nfos")
    public SyncService.SyncRunDto nfoSync() {
        String by = CurrentUser.get().name();
        return autoSync.exclusive("NFO", () -> nfoSync.nfoSync(by));
    }

    @GetMapping("/sync/schedule")
    public Map<String, Object> syncSchedule() {
        return autoSync.schedule();
    }

    private static String read(MultipartFile f) {
        try {
            String s = new String(f.getBytes(), StandardCharsets.UTF_8);
            return s.startsWith("﻿") ? s.substring(1) : s;
        } catch (IOException e) {
            throw ApiException.validation("file", "Could not read the uploaded file");
        }
    }

    // ---------------------------------------------------------------- brokerage

    @GetMapping("/brokerage")
    public BrokerageReport brokerage(@RequestParam(required = false) String month) {
        return admin.brokerage(month);
    }
}
