// Daily NAVs and trailing returns for the schemes listed on the website, from AMFI's public files.
//
// - Latest NAV and date: AMFI NAVAll.txt (all schemes, published every evening).
// - Returns compare that NAV with the NAV on or before the same date 1 / 3 / 5 / 10 years earlier (stepping back over
//   weekends and holidays): point-to-point for 1y, CAGR over the exact number of days for longer periods, rounded to
//   2 decimals (as the backend's NavService.trailingReturn).
//   1y and 3y reference NAVs come from AMFI's NAV history report for that date (one file for all schemes; AMFI serves
//   about the last three years). 5y and 10y ones come from mfapi.in, one small request per scheme, refreshed weekly and
//   kept in the saved document (refs) in between; the CAGR uses the actual dates, so a reference a few days old is fine.

const NAV_ALL = 'https://portal.amfiindia.com/spages/NAVAll.txt';
const MFAPI = (code, from, to) => `https://api.mfapi.in/mf/${code}?startDate=${from}&endDate=${to}`;
const AMFI_PERIODS = [1, 3]; // reference dates AMFI's history report still covers
const REF_REFRESH_DAYS = 7; // how long cached mfapi reference NAVs are reused
const HISTORY = (d) => `https://portal.amfiindia.com/DownloadNAVHistoryReport_Po.aspx?frmdt=${d}`;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PERIODS = [1, 3, 5, 10];
const DAY_MS = 86400000;
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
const MAX_STEP_BACK = 7; // days to look back from a reference date for the last NAV on or before it

const toIso = (amfi) => {
  // "23-Oct-2026" -> "2026-10-23"
  const [d, mon, y] = amfi.split('-');
  const m = MONTHS.indexOf(mon);
  return m < 0 ? null : `${y}-${String(m + 1).padStart(2, '0')}-${d.padStart(2, '0')}`;
};
const toAmfi = (iso) => {
  const [y, m, d] = iso.split('-');
  return `${d}-${MONTHS[Number(m) - 1]}-${y}`;
};
const addDays = (iso, n) => {
  const t = new Date(`${iso}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};
/** Same day n years earlier; 29 Feb becomes 28 Feb (like java.time minusYears). */
const minusYears = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y - n, m - 1, d));
  if (t.getUTCMonth() !== m - 1) t.setUTCDate(0);
  return t.toISOString().slice(0, 10);
};

async function download(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (aureus-finserve nav updater)' }, redirect: 'follow' });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return r.text();
}

/** Parses an AMFI file (NAVAll or history report) into Map(code -> { nav, date }) for the wanted codes. */
function parse(text, wanted) {
  const out = new Map();
  for (const line of text.split(/\r?\n/)) {
    const f = line.split(';');
    if (f.length < 4 || !wanted.has(f[0].trim())) continue;
    const nav = Number(f[f.length - 2]);
    const date = toIso(f[f.length - 1].trim());
    if (Number.isFinite(nav) && nav > 0 && date) out.set(f[0].trim(), { nav, date });
  }
  return out;
}

/** NAV on or before `iso` for each wanted code, stepping back day by day until most codes are found. */
async function navsOnOrBefore(iso, wanted, log) {
  const found = new Map();
  for (let back = 0; back <= MAX_STEP_BACK && found.size < wanted.size; back++) {
    const day = addDays(iso, -back);
    let rows;
    try {
      rows = parse(await download(HISTORY(toAmfi(day))), wanted);
    } catch (e) {
      log(`history ${day} failed: ${e.message}`);
      continue;
    }
    for (const [code, v] of rows) if (!found.has(code)) found.set(code, v);
    // a trading day covers nearly every scheme that existed then; stop once a day added little
    if (rows.size > wanted.size * 0.5) break;
  }
  return found;
}

/** Runs fn over items, `n` at a time. */
async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) await fn(items[i++]);
    })
  );
}

/** mfapi.in: NAV on or before `iso` (within a week) for each code, as Map(code -> { nav, date }). */
async function mfapiRefs(codes, iso, log) {
  const found = new Map();
  let failed = 0;
  await pool(codes, 8, async (code) => {
    try {
      const r = await fetch(MFAPI(code, addDays(iso, -MAX_STEP_BACK), iso), { headers: { 'User-Agent': 'aureus-finserve nav updater' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const rows = ((await r.json()).data || [])
        .map((d) => ({ date: d.date.split('-').reverse().join('-'), nav: Number(d.nav) })) // dd-mm-yyyy -> yyyy-mm-dd
        .filter((d) => d.date <= iso && Number.isFinite(d.nav) && d.nav > 0)
        .sort((a, b) => (a.date < b.date ? 1 : -1));
      if (rows.length) found.set(code, rows[0]);
    } catch {
      failed++;
    }
  });
  if (failed) log(`mfapi ${iso}: ${failed} of ${codes.length} requests failed`);
  return found;
}

const round2 = (n) => Math.round(n * 100) / 100;
/** Most common value (the NAV date nearly every scheme shares; a few publish ahead or lag behind). */
const mode = (values) => {
  const n = new Map();
  for (const v of values) n.set(v, (n.get(v) || 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? 1 : -1))[0][0];
};

/**
 * Builds { asOf, navs: { code: [nav, date, r1, r3, r5, r10] }, refs, updatedAt } for `codes`.
 * `prev` is the last saved result (or null); `changed` is false when AMFI has nothing newer.
 * `refs` caches the mfapi reference NAVs ({ anchor, byPeriod: { 5: { code: [nav, date] }, 10: ... } }); it is internal
 * and not meant to be sent to browsers.
 */
export async function buildNavs(codes, prev, log = () => {}) {
  const wanted = new Set(codes.map(String));
  const latest = parse(await download(NAV_ALL), wanted);
  if (latest.size < wanted.size * 0.5) throw new Error(`NAVAll matched only ${latest.size} of ${wanted.size} schemes`);
  const asOf = mode([...latest.values()].map((v) => v.date));
  if (prev && prev.asOf >= asOf && Object.keys(prev.navs || {}).length >= latest.size) return { data: prev, changed: false };

  const refs = {};
  for (const n of AMFI_PERIODS) {
    refs[n] = await navsOnOrBefore(minusYears(asOf, n), wanted, log);
    if (refs[n].size === 0) log(`AMFI history has no data for ${n}y; using mfapi`);
  }
  // 5y / 10y (and any AMFI period that came back empty): cached mfapi references, refreshed weekly
  const cached = prev?.refs && daysBetween(prev.refs.anchor, asOf) < REF_REFRESH_DAYS ? prev.refs : null;
  const byPeriod = {};
  for (const n of PERIODS.filter((p) => !refs[p] || refs[p].size === 0)) {
    const keep = cached?.byPeriod?.[n];
    if (keep && Object.keys(keep).length) {
      refs[n] = new Map(Object.entries(keep).map(([c, [nav, date]]) => [c, { nav, date }]));
    } else {
      refs[n] = await mfapiRefs([...wanted], minusYears(asOf, n), log);
    }
    byPeriod[n] = Object.fromEntries([...refs[n]].map(([c, v]) => [c, [v.nav, v.date]]));
  }

  const navs = {};
  for (const [code, { nav, date }] of latest) {
    const row = [nav, date];
    for (const n of PERIODS) {
      const ref = refs[n].get(code);
      // no reference NAV within a week before the period start (e.g. a younger fund): no return for that period
      const days = ref ? daysBetween(ref.date, date) : 0;
      if (!ref || days < n * 365 - 2 || days > n * 366 + REF_REFRESH_DAYS + MAX_STEP_BACK) {
        row.push(null);
        continue;
      }
      const ratio = nav / ref.nav;
      row.push(round2((n === 1 ? ratio - 1 : Math.pow(ratio, 365.25 / days) - 1) * 100));
    }
    navs[code] = row;
  }
  const anchor = cached ? cached.anchor : asOf;
  return { data: { asOf, navs, refs: { anchor, byPeriod }, source: 'AMFI, mfapi.in', updatedAt: new Date().toISOString() }, changed: true };
}
