package com.aureusfinserve.publicsite;

import com.aureusfinserve.common.LeadInterest;
import com.aureusfinserve.common.LeadStatus;
import com.aureusfinserve.security.EncryptedStringConverter;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;

/** Enquiry captured from the website (or entered by staff). */
@Getter
@Setter
@Entity
@Table(name = "lead_enquiry", indexes = @Index(name = "ix_lead_rm", columnList = "assigned_rm_id"))
public class Lead {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String name;

    @Convert(converter = EncryptedStringConverter.class)
    @Column(length = 512)
    private String mobile;

    @Column(length = 200)
    private String email;

    @Column(length = 80)
    private String city;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private LeadInterest interest;

    @Column(length = 2000)
    private String message;

    @Column(length = 20)
    private String source = "WEBSITE"; // WEBSITE | PORTFOLIO_REVIEW | STAFF

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private LeadStatus status = LeadStatus.NEW;

    @Column(name = "follow_up_date")
    private LocalDate followUpDate;

    @Column(length = 4000)
    private String notes;

    @Column(name = "assigned_rm_id")
    private Long assignedRmId;

    @Column(nullable = false)
    private boolean consent;

    @Column(name = "has_attachment", nullable = false)
    private boolean hasAttachment;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
}
