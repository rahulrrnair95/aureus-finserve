// Static mode (`npm run build:static`, Firebase Hosting, no backend): answers the site's public GET /api/* calls in the
// browser from the JSON snapshot in /static-api/ (written by scripts/build-static-data.mjs). Filtering, sorting and
// paging mirror the backend (SchemeService.search, NfoService.publicList, SiteService.articles); NFO status is
// recomputed from the dates for today in India (NfoRules), so an NFO is never shown as open after it has closed.
// Scheme NAVs and returns are updated from the nightly /market/navs data when it is newer than the snapshot.
// Every other /api/ call (POST, auth, investor, admin...) gets a 503 STATIC_SITE error.
import { STATIC_UNAVAILABLE } from '../utils/siteMode';

const BASE = '/static-api';

// ---------------------------------------------------------------- responses

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}
const fail = (status, code, error, fields) => json({ error, code, ...(fields ? { fields } : {}) }, status);
const notFound = (what = 'Not found') => fail(404, 'NOT_FOUND', what === 'Not found' ? 'Not found.' : `${what} not found`);
const unavailable = () => fail(503, 'STATIC_SITE', STATIC_UNAVAILABLE);

// ---------------------------------------------------------------- snapshot files (fetched once, cached in memory)

class Missing extends Error {}
let realFetch = null;
const cache = new Map();
const fileKey = (s) => encodeURIComponent(String(s)).replace(/%/g, '_'); // same as scripts/build-static-data.mjs

function load(rel) {
  if (!cache.has(rel)) {
    const p = realFetch(`${BASE}/${rel}`, { headers: { Accept: 'application/json' } }).then(async (r) => {
      // Hosting rewrites unknown paths to index.html, so a missing file can come back as 200 text/html
      const type = r.headers.get('content-type') || '';
      if (!r.ok || !type.includes('json')) throw new Missing(rel);
      return r.json();
    });
    p.catch(() => cache.delete(rel)); // retry later (e.g. after a network blip)
    cache.set(rel, p);
  }
  return cache.get(rel);
}

// ---------------------------------------------------------------- daily NAVs (Firebase function, see functions/navs.js)

let navsPromise = null;
/**
 * Latest NAVs and returns from /market/navs ({ asOf, navs: { code: [nav, date, r1, r3, r5, r10] } }), updated every night
 * from AMFI; null when unavailable (the snapshot is then used as it is).
 */
export function loadNavOverlay() {
  navsPromise ??= fetch('/market/navs', { headers: { Accept: 'application/json' } })
    .then((r) => (r.ok && (r.headers.get('content-type') || '').includes('json') ? r.json() : null))
    .then((j) => (j && j.navs && typeof j.navs === 'object' ? j : null))
    .catch(() => null);
  return navsPromise;
}

const RETURN_KEYS = ['return1y', 'return3y', 'return5y', 'return10y'];
/** The scheme with the newer NAV, date and returns when the overlay is newer than the snapshot. */
function withNav(s, overlay) {
  const r = overlay?.navs?.[s.code];
  if (!r || !(r[1] > (s.navDate || ''))) return s;
  const out = { ...s, nav: r[0], navDate: r[1] };
  // a missing figure (e.g. a failed lookup) keeps the snapshot's value
  RETURN_KEYS.forEach((k, i) => (out[k] = r[2 + i] ?? s[k]));
  return out;
}

let schemesPromise = null;
/** schemes.json with the daily NAVs applied. */
function loadSchemes() {
  if (!schemesPromise) {
    schemesPromise = Promise.all([load('schemes.json'), loadNavOverlay()]).then(([all, o]) => (o ? all.map((s) => withNav(s, o)) : all));
    schemesPromise.catch(() => (schemesPromise = null));
  }
  return schemesPromise;
}

/** A scheme's detail with the daily NAV applied and added to its NAV history. */
async function schemeDetail(id) {
  const [d, o] = await Promise.all([load(`schemes/${id}.json`), loadNavOverlay()]);
  const s = withNav(d, o);
  if (s === d) return d;
  const hist = Array.isArray(d.navHistory) ? d.navHistory : [];
  const last = hist[hist.length - 1];
  return { ...s, navHistory: last && last.date >= s.navDate ? hist : [...hist, { date: s.navDate, nav: s.nav }] };
}

// ---------------------------------------------------------------- helpers mirroring Java

/** java.lang.String.CASE_INSENSITIVE_ORDER */
function ciCompare(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    let c1 = a[i];
    let c2 = b[i];
    if (c1 !== c2) {
      c1 = c1.toUpperCase();
      c2 = c2.toUpperCase();
      if (c1 !== c2) {
        c1 = c1.toLowerCase();
        c2 = c2.toLowerCase();
        if (c1 !== c2) return c1.charCodeAt(0) - c2.charCodeAt(0);
      }
    }
  }
  return a.length - b.length;
}
const blank = (s) => s == null || String(s).trim() === '';
const eqIc = (a, b) => a != null && b != null && String(a).toLowerCase() === String(b).toLowerCase();
const intParam = (v, d) => {
  if (v == null || v === '') return d;
  const n = Number(v);
  return Number.isInteger(n) ? n : NaN;
};

// ---------------------------------------------------------------- fund explorer (SchemeService.search)

const byName = (a, b) => ciCompare(a.name || '', b.name || '');
/** Comparator.nullsLast(reverseOrder()) then by name */
const descNullsLast = (k) => (a, b) => {
  const x = a[k];
  const y = b[k];
  if (x == null && y == null) return byName(a, b);
  if (x == null) return 1;
  if (y == null) return -1;
  return y - x || byName(a, b);
};
const SORTS = {
  return1y: descNullsLast('return1y'),
  return3y: descNullsLast('return3y'),
  return5y: descNullsLast('return5y'),
  return10y: descNullsLast('return10y'),
  aum: descNullsLast('aumCr'),
  name: byName,
};

async function schemes(params) {
  const sort = params.get('sort');
  const cmp = blank(sort) ? byName : SORTS[sort];
  if (!cmp) return fail(400, 'VALIDATION', 'sort must be one of return1y, return3y, return5y, return10y, aum, name', { sort: 'sort must be one of return1y, return3y, return5y, return10y, aum, name' });
  const page = intParam(params.get('page'), 0);
  const size = intParam(params.get('size'), 20);
  if (Number.isNaN(page) || Number.isNaN(size)) return fail(400, 'VALIDATION', 'Invalid page or size');
  const sz = Math.max(1, Math.min(size, 100));
  const pg = Math.max(0, page);
  const q = params.get('q');
  const needle = q == null ? '' : q.trim().toLowerCase();
  const category = params.get('category');
  const subCategory = params.get('subCategory');
  const amc = params.get('amc');
  const risk = params.get('risk');
  const all = await loadSchemes();
  const list = all
    .filter((s) => !needle || (s.name || '').toLowerCase().includes(needle) || (s.amc || '').toLowerCase().includes(needle) || (s.subCategory != null && s.subCategory.toLowerCase().includes(needle)))
    .filter((s) => blank(category) || eqIc(s.category, category))
    .filter((s) => blank(subCategory) || eqIc(subCategory, s.subCategory))
    .filter((s) => blank(amc) || eqIc(amc, s.amc))
    .filter((s) => blank(risk) || eqIc(s.risk, risk))
    .sort(cmp);
  return json({ items: list.slice(pg * sz, pg * sz + sz), total: list.length, page: pg, size: sz });
}

// ---------------------------------------------------------------- new fund offers (NfoRules / NfoService)

const MAX_OPEN_DAYS = 15;
const RECENTLY_CLOSED_DAYS = 30;
const istFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
/** Today's date in India as yyyy-mm-dd (backend: Fmt.today()). */
export const todayIst = () => istFmt.format(new Date());
const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
const closesBy = (n) => n.closeDate || addDays(n.openDate, MAX_OPEN_DAYS);
function nfoStatus(n, today) {
  if (n.openDate > today) return 'UPCOMING';
  return today > closesBy(n) ? 'CLOSED' : 'OPEN';
}
/** The DTO with status, closesBy, closeDateConfirmed, daysLeft and opensInDays recomputed for today. */
function nfoView(n, today) {
  const status = nfoStatus(n, today);
  const by = closesBy(n);
  return {
    ...n,
    closesBy: by,
    closeDateConfirmed: n.closeDate != null,
    status,
    daysLeft: status === 'CLOSED' ? null : daysBetween(today, by),
    opensInDays: n.openDate > today ? daysBetween(today, n.openDate) : null,
  };
}
const RANK = { OPEN: 0, UPCOMING: 1, CLOSED: 2 };
const sortDay = (v) => (v.status === 'OPEN' ? daysBetween('1970-01-01', v.closesBy) : v.status === 'UPCOMING' ? daysBetween('1970-01-01', v.openDate) : -daysBetween('1970-01-01', v.closesBy));
/** Featured first; then open (closing soonest), upcoming (opening soonest), recently closed (latest first); then name. */
function nfoOrder(a, b) {
  return (
    (a.featured === b.featured ? 0 : a.featured ? -1 : 1) ||
    RANK[a.status] - RANK[b.status] ||
    sortDay(a) - sortDay(b) ||
    (a.schemeName == null ? (b.schemeName == null ? 0 : 1) : b.schemeName == null ? -1 : ciCompare(a.schemeName, b.schemeName))
  );
}
const STATUS_SETS = { open: ['OPEN'], upcoming: ['UPCOMING'], closed: ['CLOSED'], all: ['OPEN', 'UPCOMING', 'CLOSED'] };

async function nfos(params) {
  const st = params.get('status');
  const wanted = blank(st) ? ['OPEN', 'UPCOMING'] : STATUS_SETS[st.trim().toLowerCase()];
  if (!wanted) return fail(400, 'VALIDATION', 'status must be open, upcoming, closed or all', { status: 'status must be open, upcoming, closed or all' });
  const amc = params.get('amc');
  const cls = params.get('assetClass');
  const q = params.get('q');
  const needle = blank(q) ? '' : q.trim().toLowerCase();
  const today = todayIst();
  const recent = addDays(today, -RECENTLY_CLOSED_DAYS);
  const rows = (await load('nfos.json'))
    .filter((n) => n.openDate && closesBy(n) >= recent) // isPublicWindow
    .map((n) => nfoView(n, today))
    .filter((n) => wanted.includes(n.status))
    .filter((n) => blank(amc) || eqIc(amc.trim(), n.amc))
    .filter((n) => blank(cls) || eqIc(cls.trim(), n.assetClass))
    .filter((n) => !needle || [n.schemeName, n.amc, n.amcLegalName, n.subCategory, n.amfiCategory, n.schemeCode].some((v) => v != null && String(v).toLowerCase().includes(needle)))
    .sort(nfoOrder);
  return json(rows);
}

/** Backend NfoService.downloadName: "Choice Large & Mid Cap Fund" -> "Choice-Large-Mid-Cap-Fund-NFO-one-pager.pdf" */
function onePagerName(n) {
  let base = n.schemeName == null ? 'NFO' : n.schemeName.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (base.length > 120) base = base.slice(0, 120).replace(/-+$/, '');
  return `${base || 'NFO'}-NFO-one-pager.pdf`;
}

async function nfoDetail(id, onePager) {
  const list = await load('nfos.json');
  const row = list.find((n) => String(n.id) === id);
  if (!row) return notFound(onePager ? 'One-pager' : 'NFO');
  if (onePager) {
    if (!row.hasOnePager || !row.onePagerUrl) return notFound('One-pager');
    const r = await realFetch(row.onePagerUrl);
    if (!r.ok || !(r.headers.get('content-type') || '').includes('pdf')) return notFound('One-pager');
    return new Response(await r.blob(), {
      status: 200,
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${onePagerName(row)}"` },
    });
  }
  let d;
  try {
    d = await load(`nfos/${fileKey(id)}.json`);
  } catch (e) {
    if (!(e instanceof Missing)) throw e;
    d = row;
  }
  return json(nfoView(d, todayIst()));
}

// ---------------------------------------------------------------- routing

/** Simple one-file endpoints: /api/public/<key> -> <file>. */
const SIMPLE = {
  '/public/site': 'site.json',
  '/public/home': 'home.json',
  '/public/about': 'about.json',
  '/public/team': 'team.json',
  '/public/testimonials': 'testimonials.json',
  '/public/banners': 'banners.json',
  '/public/services': 'services.json',
  '/public/faqs': 'faqs.json',
  '/public/glossary': 'glossary.json',
  '/public/amcs': 'amcs.json',
  '/public/schemes/filters': 'schemes-filters.json',
};

/** Detail endpoints: only answered for ids / slugs present in the matching list (so unknown ones are a clean 404). */
async function detail(listFile, match, file, what, read = load) {
  const list = await load(listFile);
  if (!list.some(match)) return notFound(what);
  try {
    return json(await read(file));
  } catch (e) {
    if (e instanceof Missing) return notFound(what);
    throw e;
  }
}

async function handleGet(path, params) {
  if (SIMPLE[path]) return json(await load(SIMPLE[path]));
  if (path === '/public/schemes') return schemes(params);
  if (path === '/public/nfos') return nfos(params);
  if (path === '/public/articles') {
    const c = params.get('category');
    const list = await load('articles.json');
    return json(blank(c) ? list : list.filter((a) => eqIc(c, a.category)));
  }
  let m;
  if ((m = path.match(/^\/public\/schemes\/(\d+)$/))) return detail('schemes.json', (s) => String(s.id) === m[1], m[1], 'Scheme', schemeDetail);
  if ((m = path.match(/^\/public\/nfos\/(\d+)(\/one-pager)?$/))) return nfoDetail(m[1], !!m[2]);
  if ((m = path.match(/^\/public\/articles\/([^/]+)$/))) {
    const slug = decodeURIComponent(m[1]);
    return detail('articles.json', (a) => a.slug === slug, `articles/${fileKey(slug)}.json`, 'Article');
  }
  if ((m = path.match(/^\/public\/services\/([^/]+)$/))) {
    const slug = decodeURIComponent(m[1]);
    return detail('services.json', (s) => s.slug === slug, `services/${fileKey(slug)}.json`, 'Service');
  }
  if ((m = path.match(/^\/public\/pages\/([^/]+)$/))) {
    const key = decodeURIComponent(m[1]);
    const meta = await load('meta.json');
    if (!(meta.pages || []).includes(key)) return notFound('Page');
    return json(await load(`pages/${fileKey(key)}.json`));
  }
  if ((m = path.match(/^\/public\/amcs\/(\d+)\/logo$/))) {
    const amc = (await load('amcs.json')).find((a) => String(a.id) === m[1]);
    if (!amc?.logoUrl) return notFound('Logo');
    return realFetch(amc.logoUrl);
  }
  return path.startsWith('/public/') ? notFound() : unavailable();
}

async function handle(url, method) {
  const path = url.pathname.replace(/^.*?\/api(?=\/)/, '');
  if (method !== 'GET' && method !== 'HEAD') return unavailable();
  try {
    return await handleGet(path, url.searchParams);
  } catch (e) {
    if (e instanceof Missing) return notFound();
    console.warn('[static api]', path, e);
    return fail(503, 'NETWORK', 'Unable to load this information right now. Please check your connection and try again.');
  }
}

export function installStaticApi() {
  if (realFetch) return;
  realFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, window.location.href);
    if (!/\/api\//.test(url.pathname) || url.pathname.startsWith(`${BASE}/`)) return realFetch(input, init);
    const method = String(init?.method || (typeof input === 'object' && input.method) || 'GET').toUpperCase();
    return handle(url, method);
  };
}
