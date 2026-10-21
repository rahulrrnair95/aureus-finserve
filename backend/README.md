# Aureus Finserve – backend

Spring Boot 3.3 / Java 21 API for the Aureus Finserve mutual-fund-distributor website, investor dashboard and
staff console. The API contract is `../docs/API.md`, and this backend implements all of it, including section 6.

## Run it

### Quick start (in-memory H2, nothing to install)

```bash
./mvnw spring-boot:run -Dspring-boot.run.profiles=h2          # Windows: mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=h2
# or
./mvnw -DskipTests package
java -jar target/aureus-backend-1.0.0.jar --spring.profiles.active=h2
```

The API listens on `http://localhost:8080/api`. On first start against an empty database the app seeds
sample data, which takes about 5–10 s, then logs `Seed completed`. H2 is in-memory, so every restart gives a fresh copy of the demo data.

### Microsoft SQL Server (default profile)

1. As a sysadmin, run `../database/create-database.sql`. It creates database `AureusFinserve` and login/user `aureus_app`
   with ddladmin + datareader + datawriter. **Change the password in the script.**
2. Start the app without a profile:

```bash
set DB_HOST=localhost& set DB_USER=aureus_app& set DB_PASSWORD=<password>& set APP_CRYPTO_KEY=<base64 32 bytes>& set APP_HMAC_KEY=<base64>
java -jar target/aureus-backend-1.0.0.jar
```

Hibernate creates and updates the tables itself (`ddl-auto=update`). `../database/schema-reference.sql` is the
SQL Server DDL exported from the JPA model, for review only.

### Tests

```bash
./mvnw test
```

The tests run against H2. There are unit tests for XIRR, FIFO, capital-gains term rules, password policy, FY helpers and
the rate limiter. The MockMvc tests cover login → OTP → token → logout, lockout after 5 failures (with the CAPTCHA step),
RM scoping and 403 on admin-only endpoints, and password policy on change-password. `SchemeSyncRulesTest` covers the
Java port of the scheme tools (name cleaning, category mapping, Regular-Growth selection, split adjustment, thinning,
minimum-SIP parsing, both NAV file formats, details merge). `NfoRulesTest` / `NfoIntegrationTest` cover NFO status and the
estimated close date, scheme master grouping, categories, AMC names, the import never overwriting staff edits, public list
filters, hidden / featured, RM read-only access and one-pager validation / download. The tests never download anything: auto sync is off in the
`h2` profile, which a test also checks.

## Configuration (environment variables)

| Variable | Default | Purpose |
|---|---|---|
| `DB_HOST`, `DB_PORT`, `DB_NAME` | `localhost`, `1433`, `AureusFinserve` | SQL Server location |
| `DB_USER`, `DB_PASSWORD` | `aureus_app`, `ChangeMe@2026` | SQL Server credentials |
| `APP_CRYPTO_KEY` | built-in **dev** key (startup WARN) | base64 of 32 random bytes; AES-256-GCM key for PAN / mobile / DOB / bank a/c / CAS password |
| `APP_HMAC_KEY` | built-in **dev** key (startup WARN) | base64 key for HMAC-SHA256 lookup hashes (`pan_hash`, `mobile_hash`, `email_hash`) |
| `APP_DEV_MODE` | `true` | when true, OTP responses include `devOtp` and the OTP is logged. Set it to `false` once an SMS gateway is wired in |
| `APP_FRONTEND_URL` | `http://localhost:5173` | CORS origin (comma-separate several) and base of activation links |
| `APP_AMFI_NAV_URL` | `https://www.amfiindia.com/spages/NAVAll.txt` | NAV download source |
| `APP_AMFI_SCHEME_MASTER_URL` | `https://portal.amfiindia.com/DownloadSchemeData_Po.aspx?mf=0` | AMFI scheme master (launch date, minimum amount) for the new-schemes job |
| `APP_AUTO_SYNC_ENABLED` | `true` (`false` in the `h2` profile and tests) | scheduled data updates on / off (see below) |
| `APP_RATE_LIMIT_IP`, `APP_RATE_LIMIT_OTP` | `20` / min, `5` / 15 min | auth rate limits per IP and per user |
| `PORT` | `8080` | HTTP port |

Generate keys with `openssl rand -base64 32`. **Never change `APP_CRYPTO_KEY` / `APP_HMAC_KEY` once real data
exists.** Data encrypted with the old key becomes unreadable, and lookups by PAN, mobile or e-mail stop matching.

Other `app.*` settings live in `src/main/resources/application.yml`: session timeouts, lockout, OTP validity, mock-exchange delays,
and `app.seed.enabled`. The firm details there (ARN `ARN-372611`, address, phone, e-mail, nodal officer, escalation matrix, stats)
are **placeholders**. Replace them. Site stats, socials, phone, address and similar can also be edited at runtime via `PUT /api/admin/cms/site`.

## Automatic data updates

The backend updates fund data by itself every 24 hours, **but only while it is running**. If the backend was off when a
job was due, it catches up: on startup, every job (NAV import, new schemes, scheme details, NFO import) whose last
successful run is older than 20 hours runs once in the background, starting about a minute after start-up.

| When (Asia/Kolkata) | Job | What it does |
|---|---|---|
| Every day 23:30 | NAV import | Downloads AMFI `NAVAll.txt`, stores the day's NAV of every scheme, recalculates 1/3/5/10-year returns (~2 min). |
| Every day 07:00 | NAV retry | Runs the NAV import again only if none succeeded in the last 20 hours (e.g. AMFI was late or the network was down). |
| Daily 00:00 | New schemes | For the **active AMCs in Console > Content > AMC partners** (the name must equal the AMFI AMC name, e.g. `quant Mutual Fund`): adds new open-ended Regular Plan – Growth schemes (same rules as `tools/build-scheme-seed.mjs`) with ~10 years of NAV history from `api.mfapi.in` and their details; hides (`active=false`, never deletes) schemes that no longer appear in the AMFI NAV file, and shows them again if they come back. Adding an AMC to the list therefore brings in its schemes on the next run (or click "Check for new schemes"). |
| Daily 00:30 | Scheme details | Risk-o-meter, Regular-plan TER, fund size, fund managers, benchmark, exit load, objective, minimum SIP / lump sum, allotment date for all schemes (AMFI disclosures compiled by TigZig, `api.tigzig.com`). Values the source lacks are kept. |
| Every day 08:00 | NFO import | New fund offers of **all** AMCs from the AMFI scheme master (launch date = NFO opens, closure date = NFO closes, often empty while open; an unknown close date is shown as open date + 15 days, the SEBI maximum). One record per scheme; the risk-o-meter, benchmark, fund managers, exit load, objective and SSD close date are filled from the details API once the AMC has filed its Scheme Summary Document. Fields corrected by staff (Console > NFOs) are never overwritten; nothing is deleted (closed NFOs drop out of the public lists 30 days after closing). Also run on startup when the last successful NFO import is older than 20 hours. Setting: `app.auto-sync.nfo-cron`. |

Every run appears in **Console > Data sync** (started by "Scheduler") and in the audit log (`SYNC_RUN`). The same page
shows the next run times and has buttons to run each job now. Only one sync job runs at a time; a manual click while
another job runs gets "… is running right now" (409).

**Changing the times:** edit `app.auto-sync` in `src/main/resources/application.yml` (or override in `config/secrets.yml`,
or with environment variables such as `APP_AUTOSYNC_NAVCRON=0 0 22 * * *`) and restart. Cron format is Spring's
six fields `second minute hour day-of-month month day-of-week`, e.g. `0 30 23 * * *` = daily 23:30,
`0 0 2 * * SUN` = Sundays 02:00, `-` = never. Other settings: `zone` (default `Asia/Kolkata`), `catch-up-on-start`
(`true`), `catch-up-delay-seconds` (`60`), `nav-history-url`, `details-url`. Set `APP_AUTO_SYNC_ENABLED=false` (or
`app.auto-sync.enabled: false`) to switch the schedule off; the manual buttons keep working.

## Demo logins (seeded)

| User ID | Password | Role |
|---|---|---|
| `admin@aureusfinserve.in` | `Admin@2026` | ADMIN |
| `ananya@aureusfinserve.in` | `Rm@2026!` | RM (EUIN E123456): Priya, Arjun, Rao |
| `vikram@aureusfinserve.in` | `Rm@2026!` | RM (EUIN E654321): Kavita, Rohan, Meera (KYC ON_HOLD) |
| `9876543210` / `ABCPM1234F` / `priya@example.com` | `Priya@2026` | Investor Priya Menon (6 SIPs, spouse Arjun, pending RM order) |
| `9876500001` / `ABCPR5678K` | `Rao@2026` | Investor Venkat Rao (debt + hybrid, active SWP) |
| `9876500002` (Kavita Iyer) | – | NOT_ACTIVATED. The activation link is logged at seed time (PAN `ABCPI4321L`, DOB `1992-11-30`) |

In dev mode every OTP is returned as `devOtp` and logged as `DEV MODE OTP [...]`.

All schemes, AMCs (Meridian, Northstar, Banyan, Kestrel, Saffron, Harbor) and NAVs are **fictional sample data**.
Scheme codes use the `9000xx` range so they never collide with real AMFI codes. A real NAV file therefore updates nothing
until real schemes (with real AMFI codes) are added.

## What is real and what is stubbed

**Implemented:**
- Auth:
  - Opaque bearer sessions in `user_session`; only the SHA-256 of the token is stored.
  - Idle timeout 15 min (investor) / 30 min (staff), absolute timeout 8 h.
  - Single staff session, force-logout, trusted devices (30 days), new-device alerts.
  - Lockout after 5 failures for 30 min, arithmetic CAPTCHA after 3 failures.
  - OTP: 5 min validity, 3 attempts.
  - Rate limits per IP and per user, password policy, activation links (7 days), forgot / reset / change password.
- Encryption: AES-256-GCM column encryption (JPA `AttributeConverter`), with HMAC lookup hashes.
- Portfolio maths:
  - Holdings derived from transactions, with FIFO cost.
  - XIRR via Newton-Raphson with a bisection fallback.
  - 24-point monthly value history.
  - Capital gains by FIFO per folio, Indian FY. EQUITY/HYBRID are LTCG after 12 months; DEBT is LTCG only if bought before 2023-04-01 and held over 24 months.
- Reports: PDF (OpenPDF) and XLSX (POI) downloads, each audited as `REPORT_EXPORTED`.
- Orders:
  - Cart validation: risk acknowledgement, KYC, minimums, holdings, same-AMC switch / STP, mandate.
  - RM-raised orders need client OTP approval.
  - Admin status override.
  - Mock exchange: PLACED → PAYMENT_RECEIVED (~20 s) → ALLOTTED (~40 s), which creates transactions, folios and SIP/STP/SWP registrations and sends notifications.
- Sync: NAV sync from the AMFI `NAVAll.txt` format (upload or download; a network failure gives a FAILED run). RTA CSV import.
  Scheduled NAV / scheme-details / new-schemes jobs (see "Automatic data updates").
- Audit: append-only audit log. The entity is `@Immutable`, the repository has no update/delete methods, and the log records the X-Forwarded-For-aware IP.
- Section 6: CMS for home, about, services, AMCs (+ logo upload, PNG/SVG checks), testimonials (consent only; return figures rejected), team and site settings.
- New fund offers (`nfo` package, `sync/NfoSync`): daily import from AMFI + Scheme Summary Documents, public lists / details / one-pager download (`/api/public/nfos`), staff edits, manual NFOs and one-pager PDF upload (magic bytes `%PDF-`, ≤ 10 MB, stored in `nfo_one_pager`) under `/api/admin/nfos` (RM read-only), audited `NFO_UPDATED` / `NFO_ONEPAGER_UPLOADED`. See `docs/API.md` section 10.
- Portfolio-review CAS upload: PDF magic-byte check, ≤ 10 MB, OTP verified, CAS password encrypted. Staff download it from `/api/admin/leads/{id}/attachment`, audited as `ATTACHMENT_DOWNLOADED`.

**Stubbed (interfaces ready for real integrations):**
- `NotificationGateway` → `LoggingNotificationGateway` only logs SMS / e-mail, with 6-digit numbers redacted.
- `OrderPlatformGateway` → `MockExchangeGateway` stands in for a real BSE StAR MF / NSE NMF II integration.
- `KycService` trusts the KYC status stored on the investor. It is not yet a KRA lookup.
- Recurring SIP / SWP instalments after the first are expected to arrive through the RTA feed (`/api/admin/sync/rta`); no scheduler books them.
- The rate limiter and CAPTCHA store are in-memory, so they work for one instance only. Use a shared store such as Redis to scale out.

## Notes / small additive extras beyond the contract

- `Sip` objects also carry `type` (`SIP`/`STP`/`SWP`), `installments` and `targetSchemeName`. `/sips` lists SWP/STP registrations too.
- Admin AMC rows include `active`. Service details include `icon` and `sortOrder`. Team/testimonial rows include `id`.
- `GET /api/admin/leads/{id}/attachment` returns the encrypted-at-rest CAS password in an `X-Cas-Password` response
  header (exposed via CORS), so staff can open password-protected CAS files.
- Status codes for codes the contract leaves open: `INVALID_CREDENTIALS` 401, `ACCOUNT_LOCKED` 423, `ACCOUNT_DISABLED` / `NOT_ACTIVATED` 403,
  `CAPTCHA_*` / `OTP_*` / `KYC_NOT_VALID` / `VALIDATION` 400, `CONFLICT` 409. Unexpected server errors return 500 with code `INTERNAL_ERROR`.
- CSRF protection is disabled on purpose. Authentication uses an `Authorization` bearer header and no cookies, so CSRF attacks do not apply.
- Foreign keys are plain id columns (no DB-level FK constraints) to keep `ddl-auto=update` portable between H2 and SQL Server.

## Local SQL Server setup (installed on this PC)

- **Database:** SQL Server 2025 Express, instance `SQLEXPRESS`, TCP port 1433, starts automatically with Windows.
  Database `AureusFinserve`, application login `aureus_app` (created by `database/create-database.sql`).
- **Secrets:** `backend/config/secrets.yml` (not part of the code) holds the database password, encryption keys,
  the first-start admin password, the `sa` password (maintenance only) and the Gmail SMTP settings.
  It is loaded automatically when the backend is started from the `backend` folder.
- **Run against SQL Server:** `cd backend` then `java -jar target\aureus-backend-1.0.0.jar` (no profile).
  Everything clients submit - enquiries, portfolio reviews (CAS), call-back requests, online KYC applications
  and their documents - is saved in SQL Server. PAN, mobile, date of birth, addresses and documents are encrypted.
- **Test mode:** `java -jar target\aureus-backend-1.0.0.jar --spring.profiles.active=h2` uses an in-memory
  database with sample clients and ignores the SQL Server part of `secrets.yml`.
- **E-mail alerts:** new enquiries, portfolio reviews, call-back requests and KYC applications are e-mailed to
  `app.mail.notify-to`. Create a Gmail app password (https://myaccount.google.com/apppasswords, needs 2-Step
  Verification), paste it as `spring.mail.password` in `config/secrets.yml`, set `app.mail.enabled: true` and
  restart. Until then the e-mails are only written to the backend log.
- **Query the database without SSMS:** from the `database` folder,
  `java -cp <mssql-jdbc jar> QuerySql.java aureus_app <password> "SELECT * FROM lead_enquiry"`.
