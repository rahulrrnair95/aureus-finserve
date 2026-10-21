package com.aureusfinserve.admin;

import com.aureusfinserve.admin.AdminDtos.*;
import com.aureusfinserve.common.ApiException;
import com.aureusfinserve.common.LeadStatus;
import com.aureusfinserve.common.OrderStatus;
import com.aureusfinserve.common.TicketStatus;
import com.aureusfinserve.investor.InvestorDtos.TicketDto;
import com.aureusfinserve.investor.TicketService;
import com.aureusfinserve.order.OrderDtos.CartRequest;
import com.aureusfinserve.order.OrderDtos.Order;
import com.aureusfinserve.order.OrderService;
import com.aureusfinserve.publicsite.LeadAttachment;
import com.aureusfinserve.security.AuthUser;
import com.aureusfinserve.security.CurrentUser;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** Staff console endpoints available to RM (scoped) and ADMIN. ADMIN-only ones carry @PreAuthorize. */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService admin;
    private final ClientService clients;
    private final StaffScope scope;
    private final OrderService orders;
    private final TicketService tickets;

    private AuthUser me() {
        return CurrentUser.get();
    }

    @GetMapping("/dashboard")
    public Dashboard dashboard() {
        return admin.dashboard(me());
    }

    // ---------------------------------------------------------------- clients

    @GetMapping("/clients")
    public List<ClientRow> clients(@RequestParam(required = false) String q, @RequestParam(required = false) Long rmId) {
        return clients.list(me(), q, rmId);
    }

    @GetMapping("/clients/{id}")
    public Map<String, Object> client(@PathVariable Long id) {
        return clients.detail(me(), id);
    }

    @PostMapping("/clients")
    public ClientService.Created createClient(@Valid @RequestBody ClientRequest r) {
        return clients.create(me(), r);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/clients/{id}")
    public ClientRow updateClient(@PathVariable Long id, @Valid @RequestBody ClientRequest r) {
        return clients.update(me(), id, r);
    }

    @PostMapping("/clients/{id}/activation-link")
    public Map<String, Object> activationLink(@PathVariable Long id) {
        return Map.of("activationLink", clients.activationLink(me(), id));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/clients/{id}/status")
    public ClientRow clientStatus(@PathVariable Long id, @Valid @RequestBody EnabledRequest r) {
        return clients.setEnabled(id, r.enabled());
    }

    @GetMapping("/rms")
    public List<RmRef> rms() {
        return admin.rms();
    }

    // ---------------------------------------------------------------- leads

    @GetMapping("/leads")
    public List<LeadRow> leads(@RequestParam(required = false) LeadStatus status, @RequestParam(required = false) String q) {
        return admin.leads(me(), status, q);
    }

    @PutMapping("/leads/{id}")
    public LeadRow updateLead(@PathVariable Long id, @Valid @RequestBody LeadUpdate r) {
        return admin.updateLead(me(), id, r);
    }

    @GetMapping("/leads/{id}/attachment")
    public ResponseEntity<byte[]> leadAttachment(@PathVariable Long id) {
        LeadAttachment a = admin.attachment(me(), id);
        ResponseEntity.BodyBuilder b = ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(a.getFileName() == null ? "cas.pdf" : a.getFileName()).build().toString())
                .header(HttpHeaders.CACHE_CONTROL, "no-store");
        if (a.getCasPassword() != null) {
            // The CAS PDF is usually password protected; staff need the password to open it.
            b.header("X-Cas-Password", a.getCasPassword());
        }
        return b.body(a.getData());
    }

    // ---------------------------------------------------------------- orders

    @GetMapping("/orders")
    public List<Order> orders(@RequestParam(required = false) OrderStatus status, @RequestParam(required = false) Long clientId) {
        AuthUser u = me();
        if (clientId != null) {
            scope.client(u, clientId);
            return orders.list(List.of(clientId), status);
        }
        return orders.list(scope.restriction(u), status);
    }

    @PostMapping("/orders")
    public List<Order> placeOrders(@Valid @RequestBody CartRequest r) {
        AuthUser u = me();
        if (r.investorId() == null) {
            throw ApiException.validation("investorId", "Select the client");
        }
        scope.client(u, r.investorId());
        return orders.placeCart(r, r.investorId(), u, true);
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/orders/{id}/status")
    public Order orderStatus(@PathVariable Long id, @Valid @RequestBody OrderStatusRequest r) {
        return orders.overrideStatus(id, r.status(), r.note());
    }

    // ---------------------------------------------------------------- tickets

    @GetMapping("/tickets")
    public List<TicketDto> tickets(@RequestParam(required = false) TicketStatus status) {
        return tickets.list(scope.restriction(me()), status, true);
    }

    @PutMapping("/tickets/{id}")
    public TicketDto updateTicket(@PathVariable Long id, @Valid @RequestBody TicketUpdate r) {
        AuthUser u = me();
        return tickets.staffUpdate(id, r.status(), r.comment(), u.name(), scope.restriction(u));
    }
}
