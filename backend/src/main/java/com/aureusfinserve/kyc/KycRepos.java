package com.aureusfinserve.kyc;

import com.aureusfinserve.common.KycApplicationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public final class KycRepos {

    private KycRepos() {
    }

    public interface KycApplicationRepository extends JpaRepository<KycApplication, Long> {
        List<KycApplication> findAllByOrderByCreatedAtDescIdDesc();

        Optional<KycApplication> findByRef(String ref);

        boolean existsByOtpChallengeId(String otpChallengeId);

        List<KycApplication> findByStatusIn(Collection<KycApplicationStatus> statuses);
    }

    public interface KycDocumentRepository extends JpaRepository<KycDocument, Long> {
        /** Metadata only - never loads the file bytes. */
        @Query("select new com.aureusfinserve.kyc.KycDocumentMeta(d.id, d.applicationId, d.docType, d.fileName, "
                + "d.contentType, d.sizeBytes, d.uploadedAt) from KycDocument d where d.applicationId in :ids order by d.id")
        List<KycDocumentMeta> metadata(@Param("ids") Collection<Long> ids);
    }
}
