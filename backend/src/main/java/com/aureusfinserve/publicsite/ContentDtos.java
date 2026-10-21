package com.aureusfinserve.publicsite;

import com.aureusfinserve.common.AssetClass;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/** JSON shapes for the public website and its CMS (field names per contract sections 2 and 6). */
public final class ContentDtos {

    private ContentDtos() {
    }

    // ---------------------------------------------------------------- home
    public record Hero(String headline, String subline, String primaryCtaLabel, String secondaryCtaLabel) {
    }

    public record TitleText(String title, String text) {
    }

    public record Step(Integer step, String title, String text) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record HomeContent(Hero hero, List<TitleText> whyChooseUs, List<Step> howItWorks, Map<String, Boolean> sections) {
    }

    // ---------------------------------------------------------------- about
    public record Milestone(String year, String text) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record AboutContent(String story, String mission, String vision, List<TitleText> values,
                               List<Milestone> milestones, String officeAddress, String mapEmbedUrl, String officeHours) {
    }

    // ---------------------------------------------------------------- services
    public record QA(String question, String answer) {
    }

    public record ServiceSummary(String slug, String title, String shortText, String icon) {
    }

    /** Service detail; {@code icon} and {@code sortOrder} are additive extras used for the overview grid. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ServiceDetail(String slug, String title, String shortText, String whatItIs, String whoItSuits,
                                List<String> howItWorks, AssetClass relatedCategory, List<String> relatedSubCategories,
                                List<String> calculators, List<QA> faqs, String icon, Integer sortOrder) {
    }

    // ---------------------------------------------------------------- site
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Stats(Double aumCr, Integer clients, Integer families, Integer years, Double sipBookCr,
                        Integer sipsRunning) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Socials(String facebook, String instagram, String linkedin, String youtube, String x) {
    }

    /** Editable site settings (body of PUT /admin/cms/site); stored as the "site" CMS document. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record SiteSettings(Stats stats, Socials socials, String phone, String whatsapp, String email,
                               String address, String officeHours, String mapEmbedUrl) {
    }

    public record NodalOfficer(String name, String phone, String email) {
    }

    public record Escalation(int level, String name, String designation, String phone, String email, int responseDays) {
    }

    public record Euin(String name, String euin) {
    }

    public record Site(String firmName, String tagline, String arn, LocalDate arnValidTill, String address, String phone,
                       String whatsapp, String email, String officeHours, String mapEmbedUrl, Stats stats,
                       String disclaimer, NodalOfficer nodalOfficer, List<Escalation> escalation, String scoresUrl,
                       String odrUrl, Socials socials, List<Euin> euins) {
    }

    // ---------------------------------------------------------------- other public objects
    public record AmcDto(Long id, String name, String slug, String logoUrl, String website, long schemeCount, int sortOrder, boolean active) {
    }

    public record TeamDto(Long id, String name, String designation, String euin, String bio,
                          @JsonProperty("isFounder") boolean isFounder, String qualifications, Integer yearsExperience,
                          String photoUrl, int sortOrder) {
    }

    public record TestimonialDto(Long id, String name, String city, String text, String photoUrl) {
    }

    public record TestimonialAdminDto(Long id, String name, String city, String text, String photoUrl, boolean consent,
                                      boolean active) {
    }

    public record FaqDto(Long id, String question, String answer, String category, int sortOrder) {
    }

    public record GlossaryDto(String term, String definition) {
    }

    public record BannerDto(Long id, String title, String text, String ctaLabel, String ctaUrl) {
    }

    public record BannerAdminDto(Long id, String title, String text, String ctaLabel, String ctaUrl, boolean active,
                                 LocalDateTime startsAt, LocalDateTime endsAt) {
    }

    public record PageDto(String key, String title, String body, LocalDateTime updatedAt) {
    }

    public record ArticleSummary(Long id, String slug, String title, String summary, String category,
                                 LocalDateTime publishedAt, Integer readMinutes, String videoUrl) {
    }

    public record ArticleDetail(Long id, String slug, String title, String summary, String category,
                                LocalDateTime publishedAt, Integer readMinutes, String videoUrl, String body) {
    }

    public record ArticleAdmin(Long id, String slug, String title, String summary, String category,
                               LocalDateTime publishedAt, Integer readMinutes, String videoUrl, String body,
                               String status, LocalDateTime publishAt) {
    }
}
