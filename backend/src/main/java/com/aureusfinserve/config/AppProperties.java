package com.aureusfinserve.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/** All {@code app.*} configuration. */
@Data
@ConfigurationProperties(prefix = "app")
public class AppProperties {

    private boolean devMode = true;
    private String frontendUrl = "http://localhost:5173";
    private Crypto crypto = new Crypto();
    private Amfi amfi = new Amfi();
    private AutoSync autoSync = new AutoSync();
    private Security security = new Security();
    private RateLimit rateLimit = new RateLimit();
    private MockExchange mockExchange = new MockExchange();
    private Firm firm = new Firm();
    private Mail mail = new Mail();
    private Seed seed = new Seed();

    /** First-start data (only when the database has no users). */
    @Data
    public static class Seed {
        /** Read by SeedRunner's @ConditionalOnProperty; false skips seeding entirely. */
        private boolean enabled = true;
        /** true => sample clients, portfolios, leads, tickets and KYC applications; false => only the admin login. */
        private boolean sampleData = true;
        private String adminEmail = "admin@aureusfinserve.in";
        private String adminPassword = "Admin@2026";
    }

    /** Outgoing e-mail (SMTP settings live under spring.mail.*). */
    @Data
    public static class Mail {
        /** false => e-mails are only logged (no SMTP needed). */
        private boolean enabled = false;
        /** Sender address; defaults to spring.mail.username. */
        private String from;
        /** Where new enquiries / KYC applications are reported; defaults to app.firm.email. */
        private String notifyTo;
    }

    @Data
    public static class Crypto {
        private String key;
        private String hmacKey;
    }

    @Data
    public static class Amfi {
        private String navUrl = "https://www.amfiindia.com/spages/NAVAll.txt";
        /** AMFI scheme master CSV (plan / option names, launch date, minimum amount). */
        private String schemeMasterUrl = "https://portal.amfiindia.com/DownloadSchemeData_Po.aspx?mf=0";
    }

    /** Scheduled data updates (sync package). Cron expressions are Spring 6-field (sec min hour day month weekday). */
    @Data
    public static class AutoSync {
        /** false => nothing runs on a schedule (manual triggers still work). */
        private boolean enabled = true;
        /** Daily NAV import from AMFI (AMFI publishes the day's NAVs by about 23:00 IST). */
        private String navCron = "0 30 23 * * *";
        /** Retry of the NAV import, only when the latest import did not succeed in the last 20 hours. */
        private String navRetryCron = "0 0 7 * * *";
        /** Daily refresh of scheme details (risk-o-meter, TER, AUM, fund managers, ...). */
        private String detailsCron = "0 30 0 * * *";
        /** Daily check for new / closed schemes of the AMCs in the amc table. */
        private String schemesCron = "0 0 0 * * *";
        /** Daily import of new fund offers (NFOs) from the AMFI scheme master; also caught up on startup. */
        private String nfoCron = "0 0 8 * * *";
        private String zone = "Asia/Kolkata";
        /** On startup, run a NAV import (in the background) when the last successful one is older than 20 hours. */
        private boolean catchUpOnStart = true;
        private int catchUpDelaySeconds = 60;
        /** Daily NAV history per scheme (AMFI-sourced); {code} is replaced by the AMFI scheme code. */
        private String navHistoryUrl = "https://api.mfapi.in/mf/{code}";
        /** Scheme details (AMFI disclosures compiled by TigZig); {codes} = up to 50 comma-separated scheme codes. */
        private String detailsUrl = "https://api.tigzig.com/mf/v1/details?schemes={codes}";
    }

    @Data
    public static class Security {
        private int idleTimeoutInvestorMinutes = 15;
        private int idleTimeoutStaffMinutes = 30;
        private int absoluteTimeoutHours = 8;
        private int otpValidityMinutes = 5;
        private int otpMaxAttempts = 3;
        private int lockoutThreshold = 5;
        private int lockoutMinutes = 30;
        private int captchaThreshold = 3;
        private int trustedDeviceDays = 30;
        private int activationLinkDays = 7;
    }

    @Data
    public static class RateLimit {
        private int authPerIpPerMinute = 20;
        private int otpPerUserPer15Min = 5;
    }

    @Data
    public static class MockExchange {
        private boolean enabled = true;
        private int paymentAfterSeconds = 20;
        private int allotAfterSeconds = 40;
        private long pollMillis = 5000;
    }

    @Data
    public static class Firm {
        private String name;
        private String tagline;
        private String arn;
        private LocalDate arnValidTill;
        private String address;
        private String phone;
        private String whatsapp;
        private String email;
        private String officeHours;
        private String mapEmbedUrl;
        private Stats stats = new Stats();
        private String disclaimer;
        private NodalOfficer nodalOfficer = new NodalOfficer();
        private List<Escalation> escalation = new ArrayList<>();
        private String scoresUrl;
        private String odrUrl;
    }

    @Data
    public static class Stats {
        private double aumCr;
        private int clients;
        private int years;
        private double sipBookCr;
    }

    @Data
    public static class NodalOfficer {
        private String name;
        private String phone;
        private String email;
    }

    @Data
    public static class Escalation {
        private int level;
        private String name;
        private String designation;
        private String phone;
        private String email;
        private int responseDays;
    }
}
