package com.aureusfinserve.publicsite;

import com.aureusfinserve.common.ApiException;
import com.aureusfinserve.config.AppProperties;
import com.aureusfinserve.publicsite.ContentDtos.*;
import com.aureusfinserve.publicsite.PublicRepos.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;

/** Read side of the public website content (site, home, about, services, AMCs, CMS lists). */
@Service
@RequiredArgsConstructor
public class SiteService {

    public static final String HOME = "home";
    public static final String ABOUT = "about";
    public static final String SITE = "site";
    public static final String SERVICE_PREFIX = "service:";
    public static final List<String> SERVICE_SLUGS = List.of("sip", "lump-sum", "tax-saving-elss", "retirement",
            "child-education", "regular-income-swp", "nri", "portfolio-review");

    private final AppProperties props;
    private final CmsContentService content;
    private final TeamMemberRepository teamRepo;
    private final TestimonialRepository testimonialRepo;
    private final AmcRepository amcRepo;
    private final SchemeRepository schemeRepo;
    private final FaqRepository faqRepo;
    private final GlossaryTermRepository glossaryRepo;
    private final BannerRepository bannerRepo;
    private final CmsPageRepository pageRepo;
    private final ArticleRepository articleRepo;

    // ---------------------------------------------------------------- site

    public SiteSettings defaultSettings() {
        AppProperties.Firm f = props.getFirm();
        AppProperties.Stats s = f.getStats();
        return new SiteSettings(new Stats(s.getAumCr(), s.getClients(), null, s.getYears(), s.getSipBookCr(), null),
                new Socials(null, null, null, null, null), f.getPhone(), f.getWhatsapp(), f.getEmail(), f.getAddress(),
                f.getOfficeHours(), f.getMapEmbedUrl());
    }

    public SiteSettings settings() {
        return content.get(SITE, SiteSettings.class).orElseGet(this::defaultSettings);
    }

    public Site site() {
        AppProperties.Firm f = props.getFirm();
        SiteSettings st = settings();
        List<Euin> euins = teamRepo.findAllByOrderBySortOrderAscIdAsc().stream()
                .filter(t -> t.getEuin() != null && !t.getEuin().isBlank())
                .map(t -> new Euin(t.getName(), t.getEuin())).toList();
        return new Site(f.getName(), f.getTagline(), f.getArn(), f.getArnValidTill(), st.address(), st.phone(), st.whatsapp(),
                st.email(), st.officeHours(), st.mapEmbedUrl(), st.stats(), f.getDisclaimer(),
                new NodalOfficer(f.getNodalOfficer().getName(), f.getNodalOfficer().getPhone(), f.getNodalOfficer().getEmail()),
                f.getEscalation().stream().map(e -> new Escalation(e.getLevel(), e.getName(), e.getDesignation(),
                        e.getPhone(), e.getEmail(), e.getResponseDays())).toList(),
                f.getScoresUrl(), f.getOdrUrl(), st.socials(), euins);
    }

    // ---------------------------------------------------------------- home / about / services

    public HomeContent home() {
        return content.get(HOME, HomeContent.class)
                .orElseGet(() -> new HomeContent(new Hero("", "", "", ""), List.of(), List.of(), Map.of()));
    }

    public AboutContent about() {
        SiteSettings st = settings();
        AboutContent a = content.get(ABOUT, AboutContent.class)
                .orElseGet(() -> new AboutContent("", "", "", List.of(), List.of(), null, null, null));
        return new AboutContent(a.story(), a.mission(), a.vision(), a.values(), a.milestones(),
                a.officeAddress() != null ? a.officeAddress() : st.address(),
                a.mapEmbedUrl() != null ? a.mapEmbedUrl() : st.mapEmbedUrl(),
                a.officeHours() != null ? a.officeHours() : st.officeHours());
    }

    public List<ServiceDetail> serviceDetails() {
        List<ServiceDetail> out = new ArrayList<>();
        for (String slug : SERVICE_SLUGS) {
            content.get(SERVICE_PREFIX + slug, ServiceDetail.class).ifPresent(out::add);
        }
        out.sort(Comparator.comparing(d -> d.sortOrder() == null ? 99 : d.sortOrder()));
        return out;
    }

    public List<ServiceSummary> services() {
        return serviceDetails().stream().map(d -> new ServiceSummary(d.slug(), d.title(), d.shortText(), d.icon())).toList();
    }

    public ServiceDetail service(String slug) {
        if (!SERVICE_SLUGS.contains(slug)) {
            throw ApiException.notFound("Service");
        }
        return content.get(SERVICE_PREFIX + slug, ServiceDetail.class).orElseThrow(() -> ApiException.notFound("Service"));
    }

    // ---------------------------------------------------------------- AMCs

    public AmcDto toDto(Amc a, Map<String, Long> counts) {
        return new AmcDto(a.getId(), a.getName(), a.getSlug(),
                a.getLogoContentType() != null ? "/api/public/amcs/" + a.getId() + "/logo" : null, a.getWebsite(),
                counts.getOrDefault(a.getName(), 0L), a.getSortOrder(), a.isActive());
    }

    public Map<String, Long> schemeCounts() {
        Map<String, Long> counts = new HashMap<>();
        schemeRepo.findByActiveTrue().forEach(s -> counts.merge(s.getAmc(), 1L, Long::sum));
        return counts;
    }

    public List<AmcDto> amcs(boolean includeInactive) {
        Map<String, Long> counts = schemeCounts();
        return amcRepo.findAllByOrderBySortOrderAscNameAsc().stream()
                .filter(a -> includeInactive || a.isActive())
                .map(a -> toDto(a, counts)).toList();
    }

    // ---------------------------------------------------------------- lists

    public List<TeamDto> team() {
        return teamRepo.findAllByOrderBySortOrderAscIdAsc().stream().map(SiteService::teamDto).toList();
    }

    public static TeamDto teamDto(TeamMember t) {
        return new TeamDto(t.getId(), t.getName(), t.getDesignation(), t.getEuin(), t.getBio(), t.isFounder(),
                t.getQualifications(), t.getYearsExperience(), t.getPhotoUrl(), t.getSortOrder());
    }

    public List<TestimonialDto> testimonials() {
        return testimonialRepo.findAll().stream().filter(t -> t.isConsent() && t.isActive())
                .sorted(Comparator.comparing(Testimonial::getId))
                .map(t -> new TestimonialDto(t.getId(), t.getName(), t.getCity(), t.getText(), t.getPhotoUrl())).toList();
    }

    public List<FaqDto> faqs() {
        return faqRepo.findAllByOrderBySortOrderAscIdAsc().stream()
                .map(f -> new FaqDto(f.getId(), f.getQuestion(), f.getAnswer(), f.getCategory(), f.getSortOrder())).toList();
    }

    public List<GlossaryDto> glossary() {
        return glossaryRepo.findAllByOrderByTermAsc().stream().map(g -> new GlossaryDto(g.getTerm(), g.getDefinition())).toList();
    }

    public List<BannerDto> banners() {
        LocalDateTime now = LocalDateTime.now(com.aureusfinserve.common.Fmt.IST);
        return bannerRepo.findAll().stream()
                .filter(b -> b.isActive() && (b.getStartsAt() == null || !b.getStartsAt().isAfter(now))
                        && (b.getEndsAt() == null || b.getEndsAt().isAfter(now)))
                .map(b -> new BannerDto(b.getId(), b.getTitle(), b.getText(), b.getCtaLabel(), b.getCtaUrl())).toList();
    }

    public PageDto page(String key) {
        CmsPage p = pageRepo.findById(key).orElseThrow(() -> ApiException.notFound("Page"));
        return new PageDto(p.getKey(), p.getTitle(), p.getBody(), p.getUpdatedAt());
    }

    // ---------------------------------------------------------------- articles

    public List<ContentDtos.ArticleSummary> articles(String category) {
        LocalDateTime now = LocalDateTime.now(com.aureusfinserve.common.Fmt.IST);
        return articleRepo.findAllByOrderByPublishAtDesc().stream()
                .filter(a -> a.getPublishAt() != null && !a.getPublishAt().isAfter(now))
                .filter(a -> category == null || category.isBlank() || category.equalsIgnoreCase(a.getCategory()))
                .map(a -> new ContentDtos.ArticleSummary(a.getId(), a.getSlug(), a.getTitle(), a.getSummary(), a.getCategory(),
                        a.getPublishAt(), a.getReadMinutes(), a.getVideoUrl())).toList();
    }

    public ContentDtos.ArticleDetail article(String slug) {
        LocalDateTime now = LocalDateTime.now(com.aureusfinserve.common.Fmt.IST);
        Article a = articleRepo.findBySlug(slug)
                .filter(x -> x.getPublishAt() != null && !x.getPublishAt().isAfter(now))
                .orElseThrow(() -> ApiException.notFound("Article"));
        return new ContentDtos.ArticleDetail(a.getId(), a.getSlug(), a.getTitle(), a.getSummary(), a.getCategory(),
                a.getPublishAt(), a.getReadMinutes(), a.getVideoUrl(), a.getBody());
    }
}
