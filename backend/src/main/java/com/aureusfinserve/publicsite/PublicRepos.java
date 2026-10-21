package com.aureusfinserve.publicsite;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public final class PublicRepos {

    private PublicRepos() {
    }

    public interface SchemeRepository extends JpaRepository<Scheme, Long> {
        Optional<Scheme> findByCode(String code);

        List<Scheme> findByActiveTrue();

        List<Scheme> findByCodeIn(Collection<String> codes);
    }

    public interface NavPointRepository extends JpaRepository<NavPoint, Long> {
        List<NavPoint> findBySchemeIdOrderByNavDateAsc(Long schemeId);

        List<NavPoint> findBySchemeIdAndNavDateGreaterThanEqualOrderByNavDateAsc(Long schemeId, LocalDate from);

        Optional<NavPoint> findBySchemeIdAndNavDate(Long schemeId, LocalDate date);

        List<NavPoint> findBySchemeIdInOrderByNavDateAsc(Collection<Long> schemeIds);
    }

    public interface ArticleRepository extends JpaRepository<Article, Long> {
        Optional<Article> findBySlug(String slug);

        List<Article> findAllByOrderByPublishAtDesc();
    }

    public interface FaqRepository extends JpaRepository<Faq, Long> {
        List<Faq> findAllByOrderBySortOrderAscIdAsc();
    }

    public interface GlossaryTermRepository extends JpaRepository<GlossaryTerm, Long> {
        List<GlossaryTerm> findAllByOrderByTermAsc();
    }

    public interface TestimonialRepository extends JpaRepository<Testimonial, Long> {
    }

    public interface TeamMemberRepository extends JpaRepository<TeamMember, Long> {
        List<TeamMember> findAllByOrderBySortOrderAscIdAsc();
    }

    public interface BannerRepository extends JpaRepository<Banner, Long> {
    }

    public interface CmsPageRepository extends JpaRepository<CmsPage, String> {
    }

    public interface AmcRepository extends JpaRepository<Amc, Long> {
        List<Amc> findAllByOrderBySortOrderAscNameAsc();

        Optional<Amc> findBySlug(String slug);
    }

    public interface CmsContentRepository extends JpaRepository<CmsContent, String> {
        List<CmsContent> findByKeyStartingWith(String prefix);
    }

    public interface LeadAttachmentRepository extends JpaRepository<LeadAttachment, Long> {
        Optional<LeadAttachment> findFirstByLeadIdOrderByIdDesc(Long leadId);
    }

    public interface LeadRepository extends JpaRepository<Lead, Long> {
        List<Lead> findAllByOrderByCreatedAtDesc();

        List<Lead> findByAssignedRmIdOrderByCreatedAtDesc(Long rmId);
    }
}
