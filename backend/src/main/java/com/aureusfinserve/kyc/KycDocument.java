package com.aureusfinserve.kyc;

import com.aureusfinserve.common.KycDocType;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.Length;

import java.time.LocalDateTime;

/** A document uploaded with a KYC application. {@code data} holds AES-256-GCM encrypted bytes (IV + ciphertext). */
@Getter
@Setter
@Entity
@Table(name = "kyc_document", indexes = @Index(name = "ix_kyc_document_application", columnList = "application_id"))
public class KycDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "application_id", nullable = false)
    private Long applicationId;

    @Enumerated(EnumType.STRING)
    @Column(name = "doc_type", nullable = false, length = 30)
    private KycDocType docType;

    @Column(name = "file_name", length = 200)
    private String fileName;

    @Column(name = "content_type", length = 60)
    private String contentType;

    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;

    @Basic(fetch = FetchType.LAZY)
    @Column(name = "data", length = Length.LONG32, nullable = false)
    private byte[] data;

    @Column(name = "uploaded_at", nullable = false)
    private LocalDateTime uploadedAt;
}
