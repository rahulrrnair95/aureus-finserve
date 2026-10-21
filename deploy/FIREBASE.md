# Hosting the public website on Firebase (static mode, no server)

The static build is the public website only. Fund, NFO, article and other content comes from a snapshot taken from your
local backend. Login, the investor and staff areas, online KYC and every form are switched off. Visitors are sent to
call, WhatsApp or e-mail you instead. Nothing has been deleted: once a VPS is available, the normal build
(`npm run build`) is the full site again.

## One-time setup

1. Go to https://console.firebase.google.com and click **Add project** (for example `aureus-finserve`). Google
   Analytics is not needed. The free **Spark** plan is enough for Hosting.
2. In the project, open **Build → Hosting → Get started**. You can skip the CLI steps it shows.
3. Copy the **project ID** (Project settings → General). In `D:\Aureus Finserve\.firebaserc`, replace
   `REPLACE-WITH-FIREBASE-PROJECT-ID` with it.
4. Log in once from a terminal: `npx firebase-tools@13 login` (this opens your browser to sign in to Google).

## Every time you publish (refreshes NAVs, NFOs, articles and so on)

```powershell
# 1. start the backend locally (SQL Server) as usual, then:
cd "D:\Aureus Finserve\frontend"
npm run static:data      # snapshot of the public data -> frontend\static-data\
npm run build:static     # site + snapshot -> frontend\dist-static\
# optional local check: npm run preview:static   (http://localhost:4173)

# 2. upload
cd "D:\Aureus Finserve"
npx firebase-tools@13 deploy --only hosting
```

The site goes live at `https://<project-id>.web.app`. The footer shows "Fund data as of <date>", so publish
regularly (daily or weekly) to keep NAVs fresh. NFO open, upcoming and closed status is worked out in the visitor's
browser from the dates, so an NFO never shows as open after it closes, even with an old snapshot. New NFOs only appear
after you publish again.

## Connecting aureusfinserve.com (GoDaddy)

1. In Firebase: **Hosting → Add custom domain**. Enter `aureusfinserve.com`, and add `www.aureusfinserve.com` as well
   (it can redirect to the main domain).
2. Firebase shows a **TXT** record (to verify ownership) and one or two **A** records.
3. In GoDaddy: **My Products → Domain → DNS → Manage DNS**:
   - add the TXT record exactly as shown (Name `@` for the root domain);
   - delete GoDaddy's existing **A** record for `@` (the "Parked" one) and add Firebase's A record(s);
   - for `www`, add the record Firebase shows (usually a CNAME or A record);
   - under **Forwarding**, remove any domain forwarding.
4. Back in Firebase, click **Verify**. DNS can take from a few minutes up to 24 hours. Firebase then issues the HTTPS
   certificate on its own.

## Notes

- Hosting settings are in `firebase.json`. Every URL falls back to `index.html`, so deep links such as `/funds/123`
  work. `/assets/**` is cached for 1 year (file names change with every build), `/static-api/**` (the data) for
  1 hour, and pages are never cached.
- `/login`, `/app`, `/console` and `/kyc` show the "page not found" page in this version.
- Do not put secrets in the frontend. The static data contains only what the public website already shows.
