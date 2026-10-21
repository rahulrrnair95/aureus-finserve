# Aureus Finserve — API contract (v1)

Single source of truth shared by `backend/` (Spring Boot 3, Java 21, MSSQL) and `frontend/` (React + Vite).
Source requirements: "Mutual Fund Distributor Website — Product Requirements Document".

## Conventions

- Base path `/api`. JSON everywhere (except file downloads / multipart uploads).
- Dates `YYYY-MM-DD`, timestamps ISO-8601 (`2026-10-20T10:15:00`), money = number (INR, 2 dp), units = number (3–4 dp), NAV = number (4 dp).
- Auth: opaque session token. Send `Authorization: Bearer <token>`. Tokens are stored server-side (table `user_session`), so logout / idle timeout / force-logout / single staff session work.
- Every request from the browser also sends header `X-Device-Id: <uuid>` (frontend creates once, keeps in localStorage). Used for trusted device + new-device alerts.
- Errors: HTTP 4xx/5xx with body `{ "error": "Human readable message", "code": "CODE", "fields": { "field": "msg" } }` (`fields` only on validation).
  Codes: `VALIDATION`, `INVALID_CREDENTIALS`, `ACCOUNT_LOCKED`, `ACCOUNT_DISABLED`, `NOT_ACTIVATED`, `CAPTCHA_REQUIRED`, `CAPTCHA_INVALID`, `OTP_INVALID`, `OTP_EXPIRED`, `OTP_ATTEMPTS_EXCEEDED`, `SESSION_EXPIRED` (401), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `KYC_NOT_VALID`, `RATE_LIMITED` (429), `CONFLICT`.
- Dev mode (`app.dev-mode=true`, default in the `h2` profile and in the default profile until an SMS gateway is configured): any response that issues an OTP also includes `"devOtp": "123456"` so the app can be tested without SMS. OTPs are also logged by the backend. Frontend shows a small "Dev OTP: …" hint when present.
- Enums
  - Role: `INVESTOR`, `RM`, `ADMIN`
  - AssetClass / scheme category: `EQUITY`, `DEBT`, `HYBRID`
  - Risk (SEBI risk-o-meter): `LOW`, `LOW_TO_MODERATE`, `MODERATE`, `MODERATELY_HIGH`, `HIGH`, `VERY_HIGH`
  - TxnType: `PURCHASE`, `SIP`, `REDEMPTION`, `SWITCH_IN`, `SWITCH_OUT`, `STP_IN`, `STP_OUT`, `SWP`
  - OrderType: `LUMPSUM`, `SIP`, `REDEEM`, `SWITCH`, `STP`, `SWP`
  - OrderStatus: `PENDING_APPROVAL` (raised by RM, waiting for client OTP), `PLACED`, `PAYMENT_RECEIVED`, `ALLOTTED`, `FAILED`, `CANCELLED`
  - PaymentMode: `UPI`, `NETBANKING`, `MANDATE`
  - SipStatus: `ACTIVE`, `PAUSED`, `CANCELLED`
  - KycStatus: `VALIDATED`, `REGISTERED`, `ON_HOLD`, `NOT_FOUND`
  - LoginStatus: `NOT_ACTIVATED`, `ACTIVE`, `LOCKED`, `DISABLED`
  - LeadStatus: `NEW`, `CONTACTED`, `CONVERTED`, `LOST`
  - TicketStatus: `OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`
  - TicketCategory: `ADDRESS_CHANGE`, `BANK_CHANGE`, `NOMINEE_CHANGE`, `MISSING_TRANSACTION`, `STATEMENT`, `OTHER`

## Common objects

```jsonc
// User
{ "id": 1, "name": "Priya Menon", "role": "INVESTOR", "email": "priya@example.com",
  "mobileMasked": "XXXXXX4321", "panMasked": "XXXXX1234F", "investorId": 3 /* null for staff */,
  "euin": null /* staff only */, "idleTimeoutMinutes": 15 }

// SchemeSummary
{ "id": 1, "code": "100001", "name": "Meridian Large Cap Fund - Regular Plan - Growth", "amc": "Meridian Mutual Fund",
  "category": "EQUITY", "subCategory": "Large Cap", "risk": "VERY_HIGH", "nav": 245.1234, "navDate": "2026-10-19",
  "return1y": 14.2, "return3y": 16.8, "return5y": 15.1 /* % annualised, null if n/a */,
  "expenseRatio": 1.62, "minSip": 500, "minLumpsum": 5000, "aumCr": 32150.5,
  "trailCommissionPct": 0.85, "sidUrl": "https://…", "factsheetUrl": "https://…" }

// Txn
{ "id": 10, "date": "2025-04-05", "folioNo": "1234567/89", "folioId": 4, "schemeId": 1, "schemeName": "…",
  "investorName": "Priya Menon", "type": "SIP", "amount": 5000.00, "units": 21.345, "nav": 234.2345 }

// Order
{ "id": 7, "ref": "AF2610200007", "investorId": 3, "investorName": "Priya Menon",
  "type": "LUMPSUM", "schemeId": 1, "schemeName": "…", "targetSchemeId": null, "targetSchemeName": null,
  "folioId": null, "folioNo": null, "amount": 10000, "units": null, "allUnits": false,
  "sipDay": null, "installments": null, "paymentMode": "UPI", "status": "PLACED",
  "placedBy": "Priya Menon" /* or RM name */, "placedByRole": "INVESTOR", "exchangeRef": "BSE123456",
  "createdAt": "2026-10-20T10:15:00",
  "history": [ { "status": "PLACED", "at": "2026-10-20T10:15:00", "note": "Order placed on exchange" } ] }
```

## 1. Auth — `/api/auth` (public)

User ID field accepts mobile (10 digits), email, or PAN (`AAAAA9999A`) — server auto-detects.

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/login` | `{ userId, password, captchaId?, captchaAnswer? }` | `LoginResult` |
| POST | `/login-otp` | `{ userId }` (investors only — OTP-only login) | `LoginResult` (always `OTP_REQUIRED`) |
| POST | `/verify-otp` | `{ challengeId, otp, rememberDevice }` | `{ status:"OK", token, user }` |
| POST | `/resend-otp` | `{ challengeId }` | `{ challengeId, maskedMobile, maskedEmail, devOtp? }` (new challenge id) |
| POST | `/forgot` | `{ userId }` | `{ challengeId, maskedMobile, maskedEmail, devOtp? }` (returns same shape even if user unknown — never reveal existence; unknown user gets a dummy challenge that always fails) |
| POST | `/reset` | `{ challengeId, otp, newPassword }` | `{ ok:true }` — ends all other sessions |
| GET | `/activate/{token}` | – | `{ name, valid:true }` or 404 |
| POST | `/activate/verify` | `{ token, pan, dob }` | `{ challengeId, maskedMobile, maskedEmail, devOtp? }` |
| POST | `/activate/complete` | `{ challengeId, otp, newPassword }` | `{ ok:true }` |
| GET | `/me` | – (auth) | `User` |
| POST | `/logout` | – (auth) | `{ ok:true }` — revokes server session |
| POST | `/change-password/otp` | – (auth) | `{ challengeId, maskedMobile, maskedEmail, devOtp? }` |
| POST | `/change-password` | `{ currentPassword, newPassword, challengeId, otp }` (auth) | `{ ok:true }` |
| GET | `/captcha` | – | `{ captchaId, question:"What is 4 + 7?" }` |

`LoginResult`:
```jsonc
{ "status": "OTP_REQUIRED", "challengeId": "uuid", "maskedMobile": "XXXXXX4321", "maskedEmail": "pr***@example.com", "devOtp": "123456" }
// or, investor on a trusted device (skips OTP):
{ "status": "OK", "token": "…", "user": { … } }
```

Rules (server-enforced):
- Password policy: 8–64 chars, ≥1 letter, ≥1 digit, ≥1 symbol, must not equal PAN or mobile (case-insensitive). Violations → 400 `VALIDATION` with message.
- OTP: 6 digits, sent to registered mobile + email, valid 5 min, max 3 attempts per challenge (then `OTP_ATTEMPTS_EXCEEDED`, user must resend).
- Lockout: 5 consecutive wrong passwords → locked 30 min (`ACCOUNT_LOCKED`, message includes unlock time); notify by SMS + email (gateway stub logs it).
- CAPTCHA: after 3 consecutive failed passwords, `/login` returns 400 `CAPTCHA_REQUIRED` unless a valid `captchaId` + `captchaAnswer` is included. Frontend then calls `GET /captcha` and shows it.
- Rate limit: `/api/auth/**` and OTP-issuing endpoints limited per IP (e.g., 20/min) and per user id (e.g., 5 OTPs / 15 min) → 429 `RATE_LIMITED`.
- Session: idle timeout 15 min (INVESTOR) / 30 min (RM, ADMIN); absolute 8 h. Expired → 401 `SESSION_EXPIRED`.
- Trusted device: investors only, `rememberDevice:true` on verify → device (X-Device-Id) trusted for 30 days, next password login on it skips OTP. Staff always need OTP.
- Concurrent sessions: staff have one active session — a new login revokes older ones.
- New device alert: successful login from a device not seen before → SMS + email alert (stub) + in-app notification.
- Every login success/failure, logout, password change → audit log.

## 2. Public — `/api/public` (no auth)

| Method | Path | Response |
|---|---|---|
| GET | `/site` | `{ firmName, tagline, arn, arnValidTill, address, phone, whatsapp, email, officeHours, mapEmbedUrl, stats:{ aumCr, clients, years, sipBookCr }, disclaimer, nodalOfficer:{ name, phone, email }, escalation:[{ level, name, designation, phone, email, responseDays }] , scoresUrl, odrUrl }` |
| GET | `/schemes?q=&category=&subCategory=&amc=&risk=&sort=return1y\|return3y\|return5y\|aum\|name&page=0&size=20` | `{ items:[SchemeSummary], total, page, size }` |
| GET | `/schemes/filters` | `{ amcs:[string], categories:[string], subCategories:[string], risks:[string] }` |
| GET | `/schemes/{id}` | SchemeSummary + `{ fundManager, benchmark, launchDate, exitLoad, objective, navHistory:[{ date, nav }] }` (~1 year, weekly points) |
| GET | `/articles?category=` | `[{ id, slug, title, summary, category, publishedAt, readMinutes, videoUrl }]` (published only, `publishAt <= now`) |
| GET | `/articles/{slug}` | above + `{ body }` (body = paragraphs separated by blank lines; lines starting `## ` are subheadings) |
| GET | `/faqs` | `[{ id, question, answer, category }]` |
| GET | `/glossary` | `[{ term, definition }]` |
| GET | `/testimonials` | `[{ name, city, text }]` |
| GET | `/team` | `[{ name, designation, euin, bio, isFounder }]` |
| GET | `/banners` | `[{ id, title, text, ctaLabel, ctaUrl }]` (active only) |
| GET | `/pages/{key}` | `{ key, title, body, updatedAt }` — keys: `about`, `disclaimer`, `privacy`, `terms`, `commission`, `grievance` |
| POST | `/leads/otp` | `{ mobile }` → `{ challengeId, devOtp? }` |
| POST | `/leads` | `{ name, mobile, email, city, interest, message, consent:true, challengeId, otp, website:"" }` → `{ id, ok:true }`. `website` is a honeypot: if non-empty, pretend success but discard. Interests: `SIP`, `LUMPSUM`, `ELSS`, `RETIREMENT`, `CHILD_EDUCATION`, `NRI`, `OTHER`. Source = `WEBSITE`. |

## 3. Investor — `/api/investor` (role INVESTOR)

`member` query param: an investor id from `/family`, or `all` (default = self). Server checks the id belongs to the logged-in investor's family (self + linked members).

| Method | Path | Body / Query | Response |
|---|---|---|---|
| GET | `/family` | | `[{ id, name, relation:"SELF"\|"SPOUSE"\|"CHILD"\|"PARENT"\|"OTHER", panMasked }]` (self first) |
| GET | `/portfolio?member=` | | `{ currentValue, invested, gain, gainPct, xirr /* % or null */, asOf, holdingsCount, activeSips, monthlySipAmount, allocation:[{ assetClass, value, pct }], topHoldings:[Holding] /*5*/ , valueHistory:[{ date, value, invested }] /* monthly, 24 points */ }` |
| GET | `/holdings?member=` | | `[Holding]` — `{ folioId, folioNo, investorId, investorName, schemeId, schemeName, amc, category, subCategory, risk, units, nav, navDate, value, invested, gain, gainPct, xirr }` |
| GET | `/holdings/{folioId}/transactions` | | `[Txn]` |
| GET | `/transactions?member=&from=&to=&type=` | | `[Txn]` newest first |
| GET | `/sips?member=` | | `[{ id, investorId, investorName, schemeId, schemeName, folioNo, amount, sipDay, nextDebitDate, status, stepUpPct, startDate, installmentsDone, pausedUntil }]` |
| POST | `/sips/{id}/pause` | `{ months:1..6 }` | Sip |
| POST | `/sips/{id}/resume` | | Sip |
| POST | `/sips/{id}/step-up` | `{ stepUpPct:5..50 }` (annual) | Sip |
| POST | `/sips/{id}/cancel` | | Sip |
| GET | `/orders?status=` | | `[Order]` newest first |
| POST | `/orders` | `CartRequest` | `[Order]` |
| POST | `/orders/{id}/approve-otp` | | `{ challengeId, devOtp? }` (for PENDING_APPROVAL orders raised by RM) |
| POST | `/orders/{id}/approve` | `{ challengeId, otp }` | Order (→ PLACED) |
| POST | `/orders/{id}/reject` | | Order (→ CANCELLED) |
| GET | `/reports/capital-gains?fy=2025-26&member=` | | `{ fy, rows:[{ schemeName, folioNo, assetClass, purchaseDate, redemptionDate, units, costValue, saleValue, gain, term:"STCG"\|"LTCG" }], totals:{ stcg, ltcg, total } }` |
| GET | `/reports/financial-years` | | `["2026-27","2025-26","2024-25", …]` |
| GET | `/reports/{kind}/download?format=pdf\|xlsx&fy=&member=&from=&to=` | kind = `statement` \| `transactions` \| `capital-gains` | file (Content-Disposition attachment) |
| GET | `/goals` | | `[{ id, name, type:"RETIREMENT"\|"EDUCATION"\|"HOUSE"\|"WEALTH"\|"OTHER", targetAmount, targetDate, folioIds:[..], currentValue, progressPct }]` |
| POST | `/goals` | `{ name, type, targetAmount, targetDate, folioIds }` | Goal |
| PUT | `/goals/{id}` | same | Goal |
| DELETE | `/goals/{id}` | | `{ ok:true }` |
| GET | `/profile` | | `{ name, panMasked, dob, email, mobileMasked, address, kycStatus, taxStatus:"Resident Individual", nominees:[{ name, relation, sharePct }], bankAccounts:[{ bankName, accountMasked, ifsc, primary }], mandates:[{ id, umrn, bankName, limit, status:"ACTIVE"\|"PENDING"\|"REJECTED" }] }` |
| GET | `/tickets` | | `[{ id, ref, category, subject, description, status, createdAt, updatedAt, comments:[{ by, text, at }] }]` |
| POST | `/tickets` | `{ category, subject, description }` | Ticket |
| GET | `/rm` | | `{ name, phone, whatsapp, email, euin }` |
| POST | `/rm/callback` | `{ preferredTime, note }` | `{ ok:true }` (creates a ticket category OTHER "Call back request" + notifies RM) |
| GET | `/notifications` | | `[{ id, type:"ORDER"\|"SIP"\|"NAV"\|"SECURITY"\|"GENERAL", title, message, read, createdAt }]` |
| POST | `/notifications/{id}/read` | | `{ ok:true }` |
| POST | `/notifications/read-all` | | `{ ok:true }` |

`CartRequest`:
```jsonc
{ "investorId": 3, "paymentMode": "UPI", "riskAcknowledged": true,
  "items": [
    { "type": "LUMPSUM", "schemeId": 1, "amount": 10000 },
    { "type": "SIP", "schemeId": 2, "amount": 2000, "sipDay": 5, "installments": 120 },
    { "type": "REDEEM", "folioId": 4, "amount": 5000 },            // or "units": 10.5, or "allUnits": true
    { "type": "SWITCH", "folioId": 4, "targetSchemeId": 3, "allUnits": true },
    { "type": "STP", "folioId": 4, "targetSchemeId": 3, "amount": 2000, "sipDay": 10, "installments": 12 },
    { "type": "SWP", "folioId": 4, "amount": 3000, "sipDay": 1, "installments": 24 }
  ] }
```
Server validation: `riskAcknowledged` must be true; investor KYC must be `VALIDATED` (`KYC_NOT_VALID`); amounts ≥ scheme minimums; redemption amount/units ≤ holding; SWITCH/STP target must be same AMC; `MANDATE` payment requires an ACTIVE mandate for SIP/STP/SWP; only regular plans (all seeded schemes are regular). Orders go to the exchange via `OrderPlatformGateway` (mock implementation: `PLACED` → `PAYMENT_RECEIVED` after ~20s → `ALLOTTED` after ~40s, creating the transaction at current NAV and updating folio; SIP orders also create a SIP registration). Each status change creates an investor notification.

## 4. Staff console — `/api/admin` (roles RM, ADMIN)

RM data is scoped to clients where `rm_id = me` (and leads assigned to me). ADMIN sees everything. Endpoints marked **A** are ADMIN only (RM → 403).

| Method | Path | Body / Query | Response |
|---|---|---|---|
| GET | `/dashboard` | | `{ aum, clients, activeSips, sipBook /* monthly SIP amount */, newLeads, openTickets, pendingOrders, flows:[{ month:"2026-05", inflow, outflow, net }] /*12*/, aumByCategory:[{ name, value }], aumByAmc:[{ name, value }], topClients:[{ id, name, aum }] }` |
| GET | `/clients?q=&rmId=` | | `[{ id, name, panMasked, mobileMasked, email, rmId, rmName, aum, sipCount, kycStatus, loginStatus, familyHeadId, familyHeadName, relation, createdAt }]` |
| GET | `/clients/{id}` | | client row + `{ dob, address, family:[{ id, name, relation }], holdings:[Holding], sips:[Sip], orders:[Order] }` |
| POST | `/clients` | `{ name, pan, dob, email, mobile, address, kycStatus, rmId?, familyHeadId?, relation? }` (RM: rmId forced to self) | `{ client, activationLink }` |
| PUT | `/clients/{id}` **A** | same fields | client |
| POST | `/clients/{id}/activation-link` | | `{ activationLink }` — link is `{frontendUrl}/activate/{token}`, valid 7 days; also "sent" by SMS/email stub |
| POST | `/clients/{id}/status` **A** | `{ enabled }` | client (also unlocks if enabling) |
| GET | `/rms` | | `[{ id, name, euin }]` (for dropdowns) |
| GET | `/leads?status=&q=` | | `[{ id, name, mobile, email, city, interest, message, source, status, followUpDate, notes, assignedRmId, assignedRmName, createdAt }]` |
| PUT | `/leads/{id}` | `{ status, followUpDate, notes, assignedRmId /*A only*/ }` | lead |
| GET | `/orders?status=&clientId=` | | `[Order]` |
| POST | `/orders` | `CartRequest` (investorId = client) | `[Order]` with status `PENDING_APPROVAL`; client gets notification + OTP-approval link in their Orders page |
| POST | `/orders/{id}/status` **A** | `{ status, note }` (manual override / exchange reconciliation) | Order |
| GET | `/tickets?status=` | | `[Ticket + { investorId, investorName }]` |
| PUT | `/tickets/{id}` | `{ status, comment }` | Ticket |
| GET | `/brokerage?month=` **A** | | `{ rows:[{ amc, schemeName, month, aum, ratePct, expected, received, difference, reconciled }], totals:{ expected, received } }` |
| GET | `/cms/articles` **A** | | `[Article + { status:"DRAFT"\|"SCHEDULED"\|"PUBLISHED", publishAt, body }]` |
| POST / PUT / DELETE | `/cms/articles[/{id}]` **A** | `{ title, slug, summary, category, body, publishAt /* null = draft */, readMinutes, videoUrl }` | Article |
| GET / POST / PUT / DELETE | `/cms/faqs[/{id}]` **A** | `{ question, answer, category, sortOrder }` | Faq |
| GET / POST / PUT / DELETE | `/cms/banners[/{id}]` **A** | `{ title, text, ctaLabel, ctaUrl, active, startsAt, endsAt }` | Banner |
| GET | `/cms/pages` **A** | | `[{ key, title, body, updatedAt }]` |
| PUT | `/cms/pages/{key}` **A** | `{ title, body }` | Page |
| GET | `/users` **A** | | `[{ id, name, email, mobileMasked, role, euin, enabled, loginStatus, lastLoginAt }]` (staff only) |
| POST | `/users` **A** | `{ name, email, mobile, role:"RM"\|"ADMIN", euin }` | `{ user, tempPassword }` |
| POST | `/users/{id}/reset-password` **A** | | `{ tempPassword }` |
| POST | `/users/{id}/force-logout` **A** | | `{ ok:true }` |
| POST | `/users/{id}/status` **A** | `{ enabled }` | user |
| GET | `/audit?q=&action=&from=&to=&page=0&size=50` **A** | | `{ items:[{ id, at, userId, userName, role, action, entity, entityId, detail, ip }], total }` (read-only; no update/delete endpoints exist) |
| GET | `/audit/export` **A** | | CSV download |
| GET | `/sync/runs` **A** | | `[{ id, type:"NAV"\|"RTA"\|"DETAILS"\|"SCHEMES"\|"NFO", startedAt, finishedAt, status:"SUCCESS"\|"PARTIAL"\|"FAILED", processed, failed, errors:[string], summary, triggeredBy }]` (DETAILS / SCHEMES / summary: section 9; NFO: section 10) |
| POST | `/sync/nav` **A** | optional multipart `file` (AMFI NAVAll.txt format). No file → download from `app.amfi.nav-url` | SyncRun |
| POST | `/sync/rta` **A** | multipart `file` CSV: `pan,folio_no,scheme_code,date,type,amount,units,nav` | SyncRun |

Audit actions to record (at least): `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGOUT`, `ACCOUNT_LOCKED`, `PASSWORD_RESET`, `PASSWORD_CHANGED`, `ACCOUNT_ACTIVATED`, `ORDER_PLACED`, `ORDER_APPROVED`, `ORDER_STATUS`, `SIP_CHANGED`, `CLIENT_CREATED`, `CLIENT_UPDATED`, `LEAD_UPDATED`, `TICKET_UPDATED`, `CMS_CHANGED`, `USER_CREATED`, `USER_UPDATED`, `FORCE_LOGOUT`, `REPORT_EXPORTED`, `SYNC_RUN`.

## 5. Seed / demo data (created on first start if DB empty)

| Login (user id) | Password | Role | Notes |
|---|---|---|---|
| `admin@aureusfinserve.in` | `Admin@2026` | ADMIN | |
| `ananya@aureusfinserve.in` | `Rm@2026!` | RM | EUIN E123456, assigned Priya + Rao families |
| `vikram@aureusfinserve.in` | `Rm@2026!` | RM | EUIN E654321, assigned 3 other clients |
| `9876543210` (Priya Menon, PAN ABCPM1234F) | `Priya@2026` | INVESTOR | 6 SIPs across 4 AMCs, spouse Arjun Menon linked as family |
| `9876500001` (Venkat Rao, PAN ABCPR5678K) | `Rao@2026` | INVESTOR | lump-sum debt + hybrid, active SWP |
| `9876500002` (Kavita Iyer) | – | INVESTOR | NOT_ACTIVATED (to test activation link) |

Sample schemes use fictional AMCs (clearly sample data): ~24 regular-growth schemes across EQUITY/DEBT/HYBRID, 6 AMCs, with ~3 years of synthetic NAV history. Real data replaces them via `/api/admin/sync/nav`.

---

## 6. PRD update (rev 19) — additions. These are part of the contract.

Interests enum gains `PORTFOLIO_REVIEW`. Lead `source` can be `WEBSITE` or `PORTFOLIO_REVIEW`.

### Public additions — `/api/public`

| Method | Path | Response |
|---|---|---|
| GET | `/site` | (extended) adds `socials:{ facebook, instagram, linkedin, youtube, x }` (null = hidden), `euins:[{ name, euin }]`, and `stats` gains `families`, `sipsRunning` → `stats:{ aumCr, clients, families, years, sipBookCr, sipsRunning }` |
| GET | `/home` | CMS-editable home bands: `{ hero:{ headline, subline, primaryCtaLabel, secondaryCtaLabel }, whyChooseUs:[{ title, text }] /*4*/, howItWorks:[{ step, title, text }] /*3*/, sections:{ trust:true, services:true, why:true, how:true, calculator:true, amcs:true, testimonials:true, articles:true } /* band visibility */ }`. Seed hero headline "Grow your wealth with the right mutual funds"; CTAs "Book a free consultation" / "Calculate your SIP"; why = AMFI-registered, Dedicated relationship manager, One dashboard for all your funds, Paperless investing; how = Talk to us, Complete KYC, Start investing and track online. |
| GET | `/amcs` | `[{ id, name, slug, logoUrl /* nullable → frontend shows a styled text tile */, schemeCount, sortOrder }]` (active only, sorted) |
| GET | `/about` | `{ story, mission, vision, values:[{ title, text }], milestones:[{ year, text }], officeAddress, mapEmbedUrl, officeHours }` |
| GET | `/team` | (extended) `[{ name, designation, euin, bio, isFounder, qualifications, yearsExperience, photoUrl }]` |
| GET | `/testimonials` | (extended) `[{ name, city, text, photoUrl }]` — only consented ones; never contain return figures |
| GET | `/services` | `[{ slug, title, shortText, icon }]` — 8 services: `sip`, `lump-sum`, `tax-saving-elss`, `retirement`, `child-education`, `regular-income-swp`, `nri`, `portfolio-review` |
| GET | `/services/{slug}` | `{ slug, title, shortText, whatItIs, whoItSuits, howItWorks:[string], relatedCategory /* EQUITY\|DEBT\|HYBRID\|null */, relatedSubCategories:[string], calculators:[ "sip"\|"step-up-sip"\|"lump-sum"\|"elss"\|"retirement"\|"goal"\|"swp"\|"cost-of-delay" ], faqs:[{ question, answer }] }` (calculator mapping per PRD: SIP→sip,step-up-sip; lump sum→lump-sum; ELSS→elss; retirement→retirement; child education→goal; SWP→swp; NRI→sip,lump-sum; portfolio review→none) |
| POST | `/portfolio-review` | multipart: `name, mobile, email, consent=true, challengeId, otp, casPassword?, website (honeypot), file` (PDF CAS, ≤10 MB, content-type/magic-byte checked) → `{ id, ok:true }`. Creates a lead (interest `PORTFOLIO_REVIEW`, source `PORTFOLIO_REVIEW`) with the file stored (DB varbinary or `app.upload-dir`; casPassword encrypted). OTP from `/leads/otp`. |

Schemes list `amc` filter must accept the AMC name exactly as in `/amcs` (frontend links `/funds?amc=<name>`).

### Staff additions — `/api/admin` (all **A**)

| Method | Path | Body | Response |
|---|---|---|---|
| GET / PUT | `/cms/home` | the `/public/home` object | same |
| GET / PUT | `/cms/about` | the `/public/about` object | same |
| GET / POST / PUT / DELETE | `/cms/amcs[/{id}]` | `{ name, active, sortOrder }` | Amc |
| POST | `/cms/amcs/{id}/logo` | multipart `file` (PNG or SVG, ≤ 500 KB) | Amc (logo served at `logoUrl`, e.g. `/api/public/amcs/{id}/logo`) |
| GET | `/public/amcs/{id}/logo` (public path) | | image bytes |
| GET / POST / PUT / DELETE | `/cms/testimonials[/{id}]` | `{ name, city, text, photoUrl, consent, active }` | Testimonial |
| GET / POST / PUT / DELETE | `/cms/team[/{id}]` | `{ name, designation, euin, bio, isFounder, qualifications, yearsExperience, photoUrl, sortOrder }` | TeamMember |
| GET | `/cms/services` | | `[service detail]` |
| PUT | `/cms/services/{slug}` | service detail fields | service detail |
| PUT | `/cms/site` | `{ stats:{…}, socials:{…}, phone, whatsapp, email, address, officeHours, mapEmbedUrl }` | site |
| GET | `/leads/{id}/attachment` | | the CAS file (RM scoped / admin), audit `REPORT_EXPORTED`-like action `ATTACHMENT_DOWNLOADED` |

Lead rows gain `hasAttachment:boolean`.

Seed: 10 fictional AMCs is fine but prefer the 6 sample AMCs used by the schemes (each with `schemeCount`), no logos (text tiles); 8 service pages with real explanatory copy; about story/mission/vision/values (client-first, transparency, long-term investing)/milestones (placeholder years); team with "NISM Series V-A certified" qualifications; socials null except placeholders for linkedin/youtube.

### Frontend changes (no API impact)

- Header (sticky): logo, menu Home · About · Services · Funds · Calculators · Learn · Contact, phone number, **Login** button and **Start investing** CTA (→ contact / login). 
- Home = 11 bands in order: header, hero, trust numbers, 6 services cards (SIP, lump sum, tax saving, retirement, child education, NRI), why choose us (4), how it works (3 steps), inline SIP calculator widget + "More calculators", AMC partners auto-scrolling strip (pauses on hover/focus, respects `prefers-reduced-motion`) + "View all", testimonials (3–6, name/city/photo), 3 latest articles, footer (address, phone, email, social links, quick links, ARN + EUIN, risk disclaimer, grievance, privacy, terms). Band visibility/text from `/public/home`.
- Floating WhatsApp / call button visible on mobile on public pages.
- New public page **AMC partners** (`/amc-partners`): logo grid, each → `/funds?amc=…`, note "We are a distributor of these AMCs' schemes; listing does not imply endorsement."
- **Services**: overview + one page per service (`/services/:slug`) with the same template: what it is, who it suits, how it works, related fund category (link to explorer filtered), the matching calculator embedded, FAQs, enquiry CTA. Portfolio review page has the CAS upload form (OTP verified).
- **About**: story, mission & vision, founder & team (photo, designation, qualifications, years of experience, EUIN), credentials (ARN + validity, EUINs), milestones timeline, values, office (address, map, hours).
- **Calculators (8)**: SIP, Lump sum, Step-up SIP (vs flat SIP), Goal (future cost, SIP or lump sum needed), Retirement (current age, retirement age, monthly expenses, inflation, pre-/post-retirement return, life expectancy → corpus + monthly SIP), SWP (total withdrawn, final balance, month-by-month table), ELSS tax saving (annual ELSS investment, slab/regime → 80C tax saved, old regime only, cap ₹1.5 lakh, ₹0 under new regime), Cost of delay. Ranges: SIP ₹500–₹10 lakh, return 1–30% p.a., period 1–40 years; defaults ₹5,000/month, 12%, 10 years. Formulas: SIP FV = P × ((1+i)^n − 1)/i × (1+i) with i = r/12, n = months (payment at start of month); lump sum FV = P × (1+r)^t (annual compounding); goal cost = C × (1+f)^t. Indian formatting with lakh/crore. Results shareable via URL query params ("Copy link") and downloadable as PDF with the firm logo (client-side, e.g. jsPDF). Disclaimer under each result exactly: "Illustrative only, assumes a constant rate of return; actual returns may vary. Not investment advice." Each ends with "Invest now" / "Talk to an expert" CTAs.
- Sitemap: About the firm (About us, AMC partners, Contact, Grievance redressal, Legal and disclosures), Invest (Services ×8, Fund explorer, Scheme pages), Tools and learning (Calculators ×8, Knowledge centre, FAQs and glossary), Secure area (Login + OTP → Investor dashboard / RM and admin console). Every public page ≤ 2 clicks from Home. Admin console Content section gains tabs: Home, About, Services, AMC partners (with logo upload), Testimonials, Team, Site settings.

## 7. Real AMC and scheme data (additive)

- `GET /public/amcs` and `/admin/cms/amcs` rows gain `website` (AMC's official site); `POST/PUT /admin/cms/amcs` accept `website`.
- Seeded AMCs: the top 10 by average AUM (Apr–Jun 2026) with official logos (`backend/src/main/resources/seed/amc-logos/`).
- Seeded schemes: every open-ended Regular Plan – Growth scheme (ETFs, fund-of-funds and side-pocket portfolios excluded) of the 17 AMCs in `tools/build-scheme-seed.mjs`, with real AMFI codes and ~10 years of AMFI NAV history (daily for the last ~400 days, weekly before). `tools/enrich-scheme-details.mjs` then adds the disclosed risk-o-meter, Regular-plan TER (`expenseRatio`), fund size (`aumCr`, all plans), fund managers, benchmark, exit load, objective, minimum SIP / lump sum and allotment date from AMFI daily disclosures and Scheme Summary Documents (compiled by TigZig). The firm's trail rate is not public and stays null.
- `POST /admin/sync/nav` accepts both the old 6-column and the current 8-column (`…;Plan;Option;NAV;Date`) AMFI NAV file.

## 8. Online KYC application (additive)

One online path for residents and NRIs to apply for KYC. The website collects details + documents; the firm then verifies the documents, completes the **video in-person verification (VIPV)** and uploads the KYC to a KRA (CAMS / KFintech) through its intermediary access. The site never says KYC is completed on submission — it says the application is submitted and registration usually completes 2–5 working days after the video call.

Enums
- Residency: `RESIDENT`, `NRI`
- Gender: `MALE`, `FEMALE`, `TRANSGENDER`
- KycApplicationStatus: `SUBMITTED`, `UNDER_REVIEW`, `VIPV_SCHEDULED`, `SUBMITTED_TO_KRA`, `KYC_REGISTERED`, `ACTION_REQUIRED`, `REJECTED` (pending = SUBMITTED / UNDER_REVIEW / VIPV_SCHEDULED / ACTION_REQUIRED)
- KycDocType (= multipart part name): `PAN_CARD`, `ADDRESS_PROOF` (masked Aadhaar / passport / voter ID / driving licence), `PHOTO`, `SIGNATURE`, `CANCELLED_CHEQUE`, `PASSPORT`, `OVERSEAS_ADDRESS_PROOF`, `VISA_OR_OCI`
  - RESIDENT required: `PAN_CARD`, `ADDRESS_PROOF`, `PHOTO`, `SIGNATURE`; optional `CANCELLED_CHEQUE`
  - NRI required: `PAN_CARD`, `PASSPORT`, `OVERSEAS_ADDRESS_PROOF`, `PHOTO`, `SIGNATURE`; optional `ADDRESS_PROOF` (Indian address), `VISA_OR_OCI`, `CANCELLED_CHEQUE` (NRE / NRO account)
- maritalStatus: `SINGLE`, `MARRIED`, `OTHER`
- occupation: `PRIVATE_SECTOR`, `PUBLIC_SECTOR`, `GOVERNMENT`, `BUSINESS`, `PROFESSIONAL`, `SELF_EMPLOYED`, `RETIRED`, `HOMEMAKER`, `STUDENT`, `OTHER`
- annualIncome: `BELOW_1L`, `1L_5L`, `5L_10L`, `10L_25L`, `25L_1CR`, `ABOVE_1CR`

### Public — `/api/public` (rate limited per IP like the other OTP endpoints)

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/leads/otp` | `{ mobile }` (existing) | `{ challengeId, devOtp? }` |
| POST | `/kyc/verify-otp` | `{ mobile, challengeId, otp }` | `{ ok:true, validMinutes:60 }` — verifies the mobile on step 1 of the form; the verified challenge stays usable for the final submit for 60 min from issue. Errors `OTP_INVALID` / `OTP_EXPIRED` / `OTP_ATTEMPTS_EXCEEDED`. Optional: `/kyc` also accepts a not-yet-verified challenge. |
| POST | `/kyc` | multipart (see below) | `{ ref:"KYC2610200001", ok:true }` |
| POST | `/kyc/status` | `{ ref, mobile }` | `{ ref, status, submittedAt, updatedAt, message }` — only when both match; otherwise 404 `NOT_FOUND` (never reveals which one is wrong) |

`POST /kyc` multipart — flat text fields (like `/portfolio-review`) plus one file part per document, named by doc type:
- `residency`, `fullName` (as on PAN), `fatherOrSpouseName`, `gender`, `dob` (`YYYY-MM-DD`, age ≥ 18), `pan` (individual PAN, `AAAPA9999A` — 4th char `P`), `mobile` (10 digits, must be the mobile the OTP was sent to), `email`, `maritalStatus`, `occupation`, `annualIncome`, `politicallyExposed` (`true`/`false`)
- Indian address: `addressLine`, `city`, `state`, `pincode` (6 digits) — required for RESIDENT; optional for NRI (all-or-nothing)
- NRI only (required): `countryOfResidence` (not India), `overseasAddress`, `taxResidencyCountry`, `foreignTin` (required unless tax residency is India), `nationality`
- `preferredVipvSlot` (free text ≤ 100, e.g. "Weekday evening IST"), `consent=true`, `challengeId`, `otp`, `website` (honeypot: non-empty → fake success, nothing stored)
- Files: PDF / JPEG / PNG only (content type **and** magic bytes checked), ≤ 5 MB each, ≤ 20 MB per application. Bytes are stored AES-256-GCM encrypted (`kyc_document.data`).
- Validation → 400 `VALIDATION` with `fields` keyed by field name or doc type, e.g. `{ "fields": { "PASSPORT": "Upload your passport", "dob": "You must be at least 18 years old to apply online" } }`.
- On success: staff notified (in-app for admins + RMs, e-mail to the firm via `NotificationGateway` stub), applicant gets SMS + e-mail acknowledgement (stub), audit `KYC_SUBMITTED`. New applications are unassigned.

### Staff — `/api/admin` (RM + ADMIN)

RM scope: applications assigned to me **or unassigned**; ADMIN sees all. Out-of-scope id → 403 `FORBIDDEN`.

| Method | Path | Body / Query | Response |
|---|---|---|---|
| GET | `/kyc?status=&q=` | `q` matches name, ref, email, city/country, or an exact PAN / 10-digit mobile | `[KycRow]` newest first (no document bytes) |
| GET | `/kyc/{id}` | | `KycDetail` |
| PUT | `/kyc/{id}` | `{ status?, staffNotes?, assignedRmId? /* ADMIN only, RM → 403 */ }` | `KycDetail`. An RM updating an unassigned application takes ownership of it. A status change sends the applicant an SMS + e-mail (stub) with the public status message. Audit `KYC_UPDATED`. |
| GET | `/kyc/{id}/documents/{docId}` | | the decrypted file (Content-Disposition attachment, `Cache-Control: no-store`). Audit `KYC_DOCUMENT_DOWNLOADED`. |
| GET | `/dashboard` | | (extended) adds `pendingKyc` — count of pending applications in the user's scope |

```jsonc
// KycRow
{ "id": 1, "ref": "KYC2610200001", "residency": "RESIDENT", "fullName": "Sneha Pillai", "panMasked": "XXXXX4821K",
  "mobileMasked": "XXXXXX0021", "email": "sneha.pillai@example.com", "location": "Thiruvananthapuram, Kerala" /* NRI: country */,
  "status": "SUBMITTED", "assignedRmId": null, "assignedRmName": null, "documentCount": 4,
  "createdAt": "2026-10-20T09:15:00", "updatedAt": "2026-10-20T09:15:00" }
// KycDetail = KycRow + (encrypted values are masked; name / email in clear)
{ "fatherOrSpouseName": "Mohan Pillai", "gender": "FEMALE", "dobMasked": "XX-XX-1994", "age": 32,
  "maritalStatus": "SINGLE", "occupation": "PRIVATE_SECTOR", "annualIncome": "10L_25L", "politicallyExposed": false,
  "addressMasked": "Flat ***** Road", "city": "…", "state": "…", "pincode": "695003",
  "countryOfResidence": null, "overseasAddressMasked": null, "taxResidencyCountry": null, "foreignTinMasked": null, "nationality": null,
  "preferredVipvSlot": "Weekday evenings after 6 PM", "consent": true, "consentAt": "…", "staffNotes": null,
  "documents": [ { "id": 1, "docType": "PAN_CARD", "label": "PAN card", "fileName": "pan.png", "contentType": "image/png", "sizeBytes": 20480, "uploadedAt": "…" } ] }
```

Audit actions gain `KYC_SUBMITTED`, `KYC_UPDATED`, `KYC_DOCUMENT_DOWNLOADED`.

Seed: 3 SAMPLE applications — resident `SUBMITTED` (unassigned), NRI `UNDER_REVIEW` (Vikram), resident `KYC_REGISTERED` (Ananya) — with tiny generated placeholder PNG / PDF documents marked "SAMPLE".

Frontend: Home band "Complete your KYC online" (after the services band) → `/kyc?type=resident|nri`, `/kyc/status`; footer + Services page links; staff console "KYC requests" (`/console/kyc`) and dashboard tile "Pending KYC". Entered KYC data is kept in component state only (never browser storage).

## 9. Automatic data updates (additive)

The backend keeps NAVs, scheme details and the scheme list up to date on its own (`app.auto-sync.*`, see `backend/README.md`). Jobs run only while the backend is running; at most one sync job (scheduled or manual, any type) runs at a time. Every run is a `SyncRun`; scheduled ones have `triggeredBy: "Scheduler"`.

| Job | `SyncRun.type` | Default schedule (Asia/Kolkata) | What it does |
|---|---|---|---|
| NAV import | `NAV` | daily 23:30 (`0 30 23 * * *`); retry 07:00 (`0 0 7 * * *`) only if no NAV import succeeded in the last 20 h; on startup a catch-up import (after 60 s) when the last successful one is older than 20 h | same as `POST /sync/nav` without a file (AMFI NAVAll.txt, 6- or 8-column format); returns recalculated |
| Scheme details | `DETAILS` | Daily 00:30 (`0 30 0 * * *`) | disclosed risk-o-meter, Regular-plan TER (`expenseRatio`), `aumCr`, fund managers, benchmark, exit load, objective, minimum SIP / lump sum, allotment date (→ `launchDate`) for every scheme, from AMFI disclosures compiled by TigZig (batches of 50, retried). A field the source has no value for keeps its current value. |
| New schemes | `SCHEMES` | Daily 00:00 (`0 0 0 * * *`) | selects every open-ended Regular Plan – Growth scheme (same rules as `tools/build-scheme-seed.mjs`) of the **active AMCs in the AMC list** (`/cms/amcs`, name = AMFI AMC name). Codes not yet in the database are added with ~10 years of split-adjusted NAV history (daily for 400 days, weekly before), returns and details. Schemes whose code is no longer in the AMFI NAV file at all get `active=false` (hidden from the explorer, never deleted); they are reactivated if they reappear. |
| NFO import | `NFO` | daily 08:00 (`0 0 8 * * *`); on startup a catch-up run when the last successful one is older than 20 h | new fund offers of all AMCs from the AMFI scheme master + Scheme Summary Document details (section 10) |

`SyncRun` objects (in `/sync/runs` and all `POST /sync/*` responses) gain `summary` (one line, e.g. `"Added 2, deactivated 1, reactivated 0 (896 Regular Growth schemes of 17 AMCs in the AMFI file)"`, null for NAV / RTA) and `triggeredBy`. `type` is `"NAV" | "RTA" | "DETAILS" | "SCHEMES" | "NFO"` (NFO: section 10). For `DETAILS`, `processed` = schemes with details found, `failed` = schemes whose batch could not be fetched. For `SCHEMES`, `processed` = Regular Growth schemes checked, `failed` = new schemes that could not be added (+1 if the scheme master could not be downloaded).

Staff — `/api/admin` (all **A**, audited `SYNC_RUN`):

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/sync/details` | | SyncRun (runs synchronously, typically 1–2 min) |
| POST | `/sync/schemes` | | SyncRun (runs synchronously; longer when many schemes are new) |
| GET | `/sync/schedule` | | `{ enabled, zone, running /* type of the job running now or null */, catchUpOnStart, nav:{ cron, nextRun, retryCron, nextRetry }, details:{ cron, nextRun }, schemes:{ cron, nextRun }, nfo:{ cron, nextRun }, lastSuccess:{ NAV, DETAILS, SCHEMES, NFO } }` — `nextRun` is a local timestamp in `zone` (null when auto sync is disabled); `lastSuccess` = `finishedAt` of the latest `SUCCESS`/`PARTIAL` run of that type (null = never) |

`POST /sync/nav`, `/sync/rta`, `/sync/details`, `/sync/schemes` return 409 `CONFLICT` while another sync job is running.

Frontend: console Data sync page has an "Automatic updates" card (on/off, time zone, schedule, next run and last successful run per job, buttons "Update NAVs now", "Refresh scheme details", "Check for new schemes" with confirmation), and the runs table shows NAV import / Scheme details / New schemes / RTA import with the run summary and who started it.

## 10. New fund offers (NFOs) (additive)

New schemes of **all** AMCs, imported every day from the AMFI scheme master (`app.amfi.scheme-master-url`): its "Launch Date" is the date the NFO opens and "Closure Date" the date it closes (often empty while the NFO is current). One NFO per AMC + scheme (all plans / options grouped; the Regular Growth row gives the code and minimum amount). The Scheme Summary Document (details API, `app.auto-sync.details-url`) adds the risk-o-meter, benchmark, fund managers, exit load, objective and NFO close date once the AMC has filed it. Staff add the one-pager (each AMC publishes its own NFO leaflet), the SID link and corrections.

Status (computed every request; `today` = Asia/Kolkata):
- `UPCOMING` — `openDate` > today
- `OPEN` — opened and today ≤ `closesBy`
- `CLOSED` — otherwise
- `closesBy` = `closeDate`, or `openDate + 15 days` while the close date is unknown (SEBI: an NFO is open for at most 15 days, ELSS excepted) → `closeDateConfirmed:false`. `daysLeft` = days until `closesBy` (0 = closes today; null when closed), `opensInDays` for upcoming ones.
- Closed NFOs stay in the public "recently closed" list for 30 days after `closesBy`; older ones are only filtered out (never deleted).

```jsonc
// Nfo
{ "id": 38, "schemeCode": "154840" /* null for manual entries */, "amc": "Choice AMC" /* AMC partner name when it matches, else the legal name without "Private Limited" etc. */,
  "amcLegalName": "Choice AMC Private Limited", "schemeName": "Choice Large & Mid Cap Fund", "schemeType": "Open Ended",
  "amfiCategory": "Equity Schemes - Large & Mid Cap Fund", "assetClass": "EQUITY" /* EQUITY | DEBT | HYBRID | OTHER (ETF, fund of funds, FMP, interval, life cycle) */,
  "subCategory": "Large & Mid Cap", "minAmountText": "Rs. 1000 and in multiples of Re. 1/-thereafter", "minAmount": 1000.00,
  "openDate": "2026-10-20", "closeDate": null, "closeDateSource": null /* AMFI | SSD | STAFF */, "closesBy": "2026-11-04", "closeDateConfirmed": false,
  "status": "OPEN", "daysLeft": 15, "opensInDays": null, "riskometer": null /* Risk */, "benchmark": null, "fundManagers": null, "exitLoad": null, "objective": null,
  "sidUrl": null, "hasOnePager": false, "onePagerUrl": null /* "/api/public/nfos/38/one-pager" */, "onePagerUpdatedAt": null, "featured": false,
  // staff responses only:
  "hidden": false, "source": "AMFI" /* AMFI | MANUAL */, "staffEditedFields": ["closeDate"], "onePagerFileName": null, "onePagerSize": null,
  "createdAt": "2026-10-20T19:34:07", "updatedAt": "2026-10-20T19:34:07" }
```

### Public — `/api/public`

| Method | Path | Response |
|---|---|---|
| GET | `/nfos?status=open\|upcoming\|closed\|all&amc=&assetClass=&q=` | `[Nfo]` — default open + upcoming; `closed` = closed in the last 30 days; `all` = all three. Hidden NFOs excluded. Order: featured first, then open (closing soonest), upcoming (opening soonest), closed (latest first). `amc` = `Nfo.amc` exactly; `q` matches scheme, AMC, category, code. Invalid status → 400 `VALIDATION` |
| GET | `/nfos/{id}` | `Nfo` (404 if hidden / unknown) |
| GET | `/nfos/{id}/one-pager` | the PDF (`Content-Disposition: attachment; filename="<Scheme-Name>-NFO-one-pager.pdf"`), 404 `NOT_FOUND` if none |

### Staff — `/api/admin` (read: RM + ADMIN; write **A**)

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/nfos?status=&q=` | | `[Nfo]` (staff fields; incl. hidden and older closed ones; newest open date first; `status` as above, default all) |
| GET | `/nfos/{id}` | | `Nfo` |
| GET | `/nfos/{id}/one-pager` | | the PDF (also for hidden NFOs) |
| POST | `/nfos` **A** | `{ amc, schemeName, assetClass, openDate, closeDate?, subCategory?, minAmount?, minAmountText?, riskometer?, benchmark?, fundManagers?, exitLoad?, objective?, sidUrl?, featured?, hidden? }` | `Nfo` (`source:"MANUAL"`) |
| PUT | `/nfos/{id}` **A** | any of the fields above — only keys present change, `null` / `""` clears | `Nfo`. Changed fields (except `featured` / `hidden`) are added to `staffEditedFields`; the import never overwrites them. A staff close date gets `closeDateSource:"STAFF"`. Validation: close date ≥ open date, `sidUrl` http(s), known `riskometer` / `assetClass` |
| POST | `/nfos/{id}/one-pager` **A** | multipart `file` — PDF only (content type + magic bytes `%PDF-`), ≤ 10 MB; replaces an existing one | `Nfo` |
| DELETE | `/nfos/{id}/one-pager` **A** | | `Nfo` |
| POST | `/sync/nfos` **A** | | SyncRun (`type:"NFO"`, synchronous, ~1 min; 409 while another sync job runs) |

Import job (`SyncRun.type = "NFO"`, daily 08:00 Asia/Kolkata `app.auto-sync.nfo-cron` = `0 0 8 * * *`; on startup a catch-up run when the last successful one is older than 20 h; shares the one-job-at-a-time lock): takes open- and close-ended rows of all AMCs and categories whose scheme's earliest launch date is within the last 45 days (or later), or whose closure date is today or later; inserts new NFOs, refreshes the AMFI fields of known ones (except staff-edited fields; an AMFI closure date replaces an SSD one), then fills only empty fields from the Scheme Summary Document (an SSD close date only when AMFI has none and it is within 60 days after opening). Nothing is deleted. `processed` = NFOs found in the scheme master, `failed` = codes whose details batch could not be fetched (+1 if the master could not be downloaded). Summary e.g. `"14 open, 7 upcoming, 23 recently closed; 3 new, 2 updated (45 NFOs in the AMFI scheme master; scheme summary details found for 6 of 34)"`.

`GET /sync/schedule` gains `nfo:{ cron, nextRun }` and `lastSuccess.NFO`. Audit actions gain `NFO_UPDATED` (manual NFO, edits, one-pager removed), `NFO_ONEPAGER_UPLOADED`; runs are `SYNC_RUN`.

Frontend: public `/nfo` (tabs Open now / Upcoming / Recently closed in `?tab=`, filters fund house / category / search, cards with status, dates, minimum, risk, one-pager, "Talk to us"), `/nfo/:id` (details, risk-o-meter, documents, CTA `/contact?interest=OTHER&message=…`), home band "New fund offers" (after AMC partners, up to 4, hidden when none), footer and fund-explorer links, mobile menu entry. The desktop header has no NFO item (it does not fit at 1200 px). Console "NFOs" (`/console/nfos`, under Administration for ADMIN, read-only for RM) and the NFO job on the Data sync page.
