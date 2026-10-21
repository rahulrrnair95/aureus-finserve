package com.aureusfinserve.kyc;

import com.aureusfinserve.common.KycApplicationStatus;
import com.aureusfinserve.common.KycDocType;
import com.aureusfinserve.common.Residency;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

public final class KycDtos {

    private KycDtos() {
    }

    /** Flat multipart fields of POST /api/public/kyc (all strings so binding never fails; parsed in the service). */
    public record KycForm(String residency, String fullName, String fatherOrSpouseName, String gender, String dob,
                          String pan, String mobile, String email, String maritalStatus, String occupation,
                          String annualIncome, String politicallyExposed, String addressLine, String city,
                          String state, String pincode, String countryOfResidence, String overseasAddress,
                          String taxResidencyCountry, String foreignTin, String nationality,
                          String preferredVipvSlot, String consent, String challengeId, String otp,
                          String website) {
    }

    public record VerifyOtpRequest(String mobile, String challengeId, String otp) {
    }

    public record StatusRequest(String ref, String mobile) {
    }

    public record StatusResult(String ref, KycApplicationStatus status, LocalDateTime submittedAt,
                               LocalDateTime updatedAt, String message) {
    }

    public record KycRow(Long id, String ref, Residency residency, String fullName, String panMasked,
                         String mobileMasked, String email, String location, KycApplicationStatus status,
                         Long assignedRmId, String assignedRmName, int documentCount, LocalDateTime createdAt,
                         LocalDateTime updatedAt) {
    }

    public record DocumentDto(Long id, KycDocType docType, String label, String fileName, String contentType,
                              long sizeBytes, LocalDateTime uploadedAt) {
    }

    public record KycUpdate(KycApplicationStatus status, @Size(max = 4000, message = "Notes are too long") String staffNotes,
                            Long assignedRmId) {
    }
}
