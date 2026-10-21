package com.aureusfinserve.investor;

import com.aureusfinserve.common.GoalType;
import com.aureusfinserve.common.KycStatus;
import com.aureusfinserve.common.MandateStatus;
import com.aureusfinserve.common.NotificationType;
import com.aureusfinserve.common.TicketCategory;
import com.aureusfinserve.common.TicketStatus;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class InvestorDtos {

    private InvestorDtos() {
    }

    public record FamilyMember(Long id, String name, String relation, String panMasked) {
    }

    public record GoalDto(Long id, String name, GoalType type, BigDecimal targetAmount, LocalDate targetDate,
                          List<Long> folioIds, BigDecimal currentValue, Double progressPct) {
    }

    public record GoalRequest(@NotBlank(message = "Goal name is required") @Size(max = 150) String name,
                              @NotNull(message = "Goal type is required") GoalType type,
                              @NotNull(message = "Target amount is required") @DecimalMin(value = "1000", message = "Target must be at least ₹1,000") BigDecimal targetAmount,
                              @NotNull(message = "Target date is required") @Future(message = "Target date must be in the future") LocalDate targetDate,
                              List<Long> folioIds) {
    }

    public record NomineeDto(String name, String relation, BigDecimal sharePct) {
    }

    public record BankDto(String bankName, String accountMasked, String ifsc, boolean primary) {
    }

    public record MandateDto(Long id, String umrn, String bankName, BigDecimal limit, MandateStatus status) {
    }

    public record Profile(String name, String panMasked, LocalDate dob, String email, String mobileMasked, String address,
                          KycStatus kycStatus, String taxStatus, List<NomineeDto> nominees, List<BankDto> bankAccounts,
                          List<MandateDto> mandates) {
    }

    public record Comment(String by, String text, LocalDateTime at) {
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record TicketDto(Long id, String ref, TicketCategory category, String subject, String description,
                            TicketStatus status, LocalDateTime createdAt, LocalDateTime updatedAt, List<Comment> comments,
                            Long investorId, String investorName) {
    }

    public record TicketRequest(@NotNull(message = "Category is required") TicketCategory category,
                                @NotBlank(message = "Subject is required") @Size(max = 200) String subject,
                                @NotBlank(message = "Description is required") @Size(max = 4000) String description) {
    }

    public record RmDto(String name, String phone, String whatsapp, String email, String euin) {
    }

    public record CallbackRequest(@Size(max = 100) String preferredTime, @Size(max = 1000) String note) {
    }

    public record NotificationDto(Long id, NotificationType type, String title, String message, boolean read,
                                  LocalDateTime createdAt) {
    }
}
