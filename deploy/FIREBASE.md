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

## Daily Sensex update (Cloud Functions)

The Sensex card on the home page shows the latest closing value. Two Cloud Functions in `functions/` provide it:

- `sensexDaily` runs every weekday at 17:00 IST (after the 15:30 close) and saves the close to Firestore (`market/sensex`).
- `sensex` serves that value at `https://<site>/market/sensex` (rewrite in `firebase.json`). The CDN caches it for up
  to 30 minutes, so visitors almost never start the function.

The site does not need to be published again for the value to change. If the function is unavailable, the page uses the
copy baked into the last build (`frontend/public/market/sensex.json`, refreshed by `npm run build:static`), and failing
that the built-in year-end values. It is always an end-of-day value, never a live price.

### One-time setup

1. Firebase console → ⚙ **Usage and billing** → **Details & settings** → **Modify plan** → **Blaze** (pay as you go).
   Cloud Functions need it. This use stays within the free allowance (a few hundred function calls and one scheduler job a
   month); setting a small budget alert there, for example ₹100, is a good idea.
2. Firebase console → **Build → Firestore Database** → **Create database** → location **asia-south1 (Mumbai)**,
   **production mode**.
3. In `firebase.json`, add the rewrite for the function as the first entry of `hosting.rewrites` (it is left out until
   the function exists, because Hosting refuses a rewrite to a missing function):
   `{ "source": "/market/@(sensex|navs)", "function": { "functionId": "market", "region": "asia-south1" } },`
4. Deploy the functions and Firestore rules, then the site:

```powershell
cd "D:\Aureus Finserve\functions"
npm install
cd "D:\Aureus Finserve"
npx firebase-tools@13 deploy --only functions,firestore:rules
npx firebase-tools@13 deploy --only hosting
```

Deploy the functions first: Hosting refuses a rewrite to a function that does not exist yet. The first visit to
`/market/sensex` after deploying fetches the close straight away, so you do not have to wait for 17:00.

To check on it: Firebase console → **Functions** → `sensexDaily` → **Logs** ("Sensex updated" or "Sensex unchanged" on
market holidays). Google Cloud console → **Cloud Scheduler** can run the job immediately with **Force run**.

## Notes

- Hosting settings are in `firebase.json`. Every URL falls back to `index.html`, so deep links such as `/funds/123`
  work. `/assets/**` is cached for 1 year (file names change with every build), `/static-api/**` (the data) for
  1 hour, and pages are never cached.
- `/login`, `/app`, `/console` and `/kyc` show the "page not found" page in this version.
- Do not put secrets in the frontend. The static data contains only what the public website already shows.
