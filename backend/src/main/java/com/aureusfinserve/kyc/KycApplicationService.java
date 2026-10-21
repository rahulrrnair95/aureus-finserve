package com.aureusfinserve.kyc;

import com.aureusfinserve.audit.AuditService;
import com.aureusfinserve.auth.AppUser;
import com.aureusfinserve.auth.AppUserRepository;
import com.aureusfinserve.auth.OtpChallenge;
import com.aureusfinserve.auth.OtpService;
import com.aureusfinserve.common.*;
import com.aureusfinserve.config.AppProperties;
import com.aureusfinserve.kyc.KycDtos.*;
import com.aureusfinserve.kyc.KycRepos.KycApplicationRepository;
import com.aureusfinserve.kyc.KycRepos.KycDocumentRepository;
import com.aureusfinserve.notification.NotificationService;
import com.aureusfinserve.security.AuthUser;
import com.aureusfinserve.security.CryptoService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.time.Period;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Online KYC applications: public submission (OTP-verified mobile, documents encrypted at rest), public status
 * lookup, and the staff review queue (RM: assigned to me or unassigned; ADMIN: all).
 * The website never claims KYC is complete on submission - staff verify documents, do the VIPV and upload to a KRA.
 */
@Service
@RequiredArgsConstructor
public class KycApplicationService {

    public static final long MAX_FILE_BYTES = 5L * 1024 * 1024;
    public static final long MAX_TOTAL_BYTES = 20L * 1024 * 1024;
    /** How long a mobile number verified on step 1 stays valid for the final submission. */
    public static final int VERIFIED_MOBILE_MINUTES = 60;

    public static final Set<String> MARITAL = Set.of("SINGLE", "MARRIED", "OTHER");
    public static final Set<String> OCCUPATIONS = Set.of("PRIVATE_SECTOR", "PUBLIC_SECTOR", "GOVERNMENT", "BUSINESS",
            "PROFESSIONAL", "SELF_EMPLOYED", "RETIRED", "HOMEMAKER", "STUDENT", "OTHER");
    public static final Set<String> INCOMES = Set.of("BELOW_1L", "1L_5L", "5L_10L", "10L_25L", "25L_1CR", "ABOVE_1CR");

    private static final Set<String> CONTENT_TYPES = Set.of("application/pdf", "image/jpeg", "image/png");
    private static final String PAN_RE = "[A-Z]{3}P[A-Z][0-9]{4}[A-Z]";
    private static final String NAME_RE = "[\\p{L} .'-]{2,150}";

    private final KycApplicationRepository appRepo;
    private final KycDocumentRepository docRepo;
    private final AppUserRepository userRepo;
    private final OtpService otpService;
    private final NotificationService notifications;
    private final CryptoService crypto;
    private final AuditService audit;
    private final AppProperties props;

    // ================================================================ public

    /** Step 1 of the website form: verify the mobile OTP (issued by /public/leads/otp) up front. */
    @Transactional(noRollbackFor = ApiException.class)
    public Map<String, Object> verifyMobile(VerifyOtpRequest r) {
        String m = r.mobile() == null ? "" : CryptoService.normaliseMobile(r.mobile());
        if (!m.matches("[6-9]\\d{9}")) {
            throw ApiException.validation("mobile", "Enter a valid 10-digit mobile number");
        }
        checkChallengeMobile(r.challengeId(), m);
        otpService.verifyOrConfirm(r.challengeId(), r.otp(), OtpChallenge.Purpose.LEAD, VERIFIED_MOBILE_MINUTES);
        return Map.of("ok", true, "validMinutes", VERIFIED_MOBILE_MINUTES);
    }

    @Transactional(noRollbackFor = ApiException.class)
    public Map<String, Object> submit(KycForm f, Map<String, MultipartFile> files) {
        if (f.website() != null && !f.website().isBlank()) {
            // Bot filled the hidden field: pretend success, store nothing.
            return Map.of("ref", "KYC" + Fmt.today().format(java.time.format.DateTimeFormatter.ofPattern("yyMMdd"))
                    + String.format("%04d", crypto.random().nextInt(10_000)), "ok", true);
        }
        Map<String, String> errors = new LinkedHashMap<>();
        Residency residency = parseEnum(Residency.class, f.residency());
        if (residency == null) {
            errors.put("residency", "Choose whether you live in India or abroad");
        }
        String fullName = trim(f.fullName());
        if (fullName == null || !fullName.matches(NAME_RE)) {
            errors.put("fullName", "Enter your full name as on your PAN card");
        }
        String parentName = trim(f.fatherOrSpouseName());
        if (parentName == null || !parentName.matches(NAME_RE)) {
            errors.put("fatherOrSpouseName", "Enter your father's or spouse's name");
        }
        Gender gender = parseEnum(Gender.class, f.gender());
        if (gender == null) {
            errors.put("gender", "Select your gender");
        }
        LocalDate dob = null;
        try {
            dob = f.dob() == null ? null : LocalDate.parse(f.dob().trim());
        } catch (DateTimeParseException e) {
            dob = null;
        }
        if (dob == null) {
            errors.put("dob", "Enter your date of birth");
        } else if (Period.between(dob, Fmt.today()).getYears() < 18) {
            errors.put("dob", "You must be at least 18 years old to apply online");
        } else if (Period.between(dob, Fmt.today()).getYears() > 120) {
            errors.put("dob", "Check your date of birth");
        }
        String pan = f.pan() == null ? "" : f.pan().trim().toUpperCase(Locale.ROOT);
        if (!pan.matches("[A-Z]{5}[0-9]{4}[A-Z]")) {
            errors.put("pan", "Enter a valid PAN, e.g. ABCPE1234F");
        } else if (!pan.matches(PAN_RE)) {
            errors.put("pan", "Enter an individual PAN (the 4th character is P)");
        }
        String mobile = f.mobile() == null ? "" : CryptoService.normaliseMobile(f.mobile());
        if (!mobile.matches("[6-9]\\d{9}")) {
            errors.put("mobile", "Enter a valid 10-digit mobile number");
        }
        String email = trim(f.email());
        if (email == null || email.length() > 200 || !email.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
            errors.put("email", "Enter a valid e-mail address");
        }
        String marital = upper(f.maritalStatus());
        if (marital == null || !MARITAL.contains(marital)) {
            errors.put("maritalStatus", "Select your marital status");
        }
        String occupation = upper(f.occupation());
        if (occupation == null || !OCCUPATIONS.contains(occupation)) {
            errors.put("occupation", "Select your occupation");
        }
        String income = upper(f.annualIncome());
        if (income == null || !INCOMES.contains(income)) {
            errors.put("annualIncome", "Select your annual income range");
        }
        Boolean pep = parseBool(f.politicallyExposed());
        if (pep == null) {
            errors.put("politicallyExposed", "Tell us whether you are a politically exposed person");
        }

        // ---- addresses
        String addressLine = trim(f.addressLine());
        String city = trim(f.city());
        String state = trim(f.state());
        String pincode = trim(f.pincode());
        boolean anyIndian = addressLine != null || city != null || state != null || pincode != null;
        if (residency == Residency.RESIDENT || anyIndian) {
            String suffix = residency == Residency.NRI ? " (or leave the whole Indian address blank)" : "";
            if (addressLine == null || addressLine.length() < 5 || addressLine.length() > 300) {
                errors.put("addressLine", "Enter your address (house, street, area)" + suffix);
            }
            if (city == null || city.length() > 80) {
                errors.put("city", "Enter your city" + suffix);
            }
            if (state == null || state.length() > 80) {
                errors.put("state", "Select your state" + suffix);
            }
            if (pincode == null || !pincode.matches("[1-9]\\d{5}")) {
                errors.put("pincode", "Enter a valid 6-digit PIN code" + suffix);
            }
        }
        String country = trim(f.countryOfResidence());
        String overseas = trim(f.overseasAddress());
        String taxCountry = trim(f.taxResidencyCountry());
        String tin = trim(f.foreignTin());
        String nationality = trim(f.nationality());
        if (residency == Residency.NRI) {
            if (country == null || country.length() > 80) {
                errors.put("countryOfResidence", "Select the country you live in");
            } else if (country.equalsIgnoreCase("India")) {
                errors.put("countryOfResidence", "If you live in India, apply as a resident");
            }
            if (overseas == null || overseas.length() < 10 || overseas.length() > 400) {
                errors.put("overseasAddress", "Enter your full overseas address");
            }
            if (taxCountry == null || taxCountry.length() > 80) {
                errors.put("taxResidencyCountry", "Select your country of tax residence");
            } else if (!taxCountry.equalsIgnoreCase("India") && (tin == null || tin.length() < 3)) {
                errors.put("foreignTin", "Enter your tax identification number in " + taxCountry);
            }
            if (tin != null && tin.length() > 40) {
                errors.put("foreignTin", "Tax identification number is too long");
            }
            if (nationality == null || nationality.length() > 80) {
                errors.put("nationality", "Select your nationality");
            }
        }
        String slot = trim(f.preferredVipvSlot());
        if (slot != null && slot.length() > 100) {
            errors.put("preferredVipvSlot", "Keep this under 100 characters");
        }
        if (!Boolean.TRUE.equals(parseBool(f.consent()))) {
            errors.put("consent", "Please give your consent so we can complete your KYC");
        }
        if (f.challengeId() == null || f.challengeId().isBlank()) {
            errors.put("otp", "Verify your mobile number with the OTP");
        }

        // ---- documents
        Map<KycDocType, Upload> uploads = new EnumMap<>(KycDocType.class);
        if (residency != null) {
            uploads = readDocuments(residency, files, errors);
        }
        throwIf(errors);

        checkChallengeMobile(f.challengeId(), mobile);
        if (appRepo.existsByOtpChallengeId(f.challengeId())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "OTP_INVALID",
                    "This verification was already used for an application. Please verify your mobile number again.");
        }
        otpService.verifyOrConfirm(f.challengeId(), f.otp(), OtpChallenge.Purpose.LEAD, VERIFIED_MOBILE_MINUTES);

        var now = Fmt.now();
        KycApplication a = new KycApplication();
        a.setResidency(residency);
        a.setFullName(fullName);
        a.setFatherOrSpouseName(parentName);
        a.setGender(gender);
        a.setDob(dob.toString());
        a.setPan(pan);
        a.setPanHash(crypto.panHash(pan));
        a.setMobile(mobile);
        a.setMobileHash(crypto.mobileHash(mobile));
        a.setEmail(email);
        a.setMaritalStatus(marital);
        a.setOccupation(occupation);
        a.setAnnualIncome(income);
        a.setPoliticallyExposed(pep);
        if (residency == Residency.RESIDENT || anyIndian) {
            a.setAddressLine(addressLine);
            a.setCity(city);
            a.setState(state);
            a.setPincode(pincode);
        }
        if (residency == Residency.NRI) {
            a.setCountryOfResidence(country);
            a.setOverseasAddress(overseas);
            a.setTaxResidencyCountry(taxCountry);
            a.setForeignTin(tin);
            a.setNationality(nationality);
        }
        a.setPreferredVipvSlot(slot);
        a.setConsent(true);
        a.setConsentAt(now);
        a.setOtpChallengeId(f.challengeId());
        a.setStatus(KycApplicationStatus.SUBMITTED);
        a.setCreatedAt(now);
        a.setUpdatedAt(now);
        appRepo.save(a);
        a.setRef(ref(a));
        appRepo.save(a);

        for (Map.Entry<KycDocType, Upload> e : uploads.entrySet()) {
            KycDocument d = new KycDocument();
            d.setApplicationId(a.getId());
            d.setDocType(e.getKey());
            d.setFileName(e.getValue().name());
            d.setContentType(e.getValue().contentType());
            d.setSizeBytes(e.getValue().bytes().length);
            d.setData(crypto.encryptBytes(e.getValue().bytes()));
            d.setUploadedAt(now);
            docRepo.save(d);
        }

        String summary = a.getRef() + " - " + a.getFullName() + " (" + label(residency) + "), "
                + uploads.size() + " documents";
        userRepo.findByRoleOrderByNameAsc(Role.ADMIN).forEach(u ->
                notifications.notifyUser(u.getId(), NotificationType.GENERAL, "New online KYC application", summary));
        userRepo.findByRoleOrderByNameAsc(Role.RM).stream().filter(AppUser::isEnabled).forEach(u ->
                notifications.notifyUser(u.getId(), NotificationType.GENERAL, "New online KYC application (unassigned)", summary));
        notifications.notifyFirm("New online KYC application " + a.getRef() + ": " + a.getFullName(), kycEmail(a, uploads.keySet()));
        notifications.sms(mobile, "Aureus Finserve: we have received your KYC application " + a.getRef()
                + ". Our team will verify your documents and call you for a short video verification.");
        notifications.email(email, "We have received your KYC application " + a.getRef(),
                "Dear " + fullName + ", thank you for submitting your KYC application (" + a.getRef() + "). "
                        + "Our team will verify your documents, complete a short video verification call with you and then "
                        + "register your KYC with a KRA, usually within 2-5 working days after the call.");
        audit.log("KYC_SUBMITTED", "KYC_APPLICATION", a.getId(), summary);
        return Map.of("ref", a.getRef(), "ok", true);
    }

    @Transactional(readOnly = true)
    public StatusResult status(StatusRequest r) {
        String ref = r.ref() == null ? "" : r.ref().trim().toUpperCase(Locale.ROOT);
        String mobile = r.mobile() == null ? "" : CryptoService.normaliseMobile(r.mobile());
        KycApplication a = ref.isEmpty() || !mobile.matches("\\d{10}") ? null : appRepo.findByRef(ref)
                .filter(x -> crypto.mobileHash(mobile).equals(x.getMobileHash())).orElse(null);
        if (a == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND",
                    "We could not find an application with this reference number and mobile number.");
        }
        return new StatusResult(a.getRef(), a.getStatus(), a.getCreatedAt(), a.getUpdatedAt(), publicMessage(a.getStatus()));
    }

    public static String publicMessage(KycApplicationStatus s) {
        return switch (s) {
            case SUBMITTED -> "We have received your application. Our team will check your details and documents shortly.";
            case UNDER_REVIEW -> "Our team is checking your details and documents. We will contact you to schedule a short video verification call.";
            case VIPV_SCHEDULED -> "Your video verification call is being scheduled. We will call or message you on your registered mobile number.";
            case SUBMITTED_TO_KRA -> "Your verified KYC has been uploaded to the KYC Registration Agency (KRA). Registration usually completes in 2-5 working days.";
            case KYC_REGISTERED -> "Your KYC is registered with the KRA. You can now invest in mutual funds.";
            case ACTION_REQUIRED -> "We need something more from you to continue. Please check the SMS / e-mail from us or call our office.";
            case REJECTED -> "We could not process this application. Our team will contact you with the reason and the next steps.";
        };
    }

    // ================================================================ staff

    @Transactional(readOnly = true)
    public List<KycRow> list(AuthUser u, KycApplicationStatus status, String q) {
        String n = q == null ? null : q.trim().toLowerCase(Locale.ROOT);
        String qPanHash = n != null && n.toUpperCase(Locale.ROOT).matches("[A-Z]{5}[0-9]{4}[A-Z]")
                ? crypto.panHash(n) : null;
        String qMobileHash = n != null && n.replaceAll("\\D", "").length() == 10 && n.matches("[\\d +-]+")
                ? crypto.mobileHash(n) : null;
        List<KycApplication> apps = appRepo.findAllByOrderByCreatedAtDescIdDesc().stream()
                .filter(a -> visible(u, a))
                .filter(a -> status == null || a.getStatus() == status)
                .filter(a -> n == null || n.isEmpty()
                        || a.getFullName().toLowerCase(Locale.ROOT).contains(n)
                        || (a.getRef() != null && a.getRef().toLowerCase(Locale.ROOT).contains(n))
                        || (a.getEmail() != null && a.getEmail().toLowerCase(Locale.ROOT).contains(n))
                        || (a.getCity() != null && a.getCity().toLowerCase(Locale.ROOT).contains(n))
                        || (a.getCountryOfResidence() != null && a.getCountryOfResidence().toLowerCase(Locale.ROOT).contains(n))
                        || (qPanHash != null && qPanHash.equals(a.getPanHash()))
                        || (qMobileHash != null && qMobileHash.equals(a.getMobileHash())))
                .toList();
        return rows(apps);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> detail(AuthUser u, Long id) {
        return detailOf(scoped(u, id));
    }

    @Transactional
    public Map<String, Object> update(AuthUser u, Long id, KycUpdate r) {
        KycApplication a = scoped(u, id);
        StringBuilder d = new StringBuilder();
        if (r.assignedRmId() != null && !r.assignedRmId().equals(a.getAssignedRmId())) {
            if (!u.isAdmin()) {
                throw ApiException.forbidden("Only an admin can reassign KYC applications");
            }
            AppUser rm = userRepo.findById(r.assignedRmId()).filter(x -> x.getRole() == Role.RM || x.getRole() == Role.ADMIN)
                    .orElseThrow(() -> ApiException.validation("assignedRmId", "Select a valid relationship manager"));
            a.setAssignedRmId(rm.getId());
            d.append("assigned to ").append(rm.getName()).append("; ");
            if (!rm.getId().equals(u.userId())) {
                notifications.notifyUser(rm.getId(), NotificationType.GENERAL, "KYC application assigned to you",
                        a.getRef() + " - " + a.getFullName());
            }
        } else if (a.getAssignedRmId() == null && u.isRm()) {
            // An RM working on an unassigned application takes ownership of it.
            a.setAssignedRmId(u.userId());
            d.append("picked up by ").append(u.name()).append("; ");
        }
        KycApplicationStatus old = a.getStatus();
        if (r.status() != null && r.status() != old) {
            d.append(old).append(" -> ").append(r.status()).append("; ");
            a.setStatus(r.status());
        }
        if (r.staffNotes() != null && !Objects.equals(r.staffNotes(), a.getStaffNotes())) {
            a.setStaffNotes(r.staffNotes().isBlank() ? null : r.staffNotes());
            d.append("notes updated; ");
        }
        a.setUpdatedAt(Fmt.now());
        appRepo.save(a);
        if (a.getStatus() != old) {
            String msg = "Aureus Finserve: update on your KYC application " + a.getRef() + ". " + publicMessage(a.getStatus());
            notifications.sms(a.getMobile(), msg);
            notifications.email(a.getEmail(), "Update on your KYC application " + a.getRef(), msg);
        }
        audit.log("KYC_UPDATED", "KYC_APPLICATION", a.getId(),
                a.getRef() + ": " + (d.length() == 0 ? "no changes" : d.toString()));
        return detailOf(a);
    }

    public record DocumentFile(String fileName, String contentType, byte[] bytes) {
    }

    @Transactional(readOnly = true)
    public DocumentFile document(AuthUser u, Long id, Long docId) {
        KycApplication a = scoped(u, id);
        KycDocument d = docRepo.findById(docId).filter(x -> x.getApplicationId().equals(a.getId()))
                .orElseThrow(() -> ApiException.notFound("Document"));
        byte[] bytes = crypto.decryptBytes(d.getData());
        audit.log("KYC_DOCUMENT_DOWNLOADED", "KYC_APPLICATION", a.getId(),
                a.getRef() + ": " + d.getDocType() + " " + d.getFileName());
        return new DocumentFile(d.getFileName(), d.getContentType(), bytes);
    }

    /** Dashboard KPI: applications still needing work, within the staff user's scope. */
    @Transactional(readOnly = true)
    public long pendingCount(AuthUser u) {
        return appRepo.findByStatusIn(Arrays.stream(KycApplicationStatus.values()).filter(KycApplicationStatus::isPending).toList())
                .stream().filter(a -> visible(u, a)).count();
    }

    // ================================================================ helpers

    private boolean visible(AuthUser u, KycApplication a) {
        return u.isAdmin() || a.getAssignedRmId() == null || u.userId().equals(a.getAssignedRmId());
    }

    private KycApplication scoped(AuthUser u, Long id) {
        KycApplication a = appRepo.findById(id).orElseThrow(() -> ApiException.notFound("KYC application"));
        if (!visible(u, a)) {
            throw ApiException.forbidden("This KYC application is assigned to another relationship manager");
        }
        return a;
    }

    private List<KycRow> rows(List<KycApplication> apps) {
        if (apps.isEmpty()) {
            return List.of();
        }
        Map<Long, Long> docCounts = docRepo.metadata(apps.stream().map(KycApplication::getId).toList()).stream()
                .collect(Collectors.groupingBy(KycDocumentMeta::applicationId, Collectors.counting()));
        Map<Long, String> rms = rmNames(apps);
        return apps.stream().map(a -> row(a, rms, docCounts.getOrDefault(a.getId(), 0L).intValue())).toList();
    }

    private Map<Long, String> rmNames(List<KycApplication> apps) {
        return userRepo.findAllById(apps.stream().map(KycApplication::getAssignedRmId).filter(Objects::nonNull)
                .collect(Collectors.toSet())).stream().collect(Collectors.toMap(AppUser::getId, AppUser::getName));
    }

    private static KycRow row(KycApplication a, Map<Long, String> rms, int docs) {
        String location = a.getResidency() == Residency.NRI
                ? a.getCountryOfResidence()
                : a.getCity() == null ? null : a.getCity() + (a.getState() == null ? "" : ", " + a.getState());
        return new KycRow(a.getId(), a.getRef(), a.getResidency(), a.getFullName(), Fmt.maskPan(a.getPan()),
                Fmt.maskMobile(a.getMobile()), a.getEmail(), location, a.getStatus(), a.getAssignedRmId(),
                a.getAssignedRmId() == null ? null : rms.get(a.getAssignedRmId()), docs, a.getCreatedAt(), a.getUpdatedAt());
    }

    private Map<String, Object> detailOf(KycApplication a) {
        List<DocumentDto> docs = docRepo.metadata(List.of(a.getId())).stream()
                .map(d -> new DocumentDto(d.id(), d.docType(), d.docType().label(), d.fileName(), d.contentType(),
                        d.sizeBytes(), d.uploadedAt())).toList();
        KycRow row = row(a, rmNames(List.of(a)), docs.size());
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", row.id());
        m.put("ref", row.ref());
        m.put("residency", row.residency());
        m.put("fullName", row.fullName());
        m.put("panMasked", row.panMasked());
        m.put("mobileMasked", row.mobileMasked());
        m.put("email", row.email());
        m.put("location", row.location());
        m.put("status", row.status());
        m.put("assignedRmId", row.assignedRmId());
        m.put("assignedRmName", row.assignedRmName());
        m.put("documentCount", row.documentCount());
        m.put("createdAt", row.createdAt());
        m.put("updatedAt", row.updatedAt());
        m.put("fatherOrSpouseName", a.getFatherOrSpouseName());
        m.put("gender", a.getGender());
        LocalDate dob = a.dobDate();
        m.put("dobMasked", dob == null ? null : "XX-XX-" + dob.getYear());
        m.put("age", dob == null ? null : Period.between(dob, Fmt.today()).getYears());
        m.put("maritalStatus", a.getMaritalStatus());
        m.put("occupation", a.getOccupation());
        m.put("annualIncome", a.getAnnualIncome());
        m.put("politicallyExposed", a.isPoliticallyExposed());
        m.put("addressMasked", maskText(a.getAddressLine()));
        m.put("city", a.getCity());
        m.put("state", a.getState());
        m.put("pincode", a.getPincode());
        m.put("countryOfResidence", a.getCountryOfResidence());
        m.put("overseasAddressMasked", maskText(a.getOverseasAddress()));
        m.put("taxResidencyCountry", a.getTaxResidencyCountry());
        m.put("foreignTinMasked", a.getForeignTin() == null ? null : Fmt.maskAccount(a.getForeignTin()));
        m.put("nationality", a.getNationality());
        m.put("preferredVipvSlot", a.getPreferredVipvSlot());
        m.put("consent", a.isConsent());
        m.put("consentAt", a.getConsentAt());
        m.put("staffNotes", a.getStaffNotes());
        m.put("documents", docs);
        return m;
    }

    /** First 4 and last 4 characters of a free-text value (addresses); full text is in the uploaded proofs. */
    static String maskText(String s) {
        if (s == null || s.isBlank()) {
            return null;
        }
        String t = s.trim();
        if (t.length() <= 10) {
            return t.charAt(0) + "*****";
        }
        return t.substring(0, 4) + " ***** " + t.substring(t.length() - 4);
    }

    private record Upload(String name, String contentType, byte[] bytes) {
    }

    private Map<KycDocType, Upload> readDocuments(Residency residency, Map<String, MultipartFile> files,
                                                  Map<String, String> errors) {
        Map<KycDocType, Upload> out = new EnumMap<>(KycDocType.class);
        List<KycDocType> allowed = KycDocType.allowed(residency);
        long total = 0;
        for (Map.Entry<String, MultipartFile> e : (files == null ? Map.<String, MultipartFile>of() : files).entrySet()) {
            MultipartFile file = e.getValue();
            if (file == null || file.isEmpty()) {
                continue;
            }
            KycDocType type = parseEnum(KycDocType.class, e.getKey());
            if (type == null) {
                continue; // not a document part
            }
            String key = type.name();
            if (!allowed.contains(type)) {
                errors.put(key, type.label() + " is not needed for " + label(residency).toLowerCase(Locale.ROOT) + " applicants");
                continue;
            }
            if (file.getSize() > MAX_FILE_BYTES) {
                errors.put(key, type.label() + ": each file must be 5 MB or smaller");
                continue;
            }
            byte[] bytes;
            try {
                bytes = file.getBytes();
            } catch (IOException ex) {
                errors.put(key, type.label() + ": the file could not be read");
                continue;
            }
            String ct = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
            if (ct.equals("image/jpg")) {
                ct = "image/jpeg";
            }
            String sniffed = sniff(bytes);
            if (!CONTENT_TYPES.contains(ct) || sniffed == null || !sniffed.equals(ct)) {
                errors.put(key, type.label() + ": only PDF, JPG or PNG files are accepted");
                continue;
            }
            total += bytes.length;
            out.put(type, new Upload(safeName(file.getOriginalFilename(), type, sniffed), sniffed, bytes));
        }
        for (KycDocType req : KycDocType.required(residency)) {
            if (!out.containsKey(req) && !errors.containsKey(req.name())) {
                errors.put(req.name(), "Upload your " + req.label().toLowerCase(Locale.ROOT).replace("pan card", "PAN card"));
            }
        }
        if (total > MAX_TOTAL_BYTES) {
            errors.put("documents", "All documents together must be 20 MB or smaller");
        }
        return out;
    }

    /** Content type from the file's magic bytes (PDF / JPEG / PNG), or null. */
    static String sniff(byte[] b) {
        if (b == null || b.length < 8) {
            return null;
        }
        if (b[0] == '%' && b[1] == 'P' && b[2] == 'D' && b[3] == 'F' && b[4] == '-') {
            return "application/pdf";
        }
        if ((b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) {
            return "image/jpeg";
        }
        if ((b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G' && b[4] == 0x0D && b[5] == 0x0A
                && b[6] == 0x1A && b[7] == 0x0A) {
            return "image/png";
        }
        return null;
    }

    private static String safeName(String original, KycDocType type, String ct) {
        String ext = ct.equals("application/pdf") ? ".pdf" : ct.equals("image/png") ? ".png" : ".jpg";
        String n = original == null || original.isBlank() ? type.name().toLowerCase(Locale.ROOT) + ext
                : original.replaceAll("[^A-Za-z0-9._-]", "_");
        return n.length() > 200 ? n.substring(n.length() - 200) : n;
    }

    private void checkChallengeMobile(String challengeId, String mobile) {
        OtpChallenge pre = otpService.get(challengeId);
        if (!crypto.mobileHash(mobile).equals(pre.getRefText())) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "OTP_INVALID", "This OTP was sent to a different mobile number");
        }
    }

    static String ref(KycApplication a) {
        return "KYC" + a.getCreatedAt().format(java.time.format.DateTimeFormatter.ofPattern("yyMMdd"))
                + String.format("%04d", a.getId() % 10000);
    }

    private static String label(Residency r) {
        return r == Residency.NRI ? "NRI" : "Resident";
    }

    private static void throwIf(Map<String, String> errors) {
        if (!errors.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION", errors.values().iterator().next(), errors);
        }
    }

    private static String trim(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static String upper(String s) {
        return s == null || s.isBlank() ? null : s.trim().toUpperCase(Locale.ROOT);
    }

    private static Boolean parseBool(String s) {
        if (s == null) {
            return null;
        }
        return switch (s.trim().toLowerCase(Locale.ROOT)) {
            case "true", "yes", "on", "1" -> Boolean.TRUE;
            case "false", "no", "0" -> Boolean.FALSE;
            default -> null;
        };
    }

    private static <E extends Enum<E>> E parseEnum(Class<E> type, String v) {
        if (v == null || v.isBlank()) {
            return null;
        }
        try {
            return Enum.valueOf(type, v.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    /** E-mail to the firm for a new application. PAN is masked: the full record and documents stay in the console. */
    private String kycEmail(KycApplication a, java.util.Set<KycDocType> docs) {
        StringBuilder b = new StringBuilder("A client has submitted an online KYC application.\n\n");
        java.util.function.BiConsumer<String, Object> line = (k, v) ->
                b.append(k).append(": ").append(v == null || v.toString().isBlank() ? "-" : v).append('\n');
        line.accept("Reference", a.getRef());
        line.accept("Residency", label(a.getResidency()));
        line.accept("Name", a.getFullName());
        line.accept("Father / spouse name", a.getFatherOrSpouseName());
        line.accept("Gender", a.getGender());
        line.accept("Date of birth", a.getDob());
        line.accept("PAN", Fmt.maskPan(a.getPan()));
        line.accept("Mobile", "+91 " + a.getMobile() + " (verified by OTP)");
        line.accept("Email", a.getEmail());
        line.accept("Occupation", a.getOccupation());
        line.accept("Annual income", a.getAnnualIncome());
        line.accept("Politically exposed person", a.isPoliticallyExposed() ? "Yes" : "No");
        if (a.getResidency() == Residency.NRI) {
            line.accept("Country of residence", a.getCountryOfResidence());
            line.accept("Tax residency", a.getTaxResidencyCountry());
            line.accept("Nationality", a.getNationality());
        }
        line.accept("Indian address", a.getCity() == null ? null
                : a.getCity() + (a.getState() == null ? "" : ", " + a.getState()) + (a.getPincode() == null ? "" : " " + a.getPincode()));
        line.accept("Preferred video verification slot", a.getPreferredVipvSlot());
        line.accept("Documents uploaded", docs.stream().map(Enum::name).map(n -> n.replace('_', ' ').toLowerCase(Locale.ROOT))
                .collect(java.util.stream.Collectors.joining(", ")));
        line.accept("Received", a.getCreatedAt() == null ? null : a.getCreatedAt().toString().replace('T', ' '));
        b.append("\nNext: check the documents, schedule the video verification and register the KYC with the KRA "
                + "(KYC requests in the staff console).");
        return b.toString();
    }
}
