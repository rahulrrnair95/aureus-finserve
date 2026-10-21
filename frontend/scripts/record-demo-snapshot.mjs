// Records API responses from a running backend (H2 profile, fresh seed) into src/demo/snapshot.json,
// the sample data behind the static preview build (`npm run build:demo`).
// Usage: node scripts/record-demo-snapshot.mjs [apiBase] [--import-nfos]   (default http://localhost:8080/api)
//   --import-nfos: when the backend has no NFOs yet, run POST /admin/sync/nfos first (downloads from AMFI).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const API = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'http://localhost:8080/api';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'demo', 'snapshot.json');
const DEV = 'demo-recorder-device';

async function call(method, path, body, token, raw = false) {
  const r = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', 'X-Device-Id': DEV, ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (raw) return r;
  const t = await r.text();
  if (!r.ok) { console.warn('  !', r.status, method, path, t.slice(0, 120)); return undefined; }
  return t ? JSON.parse(t) : null;
}
const key = (path, q) => {
  const s = q ? new URLSearchParams(Object.entries(q).filter(([, v]) => v !== undefined && v !== null && v !== '').sort()).toString() : '';
  return s ? `${path}?${s}` : path;
};
async function rec(store, path, q, token) {
  const k = key(path, q);
  const qs = k.includes('?') ? k.slice(k.indexOf('?')) : '';
  const v = await call('GET', path + qs, null, token);
  if (v !== undefined) store[k] = v;
  return v;
}

const snap = { public: {}, users: {} };
const P = snap.public;
const site = await rec(P, '/public/site');
for (const p of ['/public/schemes/filters', '/public/faqs', '/public/glossary', '/public/testimonials', '/public/team', '/public/banners', '/public/home', '/public/amcs', '/public/about', '/public/services', '/public/articles']) await rec(P, p);
// the API pages at most 100 schemes per request
const all = { items: [] };
for (let page = 0; ; page++) {
  const p = await call('GET', `/public/schemes?size=100&page=${page}&sort=name`);
  all.items.push(...p.items);
  if (all.items.length >= p.total || !p.items.length) break;
}
P['/public/schemes#all'] = all.items;
for (const s of all.items) await rec(P, `/public/schemes/${s.id}`);
for (const a of P['/public/articles']) await rec(P, `/public/articles/${a.slug}`);
for (const k of ['about', 'disclaimer', 'privacy', 'terms', 'commission', 'grievance']) await rec(P, `/public/pages/${k}`);
for (const s of P['/public/services']) await rec(P, `/public/services/${s.slug}`);
// AMC logos are embedded as data: URIs (images in the preview cannot be fetched from an API).
const logoCache = {};
async function logoData(url) {
  if (!url) return url;
  if (!logoCache[url]) {
    const r = await fetch(API.replace(/\/api$/, '') + url);
    logoCache[url] = r.ok ? `data:${r.headers.get('content-type')};base64,${Buffer.from(await r.arrayBuffer()).toString('base64')}` : null;
  }
  return logoCache[url];
}
for (const a of P['/public/amcs']) a.logoUrl = await logoData(a.logoUrl);
// New fund offers: every status + each detail (the admin list, recorded below, becomes the mock's store)
const nfos = (await rec(P, '/public/nfos', { status: 'all' })) || [];
for (const n of nfos) await rec(P, `/public/nfos/${n.id}`);

const USERS = [
  ['priya', '9876543210', 'Priya@2026'],
  ['rao', '9876500001', 'Rao@2026'],
  ['admin', 'admin@aureusfinserve.in', 'Admin@2026'],
  ['ananya', 'ananya@aureusfinserve.in', 'Rm@2026!'],
  ['vikram', 'vikram@aureusfinserve.in', 'Rm@2026!'],
];

for (const [name, userId, password] of USERS) {
  console.log('user', name);
  const l = await call('POST', '/auth/login', { userId, password });
  const v = await call('POST', '/auth/verify-otp', { challengeId: l.challengeId, otp: l.devOtp, rememberDevice: false });
  const t = v.token;
  const S = {};
  snap.users[name] = { userId, password, store: S };
  const me = await rec(S, '/auth/me', null, t);
  if (me.role === 'INVESTOR') {
    const fam = await rec(S, '/investor/family', null, t);
    const members = [undefined, 'all', ...fam.slice(1).map((f) => String(f.id))];
    const fys = await rec(S, '/investor/reports/financial-years', null, t);
    for (const m of members) {
      const q = m ? { member: m } : undefined;
      await rec(S, '/investor/portfolio', q, t);
      await rec(S, '/investor/holdings', q, t);
      await rec(S, '/investor/sips', q, t);
      await rec(S, '/investor/transactions', q, t);
      for (const fy of fys) await rec(S, '/investor/reports/capital-gains', { fy, ...(q || {}) }, t);
    }
    for (const h of S[key('/investor/holdings', { member: 'all' })] || []) await rec(S, `/investor/holdings/${h.folioId}/transactions`, null, t);
    for (const p of ['/investor/orders', '/investor/goals', '/investor/profile', '/investor/tickets', '/investor/rm', '/investor/notifications']) await rec(S, p, null, t);
    if (name === 'priya') {
      for (const fmt of ['pdf', 'xlsx']) {
        const r = await call('GET', `/investor/reports/statement/download?format=${fmt}`, null, t, true);
        const buf = Buffer.from(await r.arrayBuffer());
        snap.public[`#download.${fmt}`] = { type: r.headers.get('content-type'), b64: buf.toString('base64') };
      }
    }
  } else {
    await rec(S, '/admin/dashboard', null, t);
    const clients = await rec(S, '/admin/clients', null, t);
    for (const c of clients) await rec(S, `/admin/clients/${c.id}`, null, t);
    for (const p of ['/admin/rms', '/admin/leads', '/admin/orders', '/admin/tickets']) await rec(S, p, null, t);
    // online KYC queue (RM-scoped: assigned to me or unassigned) + details
    const kyc = await rec(S, '/admin/kyc', null, t);
    for (const k of kyc || []) await rec(S, `/admin/kyc/${k.id}`, null, t);
    if (me.role === 'ADMIN') {
      const b = await rec(S, '/admin/brokerage', null, t);
      const months = [...new Set((b?.rows || []).map((r) => r.month))];
      for (const mo of months) await rec(S, '/admin/brokerage', { month: mo }, t);
      for (const c of ['articles', 'faqs', 'banners', 'pages', 'home', 'about', 'amcs', 'testimonials', 'team', 'services']) await rec(S, `/admin/cms/${c}`, null, t);
      for (const a of S['/admin/cms/amcs'] || []) a.logoUrl = await logoData(a.logoUrl);
      await rec(S, '/admin/users', null, t);
      await rec(S, '/admin/sync/runs', null, t);
      // NFOs (staff view incl. hidden ones). A fresh H2 backend has none until the import runs once.
      let adminNfos = await rec(S, '/admin/nfos', null, t);
      if (Array.isArray(adminNfos) && !adminNfos.length && process.argv.includes('--import-nfos')) {
        await call('POST', '/admin/sync/nfos', null, t);
        adminNfos = await rec(S, '/admin/nfos', null, t);
        const pub = (await rec(P, '/public/nfos', { status: 'all' })) || [];
        for (const n of pub) await rec(P, `/public/nfos/${n.id}`);
        await rec(S, '/admin/sync/runs', null, t);
      }
      P['/public/nfos#all'] = adminNfos || [];
      const audit = await call('GET', '/admin/audit?page=0&size=1000', null, t);
      S['/admin/audit#all'] = audit.items;
    }
  }
  await call('POST', '/auth/logout', null, t);
}

// Public KYC status lookups for the seeded SAMPLE applications (their sample mobiles are known from KycSeed).
const SAMPLE_KYC_MOBILES = ['9811100021', '9811100022', '9811100023'];
snap.public['#kycStatus'] = [];
for (const k of snap.users.admin.store['/admin/kyc'] || []) {
  for (const mobile of SAMPLE_KYC_MOBILES) {
    const r = await fetch(API + '/public/kyc/status', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Device-Id': DEV }, body: JSON.stringify({ ref: k.ref, mobile }) });
    if (r.ok) { const v = await r.json(); snap.public['#kycStatus'].push({ ref: v.ref, mobile, status: v.status, submittedAt: v.submittedAt, updatedAt: v.updatedAt }); break; }
  }
}

// Kavita (not activated) — for the activation flow
const kav = (snap.users.admin.store['/admin/clients'] || []).find((c) => c.loginStatus === 'NOT_ACTIVATED');
snap.activation = kav ? { name: kav.name, pan: 'ABCPI4321L', dob: '1992-11-30' } : null;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(snap));
console.log('written', (fs.statSync(OUT).size / 1024).toFixed(0), 'KB');
