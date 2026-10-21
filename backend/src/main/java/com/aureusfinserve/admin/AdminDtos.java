package com.aureusfinserve.admin;

import com.aureusfinserve.common.*;
import jakarta.validation.constraints.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class AdminDtos {

    private AdminDtos() {
    }

    public record NameValue(String name, BigDecimal value) {
    }

    public record Flow(String month, BigDecimal inflow, BigDecimal outflow, BigDecimal net) {
    }

    public record TopClient(Long id, String name, BigDecimal aum) {
    }

    public record Dashboard(BigDecimal aum, long clients, long activeSips, BigDecimal sipBook, long newLeads,
                            long openTickets, long pendingOrders, List<Flow> flows, List<NameValue> aumByCategory,
                            List<NameValue> aumByAmc, List<TopClient> topClients, long pendingKyc) {
    }

    public record ClientRow(Long id, String name, String panMasked, String mobileMasked, String email, Long rmId,
                            String rmName, BigDecimal aum, long sipCount, KycStatus kycStatus, LoginStatus loginStatus,
                            Long familyHeadId, String familyHeadName, Relation relation, LocalDateTime createdAt) {
    }

    public record ClientRequest(@NotBlank(message = "Name is required") @Size(max = 150) String name,
                                @NotBlank(message = "PAN is required") @Pattern(regexp = "[A-Za-z]{5}[0-9]{4}[A-Za-z]", message = "PAN must look like ABCDE1234F") String pan,
                                @NotNull(message = "Date of birth is required") @Past(message = "Date of birth must be in the past") LocalDate dob,
                                @NotBlank(message = "E-mail is required") @Email(message = "Enter a valid e-mail") @Size(max = 200) String email,
                                @NotBlank(message = "Mobile is required") @Pattern(regexp = "(\\+?91)?[6-9]\\d{9}", message = "Enter a valid 10-digit mobile") String mobile,
                                @Size(max = 500) String address, KycStatus kycStatus, Long rmId, Long familyHeadId,
                                Relation relation) {
    }

    public record FamilyRef(Long id, String name, Relation relation) {
    }

    public record EnabledRequest(@NotNull(message = "enabled is required") Boolean enabled) {
    }

    public record RmRef(Long id, String name, String euin) {
    }

    public record LeadRow(Long id, String name, String mobile, String email, String city, LeadInterest interest,
                          String message, String source, LeadStatus status, LocalDate followUpDate, String notes,
                          Long assignedRmId, String assignedRmName, LocalDateTime createdAt, boolean hasAttachment) {
    }

    public record LeadUpdate(LeadStatus status, LocalDate followUpDate, @Size(max = 4000) String notes, Long assignedRmId) {
    }

    public record OrderStatusRequest(@NotNull(message = "Status is required") OrderStatus status, @Size(max = 500) String note) {
    }

    public record TicketUpdate(TicketStatus status, @Size(max = 2000) String comment) {
    }

    public record StaffUser(Long id, String name, String email, String mobileMasked, Role role, String euin, boolean enabled,
                            LoginStatus loginStatus, LocalDateTime lastLoginAt) {
    }

    public record StaffUserRequest(@NotBlank(message = "Name is required") @Size(max = 150) String name,
                                   @NotBlank(message = "E-mail is required") @Email(message = "Enter a valid e-mail") String email,
                                   @NotBlank(message = "Mobile is required") @Pattern(regexp = "(\\+?91)?[6-9]\\d{9}", message = "Enter a valid 10-digit mobile") String mobile,
                                   @NotNull(message = "Role is required") Role role,
                                   @Size(max = 20) String euin) {
    }

    public record BrokerageRow(String amc, String schemeName, String month, BigDecimal aum, BigDecimal ratePct,
                               BigDecimal expected, BigDecimal received, BigDecimal difference, boolean reconciled) {
    }

    public record BrokerageTotals(BigDecimal expected, BigDecimal received) {
    }

    public record BrokerageReport(List<BrokerageRow> rows, BrokerageTotals totals) {
    }

    public record AuditRow(Long id, LocalDateTime at, Long userId, String userName, String role, String action,
                           String entity, String entityId, String detail, String ip) {
    }

    public record AuditPage(List<AuditRow> items, long total) {
    }
}
