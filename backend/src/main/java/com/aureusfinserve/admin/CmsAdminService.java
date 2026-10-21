package com.aureusfinserve.admin;

import com.aureusfinserve.audit.AuditService;
import com.aureusfinserve.common.ApiException;
import com.aureusfinserve.common.Fmt;
import com.aureusfinserve.publicsite.*;
import com.aureusfinserve.publicsite.ContentDtos.*;
import com.aureusfinserve.publicsite.PublicRepos.*;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Pattern;

/** Admin CMS: articles, FAQs, banners, pages, home, about, AMCs (+logo), testimonials, team, services, site. */
@Service
@RequiredArgsConstructor
public class CmsAdminService {

    public record ArticleRequest(@NotBlank(message = "Title is required") @Size(max = 250) String title,
                                 @Size(max = 150) String slug, @Size(max = 600) String summary, @Size(max = 60) String category,
                                 String body, LocalDateTime publishAt, Integer readMinutes, @Size(max = 300) String videoUrl) {
    }

    public record FaqRequest(@NotBlank(message = "Question is required") @Size(max = 500) String question,
                             @NotBlank(message = "Answer is required") @Size(max = 4000) String answer,
                             @Size(max = 60) String category, Integer sortOrder) {
    }

    public record BannerRequest(@NotBlank(message = "Title is required") @Size(max = 200) String title,
                                @Size(max = 1000) String text, @Size(max = 60) String ctaLabel, @Size(max = 300) String ctaUrl,
                                Boolean active, LocalDateTime startsAt, LocalDateTime endsAt) {
    }

    public record PageRequest(@NotBlank(message = "Title is required") @Size(max = 200) String title, String body) {
    }

    public record AmcRequest(@NotBlank(message = "Name is required") @Size(max = 100) String name, Boolean active,
                             Integer sortOrder, @Size(max = 200) String website) {
    }

    public record TestimonialRequest(@NotBlank(message = "Name is required") @Size(max = 100) String name,
                                     @Size(max = 60) String city,
                                     @NotBlank(message = "Text is required") @Size(max = 1000) String text,
                                     @Size(max = 300) String photoUrl, Boolean consent, Boolean active) {
    }

    public record TeamRequest(@NotBlank(message = "Name is required") @Size(max = 100) String name,
                              @Size(max = 100) String designation, @Size(max = 20) String euin, @Size(max = 1500) String bio,
                              @JsonProperty("isFounder") Boolean isFounder, @Size(max = 300) String qualifications,
                              Integer yearsExperience, @Size(max = 300) String photoUrl, Integer sortOrder) {
    }

    private static final Pattern RETURN_FIGURES = Pattern.compile(
            "(\\d+(\\.\\d+)?\\s*(%|percent))|((return|returns|gain|gains|cagr|xirr)[^.]{0,30}\\d)|(\\d[^.]{0,30}(return|returns|cagr|xirr))",
            Pattern.CASE_INSENSITIVE);
    private static final long MAX_LOGO = 500 * 1024;

    private final ArticleRepository articleRepo;
    private final FaqRepository faqRepo;
    private final BannerRepository bannerRepo;
    private final CmsPageRepository pageRepo;
    private final AmcRepository amcRepo;
    private final TestimonialRepository testimonialRepo;
    private final TeamMemberRepository teamRepo;
    private final CmsContentService content;
    private final SiteService site;
    private final AuditService audit;

    private void changed(String entity, Object id, String detail) {
        audit.log("CMS_CHANGED", entity, id, detail);
    }

    // ---------------------------------------------------------------- articles

    public static ArticleAdmin articleDto(Article a) {
        LocalDateTime now = LocalDateTime.now(Fmt.IST);
        String status = a.getPublishAt() == null ? "DRAFT" : a.getPublishAt().isAfter(now) ? "SCHEDULED" : "PUBLISHED";
        return new ArticleAdmin(a.getId(), a.getSlug(), a.getTitle(), a.getSummary(), a.getCategory(),
                "PUBLISHED".equals(status) ? a.getPublishAt() : null, a.getReadMinutes(), a.getVideoUrl(), a.getBody(),
                status, a.getPublishAt());
    }

    public List<ArticleAdmin> articles() {
        return articleRepo.findAll().stream()
                .sorted(Comparator.comparing(Article::getUpdatedAt).reversed())
                .map(CmsAdminService::articleDto).toList();
    }

    @Transactional
    public ArticleAdmin saveArticle(Long id, ArticleRequest r) {
        Article a = id == null ? new Article() : articleRepo.findById(id).orElseThrow(() -> ApiException.notFound("Article"));
        String slug = slugify(r.slug() == null || r.slug().isBlank() ? r.title() : r.slug());
        articleRepo.findBySlug(slug).filter(o -> !o.getId().equals(a.getId())).ifPresent(o -> {
            throw ApiException.validation("slug", "Another article already uses this slug");
        });
        a.setTitle(r.title().trim());
        a.setSlug(slug);
        a.setSummary(r.summary());
        a.setCategory(r.category());
        a.setBody(r.body());
        a.setPublishAt(r.publishAt() == null ? null : r.publishAt().withNano(0));
        a.setReadMinutes(r.readMinutes() == null ? estimateMinutes(r.body()) : r.readMinutes());
        a.setVideoUrl(r.videoUrl());
        if (a.getCreatedAt() == null) {
            a.setCreatedAt(Fmt.now());
        }
        a.setUpdatedAt(Fmt.now());
        articleRepo.save(a);
        changed("ARTICLE", a.getId(), (id == null ? "Created " : "Updated ") + a.getSlug());
        return articleDto(a);
    }

    @Transactional
    public void deleteArticle(Long id) {
        Article a = articleRepo.findById(id).orElseThrow(() -> ApiException.notFound("Article"));
        articleRepo.delete(a);
        changed("ARTICLE", id, "Deleted " + a.getSlug());
    }

    private static int estimateMinutes(String body) {
        if (body == null) {
            return 1;
        }
        return Math.max(1, (int) Math.ceil(body.split("\\s+").length / 200.0));
    }

    public static String slugify(String s) {
        String slug = s.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
        if (slug.isEmpty()) {
            throw ApiException.validation("slug", "Slug is required");
        }
        return slug.length() > 150 ? slug.substring(0, 150) : slug;
    }

    // ---------------------------------------------------------------- FAQs

    public List<FaqDto> faqs() {
        return site.faqs();
    }

    @Transactional
    public FaqDto saveFaq(Long id, FaqRequest r) {
        Faq f = id == null ? new Faq() : faqRepo.findById(id).orElseThrow(() -> ApiException.notFound("FAQ"));
        f.setQuestion(r.question().trim());
        f.setAnswer(r.answer().trim());
        f.setCategory(r.category());
        f.setSortOrder(r.sortOrder() == null ? 0 : r.sortOrder());
        faqRepo.save(f);
        changed("FAQ", f.getId(), id == null ? "Created" : "Updated");
        return new FaqDto(f.getId(), f.getQuestion(), f.getAnswer(), f.getCategory(), f.getSortOrder());
    }

    @Transactional
    public void deleteFaq(Long id) {
        faqRepo.delete(faqRepo.findById(id).orElseThrow(() -> ApiException.notFound("FAQ")));
        changed("FAQ", id, "Deleted");
    }

    // ---------------------------------------------------------------- banners

    private static BannerAdminDto bannerDto(Banner b) {
        return new BannerAdminDto(b.getId(), b.getTitle(), b.getText(), b.getCtaLabel(), b.getCtaUrl(), b.isActive(),
                b.getStartsAt(), b.getEndsAt());
    }

    public List<BannerAdminDto> banners() {
        return bannerRepo.findAll().stream().sorted(Comparator.comparing(Banner::getId)).map(CmsAdminService::bannerDto).toList();
    }

    @Transactional
    public BannerAdminDto saveBanner(Long id, BannerRequest r) {
        Banner b = id == null ? new Banner() : bannerRepo.findById(id).orElseThrow(() -> ApiException.notFound("Banner"));
        if (r.startsAt() != null && r.endsAt() != null && r.endsAt().isBefore(r.startsAt())) {
            throw ApiException.validation("endsAt", "End must be after start");
        }
        b.setTitle(r.title().trim());
        b.setText(r.text());
        b.setCtaLabel(r.ctaLabel());
        b.setCtaUrl(r.ctaUrl());
        b.setActive(Boolean.TRUE.equals(r.active()));
        b.setStartsAt(r.startsAt());
        b.setEndsAt(r.endsAt());
        bannerRepo.save(b);
        changed("BANNER", b.getId(), id == null ? "Created" : "Updated");
        return bannerDto(b);
    }

    @Transactional
    public void deleteBanner(Long id) {
        bannerRepo.delete(bannerRepo.findById(id).orElseThrow(() -> ApiException.notFound("Banner")));
        changed("BANNER", id, "Deleted");
    }

    // ---------------------------------------------------------------- pages

    public List<PageDto> pages() {
        return pageRepo.findAll().stream().sorted(Comparator.comparing(CmsPage::getKey))
                .map(p -> new PageDto(p.getKey(), p.getTitle(), p.getBody(), p.getUpdatedAt())).toList();
    }

    @Transactional
    public PageDto savePage(String key, PageRequest r) {
        CmsPage p = pageRepo.findById(key).orElseThrow(() -> ApiException.notFound("Page"));
        p.setTitle(r.title().trim());
        p.setBody(r.body());
        p.setUpdatedAt(Fmt.now());
        pageRepo.save(p);
        changed("PAGE", key, "Updated");
        return new PageDto(p.getKey(), p.getTitle(), p.getBody(), p.getUpdatedAt());
    }

    // ---------------------------------------------------------------- home / about / services / site

    @Transactional
    public HomeContent saveHome(HomeContent h) {
        if (h == null || h.hero() == null) {
            throw ApiException.validation("hero", "Hero content is required");
        }
        content.put(SiteService.HOME, h);
        changed("CMS_CONTENT", SiteService.HOME, "Home page updated");
        return site.home();
    }

    @Transactional
    public AboutContent saveAbout(AboutContent a) {
        if (a == null) {
            throw ApiException.validation("story", "About content is required");
        }
        content.put(SiteService.ABOUT, a);
        changed("CMS_CONTENT", SiteService.ABOUT, "About page updated");
        return site.about();
    }

    @Transactional
    public ServiceDetail saveService(String slug, ServiceDetail d) {
        ServiceDetail existing = site.service(slug);
        if (d == null) {
            throw ApiException.validation("title", "Service content is required");
        }
        List<String> allowedCalcs = List.of("sip", "step-up-sip", "lump-sum", "elss", "retirement", "goal", "swp", "cost-of-delay");
        if (d.calculators() != null && !allowedCalcs.containsAll(d.calculators())) {
            throw ApiException.validation("calculators", "Unknown calculator; allowed: " + String.join(", ", allowedCalcs));
        }
        ServiceDetail merged = new ServiceDetail(slug,
                nz(d.title(), existing.title()), nz(d.shortText(), existing.shortText()),
                nz(d.whatItIs(), existing.whatItIs()), nz(d.whoItSuits(), existing.whoItSuits()),
                d.howItWorks() != null ? d.howItWorks() : existing.howItWorks(),
                d.relatedCategory(),
                d.relatedSubCategories() != null ? d.relatedSubCategories() : existing.relatedSubCategories(),
                d.calculators() != null ? d.calculators() : existing.calculators(),
                d.faqs() != null ? d.faqs() : existing.faqs(),
                nz(d.icon(), existing.icon()), d.sortOrder() != null ? d.sortOrder() : existing.sortOrder());
        content.put(SiteService.SERVICE_PREFIX + slug, merged);
        changed("CMS_CONTENT", SiteService.SERVICE_PREFIX + slug, "Service page updated");
        return merged;
    }

    @Transactional
    public Site saveSite(SiteSettings s) {
        SiteSettings cur = site.settings();
        Stats st = s.stats() == null ? cur.stats() : new Stats(
                nz(s.stats().aumCr(), cur.stats().aumCr()), nz(s.stats().clients(), cur.stats().clients()),
                nz(s.stats().families(), cur.stats().families()), nz(s.stats().years(), cur.stats().years()),
                nz(s.stats().sipBookCr(), cur.stats().sipBookCr()), nz(s.stats().sipsRunning(), cur.stats().sipsRunning()));
        SiteSettings merged = new SiteSettings(st, s.socials() == null ? cur.socials() : s.socials(),
                nz(s.phone(), cur.phone()), nz(s.whatsapp(), cur.whatsapp()), nz(s.email(), cur.email()),
                nz(s.address(), cur.address()), nz(s.officeHours(), cur.officeHours()), nz(s.mapEmbedUrl(), cur.mapEmbedUrl()));
        content.put(SiteService.SITE, merged);
        changed("CMS_CONTENT", SiteService.SITE, "Site settings updated");
        return site.site();
    }

    private static <T> T nz(T v, T fallback) {
        return v != null ? v : fallback;
    }

    // ---------------------------------------------------------------- AMCs

    @Transactional
    public AmcDto saveAmc(Long id, AmcRequest r) {
        Amc a = id == null ? new Amc() : amcRepo.findById(id).orElseThrow(() -> ApiException.notFound("AMC"));
        String slug = slugify(r.name());
        amcRepo.findBySlug(slug).filter(o -> !o.getId().equals(a.getId())).ifPresent(o -> {
            throw ApiException.conflict("An AMC with this name already exists");
        });
        a.setName(r.name().trim());
        a.setSlug(slug);
        a.setActive(r.active() == null || r.active());
        a.setSortOrder(r.sortOrder() == null ? 0 : r.sortOrder());
        a.setWebsite(r.website() == null || r.website().isBlank() ? null : r.website().trim());
        amcRepo.save(a);
        changed("AMC", a.getId(), (id == null ? "Created " : "Updated ") + a.getName());
        return site.toDto(a, site.schemeCounts());
    }

    @Transactional
    public void deleteAmc(Long id) {
        Amc a = amcRepo.findById(id).orElseThrow(() -> ApiException.notFound("AMC"));
        amcRepo.delete(a);
        changed("AMC", id, "Deleted " + a.getName());
    }

    @Transactional
    public AmcDto uploadLogo(Long id, MultipartFile file) {
        Amc a = amcRepo.findById(id).orElseThrow(() -> ApiException.notFound("AMC"));
        if (file == null || file.isEmpty()) {
            throw ApiException.validation("file", "Choose a PNG or SVG file");
        }
        if (file.getSize() > MAX_LOGO) {
            throw ApiException.validation("file", "Logo must be 500 KB or smaller");
        }
        byte[] b;
        try {
            b = file.getBytes();
        } catch (IOException e) {
            throw ApiException.validation("file", "Could not read the uploaded file");
        }
        String ct;
        boolean png = b.length > 8 && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G';
        if (png) {
            ct = "image/png";
        } else {
            String head = new String(b, 0, Math.min(b.length, 4096), StandardCharsets.UTF_8).toLowerCase(Locale.ROOT);
            String all = new String(b, StandardCharsets.UTF_8).toLowerCase(Locale.ROOT);
            boolean svg = head.contains("<svg") && (file.getContentType() == null
                    || file.getContentType().toLowerCase(Locale.ROOT).startsWith("image/svg"));
            if (!svg) {
                throw ApiException.validation("file", "Only PNG or SVG logos are accepted");
            }
            if (all.contains("<script") || all.matches("(?s).*\\son[a-z]+\\s*=.*") || all.contains("javascript:")
                    || all.contains("<foreignobject")) {
                throw ApiException.validation("file", "SVG must not contain scripts or event handlers");
            }
            ct = "image/svg+xml";
        }
        a.setLogo(b);
        a.setLogoContentType(ct);
        amcRepo.save(a);
        changed("AMC", a.getId(), "Logo uploaded (" + ct + ", " + b.length + " bytes)");
        return site.toDto(a, site.schemeCounts());
    }

    // ---------------------------------------------------------------- testimonials

    private static TestimonialAdminDto testimonialDto(Testimonial t) {
        return new TestimonialAdminDto(t.getId(), t.getName(), t.getCity(), t.getText(), t.getPhotoUrl(), t.isConsent(), t.isActive());
    }

    public List<TestimonialAdminDto> testimonials() {
        return testimonialRepo.findAll().stream().sorted(Comparator.comparing(Testimonial::getId))
                .map(CmsAdminService::testimonialDto).toList();
    }

    @Transactional
    public TestimonialAdminDto saveTestimonial(Long id, TestimonialRequest r) {
        if (RETURN_FIGURES.matcher(r.text()).find()) {
            throw ApiException.validation("text", "Testimonials must not mention returns or performance figures");
        }
        Testimonial t = id == null ? new Testimonial() : testimonialRepo.findById(id).orElseThrow(() -> ApiException.notFound("Testimonial"));
        t.setName(r.name().trim());
        t.setCity(r.city());
        t.setText(r.text().trim());
        t.setPhotoUrl(r.photoUrl());
        t.setConsent(Boolean.TRUE.equals(r.consent()));
        t.setActive(r.active() == null || r.active());
        testimonialRepo.save(t);
        changed("TESTIMONIAL", t.getId(), id == null ? "Created" : "Updated");
        return testimonialDto(t);
    }

    @Transactional
    public void deleteTestimonial(Long id) {
        testimonialRepo.delete(testimonialRepo.findById(id).orElseThrow(() -> ApiException.notFound("Testimonial")));
        changed("TESTIMONIAL", id, "Deleted");
    }

    // ---------------------------------------------------------------- team

    @Transactional
    public TeamDto saveTeam(Long id, TeamRequest r) {
        TeamMember t = id == null ? new TeamMember() : teamRepo.findById(id).orElseThrow(() -> ApiException.notFound("Team member"));
        if (r.yearsExperience() != null && (r.yearsExperience() < 0 || r.yearsExperience() > 70)) {
            throw ApiException.validation("yearsExperience", "Enter a realistic number of years");
        }
        t.setName(r.name().trim());
        t.setDesignation(r.designation());
        t.setEuin(r.euin() == null || r.euin().isBlank() ? null : r.euin().trim().toUpperCase(Locale.ROOT));
        t.setBio(r.bio());
        t.setFounder(Boolean.TRUE.equals(r.isFounder()));
        t.setQualifications(r.qualifications());
        t.setYearsExperience(r.yearsExperience());
        t.setPhotoUrl(r.photoUrl());
        t.setSortOrder(r.sortOrder() == null ? 0 : r.sortOrder());
        teamRepo.save(t);
        changed("TEAM", t.getId(), id == null ? "Created" : "Updated");
        return SiteService.teamDto(t);
    }

    @Transactional
    public void deleteTeam(Long id) {
        teamRepo.delete(teamRepo.findById(id).orElseThrow(() -> ApiException.notFound("Team member")));
        changed("TEAM", id, "Deleted");
    }
}
