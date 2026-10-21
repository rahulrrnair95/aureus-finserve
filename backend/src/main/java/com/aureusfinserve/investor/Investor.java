package com.aureusfinserve.investor;

import com.aureusfinserve.common.KycStatus;
import com.aureusfinserve.common.Relation;
import com.aureusfinserve.security.EncryptedStringConverter;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

/** An investor (client). PAN, mobile and DOB are encrypted at rest; *_hash columns are used for lookups. */
@Getter
@Setter
@Entity
@Table(name = "investor", indexes = {
        @Index(name = "ix_investor_pan_hash", columnList = "pan_hash"),
        @Index(name = "ix_investor_mobile_hash", columnList = "mobile_hash"),
        @Index(name = "ix_investor_email_hash", columnList = "email_hash"),
        @Index(name = "ix_investor_rm", columnList = "rm_id"),
        @Index(name = "ix_investor_family_head", columnList = "family_head_id")
})
public class Investor {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String name;

    @Convert(converter = EncryptedStringConverter.class)
    @Column(length = 512)
    private String pan;

    @Column(name = "pan_hash", length = 64)
    private String panHash;

    /** ISO date string (YYYY-MM-DD), encrypted. */
    @Convert(converter = EncryptedStringConverter.class)
    @Column(length = 512)
    private String dob;

    @Column(length = 200)
    private String email;

    @Column(name = "email_hash", length = 64)
    private String emailHash;

    @Convert(converter = EncryptedStringConverter.class)
    @Column(length = 512)
    private String mobile;

    @Column(name = "mobile_hash", length = 64)
    private String mobileHash;

    @Column(length = 500)
    private String address;

    @Enumerated(EnumType.STRING)
    @Column(name = "kyc_status", nullable = false, length = 20)
    private KycStatus kycStatus = KycStatus.REGISTERED;

    @Column(name = "tax_status", length = 50)
    private String taxStatus = "Resident Individual";

    @Column(name = "rm_id")
    private Long rmId;

    /** null = this investor is a family head (or standalone). */
    @Column(name = "family_head_id")
    private Long familyHeadId;

    /** Relation to the family head (SELF for the head). */
    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private Relation relation = Relation.SELF;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    public LocalDate dobDate() {
        return dob == null ? null : LocalDate.parse(dob);
    }
}
