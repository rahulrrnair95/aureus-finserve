package com.aureusfinserve.nfo;

import com.aureusfinserve.nfo.NfoService.NfoDto;
import com.aureusfinserve.nfo.NfoService.OnePagerFile;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;
import java.util.List;

/** New fund offers: public lists / details / one-pager download, and the staff console (RM read-only, ADMIN edits). */
@RestController
@RequiredArgsConstructor
public class NfoController {

    private final NfoService nfos;

    // ---------------------------------------------------------------- public

    @GetMapping("/api/public/nfos")
    public List<NfoDto> publicList(@RequestParam(required = false) String status, @RequestParam(required = false) String amc,
                                   @RequestParam(required = false) String assetClass, @RequestParam(required = false) String q) {
        return nfos.publicList(status, amc, assetClass, q);
    }

    @GetMapping("/api/public/nfos/{id}")
    public NfoDto publicDetail(@PathVariable Long id) {
        return nfos.publicDetail(id);
    }

    @GetMapping("/api/public/nfos/{id}/one-pager")
    public ResponseEntity<byte[]> onePager(@PathVariable Long id) {
        return pdf(nfos.onePager(id, false), CacheControl.maxAge(Duration.ofMinutes(10)).cachePublic());
    }

    static ResponseEntity<byte[]> pdf(OnePagerFile f, CacheControl cache) {
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .cacheControl(cache)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(f.fileName()).build().toString())
                .header("X-Content-Type-Options", "nosniff")
                .body(f.data());
    }

    // ---------------------------------------------------------------- staff (RM + ADMIN read, ADMIN write)

    @GetMapping("/api/admin/nfos")
    public List<NfoDto> adminList(@RequestParam(required = false) String status, @RequestParam(required = false) String q) {
        return nfos.adminList(status, q);
    }

    @GetMapping("/api/admin/nfos/{id}")
    public NfoDto adminDetail(@PathVariable Long id) {
        return nfos.adminDetail(id);
    }

    @GetMapping("/api/admin/nfos/{id}/one-pager")
    public ResponseEntity<byte[]> adminOnePager(@PathVariable Long id) {
        return pdf(nfos.onePager(id, true), CacheControl.noStore());
    }

    @PostMapping("/api/admin/nfos")
    @PreAuthorize("hasRole('ADMIN')")
    public NfoDto create(@RequestBody(required = false) JsonNode body) {
        return nfos.create(body);
    }

    @PutMapping("/api/admin/nfos/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public NfoDto update(@PathVariable Long id, @RequestBody(required = false) JsonNode body) {
        return nfos.update(id, body);
    }

    @PostMapping("/api/admin/nfos/{id}/one-pager")
    @PreAuthorize("hasRole('ADMIN')")
    public NfoDto uploadOnePager(@PathVariable Long id, @RequestPart(value = "file", required = false) MultipartFile file) {
        return nfos.uploadOnePager(id, file);
    }

    @DeleteMapping("/api/admin/nfos/{id}/one-pager")
    @PreAuthorize("hasRole('ADMIN')")
    public NfoDto deleteOnePager(@PathVariable Long id) {
        return nfos.deleteOnePager(id);
    }
}
