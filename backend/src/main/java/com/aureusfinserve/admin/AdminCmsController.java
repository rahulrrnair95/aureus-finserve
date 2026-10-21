package com.aureusfinserve.admin;

import com.aureusfinserve.admin.CmsAdminService.*;
import com.aureusfinserve.publicsite.ContentDtos.*;
import com.aureusfinserve.publicsite.SiteService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

/** ADMIN-only content management. */
@RestController
@RequestMapping("/api/admin/cms")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminCmsController {

    private static final Map<String, Object> OK = Map.of("ok", true);

    private final CmsAdminService cms;
    private final SiteService site;

    // articles
    @GetMapping("/articles")
    public List<ArticleAdmin> articles() {
        return cms.articles();
    }

    @PostMapping("/articles")
    public ArticleAdmin createArticle(@Valid @RequestBody ArticleRequest r) {
        return cms.saveArticle(null, r);
    }

    @PutMapping("/articles/{id}")
    public ArticleAdmin updateArticle(@PathVariable Long id, @Valid @RequestBody ArticleRequest r) {
        return cms.saveArticle(id, r);
    }

    @DeleteMapping("/articles/{id}")
    public Map<String, Object> deleteArticle(@PathVariable Long id) {
        cms.deleteArticle(id);
        return OK;
    }

    // FAQs
    @GetMapping("/faqs")
    public List<FaqDto> faqs() {
        return cms.faqs();
    }

    @PostMapping("/faqs")
    public FaqDto createFaq(@Valid @RequestBody FaqRequest r) {
        return cms.saveFaq(null, r);
    }

    @PutMapping("/faqs/{id}")
    public FaqDto updateFaq(@PathVariable Long id, @Valid @RequestBody FaqRequest r) {
        return cms.saveFaq(id, r);
    }

    @DeleteMapping("/faqs/{id}")
    public Map<String, Object> deleteFaq(@PathVariable Long id) {
        cms.deleteFaq(id);
        return OK;
    }

    // banners
    @GetMapping("/banners")
    public List<BannerAdminDto> banners() {
        return cms.banners();
    }

    @PostMapping("/banners")
    public BannerAdminDto createBanner(@Valid @RequestBody BannerRequest r) {
        return cms.saveBanner(null, r);
    }

    @PutMapping("/banners/{id}")
    public BannerAdminDto updateBanner(@PathVariable Long id, @Valid @RequestBody BannerRequest r) {
        return cms.saveBanner(id, r);
    }

    @DeleteMapping("/banners/{id}")
    public Map<String, Object> deleteBanner(@PathVariable Long id) {
        cms.deleteBanner(id);
        return OK;
    }

    // pages
    @GetMapping("/pages")
    public List<PageDto> pages() {
        return cms.pages();
    }

    @PutMapping("/pages/{key}")
    public PageDto savePage(@PathVariable String key, @Valid @RequestBody PageRequest r) {
        return cms.savePage(key, r);
    }

    // home / about
    @GetMapping("/home")
    public HomeContent home() {
        return site.home();
    }

    @PutMapping("/home")
    public HomeContent saveHome(@RequestBody HomeContent h) {
        return cms.saveHome(h);
    }

    @GetMapping("/about")
    public AboutContent about() {
        return site.about();
    }

    @PutMapping("/about")
    public AboutContent saveAbout(@RequestBody AboutContent a) {
        return cms.saveAbout(a);
    }

    // AMCs
    @GetMapping("/amcs")
    public List<AmcDto> amcs() {
        return site.amcs(true);
    }

    @PostMapping("/amcs")
    public AmcDto createAmc(@Valid @RequestBody AmcRequest r) {
        return cms.saveAmc(null, r);
    }

    @PutMapping("/amcs/{id}")
    public AmcDto updateAmc(@PathVariable Long id, @Valid @RequestBody AmcRequest r) {
        return cms.saveAmc(id, r);
    }

    @DeleteMapping("/amcs/{id}")
    public Map<String, Object> deleteAmc(@PathVariable Long id) {
        cms.deleteAmc(id);
        return OK;
    }

    @PostMapping("/amcs/{id}/logo")
    public AmcDto uploadLogo(@PathVariable Long id, @RequestPart(value = "file", required = false) MultipartFile file) {
        return cms.uploadLogo(id, file);
    }

    // testimonials
    @GetMapping("/testimonials")
    public List<TestimonialAdminDto> testimonials() {
        return cms.testimonials();
    }

    @PostMapping("/testimonials")
    public TestimonialAdminDto createTestimonial(@Valid @RequestBody TestimonialRequest r) {
        return cms.saveTestimonial(null, r);
    }

    @PutMapping("/testimonials/{id}")
    public TestimonialAdminDto updateTestimonial(@PathVariable Long id, @Valid @RequestBody TestimonialRequest r) {
        return cms.saveTestimonial(id, r);
    }

    @DeleteMapping("/testimonials/{id}")
    public Map<String, Object> deleteTestimonial(@PathVariable Long id) {
        cms.deleteTestimonial(id);
        return OK;
    }

    // team
    @GetMapping("/team")
    public List<TeamDto> team() {
        return site.team();
    }

    @PostMapping("/team")
    public TeamDto createTeam(@Valid @RequestBody TeamRequest r) {
        return cms.saveTeam(null, r);
    }

    @PutMapping("/team/{id}")
    public TeamDto updateTeam(@PathVariable Long id, @Valid @RequestBody TeamRequest r) {
        return cms.saveTeam(id, r);
    }

    @DeleteMapping("/team/{id}")
    public Map<String, Object> deleteTeam(@PathVariable Long id) {
        cms.deleteTeam(id);
        return OK;
    }

    // services
    @GetMapping("/services")
    public List<ServiceDetail> services() {
        return site.serviceDetails();
    }

    @PutMapping("/services/{slug}")
    public ServiceDetail saveService(@PathVariable String slug, @RequestBody ServiceDetail d) {
        return cms.saveService(slug, d);
    }

    // site settings
    @PutMapping("/site")
    public Site saveSite(@RequestBody SiteSettings s) {
        return cms.saveSite(s);
    }
}
