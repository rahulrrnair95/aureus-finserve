package com.aureusfinserve.publicsite;

import com.aureusfinserve.auth.AppUser;
import com.aureusfinserve.auth.AppUserRepository;
import com.aureusfinserve.auth.OtpChallenge;
import com.aureusfinserve.auth.OtpService;
import com.aureusfinserve.common.*;
import com.aureusfinserve.notification.NotificationService;
import com.aureusfinserve.publicsite.PublicRepos.LeadAttachmentRepository;
import com.aureusfinserve.publicsite.PublicRepos.LeadRepository;
import com.aureusfinserve.security.CryptoService;
import com.aureusfinserve.security.RequestInfo;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.*;

/** Website enquiries (OTP-verified mobile) and portfolio-review CAS uploads. */
@Service
@RequiredArgsConstructor
public class LeadService {

    public static final long MAX_CAS_BYTES = 10L * 1024 * 1024;

    public record LeadOtpResult(String challengeId, String devOtp) {
    }

    public record LeadForm(String name, String mobile, String email, String city, String interest, String message,
                           Boolean consent, String challengeId, String otp, String website) {
    }

    private final LeadRepository leadRepo;
    private final LeadAttachmentRepository attachmentRepo;
    private final AppUserRepository userRepo;
    private final OtpService otpService;
    private final NotificationService notifications;
    private final CryptoService crypto;

    @Transactional
    public LeadOtpResult otp(String mobile) {
        String m = mobile == null ? "" : CryptoService.normaliseMobile(mobile);
        if (!m.matches("[6-9]\\d{9}")) {
            throw ApiException.validation("mobile", "Enter a valid 10-digit mobile number");
        }
        String h = crypto.mobileHash(m);
        OtpService.OtpIssued r = otpService.issue(new OtpService.OtpTarget(OtpChallenge.Purpose.LEAD, null, m, null,
                null, h, "lead:" + h), RequestInfo.deviceId());
        return new LeadOtpResult(r.challengeId(), r.devOtp());
    }

    @Transactional(noRollbackFor = ApiException.class)
    public Map<String, Object> create(LeadForm f) {
        if (f.website() != null && !f.website().isBlank()) {
            return honeypot();
        }
        Map<String, String> errors = validate(f, true);
        LeadInterest interest = null;
        if (f.interest() != null && !f.interest().isBlank()) {
            try {
                interest = LeadInterest.valueOf(f.interest().trim().toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException e) {
                errors.put("interest", "Choose a valid interest");
            }
        } else {
            errors.put("interest", "Choose what you are interested in");
        }
        throwIf(errors);
        verifyOtp(f);
        Lead l = newLead(f, interest == null ? LeadInterest.OTHER : interest, "WEBSITE");
        return Map.of("id", l.getId(), "ok", true);
    }

    @Transactional(noRollbackFor = ApiException.class)
    public Map<String, Object> portfolioReview(LeadForm f, String casPassword, MultipartFile file) {
        if (f.website() != null && !f.website().isBlank()) {
            return honeypot();
        }
        Map<String, String> errors = validate(f, false);
        byte[] bytes = null;
        if (file == null || file.isEmpty()) {
            errors.put("file", "Attach your CAS (PDF)");
        } else if (file.getSize() > MAX_CAS_BYTES) {
            errors.put("file", "The file must be 10 MB or smaller");
        } else {
            String ct = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
            try {
                bytes = file.getBytes();
            } catch (IOException e) {
                errors.put("file", "Could not read the uploaded file");
            }
            boolean magic = bytes != null && bytes.length > 5 && bytes[0] == '%' && bytes[1] == 'P' && bytes[2] == 'D'
                    && bytes[3] == 'F' && bytes[4] == '-';
            if (bytes != null && (!ct.equals("application/pdf") || !magic)) {
                errors.put("file", "Only PDF files are accepted");
            }
        }
        if (casPassword != null && casPassword.length() > 100) {
            errors.put("casPassword", "Password is too long");
        }
        throwIf(errors);
        verifyOtp(f);
        Lead l = newLead(f, LeadInterest.PORTFOLIO_REVIEW, "PORTFOLIO_REVIEW");
        LeadAttachment a = new LeadAttachment();
        a.setLeadId(l.getId());
        String name = file.getOriginalFilename() == null ? "cas.pdf"
                : file.getOriginalFilename().replaceAll("[^A-Za-z0-9._-]", "_");
        a.setFileName(name.length() > 200 ? name.substring(name.length() - 200) : name);
        a.setContentType("application/pdf");
        a.setSizeBytes(bytes.length);
        a.setData(bytes);
        a.setCasPassword(casPassword == null || casPassword.isBlank() ? null : casPassword);
        a.setCreatedAt(Fmt.now());
        attachmentRepo.save(a);
        l.setHasAttachment(true);
        leadRepo.save(l);
        return Map.of("id", l.getId(), "ok", true);
    }

    private Map<String, Object> honeypot() {
        // Bot filled the hidden field: pretend success, store nothing.
        return Map.of("id", 100_000 + crypto.random().nextInt(900_000), "ok", true);
    }

    private Map<String, String> validate(LeadForm f, boolean needCity) {
        Map<String, String> errors = new LinkedHashMap<>();
        if (f.name() == null || f.name().trim().length() < 2 || f.name().length() > 150) {
            errors.put("name", "Enter your name");
        }
        String m = f.mobile() == null ? "" : CryptoService.normaliseMobile(f.mobile());
        if (!m.matches("[6-9]\\d{9}")) {
            errors.put("mobile", "Enter a valid 10-digit mobile number");
        }
        if (f.email() != null && !f.email().isBlank() && !f.email().trim().matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
            errors.put("email", "Enter a valid e-mail address");
        }
        if (!Boolean.TRUE.equals(f.consent())) {
            errors.put("consent", "Please consent to be contacted");
        }
        if (f.challengeId() == null || f.challengeId().isBlank()) {
            errors.put("otp", "Verify your mobile number with the OTP");
        }
        if (f.message() != null && f.message().length() > 2000) {
            errors.put("message", "Message is too long");
        }
        return errors;
    }

    private static void throwIf(Map<String, String> errors) {
        if (!errors.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION", errors.values().iterator().next(), errors);
        }
    }

    private void verifyOtp(LeadForm f) {
        String h = crypto.mobileHash(CryptoService.normaliseMobile(f.mobile()));
        OtpChallenge pre = otpService.get(f.challengeId());
        if (!h.equals(pre.getRefText())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "OTP_INVALID", "This OTP was sent to a different mobile number");
        }
        otpService.verify(f.challengeId(), f.otp(), OtpChallenge.Purpose.LEAD);
    }

    private Lead newLead(LeadForm f, LeadInterest interest, String source) {
        Lead l = new Lead();
        l.setName(f.name().trim());
        l.setMobile(CryptoService.normaliseMobile(f.mobile()));
        l.setEmail(f.email() == null || f.email().isBlank() ? null : f.email().trim());
        l.setCity(f.city() == null ? null : f.city().trim());
        l.setInterest(interest);
        l.setMessage(f.message() == null ? null : f.message().trim());
        l.setSource(source);
        l.setStatus(LeadStatus.NEW);
        l.setConsent(true);
        l.setCreatedAt(Fmt.now());
        l.setAssignedRmId(pickRm());
        leadRepo.save(l);
        String msg = l.getName() + " (" + interest + ") via " + source.toLowerCase(Locale.ROOT).replace('_', ' ');
        if (l.getAssignedRmId() != null) {
            notifications.notifyUser(l.getAssignedRmId(), NotificationType.GENERAL, "New lead assigned", msg);
        }
        userRepo.findByRoleOrderByNameAsc(Role.ADMIN).forEach(a ->
                notifications.notifyUser(a.getId(), NotificationType.GENERAL, "New website lead", msg));
        String rmName = l.getAssignedRmId() == null ? "Unassigned"
                : userRepo.findById(l.getAssignedRmId()).map(AppUser::getName).orElse("Unassigned");
        boolean review = "PORTFOLIO_REVIEW".equals(source);
        notifications.notifyFirm((review ? "New portfolio review request: " : "New website enquiry: ") + l.getName(),
                (review ? "A client has uploaded their CAS for a free portfolio review." : "A client has submitted the enquiry form.")
                        + "\n\nName: " + l.getName()
                        + "\nMobile: +91 " + l.getMobile() + " (verified by OTP)"
                        + "\nEmail: " + (l.getEmail() == null ? "-" : l.getEmail())
                        + "\nCity: " + (l.getCity() == null || l.getCity().isBlank() ? "-" : l.getCity())
                        + "\nInterested in: " + interest.name().replace('_', ' ').toLowerCase(Locale.ROOT)
                        + "\nMessage: " + (l.getMessage() == null || l.getMessage().isBlank() ? "-" : l.getMessage())
                        + "\nReceived: " + Fmt.now().toString().replace('T', ' ')
                        + "\nAssigned to: " + rmName
                        + (review ? "\n\nThe CAS PDF is stored securely; download it from Leads in the staff console." : ""));
        return l;
    }

    /** Assigns new leads to the active RM with the fewest open (NEW / CONTACTED) leads. */
    private Long pickRm() {
        List<AppUser> rms = userRepo.findByRoleOrderByNameAsc(Role.RM).stream().filter(AppUser::isEnabled).toList();
        if (rms.isEmpty()) {
            return null;
        }
        Map<Long, Long> open = new HashMap<>();
        leadRepo.findAll().stream()
                .filter(l -> l.getAssignedRmId() != null && (l.getStatus() == LeadStatus.NEW || l.getStatus() == LeadStatus.CONTACTED))
                .forEach(l -> open.merge(l.getAssignedRmId(), 1L, Long::sum));
        return rms.stream().min(Comparator.comparing((AppUser u) -> open.getOrDefault(u.getId(), 0L))
                .thenComparing(AppUser::getId)).map(AppUser::getId).orElse(null);
    }
}
