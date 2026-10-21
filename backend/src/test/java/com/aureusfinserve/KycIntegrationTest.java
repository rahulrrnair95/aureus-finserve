package com.aureusfinserve;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Online KYC application: public submission, status lookup and the staff queue (RM scoping). */
@SpringBootTest(properties = {
        "app.rate-limit.auth-per-ip-per-minute=1000",
        "app.rate-limit.otp-per-user-per-15-min=100",
        "app.mock-exchange.enabled=false"
})
@AutoConfigureMockMvc
@ActiveProfiles("h2")
class KycIntegrationTest {

    static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13, 'I', 'H', 'D', 'R'};
    static final byte[] JPG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 16, 'J', 'F', 'I', 'F', 0, 1};
    static final byte[] PDF = "%PDF-1.4\n% sample kyc proof\n%%EOF\n".getBytes();

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper mapper;

    private ResultActions postJson(String path, Object body, String token) throws Exception {
        var req = post(path).contentType(MediaType.APPLICATION_JSON).header("X-Device-Id", "test-device")
                .content(mapper.writeValueAsString(body));
        if (token != null) {
            req.header("Authorization", "Bearer " + token);
        }
        return mvc.perform(req);
    }

    private ResultActions getAuth(String path, String token) throws Exception {
        return mvc.perform(get(path).header("Authorization", "Bearer " + token).header("X-Device-Id", "test-device"));
    }

    private JsonNode json(MvcResult r) throws Exception {
        return mapper.readTree(r.getResponse().getContentAsString());
    }

    private String login(String userId, String password) throws Exception {
        JsonNode lr = json(postJson("/api/auth/login", Map.of("userId", userId, "password", password), null)
                .andExpect(status().isOk()).andReturn());
        JsonNode v = json(postJson("/api/auth/verify-otp", Map.of("challengeId", lr.get("challengeId").asText(),
                "otp", lr.get("devOtp").asText(), "rememberDevice", false), null).andExpect(status().isOk()).andReturn());
        return v.get("token").asText();
    }

    private JsonNode otp(String mobile) throws Exception {
        return json(postJson("/api/public/leads/otp", Map.of("mobile", mobile), null).andExpect(status().isOk()).andReturn());
    }

    private Map<String, String> residentFields(String mobile) {
        Map<String, String> f = new LinkedHashMap<>();
        f.put("residency", "RESIDENT");
        f.put("fullName", "Test Resident");
        f.put("fatherOrSpouseName", "Test Father");
        f.put("gender", "FEMALE");
        f.put("dob", LocalDate.now().minusYears(30).toString());
        f.put("pan", "abcpt1234k");
        f.put("mobile", mobile);
        f.put("email", "resident@example.com");
        f.put("maritalStatus", "SINGLE");
        f.put("occupation", "PRIVATE_SECTOR");
        f.put("annualIncome", "5L_10L");
        f.put("politicallyExposed", "false");
        f.put("addressLine", "12 MG Road, Indiranagar");
        f.put("city", "Bengaluru");
        f.put("state", "Karnataka");
        f.put("pincode", "560038");
        f.put("preferredVipvSlot", "Weekday evening IST");
        f.put("consent", "true");
        f.put("website", "");
        return f;
    }

    private ResultActions submit(Map<String, String> fields, MockMultipartFile... files) throws Exception {
        MockMultipartHttpServletRequestBuilder b = multipart("/api/public/kyc");
        fields.forEach(b::param);
        for (MockMultipartFile f : files) {
            b.file(f);
        }
        return mvc.perform(b.header("X-Device-Id", "test-device"));
    }

    private static MockMultipartFile file(String part, String name, String type, byte[] bytes) {
        return new MockMultipartFile(part, name, type, bytes);
    }

    @Test
    void residentSubmissionHappyPath() throws Exception {
        String mobile = "9123400001";
        JsonNode otp = otp(mobile);
        // step 1 of the website form verifies the mobile up front
        postJson("/api/public/kyc/verify-otp", Map.of("mobile", mobile, "challengeId", otp.get("challengeId").asText(),
                "otp", otp.get("devOtp").asText()), null).andExpect(status().isOk()).andExpect(jsonPath("$.ok").value(true));

        Map<String, String> f = residentFields(mobile);
        f.put("challengeId", otp.get("challengeId").asText());
        f.put("otp", otp.get("devOtp").asText());
        JsonNode res = json(submit(f,
                file("PAN_CARD", "pan.png", "image/png", PNG),
                file("ADDRESS_PROOF", "aadhaar-masked.pdf", "application/pdf", PDF),
                file("PHOTO", "me.jpg", "image/jpeg", JPG),
                file("SIGNATURE", "sign.png", "image/png", PNG))
                .andExpect(status().isOk()).andExpect(jsonPath("$.ok").value(true)).andReturn());
        String ref = res.get("ref").asText();
        assertThat(ref).matches("KYC\\d{10}");

        // the same verification cannot back a second application
        submit(f, file("PAN_CARD", "pan.png", "image/png", PNG), file("ADDRESS_PROOF", "a.pdf", "application/pdf", PDF),
                file("PHOTO", "me.jpg", "image/jpeg", JPG), file("SIGNATURE", "s.png", "image/png", PNG))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("OTP_INVALID"));

        postJson("/api/public/kyc/status", Map.of("ref", ref.toLowerCase(), "mobile", mobile), null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ref").value(ref))
                .andExpect(jsonPath("$.status").value("SUBMITTED"))
                .andExpect(jsonPath("$.message").isString());
        postJson("/api/public/kyc/status", Map.of("ref", ref, "mobile", "9999999999"), null)
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));

        String admin = login("admin@aureusfinserve.in", "Admin@2026");
        JsonNode list = json(getAuth("/api/admin/kyc?q=" + ref, admin).andExpect(status().isOk()).andReturn());
        assertThat(list.size()).isEqualTo(1);
        JsonNode row = list.get(0);
        assertThat(row.get("panMasked").asText()).isEqualTo("XXXXX1234K");
        assertThat(row.get("mobileMasked").asText()).isEqualTo("XXXXXX0001");
        assertThat(row.get("documentCount").asInt()).isEqualTo(4);
        long id = row.get("id").asLong();

        JsonNode detail = json(getAuth("/api/admin/kyc/" + id, admin).andExpect(status().isOk()).andReturn());
        assertThat(detail.get("documents").size()).isEqualTo(4);
        assertThat(detail.toString()).doesNotContain("ABCPT1234K").doesNotContain(mobile);
        long docId = -1;
        for (JsonNode d : detail.get("documents")) {
            if (d.get("docType").asText().equals("ADDRESS_PROOF")) {
                docId = d.get("id").asLong();
            }
        }
        MvcResult dl = getAuth("/api/admin/kyc/" + id + "/documents/" + docId, admin).andExpect(status().isOk()).andReturn();
        assertThat(dl.getResponse().getContentAsByteArray()).isEqualTo(PDF);
        assertThat(dl.getResponse().getContentType()).isEqualTo("application/pdf");

        mvc.perform(put("/api/admin/kyc/" + id).header("Authorization", "Bearer " + admin).header("X-Device-Id", "test-device")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("status", "VIPV_SCHEDULED", "staffNotes", "Call on Monday"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("VIPV_SCHEDULED"));
        postJson("/api/public/kyc/status", Map.of("ref", ref, "mobile", mobile), null)
                .andExpect(jsonPath("$.status").value("VIPV_SCHEDULED"));
        JsonNode audit = json(getAuth("/api/admin/audit?q=" + ref, admin).andExpect(status().isOk()).andReturn());
        assertThat(audit.toString()).contains("KYC_SUBMITTED", "KYC_DOCUMENT_DOWNLOADED", "KYC_UPDATED");
        getAuth("/api/admin/dashboard", admin).andExpect(status().isOk()).andExpect(jsonPath("$.pendingKyc").isNumber());
    }

    @Test
    void nriMissingPassportIsRejectedWithFieldError() throws Exception {
        String mobile = "9123400002";
        JsonNode otp = otp(mobile);
        Map<String, String> f = residentFields(mobile);
        f.put("residency", "NRI");
        f.put("pan", "ABCPN5678L");
        f.put("countryOfResidence", "United Kingdom");
        f.put("overseasAddress", "221B Baker Street, London NW1 6XE");
        f.put("taxResidencyCountry", "United Kingdom");
        f.put("foreignTin", "AB123456C");
        f.put("nationality", "Indian");
        f.put("challengeId", otp.get("challengeId").asText());
        f.put("otp", otp.get("devOtp").asText());
        submit(f,
                file("PAN_CARD", "pan.png", "image/png", PNG),
                file("OVERSEAS_ADDRESS_PROOF", "utility.pdf", "application/pdf", PDF),
                file("PHOTO", "me.jpg", "image/jpeg", JPG),
                file("SIGNATURE", "sign.png", "image/png", PNG))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION"))
                .andExpect(jsonPath("$.fields.PASSPORT").value("Upload your passport"));

        // a renamed text file is refused by the magic-byte check
        submit(f,
                file("PAN_CARD", "pan.png", "image/png", "not really a png".getBytes()),
                file("PASSPORT", "passport.pdf", "application/pdf", PDF),
                file("OVERSEAS_ADDRESS_PROOF", "utility.pdf", "application/pdf", PDF),
                file("PHOTO", "me.jpg", "image/jpeg", JPG),
                file("SIGNATURE", "sign.png", "image/png", PNG))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.PAN_CARD").exists());

        // under 18
        f.put("dob", LocalDate.now().minusYears(17).toString());
        submit(f, file("PASSPORT", "passport.pdf", "application/pdf", PDF))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.dob").exists());
    }

    @Test
    void rmSeesOnlyAssignedOrUnassignedApplications() throws Exception {
        String admin = login("admin@aureusfinserve.in", "Admin@2026");
        JsonNode all = json(getAuth("/api/admin/kyc", admin).andExpect(status().isOk()).andReturn());
        long vikramsApp = -1;
        long unassigned = -1;
        for (JsonNode r : all) {
            if ("Vikram Nair".equals(r.path("assignedRmName").asText(null))) {
                vikramsApp = r.get("id").asLong();
            }
            if (r.get("assignedRmId").isNull()) {
                unassigned = r.get("id").asLong();
            }
        }
        assertThat(vikramsApp).isPositive();
        assertThat(unassigned).isPositive();

        String rm = login("ananya@aureusfinserve.in", "Rm@2026!");
        JsonNode mine = json(getAuth("/api/admin/kyc", rm).andExpect(status().isOk()).andReturn());
        assertThat(mine).isNotEmpty();
        for (JsonNode r : mine) {
            assertThat(r.get("assignedRmId").isNull() || "Ananya Sharma".equals(r.get("assignedRmName").asText())).isTrue();
            assertThat(r.get("id").asLong()).isNotEqualTo(vikramsApp);
        }
        getAuth("/api/admin/kyc/" + vikramsApp, rm).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        getAuth("/api/admin/kyc/" + vikramsApp + "/documents/1", rm).andExpect(status().isForbidden());
        getAuth("/api/admin/kyc/" + unassigned, rm).andExpect(status().isOk());
        // an RM cannot reassign
        mvc.perform(put("/api/admin/kyc/" + unassigned).header("Authorization", "Bearer " + rm).header("X-Device-Id", "test-device")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(mapper.writeValueAsString(Map.of("assignedRmId", 1))))
                .andExpect(status().isForbidden());
        // the public cannot reach the staff queue
        mvc.perform(get("/api/admin/kyc")).andExpect(status().isUnauthorized());
    }
}
