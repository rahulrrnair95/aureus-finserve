package com.aureusfinserve.kyc;

import com.aureusfinserve.common.Gender;
import com.aureusfinserve.common.KycApplicationStatus;
import com.aureusfinserve.common.Residency;
import com.aureusfinserve.security.EncryptedStringConverter;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Online KYC application submitted from the website (resident or NRI). The firm verifies the documents,
 * completes the video in-person verification (VIPV) and uploads the KYC to a KRA. PAN, DOB, mobile,
 * addresses and the foreign TIN are AES-GCM encrypted; *_hash columns are HMAC lookups.
 */
@Getter
@Setter
@Entity
@Table(name = "kyc_application", indexes = {
        @Index(name = "ix_kyc_application_pan_hash", columnList = "pan_hash"),
        @Index(name = "ix_kyc_application_mobile_hash", columnList = "mobile_hash"),
        @Index(name = "ix_kyc_application_rm", columnList = "assigned_rm_id"),
        @Index(name = "ix_kyc_application_status", columnList = "status"),
        @Index(name = "ix_kyc_application_ref", columnList = "ref")
})
public class KycApplication {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(length = 20)
    private String ref;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Residency residency;

    @Column(name = "full_name", nullable = false, length = 150)
    private String fullName;

    @Column(name = "father_or_spouse_name", length = 150)
    private String fatherOrSpouseName;

    @Enumerated(EnumType.STRING)
    @Column(length = 12)
    private Gender gender;

    /** ISO date string (YYYY-MM-DD), encrypted. */
    @Convert(converter = EncryptedStringConverter.class)
    @Column(length = 512)
    private String dob;

    @Convert(converter = EncryptedStringConverter.class)
    @Column(length = 512)
    private String pan;

    @Column(name = "pan_hash", length = 64)
    private String panHash;

    @Convert(converter = EncryptedStringConverter.class)
    @Column(length = 512)
    private String mobile;

    @Column(name = "mobile_hash", length = 64)
    private String mobileHash;

    @Column(length = 200)
    private String email;

    @Column(name = "marital_status", length = 20)
    private String maritalStatus;

    @Column(length = 30)
    private String occupation;

    @Column(name = "annual_income", length = 20)
    private String annualIncome;

    @Column(name = "politically_exposed", nullable = false)
    private boolean politicallyExposed;

    /** Indian address (optional for NRIs), encrypted. */
    @Convert(converter = EncryptedStringConverter.class)
    @Column(name = "address_line", length = 1024)
    private String addressLine;

    @Column(length = 80)
    private String city;

    @Column(name = "state_name", length = 80)
    private String state;

    @Column(length = 10)
    private String pincode;

    // ---- NRI only
    @Column(name = "country_of_residence", length = 80)
    private String countryOfResidence;

    @Convert(converter = EncryptedStringConverter.class)
    @Column(name = "overseas_address", length = 1024)
    private String overseasAddress;

    @Column(name = "tax_residency_country", length = 80)
    private String taxResidencyCountry;

    @Convert(converter = EncryptedStringConverter.class)
    @Column(name = "foreign_tin", length = 512)
    private String foreignTin;

    @Column(length = 80)
    private String nationality;

    @Column(name = "preferred_vipv_slot", length = 100)
    private String preferredVipvSlot;

    @Column(nullable = false)
    private boolean consent;

    @Column(name = "consent_at")
    private LocalDateTime consentAt;

    /** OTP challenge that verified the mobile; one challenge can back only one application. */
    @Column(name = "otp_challenge_id", length = 36)
    private String otpChallengeId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private KycApplicationStatus status = KycApplicationStatus.SUBMITTED;

    @Column(name = "staff_notes", length = 4000)
    private String staffNotes;

    @Column(name = "assigned_rm_id")
    private Long assignedRmId;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public LocalDate dobDate() {
        return dob == null ? null : LocalDate.parse(dob);
    }
}
