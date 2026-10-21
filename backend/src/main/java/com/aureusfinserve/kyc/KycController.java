package com.aureusfinserve.kyc;

import com.aureusfinserve.common.KycApplicationStatus;
import com.aureusfinserve.kyc.KycDtos.*;
import com.aureusfinserve.security.CurrentUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.multipart.MultipartHttpServletRequest;

import java.util.List;
import java.util.Map;

/**
 * Online KYC: public submission + status lookup (/api/public/kyc) and the staff review queue (/api/admin/kyc,
 * RM + ADMIN via SecurityConfig path rules; RM scoping is applied in {@link KycApplicationService}).
 */
@RestController
@RequiredArgsConstructor
public class KycController {

    private final KycApplicationService kyc;

    // ---------------------------------------------------------------- public

    @PostMapping("/api/public/kyc/verify-otp")
    public Map<String, Object> verifyOtp(@RequestBody VerifyOtpRequest r) {
        return kyc.verifyMobile(r);
    }

    /** multipart: flat form fields (see {@link KycForm}) + one file part per document, named by doc type. */
    @PostMapping(value = "/api/public/kyc", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> submit(@ModelAttribute KycForm form, MultipartHttpServletRequest request) {
        Map<String, MultipartFile> files = request.getFileMap();
        return kyc.submit(form, files);
    }

    @PostMapping("/api/public/kyc/status")
    public StatusResult status(@RequestBody StatusRequest r) {
        return kyc.status(r);
    }

    // ---------------------------------------------------------------- staff

    @GetMapping("/api/admin/kyc")
    public List<KycRow> list(@RequestParam(required = false) KycApplicationStatus status,
                             @RequestParam(required = false) String q) {
        return kyc.list(CurrentUser.get(), status, q);
    }

    @GetMapping("/api/admin/kyc/{id}")
    public Map<String, Object> detail(@PathVariable Long id) {
        return kyc.detail(CurrentUser.get(), id);
    }

    @PutMapping("/api/admin/kyc/{id}")
    public Map<String, Object> update(@PathVariable Long id, @Valid @RequestBody KycUpdate r) {
        return kyc.update(CurrentUser.get(), id, r);
    }

    @GetMapping("/api/admin/kyc/{id}/documents/{docId}")
    public ResponseEntity<byte[]> document(@PathVariable Long id, @PathVariable Long docId) {
        KycApplicationService.DocumentFile f = kyc.document(CurrentUser.get(), id, docId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(f.contentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(f.fileName()).build().toString())
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(f.bytes());
    }
}
