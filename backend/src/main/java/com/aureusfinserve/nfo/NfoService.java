package com.aureusfinserve.nfo;

import com.aureusfinserve.audit.AuditService;
import com.aureusfinserve.common.ApiException;
import com.aureusfinserve.common.Fmt;
import com.aureusfinserve.common.Risk;
import com.aureusfinserve.nfo.NfoRepos.NfoOnePagerRepository;
import com.aureusfinserve.nfo.NfoRepos.NfoRepository;
import com.aureusfinserve.nfo.NfoRules.Status;
import com.aureusfinserve.sync.SchemeRules;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.function.Consumer;
import java.util.function.Supplier;

/** Public NFO lists, staff edits, manual NFOs and one-pager files. The daily import is {@code sync.NfoSync}. */
@Service
@RequiredArgsConstructor
public class NfoService {

    public static final long MAX_ONE_PAGER_BYTES = 10L * 1024 * 1024;
    /** Fields the import never fills / overwrites (featured / hidden / sidUrl are staff-only anyway). */
    public static final List<String> EDITABLE_FIELDS = List.of("amc", "schemeName", "assetClass", "subCategory", "openDate",
            "closeDate", "riskometer", "benchmark", "fundManagers", "exitLoad", "objective", "sidUrl", "minAmount",
            "minAmountText");

    /**
     * NFO as returned by the API. The last block ({@code hidden} ... {@code updatedAt}) is filled for staff only and
     * left out of public responses.
     */
    public record NfoDto(Long id, String schemeCode, String amc, String amcLegalName, String schemeName, String schemeType,
                         String amfiCategory, String assetClass, String subCategory, String minAmountText, BigDecimal minAmount,
                         LocalDate openDate, LocalDate closeDate, String closeDateSource, LocalDate closesBy,
                         boolean closeDateConfirmed, String status, Integer daysLeft, Integer opensInDays, Risk riskometer,
                         String benchmark, String fundManagers, String exitLoad, String objective, String sidUrl,
                         boolean hasOnePager, String onePagerUrl, LocalDateTime onePagerUpdatedAt, boolean featured,
                         @JsonInclude(JsonInclude.Include.NON_NULL) Boolean hidden,
                         @JsonInclude(JsonInclude.Include.NON_NULL) String source,
                         @JsonInclude(JsonInclude.Include.NON_NULL) List<String> staffEditedFields,
                         @JsonInclude(JsonInclude.Include.NON_NULL) String onePagerFileName,
                         @JsonInclude(JsonInclude.Include.NON_NULL) Integer onePagerSize,
                         @JsonInclude(JsonInclude.Include.NON_NULL) LocalDateTime createdAt,
                         @JsonInclude(JsonInclude.Include.NON_NULL) LocalDateTime updatedAt) {
    }

    public record OnePagerFile(String fileName, byte[] data) {
    }

    private final NfoRepository repo;
    private final NfoOnePagerRepository files;
    private final AuditService audit;

    // ---------------------------------------------------------------- DTO

    public static NfoDto dto(Nfo n, LocalDate today, boolean staff) {
        Status st = NfoRules.status(n.getOpenDate(), n.getCloseDate(), today);
        return new NfoDto(n.getId(), n.getSchemeCode(), n.getAmcDisplay(), n.getAmcName(), n.getSchemeName(), n.getSchemeType(),
                n.getAmfiCategory(), n.getAssetClass(), n.getSubCategory(), n.getMinAmountText(), n.getMinAmount(),
                n.getOpenDate(), n.getCloseDate(), n.getCloseDateSource(), NfoRules.closesBy(n.getOpenDate(), n.getCloseDate()),
                n.getCloseDate() != null, st.name(), NfoRules.daysLeft(n.getOpenDate(), n.getCloseDate(), today),
                NfoRules.opensInDays(n.getOpenDate(), today), n.getRiskometer(), n.getBenchmark(), n.getFundManagers(),
                n.getExitLoad(), n.getObjective(), n.getSidUrl(), n.hasOnePager(),
                n.hasOnePager() ? "/api/public/nfos/" + n.getId() + "/one-pager" : null, n.getOnePagerUpdatedAt(), n.isFeatured(),
                staff ? n.isHidden() : null, staff ? n.getSource() : null, staff ? editedList(n) : null,
                staff ? n.getOnePagerFileName() : null, staff ? n.getOnePagerSize() : null,
                staff ? n.getCreatedAt() : null, staff ? n.getUpdatedAt() : null);
    }

    static List<String> editedList(Nfo n) {
        String s = n.getStaffEditedFields();
        if (s == null || s.isBlank()) {
            return List.of();
        }
        return Arrays.stream(s.split(",")).map(String::trim).filter(x -> !x.isEmpty()).toList();
    }

    public static boolean isStaffEdited(Nfo n, String field) {
        return editedList(n).contains(field);
    }

    static void markEdited(Nfo n, Collection<String> fields) {
        LinkedHashSet<String> all = new LinkedHashSet<>(editedList(n));
        all.addAll(fields);
        all.remove("featured");
        all.remove("hidden");
        n.setStaffEditedFields(all.isEmpty() ? null : String.join(",", all));
    }

    // ---------------------------------------------------------------- public

    /**
     * @param status open | upcoming | closed (closed in the last 30 days) | all (all three); null = open + upcoming
     */
    @Transactional(readOnly = true)
    public List<NfoDto> publicList(String status, String amc, String assetClass, String q) {
        LocalDate today = Fmt.today();
        Set<Status> wanted = statuses(status, false);
        return repo.findAll().stream()
                .filter(n -> !n.isHidden() && NfoRules.isPublicWindow(n.getOpenDate(), n.getCloseDate(), today))
                .filter(n -> wanted.contains(NfoRules.status(n.getOpenDate(), n.getCloseDate(), today)))
                .filter(n -> matches(n, amc, assetClass, q))
                .sorted(publicOrder(today))
                .map(n -> dto(n, today, false)).toList();
    }

    @Transactional(readOnly = true)
    public NfoDto publicDetail(Long id) {
        Nfo n = repo.findById(id).filter(x -> !x.isHidden()).orElseThrow(() -> ApiException.notFound("NFO"));
        return dto(n, Fmt.today(), false);
    }

    @Transactional(readOnly = true)
    public OnePagerFile onePager(Long id, boolean staff) {
        Nfo n = repo.findById(id).filter(x -> staff || !x.isHidden()).filter(Nfo::hasOnePager)
                .orElseThrow(() -> ApiException.notFound("One-pager"));
        NfoOnePager f = files.findById(n.getId()).orElseThrow(() -> ApiException.notFound("One-pager"));
        return new OnePagerFile(downloadName(n), f.getData());
    }

    /** "Choice Large & Mid Cap Fund" -> "Choice-Large-Mid-Cap-Fund-NFO-one-pager.pdf" */
    static String downloadName(Nfo n) {
        String base = n.getSchemeName() == null ? "NFO" : n.getSchemeName().replaceAll("[^A-Za-z0-9]+", "-").replaceAll("^-+|-+$", "");
        if (base.length() > 120) {
            base = base.substring(0, 120).replaceAll("-+$", "");
        }
        return (base.isEmpty() ? "NFO" : base) + "-NFO-one-pager.pdf";
    }

    private static Set<Status> statuses(String status, boolean staff) {
        if (status == null || status.isBlank()) {
            return staff ? EnumSet.allOf(Status.class) : EnumSet.of(Status.OPEN, Status.UPCOMING);
        }
        return switch (status.trim().toLowerCase(Locale.ROOT)) {
            case "open" -> EnumSet.of(Status.OPEN);
            case "upcoming" -> EnumSet.of(Status.UPCOMING);
            case "closed" -> EnumSet.of(Status.CLOSED);
            case "all" -> EnumSet.allOf(Status.class);
            default -> throw ApiException.validation("status", "status must be open, upcoming, closed or all");
        };
    }

    private static boolean matches(Nfo n, String amc, String assetClass, String q) {
        if (amc != null && !amc.isBlank() && !amc.trim().equalsIgnoreCase(n.getAmcDisplay())) {
            return false;
        }
        if (assetClass != null && !assetClass.isBlank() && !assetClass.trim().equalsIgnoreCase(n.getAssetClass())) {
            return false;
        }
        if (q != null && !q.isBlank()) {
            String needle = q.trim().toLowerCase(Locale.ROOT);
            return java.util.stream.Stream.of(n.getSchemeName(), n.getAmcDisplay(), n.getAmcName(), n.getSubCategory(),
                            n.getAmfiCategory(), n.getSchemeCode())
                    .anyMatch(v -> v != null && v.toLowerCase(Locale.ROOT).contains(needle));
        }
        return true;
    }

    /** Featured first; then open (closing soonest first), upcoming (opening soonest first), recently closed (latest first). */
    static Comparator<Nfo> publicOrder(LocalDate today) {
        return Comparator.comparing((Nfo n) -> !n.isFeatured())
                .thenComparing(n -> NfoRules.status(n.getOpenDate(), n.getCloseDate(), today).ordinal() == 1 ? 0
                        : NfoRules.status(n.getOpenDate(), n.getCloseDate(), today).ordinal() == 0 ? 1 : 2)
                .thenComparing(n -> sortDate(n, today))
                .thenComparing(Nfo::getSchemeName, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER));
    }

    private static long sortDate(Nfo n, LocalDate today) {
        return switch (NfoRules.status(n.getOpenDate(), n.getCloseDate(), today)) {
            case OPEN -> NfoRules.closesBy(n.getOpenDate(), n.getCloseDate()).toEpochDay();
            case UPCOMING -> n.getOpenDate().toEpochDay();
            case CLOSED -> -NfoRules.closesBy(n.getOpenDate(), n.getCloseDate()).toEpochDay();
        };
    }

    // ---------------------------------------------------------------- staff

    @Transactional(readOnly = true)
    public List<NfoDto> adminList(String status, String q) {
        LocalDate today = Fmt.today();
        Set<Status> wanted = statuses(status, true);
        return repo.findAllByOrderByOpenDateDescIdDesc().stream()
                .filter(n -> wanted.contains(NfoRules.status(n.getOpenDate(), n.getCloseDate(), today)))
                .filter(n -> matches(n, null, null, q))
                .map(n -> dto(n, today, true)).toList();
    }

    @Transactional(readOnly = true)
    public NfoDto adminDetail(Long id) {
        return dto(get(id), Fmt.today(), true);
    }

    private Nfo get(Long id) {
        return repo.findById(id).orElseThrow(() -> ApiException.notFound("NFO"));
    }

    /** Manual NFO (e.g. announced by the AMC before AMFI lists it). Required: amc, schemeName, assetClass, openDate. */
    @Transactional
    public NfoDto create(JsonNode body) {
        Nfo n = new Nfo();
        n.setSource("MANUAL");
        n.setAssetClass("OTHER");
        Map<String, String> errors = new LinkedHashMap<>();
        List<String> changed = apply(n, body == null ? com.fasterxml.jackson.databind.node.NullNode.getInstance() : body, errors);
        if (blank(n.getAmcDisplay())) {
            errors.putIfAbsent("amc", "Enter the AMC (fund house)");
        }
        if (blank(n.getSchemeName())) {
            errors.putIfAbsent("schemeName", "Enter the scheme name");
        }
        if (body == null || !body.hasNonNull("assetClass")) {
            errors.putIfAbsent("assetClass", "Choose the category");
        }
        if (n.getOpenDate() == null) {
            errors.putIfAbsent("openDate", "Enter the date the NFO opens");
        }
        validateDates(n, errors);
        if (!errors.isEmpty()) {
            throw new ApiException(org.springframework.http.HttpStatus.BAD_REQUEST, "VALIDATION", errors.values().iterator().next(), errors);
        }
        n.setAmcName(n.getAmcDisplay());
        n.setSchemeKey(NfoRules.key(n.getAmcName(), n.getSchemeName()));
        markEdited(n, changed);
        LocalDateTime now = Fmt.now();
        n.setCreatedAt(now);
        n.setUpdatedAt(now);
        repo.save(n);
        audit.log("NFO_UPDATED", "NFO", n.getId(), "Manual NFO added: " + n.getSchemeName() + " (" + n.getAmcDisplay() + ")");
        return dto(n, Fmt.today(), true);
    }

    /** Partial update: only the keys present in the body change ({@code null} / "" clears). Changed fields become staff-edited. */
    @Transactional
    public NfoDto update(Long id, JsonNode body) {
        Nfo n = get(id);
        Map<String, String> errors = new LinkedHashMap<>();
        List<String> changed = apply(n, body == null ? com.fasterxml.jackson.databind.node.NullNode.getInstance() : body, errors);
        if (blank(n.getAmcDisplay())) {
            errors.putIfAbsent("amc", "Enter the AMC (fund house)");
        }
        if (blank(n.getSchemeName())) {
            errors.putIfAbsent("schemeName", "Enter the scheme name");
        }
        if (n.getOpenDate() == null) {
            errors.putIfAbsent("openDate", "Enter the date the NFO opens");
        }
        validateDates(n, errors);
        if (!errors.isEmpty()) {
            throw new ApiException(org.springframework.http.HttpStatus.BAD_REQUEST, "VALIDATION", errors.values().iterator().next(), errors);
        }
        if (!changed.isEmpty()) {
            markEdited(n, changed);
            n.setUpdatedAt(Fmt.now());
            repo.save(n);
            audit.log("NFO_UPDATED", "NFO", n.getId(), n.getSchemeName() + ": " + String.join(", ", changed));
        }
        return dto(n, Fmt.today(), true);
    }

    private static void validateDates(Nfo n, Map<String, String> errors) {
        if (n.getOpenDate() != null && n.getCloseDate() != null && n.getCloseDate().isBefore(n.getOpenDate())) {
            errors.putIfAbsent("closeDate", "The close date cannot be before the open date");
        }
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    /** Applies the known keys of the body; returns the names of the fields that changed. */
    private static List<String> apply(Nfo n, JsonNode b, Map<String, String> errors) {
        List<String> changed = new ArrayList<>();
        text(b, "amc", 150, n::getAmcDisplay, n::setAmcDisplay, changed, errors);
        text(b, "schemeName", 250, n::getSchemeName, n::setSchemeName, changed, errors);
        text(b, "subCategory", 60, n::getSubCategory, n::setSubCategory, changed, errors);
        text(b, "benchmark", 150, n::getBenchmark, n::setBenchmark, changed, errors);
        text(b, "fundManagers", 300, n::getFundManagers, n::setFundManagers, changed, errors);
        text(b, "exitLoad", 1000, n::getExitLoad, n::setExitLoad, changed, errors);
        text(b, "objective", 2000, n::getObjective, n::setObjective, changed, errors);
        text(b, "minAmountText", 300, n::getMinAmountText, n::setMinAmountText, changed, errors);
        if (b.has("sidUrl")) {
            String v = clean(b.get("sidUrl"));
            if (v != null && !v.matches("(?i)^https?://\\S+$")) {
                errors.put("sidUrl", "Enter a full web address starting with https://");
            } else if (v != null && v.length() > 300) {
                errors.put("sidUrl", "The link must be 300 characters or fewer");
            } else if (!Objects.equals(v, n.getSidUrl())) {
                n.setSidUrl(v);
                changed.add("sidUrl");
            }
        }
        if (b.has("assetClass")) {
            String v = clean(b.get("assetClass"));
            String up = v == null ? null : v.toUpperCase(Locale.ROOT);
            if (up == null || !NfoRules.ASSET_CLASSES.contains(up)) {
                errors.put("assetClass", "Choose Equity, Debt, Hybrid or Other");
            } else if (!up.equals(n.getAssetClass()) || n.getId() == null) {
                n.setAssetClass(up);
                changed.add("assetClass");
            }
        }
        if (b.has("riskometer")) {
            String v = clean(b.get("riskometer"));
            Risk r = null;
            if (v != null) {
                try {
                    r = Risk.valueOf(v.toUpperCase(Locale.ROOT));
                } catch (IllegalArgumentException e) {
                    errors.put("riskometer", "Unknown risk level");
                }
            }
            if (!errors.containsKey("riskometer") && r != n.getRiskometer()) {
                n.setRiskometer(r);
                changed.add("riskometer");
            }
        }
        if (b.has("minAmount")) {
            JsonNode v = b.get("minAmount");
            BigDecimal m = null;
            if (v != null && !v.isNull() && !(v.isTextual() && v.asText().isBlank())) {
                try {
                    m = new BigDecimal(v.asText().trim().replace(",", "")).setScale(2, RoundingMode.HALF_UP);
                    if (m.signum() < 0 || m.compareTo(BigDecimal.valueOf(100_000_000)) > 0) {
                        errors.put("minAmount", "Enter an amount between 0 and 10 crore");
                    }
                } catch (NumberFormatException e) {
                    errors.put("minAmount", "Enter the minimum investment in rupees");
                }
            }
            if (!errors.containsKey("minAmount") && !sameAmount(m, n.getMinAmount())) {
                n.setMinAmount(m);
                changed.add("minAmount");
            }
        }
        LocalDate open = date(b, "openDate", errors);
        if (b.has("openDate") && !errors.containsKey("openDate") && !Objects.equals(open, n.getOpenDate())) {
            n.setOpenDate(open);
            changed.add("openDate");
        }
        LocalDate close = date(b, "closeDate", errors);
        if (b.has("closeDate") && !errors.containsKey("closeDate") && !Objects.equals(close, n.getCloseDate())) {
            n.setCloseDate(close);
            n.setCloseDateSource(close == null ? null : "STAFF");
            changed.add("closeDate");
        }
        if (b.has("featured") && b.get("featured").isBoolean() && b.get("featured").asBoolean() != n.isFeatured()) {
            n.setFeatured(b.get("featured").asBoolean());
            changed.add("featured");
        }
        if (b.has("hidden") && b.get("hidden").isBoolean() && b.get("hidden").asBoolean() != n.isHidden()) {
            n.setHidden(b.get("hidden").asBoolean());
            changed.add("hidden");
        }
        return changed;
    }

    private static boolean sameAmount(BigDecimal a, BigDecimal b) {
        return a == null ? b == null : b != null && a.compareTo(b) == 0;
    }

    private static String clean(JsonNode v) {
        if (v == null || v.isNull()) {
            return null;
        }
        return SchemeRules.clean(v.asText());
    }

    private static void text(JsonNode b, String key, int max, Supplier<String> get, Consumer<String> set, List<String> changed,
                             Map<String, String> errors) {
        if (!b.has(key)) {
            return;
        }
        String v = b.get(key) == null || b.get(key).isNull() ? null : b.get(key).asText().trim();
        if (v != null && v.isEmpty()) {
            v = null;
        }
        if (v != null && v.length() > max) {
            errors.put(key, "Must be " + max + " characters or fewer");
            return;
        }
        if (!Objects.equals(v, get.get())) {
            set.accept(v);
            changed.add(key);
        }
    }

    private static LocalDate date(JsonNode b, String key, Map<String, String> errors) {
        if (!b.has(key) || b.get(key).isNull() || b.get(key).asText().isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(b.get(key).asText().trim());
        } catch (DateTimeParseException e) {
            errors.put(key, "Enter the date as YYYY-MM-DD");
            return null;
        }
    }

    // ---------------------------------------------------------------- one-pager

    @Transactional
    public NfoDto uploadOnePager(Long id, MultipartFile file) {
        Nfo n = get(id);
        if (file == null || file.isEmpty()) {
            throw ApiException.validation("file", "Choose the one-pager PDF");
        }
        if (file.getSize() > MAX_ONE_PAGER_BYTES) {
            throw ApiException.validation("file", "The one-pager must be 10 MB or smaller");
        }
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw ApiException.validation("file", "Could not read the uploaded file");
        }
        String ct = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        boolean ctOk = ct.isEmpty() || ct.startsWith("application/pdf") || ct.equals("application/x-pdf") || ct.equals("application/octet-stream");
        if (!ctOk || !isPdf(bytes)) {
            throw ApiException.validation("file", "Only PDF files are accepted");
        }
        NfoOnePager f = files.findById(n.getId()).orElseGet(() -> {
            NfoOnePager x = new NfoOnePager();
            x.setNfoId(n.getId());
            return x;
        });
        f.setData(bytes);
        files.save(f);
        n.setOnePagerContentType("application/pdf");
        n.setOnePagerFileName(safeFileName(file.getOriginalFilename()));
        n.setOnePagerSize(bytes.length);
        n.setOnePagerUpdatedAt(Fmt.now());
        n.setUpdatedAt(Fmt.now());
        repo.save(n);
        audit.log("NFO_ONEPAGER_UPLOADED", "NFO", n.getId(), n.getSchemeName() + ": " + n.getOnePagerFileName() + " (" + bytes.length + " bytes)");
        return dto(n, Fmt.today(), true);
    }

    @Transactional
    public NfoDto deleteOnePager(Long id) {
        Nfo n = get(id);
        if (!n.hasOnePager()) {
            throw ApiException.notFound("One-pager");
        }
        files.deleteById(n.getId());
        n.setOnePagerContentType(null);
        n.setOnePagerFileName(null);
        n.setOnePagerSize(null);
        n.setOnePagerUpdatedAt(null);
        n.setUpdatedAt(Fmt.now());
        repo.save(n);
        audit.log("NFO_UPDATED", "NFO", n.getId(), n.getSchemeName() + ": one-pager removed");
        return dto(n, Fmt.today(), true);
    }

    /** Magic bytes "%PDF-". */
    public static boolean isPdf(byte[] b) {
        return b != null && b.length > 5 && b[0] == '%' && b[1] == 'P' && b[2] == 'D' && b[3] == 'F' && b[4] == '-';
    }

    static String safeFileName(String name) {
        String n = name == null ? "" : name.replaceAll("^.*[\\\\/]", "").replaceAll("[^A-Za-z0-9._ ()&-]", "_").trim();
        if (n.isEmpty()) {
            n = "one-pager.pdf";
        }
        if (!n.toLowerCase(Locale.ROOT).endsWith(".pdf")) {
            n = n + ".pdf";
        }
        return n.length() > 200 ? n.substring(n.length() - 200) : n;
    }
}
