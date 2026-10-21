package com.aureusfinserve;

import com.aureusfinserve.common.Fmt;
import com.aureusfinserve.nfo.Nfo;
import com.aureusfinserve.nfo.NfoRepos.NfoRepository;
import com.aureusfinserve.nfo.NfoRules.Candidate;
import com.aureusfinserve.sync.NfoSync;
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

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** NFO import upsert (no network), public lists and filters, staff edits, one-pager upload / download, access rules. */
@SpringBootTest(properties = {
        "app.rate-limit.auth-per-ip-per-minute=1000",
        "app.rate-limit.otp-per-user-per-15-min=100",
        "app.mock-exchange.enabled=false"
})
@AutoConfigureMockMvc
@ActiveProfiles("h2")
class NfoIntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper mapper;

    @Autowired
    NfoSync nfoSync;

    @Autowired
    NfoRepository nfos;

    static final String AMC = "Testwise Asset Management Private Limited";

    private static Candidate cand(String name, String code, String category, LocalDate open, LocalDate close) {
        return new Candidate(AMC + "|" + name.toLowerCase(), AMC, code, name, "Open Ended", category, "Rs. 500/- and any amount thereafter",
                open, close);
    }

    private Map<String, Long> importSample(LocalDate today) {
        List<Candidate> list = new ArrayList<>();
        list.add(cand("Testwise Open Flexi Cap Fund", "990001", "Equity Schemes - Flexi Cap Fund", today.minusDays(3), today.plusDays(5)));
        list.add(cand("Testwise Estimated Liquid Fund", "990002", "Income/Debt Oriented Schemes - Liquid Fund", today.minusDays(10), null));
        list.add(cand("Testwise Upcoming Balanced Advantage Fund", "990003", "Hybrid Schemes - Balanced Advantage Fund", today.plusDays(4), null));
        list.add(cand("Testwise Closed Gold ETF", "990004", "Exchange Traded Funds (ETFs) - Gold ETF", today.minusDays(20), today.minusDays(6)));
        list.add(cand("Testwise Old Closed Fund", "990005", "Equity Schemes - Mid Cap Fund", today.minusDays(60), today.minusDays(45)));
        NfoSync.UpsertResult r = nfoSync.upsert(list, today);
        assertThat(r.added() + r.updated()).isGreaterThanOrEqualTo(0);
        Map<String, Long> ids = new HashMap<>();
        for (Nfo n : nfos.findAll()) {
            if (n.getSchemeCode() != null && n.getSchemeCode().startsWith("99000")) {
                ids.put(n.getSchemeCode(), n.getId());
            }
        }
        return ids;
    }

    @Test
    void importAndPublicListsWithFilters() throws Exception {
        LocalDate today = Fmt.today();
        Map<String, Long> ids = importSample(today);
        assertThat(ids).hasSize(5);
        // a second import of the same data changes nothing
        assertThat(nfoSync.upsert(List.of(cand("Testwise Open Flexi Cap Fund", "990001", "Equity Schemes - Flexi Cap Fund",
                today.minusDays(3), today.plusDays(5))), today)).isEqualTo(new NfoSync.UpsertResult(0, 0));

        // default = open + upcoming; AMC shown without the company suffix
        JsonNode def = json(mvc.perform(get("/api/public/nfos").param("amc", "Testwise Asset Management")).andExpect(status().isOk()).andReturn());
        assertThat(def).hasSize(3);
        assertThat(def.get(0).get("schemeName").asText()).isEqualTo("Testwise Estimated Liquid Fund"); // closes soonest
        assertThat(def.get(0).get("status").asText()).isEqualTo("OPEN");
        assertThat(def.get(0).get("closeDateConfirmed").asBoolean()).isFalse();
        assertThat(def.get(0).get("closesBy").asText()).isEqualTo(today.plusDays(5).toString());
        assertThat(def.get(0).get("daysLeft").asInt()).isEqualTo(5);
        assertThat(def.get(0).get("assetClass").asText()).isEqualTo("DEBT");
        assertThat(def.get(0).get("minAmount").asDouble()).isEqualTo(500.0);
        assertThat(def.get(0).has("staffEditedFields")).isFalse(); // staff-only fields are not public
        assertThat(def.get(2).get("status").asText()).isEqualTo("UPCOMING");
        assertThat(def.get(2).get("opensInDays").asInt()).isEqualTo(4);

        JsonNode open = json(mvc.perform(get("/api/public/nfos").param("status", "open").param("amc", "Testwise Asset Management")).andReturn());
        assertThat(open).hasSize(2);
        JsonNode closed = json(mvc.perform(get("/api/public/nfos").param("status", "closed").param("amc", "Testwise Asset Management")).andReturn());
        assertThat(closed).hasSize(1); // the one closed 45 days ago is filtered out (kept in the database)
        assertThat(closed.get(0).get("assetClass").asText()).isEqualTo("OTHER");
        JsonNode all = json(mvc.perform(get("/api/public/nfos").param("status", "all").param("amc", "Testwise Asset Management")).andReturn());
        assertThat(all).hasSize(4);
        JsonNode hybrid = json(mvc.perform(get("/api/public/nfos").param("status", "all").param("assetClass", "HYBRID")
                .param("amc", "Testwise Asset Management")).andReturn());
        assertThat(hybrid).hasSize(1);
        mvc.perform(get("/api/public/nfos").param("status", "soon")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION"));

        // detail + no one-pager yet
        mvc.perform(get("/api/public/nfos/" + ids.get("990001"))).andExpect(status().isOk())
                .andExpect(jsonPath("$.schemeName").value("Testwise Open Flexi Cap Fund"))
                .andExpect(jsonPath("$.subCategory").value("Flexi Cap"))
                .andExpect(jsonPath("$.hasOnePager").value(false));
        mvc.perform(get("/api/public/nfos/" + ids.get("990001") + "/one-pager")).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        assertThat(nfos.findById(ids.get("990005"))).isPresent();
    }

    @Test
    void staffEditsSurviveTheNextImportAndHiddenOrFeaturedApply() throws Exception {
        LocalDate today = Fmt.today();
        Map<String, Long> ids = importSample(today);
        String admin = login("admin@aureusfinserve.in", "Admin@2026");
        long id = ids.get("990003");

        put("/api/admin/nfos/" + id, Map.of("closeDate", "2020-01-01"), admin).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.closeDate").exists());
        put("/api/admin/nfos/" + id, Map.of("sidUrl", "not a link"), admin).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.sidUrl").exists());
        Map<String, Object> body = new HashMap<>();
        body.put("closeDate", today.plusDays(9).toString());
        body.put("riskometer", "VERY_HIGH");
        body.put("benchmark", "NIFTY 50 Hybrid Composite Debt 65:35 Index");
        body.put("sidUrl", "https://example.com/sid.pdf");
        body.put("featured", true);
        JsonNode saved = json(put("/api/admin/nfos/" + id, body, admin).andExpect(status().isOk()).andReturn());
        assertThat(saved.get("closeDateSource").asText()).isEqualTo("STAFF");
        assertThat(saved.get("staffEditedFields").toString()).contains("closeDate", "riskometer", "benchmark", "sidUrl").doesNotContain("featured");

        // the next import has a different AMFI closure date: the staff date stays
        nfoSync.upsert(List.of(cand("Testwise Upcoming Balanced Advantage Fund", "990003", "Hybrid Schemes - Balanced Advantage Fund",
                today.plusDays(4), today.plusDays(18))), today);
        Nfo n = nfos.findById(id).orElseThrow();
        assertThat(n.getCloseDate()).isEqualTo(today.plusDays(9));
        assertThat(n.getBenchmark()).isEqualTo("NIFTY 50 Hybrid Composite Debt 65:35 Index");

        // featured first in the public list
        JsonNode def = json(mvc.perform(get("/api/public/nfos").param("amc", "Testwise Asset Management")).andReturn());
        assertThat(def.get(0).get("id").asLong()).isEqualTo(id);

        // hidden NFOs disappear from the public site (list, detail, one-pager) but staff still see them
        put("/api/admin/nfos/" + id, Map.of("hidden", true, "featured", false), admin).andExpect(status().isOk());
        JsonNode after = json(mvc.perform(get("/api/public/nfos").param("amc", "Testwise Asset Management")).andReturn());
        after.forEach(x -> assertThat(x.get("id").asLong()).isNotEqualTo(id));
        mvc.perform(get("/api/public/nfos/" + id)).andExpect(status().isNotFound());
        getAuth("/api/admin/nfos/" + id, admin).andExpect(status().isOk()).andExpect(jsonPath("$.hidden").value(true));
        put("/api/admin/nfos/" + id, Map.of("hidden", false), admin).andExpect(status().isOk());

        // manual NFO
        postJson("/api/admin/nfos", Map.of("schemeName", "Manual Test Fund"), admin).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.amc").exists()).andExpect(jsonPath("$.fields.openDate").exists());
        JsonNode manual = json(postJson("/api/admin/nfos", Map.of("amc", "Testwise Mutual Fund", "schemeName", "Testwise Manual Fund",
                "assetClass", "EQUITY", "openDate", today.plusDays(2).toString(), "minAmount", 1000), admin)
                .andExpect(status().isOk()).andReturn());
        assertThat(manual.get("source").asText()).isEqualTo("MANUAL");
        assertThat(manual.get("status").asText()).isEqualTo("UPCOMING");

        // RM: read-only
        String rm = login("ananya@aureusfinserve.in", "Rm@2026!");
        getAuth("/api/admin/nfos", rm).andExpect(status().isOk());
        put("/api/admin/nfos/" + id, Map.of("featured", true), rm).andExpect(status().isForbidden());
        mvc.perform(post("/api/admin/sync/nfos").header("Authorization", "Bearer " + rm).header("X-Device-Id", "test-device"))
                .andExpect(status().isForbidden());
        getAuth("/api/admin/sync/schedule", admin).andExpect(status().isOk())
                .andExpect(jsonPath("$.nfo.cron").value("0 0 8 * * *"))
                .andExpect(jsonPath("$.lastSuccess.NFO").doesNotExist());
    }

    @Test
    void onePagerUploadIsValidatedAndDownloadsByteIdentical() throws Exception {
        LocalDate today = Fmt.today();
        Map<String, Long> ids = importSample(today);
        String admin = login("admin@aureusfinserve.in", "Admin@2026");
        long id = ids.get("990001");
        String url = "/api/admin/nfos/" + id + "/one-pager";

        upload(url, new MockMultipartFile("file", "leaflet.pdf", "application/pdf", "PK\u0003\u0004not a pdf".getBytes()), admin)
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.file").value("Only PDF files are accepted"));
        upload(url, new MockMultipartFile("file", "leaflet.png", "image/png", "%PDF-1.4 but png type".getBytes()), admin)
                .andExpect(status().isBadRequest());
        upload(url, new MockMultipartFile("file", "big.pdf", "application/pdf", bigPdf()), admin)
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fields.file").value("The one-pager must be 10 MB or smaller"));
        upload(url, new MockMultipartFile("file", "empty.pdf", "application/pdf", new byte[0]), admin).andExpect(status().isBadRequest());

        String rm = login("ananya@aureusfinserve.in", "Rm@2026!");
        byte[] pdf = "%PDF-1.4\n% test one-pager\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n".getBytes(StandardCharsets.US_ASCII);
        upload(url, new MockMultipartFile("file", "leaflet.pdf", "application/pdf", pdf), rm).andExpect(status().isForbidden());
        upload(url, new MockMultipartFile("file", "C:\\fakepath\\Testwise leaflet.pdf", "application/pdf", pdf), admin)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasOnePager").value(true))
                .andExpect(jsonPath("$.onePagerFileName").value("Testwise leaflet.pdf"))
                .andExpect(jsonPath("$.onePagerUrl").value("/api/public/nfos/" + id + "/one-pager"));

        MvcResult r = mvc.perform(get("/api/public/nfos/" + id + "/one-pager")).andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "application/pdf"))
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"Testwise-Open-Flexi-Cap-Fund-NFO-one-pager.pdf\""))
                .andReturn();
        assertThat(r.getResponse().getContentAsByteArray()).isEqualTo(pdf);

        mvc.perform(delete(url).header("Authorization", "Bearer " + admin).header("X-Device-Id", "test-device"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.hasOnePager").value(false));
        mvc.perform(get("/api/public/nfos/" + id + "/one-pager")).andExpect(status().isNotFound());
    }

    private static byte[] bigPdf() {
        byte[] b = new byte[10 * 1024 * 1024 + 10];
        System.arraycopy("%PDF-1.4".getBytes(), 0, b, 0, 8);
        return b;
    }

    // ---------------------------------------------------------------- helpers

    private ResultActions upload(String path, MockMultipartFile f, String token) throws Exception {
        return mvc.perform(multipart(path).file(f).header("Authorization", "Bearer " + token).header("X-Device-Id", "test-device"));
    }

    private ResultActions put(String path, Object body, String token) throws Exception {
        return mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put(path)
                .contentType(MediaType.APPLICATION_JSON).header("X-Device-Id", "test-device")
                .header("Authorization", "Bearer " + token).content(mapper.writeValueAsString(body)));
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
}
