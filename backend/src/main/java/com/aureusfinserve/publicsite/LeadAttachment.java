package com.aureusfinserve.publicsite;

import com.aureusfinserve.security.EncryptedStringConverter;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.Length;

import java.time.LocalDateTime;

/** CAS PDF uploaded with a portfolio-review request. The CAS password is AES-GCM encrypted. */
@Getter
@Setter
@Entity
@Table(name = "lead_attachment", indexes = @Index(name = "ix_lead_attachment_lead", columnList = "lead_id"))
public class LeadAttachment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "lead_id", nullable = false)
    private Long leadId;

    @Column(name = "file_name", length = 200)
    private String fileName;

    @Column(name = "content_type", length = 60)
    private String contentType;

    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;

    @Basic(fetch = FetchType.LAZY)
    @Column(name = "data", length = Length.LONG32, nullable = false)
    private byte[] data;

    @Convert(converter = EncryptedStringConverter.class)
    @Column(name = "cas_password", length = 512)
    private String casPassword;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
