package com.aureusfinserve.publicsite;

import com.aureusfinserve.common.ApiException;
import com.aureusfinserve.publicsite.ContentDtos.*;
import com.aureusfinserve.publicsite.PublicRepos.AmcRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/public")
@RequiredArgsConstructor
public class PublicController {

    public record LeadOtpRequest(String mobile) {
    }

    private final SiteService site;
    private final SchemeService schemes;
    private final LeadService leads;
    private final AmcRepository amcRepo;

    @GetMapping("/site")
    public Site site() {
        return site.site();
    }

    @GetMapping("/home")
    public HomeContent home() {
        return site.home();
    }

    @GetMapping("/about")
    public AboutContent about() {
        return site.about();
    }

    @GetMapping("/amcs")
    public List<Map<String, Object>> amcs() {
        return site.amcs(false).stream().map(a -> {
            Map<String, Object> m = new java.util.LinkedHashMap<>();
            m.put("id", a.id());
            m.put("name", a.name());
            m.put("slug", a.slug());
            m.put("logoUrl", a.logoUrl());
            m.put("website", a.website());
            m.put("schemeCount", a.schemeCount());
            m.put("sortOrder", a.sortOrder());
            return m;
        }).toList();
    }

    @GetMapping("/amcs/{id}/logo")
    public ResponseEntity<byte[]> amcLogo(@PathVariable Long id) {
        Amc a = amcRepo.findById(id).filter(x -> x.getLogo() != null && x.getLogoContentType() != null)
                .orElseThrow(() -> ApiException.notFound("Logo"));
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(a.getLogoContentType()))
                .cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePublic())
                // SVGs can carry script: serve them with a locked-down CSP so they render only as images.
                .header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox")
                .header("Cross-Origin-Resource-Policy", "cross-origin")
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline")
                .body(a.getLogo());
    }

    @GetMapping("/services")
    public List<ServiceSummary> services() {
        return site.services();
    }

    @GetMapping("/services/{slug}")
    public ServiceDetail service(@PathVariable String slug) {
        return site.service(slug);
    }

    @GetMapping("/schemes")
    public SchemeService.Page<SchemeService.SchemeSummary> schemes(@RequestParam(required = false) String q,
                                                                   @RequestParam(required = false) String category,
                                                                   @RequestParam(required = false) String subCategory,
                                                                   @RequestParam(required = false) String amc,
                                                                   @RequestParam(required = false) String risk,
                                                                   @RequestParam(required = false) String sort,
                                                                   @RequestParam(defaultValue = "0") int page,
                                                                   @RequestParam(defaultValue = "20") int size) {
        return schemes.search(q, category, subCategory, amc, risk, sort, page, size);
    }

    @GetMapping("/schemes/filters")
    public SchemeService.Filters filters() {
        return schemes.filters();
    }

    @GetMapping("/schemes/{id}")
    public Map<String, Object> scheme(@PathVariable Long id) {
        return schemes.detail(id);
    }

    @GetMapping("/articles")
    public List<ArticleSummary> articles(@RequestParam(required = false) String category) {
        return site.articles(category);
    }

    @GetMapping("/articles/{slug}")
    public ArticleDetail article(@PathVariable String slug) {
        return site.article(slug);
    }

    @GetMapping("/faqs")
    public List<FaqDto> faqs() {
        return site.faqs();
    }

    @GetMapping("/glossary")
    public List<GlossaryDto> glossary() {
        return site.glossary();
    }

    @GetMapping("/testimonials")
    public List<TestimonialDto> testimonials() {
        return site.testimonials();
    }

    @GetMapping("/team")
    public List<TeamDto> team() {
        return site.team();
    }

    @GetMapping("/banners")
    public List<BannerDto> banners() {
        return site.banners();
    }

    @GetMapping("/pages/{key}")
    public PageDto page(@PathVariable String key) {
        return site.page(key);
    }

    @PostMapping("/leads/otp")
    public Map<String, Object> leadOtp(@RequestBody LeadOtpRequest r) {
        LeadService.LeadOtpResult res = leads.otp(r.mobile());
        return res.devOtp() == null ? Map.of("challengeId", res.challengeId())
                : Map.of("challengeId", res.challengeId(), "devOtp", res.devOtp());
    }

    @PostMapping("/leads")
    public Map<String, Object> lead(@RequestBody LeadService.LeadForm f) {
        return leads.create(f);
    }

    @PostMapping(value = "/portfolio-review", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> portfolioReview(@RequestParam(required = false) String name,
                                               @RequestParam(required = false) String mobile,
                                               @RequestParam(required = false) String email,
                                               @RequestParam(required = false) Boolean consent,
                                               @RequestParam(required = false) String challengeId,
                                               @RequestParam(required = false) String otp,
                                               @RequestParam(required = false) String casPassword,
                                               @RequestParam(required = false) String website,
                                               @RequestParam(required = false) String city,
                                               @RequestParam(required = false) String message,
                                               @RequestPart(value = "file", required = false) MultipartFile file) {
        return leads.portfolioReview(new LeadService.LeadForm(name, mobile, email, city, "PORTFOLIO_REVIEW", message,
                consent, challengeId, otp, website), casPassword, file);
    }
}
