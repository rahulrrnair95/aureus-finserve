# Aureus Finserve — Frontend

React 18 + Vite 6 single-page app for the Aureus Finserve website, investor app and staff console.
Implements the contract in [`../docs/API.md`](../docs/API.md) (Spring Boot backend on `http://localhost:8080`).

## Prerequisites

- Node.js 20+ (tested on Node 24) and npm.

## Development

```bash
npm install
npm run dev          # http://localhost:5173
```

The dev server proxies every request under `/api` to `http://localhost:8080` (see `vite.config.js`).
Start the backend separately (for example with its `h2` profile). In dev mode the backend returns
`devOtp` with every OTP it issues; the UI shows it as a small "Dev OTP: …" hint.

Demo logins (seeded by the backend): `9876543210` / `Priya@2026` (investor), `9876500001` / `Rao@2026`
(investor), `ananya@aureusfinserve.in` / `Rm@2026!` (RM), `admin@aureusfinserve.in` / `Admin@2026` (admin).

## Build

```bash
npm run build        # outputs dist/
npm run preview      # serves dist/ on http://localhost:4173 with the same /api proxy
```

`dist/` is a static SPA: the web server must fall back to `index.html` for unknown paths
(e.g. `/app/holdings`, `/activate/<token>`) and forward `/api/**` to the backend.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_PROXY_TARGET` | `http://localhost:8080` | Dev/preview proxy target for `/api` |
| `VITE_API_BASE` | *(empty)* | Absolute API origin baked into the build, if the API is not served from the same origin (e.g. `https://api.example.com`). Leave empty when `/api` is reverse-proxied. |

Put overrides in `.env.local` (not committed).

## Structure

```
src/
  api/          fetch client (auth header, X-Device-Id, error parsing), endpoint wrappers, useApi hook
  auth/         AuthContext (session, idle timer, 401 handling), SiteContext (/public/site), route guard
  components/   Button, Field/Input/Select, Modal/Drawer (focus trap), Tabs, DataTable (cards on mobile),
                StatusChip, RiskOMeter, Money, Toast, OtpInput, States (Empty/Error/Async), Skeleton,
                Charts helpers, order/CartBuilder (shared by investor Transact and console Order desk)
  layouts/      PublicLayout (header, footer, floating contact), AppShell, InvestorLayout, ConsoleLayout, AuthLayout
  pages/        public/, auth/, investor/, console/
  styles/       tokens.css (brand colours/fonts), base, components, layout, per-area page styles
  utils/        Indian number formatting, calculator maths, PDF export, password policy, titles
```

## Security & session behaviour

- Session token is kept in `sessionStorage` (cleared when the tab closes); the device id in `localStorage`.
- Any `401 SESSION_EXPIRED` / `UNAUTHORIZED` clears the token and redirects to `/login` with a message.
- Client-side idle timer uses `user.idleTimeoutMinutes` with a one-minute warning ("Stay signed in" pings `/api/auth/me`).
- File downloads (reports, CSV, CAS attachments) are fetched with the auth header and saved as blobs.
