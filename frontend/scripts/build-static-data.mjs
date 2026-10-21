// Snapshots the public content of a running backend into frontend/static-data/ for the static (Firebase) build.
// Only public GET endpoints are used - no login. The static build serves the folder as /static-api/ and
// src/static/staticApi.js answers the site's /api/public/* calls from it.
//
// Usage: node scripts/build-static-data.mjs [apiBase]     (default http://localhost:8080/api)
//        npm run static:data
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const API = (process.argv[2] || process.env.STATIC_API_BASE || 'http://localhost:8080/api').replace(/\/$/, '');
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'static-data');
// written here first, then swapped in, so a failed run keeps the previous snapshot
const TMP = `${OUT}.tmp`;
const PUBLIC_PREFIX = '/static-api';
const PAGE_KEYS = ['about', 'disclaimer', 'privacy', 'terms', 'commission', 'grievance'];
const CONCURRENCY = 8;

let files = 0;
let bytes = 0;
const counts = {};

/** File name for a slug / key (kept URL-safe; the browser side uses the same encoding). */
export const fileKey = (s) => encodeURIComponent(String(s)).replace(/%/g, '_');

async function get(p, { optional = false } = {}) {
  const r = await fetch(API + p, { headers: { Accept: 'application/json', 'X-Device-Id': 'static-snapshot' } });
  if (r.status === 404 && optional) return undefined;
  if (!r.ok) throw new Error(`GET ${p} -> HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

async function getBinary(p) {
  const r = await fetch(API + p.replace(/^\/api/, ''));
  if (!r.ok) return null;
  return { type: (r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase(), data: Buffer.from(await r.arrayBuffer()) };
}

function write(rel, data) {
  const file = path.join(TMP, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(JSON.stringify(data));
  fs.writeFileSync(file, buf);
  files++;
  bytes += buf.length;
}

/** Runs fn over items with limited parallelism. */
async function pool(items, fn) {
  let i = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
}

const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/svg+xml': 'svg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' };

async function main() {
  console.log(`Snapshotting public data from ${API} into ${OUT}`);
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
  write('site.json', await get('/public/site'));

  for (const name of ['home', 'about', 'team', 'testimonials', 'banners', 'faqs', 'glossary']) {
    const v = await get(`/public/${name}`);
    write(`${name}.json`, v);
    if (Array.isArray(v)) counts[name] = v.length;
  }

  // services + each service page
  const services = await get('/public/services');
  write('services.json', services);
  await pool(services, async (s) => write(`services/${fileKey(s.slug)}.json`, await get(`/public/services/${encodeURIComponent(s.slug)}`)));
  counts.services = services.length;

  // CMS pages (legal etc.) - skip the ones that do not exist
  const pages = [];
  for (const key of PAGE_KEYS) {
    const v = await get(`/public/pages/${key}`, { optional: true });
    if (v !== undefined) {
      write(`pages/${fileKey(key)}.json`, v);
      pages.push(key);
    }
  }
  counts.pages = pages.length;

  // articles + each article
  const articles = await get('/public/articles');
  write('articles.json', articles);
  await pool(articles, async (a) => write(`articles/${fileKey(a.slug)}.json`, await get(`/public/articles/${encodeURIComponent(a.slug)}`)));
  counts.articles = articles.length;

  // AMC partners + logos as static files
  const amcs = await get('/public/amcs');
  let logos = 0;
  await pool(amcs, async (a) => {
    if (!a.logoUrl) return;
    if (!a.logoUrl.startsWith('/api/')) return; // external URL: keep as-is
    const bin = await getBinary(a.logoUrl);
    if (!bin || !bin.data.length) {
      a.logoUrl = null;
      return;
    }
    const name = `amc-logos/${a.id}.${EXT[bin.type] || 'png'}`;
    write(name, bin.data);
    a.logoUrl = `${PUBLIC_PREFIX}/${name}`;
    logos++;
  });
  write('amcs.json', amcs);
  counts.amcs = amcs.length;
  counts.amcLogos = logos;

  // fund explorer: filter values, the full scheme list (summaries) and each scheme's detail (with NAV history)
  write('schemes-filters.json', await get('/public/schemes/filters'));
  const schemes = [];
  for (let page = 0; ; page++) {
    const p = await get(`/public/schemes?size=100&page=${page}&sort=name`);
    schemes.push(...p.items);
    if (schemes.length >= p.total || !p.items.length) break;
  }
  write('schemes.json', schemes);
  counts.schemes = schemes.length;
  let done = 0;
  await pool(schemes, async (s) => {
    write(`schemes/${s.id}.json`, await get(`/public/schemes/${s.id}`));
    if (++done % 200 === 0) console.log(`  scheme details ${done}/${schemes.length}`);
  });

  // NFOs (open, upcoming and recently closed); status is recomputed in the browser from the dates.
  const nfos = await get('/public/nfos?status=all');
  let onePagers = 0;
  const details = [];
  await pool(nfos, async (n) => {
    const d = await get(`/public/nfos/${n.id}`);
    for (const x of [n, d]) {
      x.hasOnePager = !!x.hasOnePager;
    }
    if (d.hasOnePager) {
      const bin = await getBinary(`/public/nfos/${n.id}/one-pager`);
      if (bin && bin.data.length) {
        write(`nfo-one-pagers/${n.id}.pdf`, bin.data);
        onePagers++;
        n.onePagerUrl = d.onePagerUrl = `${PUBLIC_PREFIX}/nfo-one-pagers/${n.id}.pdf`;
      } else {
        n.hasOnePager = d.hasOnePager = false;
        n.onePagerUrl = d.onePagerUrl = null;
      }
    }
    details.push(d);
  });
  for (const d of details) write(`nfos/${d.id}.json`, d);
  write('nfos.json', nfos);
  counts.nfos = nfos.length;
  counts.nfoOnePagers = onePagers;

  const navDates = schemes.map((s) => s.navDate).filter(Boolean).sort();
  write('meta.json', {
    generatedAt: new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 19) + '+05:30',
    latestNavDate: navDates[navDates.length - 1] || null,
    pages,
    counts,
  });

  fs.rmSync(OUT, { recursive: true, force: true });
  try {
    fs.renameSync(TMP, OUT);
  } catch {
    // Windows sometimes refuses to rename a folder with freshly written files (indexer / antivirus): copy instead
    fs.cpSync(TMP, OUT, { recursive: true });
    fs.rmSync(TMP, { recursive: true, force: true });
  }

  console.log('Counts:', counts);
  console.log(`Wrote ${files} files, ${(bytes / 1024 / 1024).toFixed(2)} MB`);
}

main().catch((e) => {
  fs.rmSync(TMP, { recursive: true, force: true });
  console.error('Static data snapshot failed (previous snapshot kept):', e.message);
  if (/fetch failed|ECONNREFUSED/i.test(String(e.message) + String(e.cause?.code))) console.error('Is the backend running on', API, '?');
  process.exit(1);
});
