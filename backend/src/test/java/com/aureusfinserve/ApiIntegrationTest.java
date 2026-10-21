package com.aureusfinserve;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** End-to-end API tests against the seeded in-memory H2 database. */
@SpringBootTest(properties = {
        "app.rate-limit.auth-per-ip-per-minute=1000",
        "app.rate-limit.otp-per-user-per-15-min=100",
        "app.mock-exchange.enabled=false"
})
@AutoConfigureMockMvc
@ActiveProfiles("h2")
class ApiIntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper mapper;

    @Autowired
    com.aureusfinserve.sync.AutoSync autoSync;

    @Autowired
    com.aureusfinserve.sync.SyncRunRepository syncRuns;

    @Autowired
    com.aureusfinserve.publicsite.PublicRepos.SchemeRepository schemes;

    @Test
    void autoSyncIsDisabledInTestsAndScheduleIsReported() throws Exception {
        String admin = login("admin@aureusfinserve.in", "Admin@2026");
        long before = syncRuns.count();
        // the h2 profile switches the scheduler off: scheduled jobs are not even queued, so CI never hits the network
        assertThat(autoSync.submit("NAV", false)).isFalse();
        assertThat(autoSync.submit("SCHEMES", false)).isFalse();
        autoSync.scheduledNav();
        autoSync.scheduledDetails();
        autoSync.catchUpOnStart();
        assertThat(syncRuns.count()).isEqualTo(before);

        getAuth("/api/admin/sync/schedule", admin).andExpect(status().isOk())
                .andExpect(jsonPath("$.enabled").value(false))
                .andExpect(jsonPath("$.zone").value("Asia/Kolkata"))
                .andExpect(jsonPath("$.nav.cron").value("0 30 23 * * *"))
                .andExpect(jsonPath("$.nav.retryCron").value("0 0 7 * * *"))
                .andExpect(jsonPath("$.nav.nextRun").doesNotExist())
                .andExpect(jsonPath("$.details.cron").value("0 30 0 * * *"))
                .andExpect(jsonPath("$.schemes.cron").value("0 0 0 * * *"))
                .andExpect(jsonPath("$.lastSuccess").exists());

        String rm = login("ananya@aureusfinserve.in", "Rm@2026!");
        getAuth("/api/admin/sync/schedule", rm).andExpect(status().isForbidden());
        mvc.perform(post("/api/admin/sync/details").header("Authorization", "Bearer " + rm).header("X-Device-Id", "test-device"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/admin/sync/schemes").header("Authorization", "Bearer " + rm).header("X-Device-Id", "test-device"))
                .andExpect(status().isForbidden());
    }

    @Test
    void navUploadAcceptsSixAndEightColumnLines() throws Exception {
        String admin = login("admin@aureusfinserve.in", "Admin@2026");
        var all = schemes.findAll().stream().filter(s -> s.getCode().matches("\\d+")).limit(2).toList();
        assertThat(all).hasSize(2);
        java.time.LocalDate today = java.time.LocalDate.now(java.time.ZoneId.of("Asia/Kolkata"));
        String date = today.format(java.time.format.DateTimeFormatter.ofPattern("dd-MMM-yyyy", java.util.Locale.ENGLISH));
        String file = "Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Plan;Option;Net Asset Value;Date\n\n"
                + "Open Ended Schemes(Equity Scheme - Flexi Cap Fund)\n\nSome Mutual Fund\n\n"
                + all.get(0).getCode() + ";-;-;Old format scheme;" + all.get(0).getNav().toPlainString() + ";" + date + "\n"
                + all.get(1).getCode() + ";-;-;New format scheme;Regular Plan;Growth Option;" + all.get(1).getNav().toPlainString() + ";" + date + "\n"
                + "999999999;-;-;Unknown;Regular Plan;Growth Option;10;" + date + "\n";
        JsonNode run = json(mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart("/api/admin/sync/nav")
                        .file(new org.springframework.mock.web.MockMultipartFile("file", "NAVAll.txt", "text/plain",
                                file.getBytes(java.nio.charset.StandardCharsets.UTF_8)))
                        .header("Authorization", "Bearer " + admin).header("X-Device-Id", "test-device"))
                .andExpect(status().isOk()).andReturn());
        assertThat(run.get("type").asText()).isEqualTo("NAV");
        assertThat(run.get("status").asText()).isEqualTo("SUCCESS");
        assertThat(run.get("processed").asInt()).isEqualTo(2);
        assertThat(schemes.findByCode(all.get(0).getCode()).orElseThrow().getNavDate()).isEqualTo(today);
        assertThat(schemes.findByCode(all.get(1).getCode()).orElseThrow().getNavDate()).isEqualTo(today);
    }

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
        if ("OK".equals(lr.get("status").asText())) {
            return lr.get("token").asText();
        }
        JsonNode v = json(postJson("/api/auth/verify-otp", Map.of("challengeId", lr.get("challengeId").asText(),
                "otp", lr.get("devOtp").asText(), "rememberDevice", false), null).andExpect(status().isOk()).andReturn());
        return v.get("token").asText();
    }

    @Test
    void loginOtpTokenFlow() throws Exception {
        JsonNode lr = json(postJson("/api/auth/login", Map.of("userId", "9876543210", "password", "Priya@2026"), null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OTP_REQUIRED"))
                .andExpect(jsonPath("$.maskedMobile").value("XXXXXX3210"))
                .andExpect(jsonPath("$.devOtp").isString())
                .andReturn());

        // wrong OTP counts an attempt
        postJson("/api/auth/verify-otp", Map.of("challengeId", lr.get("challengeId").asText(), "otp", "000000",
                "rememberDevice", false), null)
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("OTP_INVALID"));

        JsonNode ok = json(postJson("/api/auth/verify-otp", Map.of("challengeId", lr.get("challengeId").asText(),
                "otp", lr.get("devOtp").asText(), "rememberDevice", false), null)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OK"))
                .andExpect(jsonPath("$.user.role").value("INVESTOR"))
                .andExpect(jsonPath("$.user.panMasked").value("XXXXX1234F"))
                .andReturn());
        String token = ok.get("token").asText();

        getAuth("/api/auth/me", token).andExpect(status().isOk()).andExpect(jsonPath("$.name").value("Priya Menon"));
        getAuth("/api/investor/portfolio", token).andExpect(status().isOk())
                .andExpect(jsonPath("$.valueHistory.length()").value(24));

        // OTP cannot be reused
        postJson("/api/auth/verify-otp", Map.of("challengeId", lr.get("challengeId").asText(),
                "otp", lr.get("devOtp").asText(), "rememberDevice", false), null)
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("OTP_INVALID"));

        postJson("/api/auth/logout", Map.of(), token).andExpect(status().isOk());
        getAuth("/api/auth/me", token).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        mvc.perform(get("/api/investor/portfolio")).andExpect(status().isUnauthorized());
    }

    @Test
    void lockoutAfterFiveFailures() throws Exception {
        String user = "vikram@aureusfinserve.in";
        for (int i = 0; i < 3; i++) {
            postJson("/api/auth/login", Map.of("userId", user, "password", "Wrong@123"), null)
                    .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
        }
        // after 3 failures a CAPTCHA is required
        postJson("/api/auth/login", Map.of("userId", user, "password", "Wrong@123"), null)
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("CAPTCHA_REQUIRED"));
        postJson("/api/auth/login", Map.of("userId", user, "password", "Wrong@123", "captchaId", captcha()[0],
                "captchaAnswer", "999"), null)
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("CAPTCHA_INVALID"));

        String[] c = captcha();
        postJson("/api/auth/login", Map.of("userId", user, "password", "Wrong@123", "captchaId", c[0], "captchaAnswer", c[1]), null)
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
        c = captcha();
        postJson("/api/auth/login", Map.of("userId", user, "password", "Wrong@123", "captchaId", c[0], "captchaAnswer", c[1]), null)
                .andExpect(status().isLocked()).andExpect(jsonPath("$.code").value("ACCOUNT_LOCKED"));
        // even the right password is refused while locked
        c = captcha();
        MvcResult r = postJson("/api/auth/login", Map.of("userId", user, "password", "Rm@2026!", "captchaId", c[0], "captchaAnswer", c[1]), null)
                .andExpect(status().isLocked()).andExpect(jsonPath("$.code").value("ACCOUNT_LOCKED")).andReturn();
        assertThat(json(r).get("error").asText()).contains("Try again after");
    }

    private String[] captcha() throws Exception {
        JsonNode c = json(mvc.perform(get("/api/auth/captcha")).andExpect(status().isOk()).andReturn());
        Matcher m = Pattern.compile("What is (\\d+) \\+ (\\d+)\\?").matcher(c.get("question").asText());
        assertThat(m.matches()).isTrue();
        return new String[]{c.get("captchaId").asText(),
                String.valueOf(Integer.parseInt(m.group(1)) + Integer.parseInt(m.group(2)))};
    }

    @Test
    void rmCannotSeeAnotherRmsClient() throws Exception {
        String admin = login("admin@aureusfinserve.in", "Admin@2026");
        JsonNode clients = json(getAuth("/api/admin/clients", admin).andExpect(status().isOk()).andReturn());
        long kavitaId = -1;
        for (JsonNode c : clients) {
            if (c.get("name").asText().equals("Kavita Iyer")) {
                kavitaId = c.get("id").asLong();
            }
        }
        assertThat(kavitaId).isPositive();

        String rm = login("ananya@aureusfinserve.in", "Rm@2026!");
        JsonNode mine = json(getAuth("/api/admin/clients", rm).andExpect(status().isOk()).andReturn());
        assertThat(mine.size()).isEqualTo(3);
        mine.forEach(c -> assertThat(c.get("rmName").asText()).isEqualTo("Ananya Sharma"));
        getAuth("/api/admin/clients/" + kavitaId, rm).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        getAuth("/api/admin/users", rm).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
        getAuth("/api/admin/users", admin).andExpect(status().isOk());
    }

    @Test
    void passwordPolicyIsEnforcedOnChange() throws Exception {
        String token = login("9876500001", "Rao@2026");
        JsonNode otp = json(postJson("/api/auth/change-password/otp", Map.of(), token).andExpect(status().isOk()).andReturn());
        postJson("/api/auth/change-password", Map.of("currentPassword", "Rao@2026", "newPassword", "password1",
                "challengeId", otp.get("challengeId").asText(), "otp", otp.get("devOtp").asText()), token)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION"))
                .andExpect(jsonPath("$.fields.newPassword").value("Password must contain at least one symbol"));
        postJson("/api/auth/change-password", Map.of("currentPassword", "Rao@2026", "newPassword", "9876500001",
                "challengeId", otp.get("challengeId").asText(), "otp", otp.get("devOtp").asText()), token)
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION"));
        postJson("/api/auth/change-password", Map.of("currentPassword", "Rao@2026", "newPassword", "NewRao#2027",
                "challengeId", otp.get("challengeId").asText(), "otp", otp.get("devOtp").asText()), token)
                .andExpect(status().isOk()).andExpect(jsonPath("$.ok").value(true));
        login("9876500001", "NewRao#2027");
    }
}
