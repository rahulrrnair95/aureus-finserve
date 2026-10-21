// Builds backend/src/main/resources/seed/schemes.json from official AMFI data:
//  - NAV file (latest NAV, AMC and category of every scheme code): https://www.amfiindia.com/spages/NAVAll.txt
//  - scheme master (plan / option name, launch date, minimum amount): https://portal.amfiindia.com/DownloadSchemeData_Po.aspx?mf=0
//  - daily NAV history (AMFI-sourced): https://api.mfapi.in/mf/<schemeCode>
// Usage: node tools/build-scheme-seed.mjs [NAVAll.txt] [SchemeData.csv]   (files are downloaded when omitted)
//
// Takes every open-ended Regular Plan - Growth scheme of the AMCs below - equity (incl. sectoral / thematic and
// index funds), hybrid, debt and solution-oriented. ETFs and fund-of-funds are left out (they are not equity /
// debt / hybrid schemes in the site's model). NAV history is daily for the last ~400 days and weekly before that.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '..', 'backend', 'src', 'main', 'resources', 'seed', 'schemes.json');
const YEARS_OF_HISTORY = 10.3; // enough for 10-year returns to be recomputed after each NAV sync
const DAILY_DAYS = 400; // older points are thinned to one per week
const CONCURRENCY = 8;

const AMCS = [
  { name: 'SBI Mutual Fund', slug: 'sbi', website: 'https://www.sbimf.com' },
  { name: 'ICICI Prudential Mutual Fund', slug: 'icici-prudential', website: 'https://www.icicipruamc.com' },
  { name: 'HDFC Mutual Fund', slug: 'hdfc', website: 'https://www.hdfcfund.com' },
  { name: 'Nippon India Mutual Fund', slug: 'nippon-india', website: 'https://mf.nipponindiaim.com' },
  { name: 'Kotak Mahindra Mutual Fund', slug: 'kotak', website: 'https://www.kotakmf.com' },
  { name: 'Aditya Birla Sun Life Mutual Fund', slug: 'aditya-birla-sun-life', website: 'https://mutualfund.adityabirlacapital.com' },
  { name: 'UTI Mutual Fund', slug: 'uti', website: 'https://www.utimf.com' },
  { name: 'Axis Mutual Fund', slug: 'axis', website: 'https://www.axismf.com' },
  { name: 'DSP Mutual Fund', slug: 'dsp', website: 'https://www.dspim.com' },
  { name: 'Tata Mutual Fund', slug: 'tata', website: 'https://www.tatamutualfund.com' },
  { name: 'The Wealth Company Mutual Fund', slug: 'the-wealth-company', website: 'https://www.wealthcompanyamc.in' },
  { name: 'Motilal Oswal Mutual Fund', slug: 'motilal-oswal', website: 'https://www.motilaloswalmf.com' },
  { name: 'Canara Robeco Mutual Fund', slug: 'canara-robeco', website: 'https://www.canararobeco.com' },
  { name: 'Bajaj Finserv Mutual Fund', slug: 'bajaj-finserv', website: 'https://www.bajajamc.com' },
  { name: 'Sundaram Mutual Fund', slug: 'sundaram', website: 'https://www.sundarammutual.com' },
  { name: 'ITI Mutual Fund', slug: 'iti', website: 'https://www.itiamc.com' },
  { name: 'quant Mutual Fund', slug: 'quant', website: 'https://quantmutual.com' },
  { name: 'Carnelian Mutual Fund', slug: 'carnelian', website: 'https://www.carnelianmf.com' },
];

// demo portfolio scheme names used by DemoSeed → [AMC, AMFI category pattern, optional name pattern]
const ALIASES = {
  'Meridian Large Cap Fund': ['SBI Mutual Fund', /- Large Cap Fund$/],
  'Meridian Flexi Cap Fund': ['HDFC Mutual Fund', /- Flexi ?Cap Fund$/i],
  'Meridian Liquid Fund': ['SBI Mutual Fund', /- Liquid Fund$/],
  'Meridian Balanced Advantage Fund': ['ICICI Prudential Mutual Fund', /Balanced Advantage|Dynamic Asset Allocation/],
  'Northstar Mid Cap Fund': ['Kotak Mahindra Mutual Fund', /- Mid ?Cap Fund$/i],
  'Northstar ELSS Tax Saver Fund': ['Axis Mutual Fund', /ELSS/],
  'Northstar Short Duration Fund': ['HDFC Mutual Fund', /- Short (Duration|Term) Fund$/],
  'Northstar Aggressive Hybrid Fund': ['ICICI Prudential Mutual Fund', /- Aggressive Hybrid Fund$/],
  'Banyan Small Cap Fund': ['Nippon India Mutual Fund', /- Small ?Cap Fund$/i],
  'Banyan Nifty 50 Index Fund': ['UTI Mutual Fund', /Index Funds/, /nifty 50 index fund/i],
  'Banyan Corporate Bond Fund': ['Aditya Birla Sun Life Mutual Fund', /- Corporate Bond Fund$/],
  'Harbor Conservative Hybrid Fund': ['Kotak Mahindra Mutual Fund', /- Conservative Hybrid Fund$/],
  'Harbor Focused Fund': ['Axis Mutual Fund', /- Focused Fund$/],
  'Harbor Money Market Fund': ['Tata Mutual Fund', /- Money Market Fund$/],
  'Harbor Value Fund': ['Tata Mutual Fund', /- Value Fund$/],
  'Kestrel Flexi Cap Fund': ['Kotak Mahindra Mutual Fund', /- Flexi ?Cap Fund$/i],
  'Kestrel Large & Mid Cap Fund': ['DSP Mutual Fund', /- Large & Mid Cap Fund$/],
  'Saffron Banking & PSU Debt Fund': ['ICICI Prudential Mutual Fund', /- Banking and PSU( Debt)? Fund$/],
  'Saffron Bluechip Fund': ['ICICI Prudential Mutual Fund', /- Large Cap Fund$/],
};

// ---------------------------------------------------------------- category → asset class / sub-category / risk
// Risk-o-meter levels are category-typical (indicative): each scheme's actual level is published monthly by its AMC.
const DEBT_LOW = /Overnight/;
const DEBT_LOW_MOD = /Liquid|Money Market|Ultra Short|Low Duration|Floater|Floating/;
const DEBT_MOD_HIGH = /Credit Risk/;

function classify(cat, name) {
  const tail = (cat.split(/\s-\s/).slice(1).join(' - ') || cat).trim();
  if (/Index Funds|Other Scheme - Index/i.test(cat)) {
    const debt = /Debt|SDL|G-?Sec|Gilt|Bond|PSU|T-?Bill|Treasury|Crisil IBX|Liquid|Target Maturity/i.test(cat + ' ' + name);
    return debt ? { cls: 'DEBT', sub: 'Index (Debt)', risk: 'MODERATE' } : { cls: 'EQUITY', sub: 'Index', risk: 'VERY_HIGH' };
  }
  if (/Solution Oriented|Retirement|Children/i.test(cat)) {
    return { cls: 'HYBRID', sub: /Retirement/i.test(cat) ? 'Retirement' : "Children's", risk: 'VERY_HIGH' };
  }
  if (/^Equity|Growth|ELSS/i.test(cat) || /ELSS/i.test(tail)) {
    let sub = tail.replace(/\s*Fund$/i, '').replace(/ELSS.*/i, 'ELSS').replace(/Sectoral\s*\/\s*Thematic/i, 'Sectoral / Thematic');
    if (/^Thematic$|Sectoral$/i.test(sub)) sub = 'Sectoral / Thematic';
    sub = sub.replace(/\bFlexicap\b/i, 'Flexi Cap').replace(/\bMidcap\b/i, 'Mid Cap').replace(/\bSmallcap\b/i, 'Small Cap');
    return { cls: 'EQUITY', sub, risk: 'VERY_HIGH' };
  }
  if (/Hybrid/i.test(cat)) {
    let sub = tail.replace(/\s*Fund$/i, '');
    if (/Balanced Advantage|Dynamic Asset Allocation/i.test(sub)) sub = 'Balanced Advantage';
    const risk = /Arbitrage/i.test(sub) ? 'LOW' : /Conservative|Equity Savings/i.test(sub) ? 'MODERATELY_HIGH' : 'VERY_HIGH';
    return { cls: 'HYBRID', sub, risk };
  }
  // debt (incl. older "Income/Debt Oriented Schemes - ..." labels)
  let sub = tail.replace(/\s*Fund$/i, '').replace(/^Ultra Short to Short Term$/i, 'Ultra Short Duration').replace(/Short Term$/i, 'Short Duration')
    .replace(/^Medium Term$/i, 'Medium Duration').replace(/^Medium to Long Term$/i, 'Medium to Long Duration').replace(/^Long Term$/i, 'Long Duration')
    .replace(/^Dynamic Term$/i, 'Dynamic Bond').replace(/Banking and PSU( Debt)?/i, 'Banking & PSU').replace(/Floating Interest Rates/i, 'Floater');
  if (/^Income$/i.test(sub)) sub = 'Debt';
  if (/^Sectoral$/i.test(sub)) sub = 'Sectoral Debt';
  if (/Constant Maturity Gilt/i.test(sub)) sub = 'Gilt (10-year Constant Maturity)';
  const risk = DEBT_LOW.test(sub) ? 'LOW' : DEBT_LOW_MOD.test(sub) ? 'LOW_TO_MODERATE' : DEBT_MOD_HIGH.test(sub) ? 'MODERATELY_HIGH' : 'MODERATE';
  return { cls: 'DEBT', sub, risk };
}

// ---------------------------------------------------------------- names
const ACRONYMS = new Set(['SBI', 'ICICI', 'HDFC', 'UTI', 'DSP', 'ITI', 'ELSS', 'PSU', 'IDCW', 'BAF', 'ESG', 'MNC', 'PSE', 'CPSE', 'IT', 'US', 'BSE', 'NSE', 'SDL', 'AAA', 'BHARAT', 'G-SEC', 'II', 'III', 'IV', 'FMCG', 'EV', 'AI', 'REIT', 'REITS', 'TRI', 'NASDAQ', 'S&P', 'CRISIL', 'IBX', 'PSBs']);
const cleanName = (n) => n
  .replace(/\s*\(existing number of segregated portfolios[^)]*\)/i, '')
  .replace(/\s*\(\s*(formerly know[n]? as|erstwhile)\b[^)]*\)/gi, '')
  .replace(/^UTI\s*-\s*/, 'UTI ')
  .replace(/\s*-\s*(?=Tax Saver)/i, ' ')
  .replace(/\bFLEXICAP\b/, 'Flexi Cap')
  .replace(/\bFlexicap\b/, 'Flexi Cap')
  .replace(/\b[A-Z]{2,}\b/g, (w) => (ACRONYMS.has(w) || /\d/.test(w) ? w : w[0] + w.slice(1).toLowerCase()))
  .replace(/\bNifty\b/gi, 'Nifty')
  .replace(/\bfund\b/g, 'Fund')
  .replace(/^Quant\b/, 'quant') // the AMC's brand is lower-case
  .replace(/\s{2,}/g, ' ')
  .replace(/[\s.-]+$/, '')
  .trim();

// ---------------------------------------------------------------- inputs
const MONTHS = 'JanFebMarAprMayJunJulAugSepOctNovDec';
const fromDdMonYyyy = (d) => {
  const m = /^(\d{2})-([A-Za-z]{3})-(\d{4})$/.exec((d || '').trim());
  return m ? `${m[3]}-${String(MONTHS.indexOf(m[2][0].toUpperCase() + m[2].slice(1).toLowerCase()) / 3 + 1).padStart(2, '0')}-${m[1]}` : null;
};
const fromDdMmYyyy = (d) => { const [dd, mm, yy] = d.split('-'); return `${yy}-${mm}-${dd}`; };

async function load(arg, url) {
  if (arg) return fs.readFileSync(arg, 'utf8');
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.text();
}
const navText = await load(process.argv[2], 'https://www.amfiindia.com/spages/NAVAll.txt');
const masterText = await load(process.argv[3], 'https://portal.amfiindia.com/DownloadSchemeData_Po.aspx?mf=0');

// NAVAll: AMC header lines, "Open Ended Schemes(<category>)" lines, then
// Code;ISIN growth;ISIN reinvest;Name;[Plan;Option;]NAV;Date
const rows = [];
let amc = null;
let cat = null;
let catFull = null;
for (const raw of navText.split(/\r?\n/)) {
  const line = raw.trim();
  if (!line) continue;
  const f = line.split(';');
  if (f.length === 1) {
    if (/Schemes\(/.test(line)) {
      catFull = line;
      cat = line.slice(line.indexOf('(') + 1, line.lastIndexOf(')'));
    } else amc = line;
    continue;
  }
  if (!/^\d+$/.test(f[0])) continue;
  const hasPlan = f.length >= 8;
  rows.push({ amc, cat, catFull, code: f[0], isin: f[1], name: f[3].trim(), plan: hasPlan ? f[4] : '', option: hasPlan ? f[5] : '', nav: +f[hasPlan ? 6 : 4], date: f[hasPlan ? 7 : 5] });
}

// Scheme master (CSV without quoting): AMC,Code,Scheme Name,Type,Category,NAV Name,Minimum Amount...,Launch Date,Closure Date,ISINs
const master = new Map();
for (const line of masterText.split(/\r?\n/).slice(1)) {
  const f = line.split(',');
  if (!/^\d+$/.test(f[1] || '')) continue;
  const dateIdx = f.findIndex((x, i) => i > 5 && /^\d{2}-[A-Za-z]{3}-\d{4}$/.test(x.trim()));
  const minText = dateIdx > 6 ? f.slice(6, dateIdx).join(',') : '';
  const minNum = +(/(\d[\d,]*)/.exec(minText.replace(/Re\.?\s*1\b.*$/i, ''))?.[1] || '').replace(/,/g, '');
  master.set(f[1], { navName: (f[5] || '').trim(), launch: dateIdx > 0 ? fromDdMonYyyy(f[dateIdx]) : null, minAmount: minNum >= 100 && minNum <= 100000 ? minNum : null });
}

const isRegularGrowth = (r) => {
  const label = r.plan || r.option ? `${r.plan} ${r.option}` : master.get(r.code)?.navName || r.name;
  return /regular/i.test(label) && /growth/i.test(label) && !/direct|idcw|dividend|bonus|unclaimed|discontinued|payout|reinvest/i.test(label);
};
const EXCLUDE_NAME = /segregated portfolio\s*-?\s*\d|\(\s*segregated\s*-|unclaimed|bonus|unit linked|insurance|fund of funds?\b|\bfof\b|\betf\b|exchange traded|interval|fixed maturity|\bfmp\b|direct/i;
const EXCLUDE_CAT = /ETF|FoF|Fund of Funds|Interval|Exchange Traded/i;

const wantedAmcs = new Set(AMCS.map((a) => a.name));
const candidates = rows.filter((r) => wantedAmcs.has(r.amc) && /^Open Ended/.test(r.catFull) && !EXCLUDE_CAT.test(r.cat)
  && r.nav > 0 && isRegularGrowth(r) && !EXCLUDE_NAME.test(r.name.replace(/\(existing number of segregated portfolios[^)]*\)/i, '')));

// one code per scheme: prefer the most recent NAV, then the lower (older) code
const latest = (r) => fromDdMonYyyy(r.date) || '';
const byScheme = new Map();
for (const r of candidates) {
  const k = `${r.amc}|${cleanName(r.name).toLowerCase()}`;
  const cur = byScheme.get(k);
  if (!cur || latest(r) > latest(cur) || (latest(r) === latest(cur) && +r.code < +cur.code)) byScheme.set(k, r);
}
const chosen = [...byScheme.values()];
console.log(`${candidates.length} regular-growth rows → ${chosen.length} schemes across ${new Set(chosen.map((r) => r.amc)).size} AMCs`);

// ---------------------------------------------------------------- NAV history
function adjustForSplits(series, label) {
  for (let i = series.length - 1; i > 0; i--) {
    const ratio = series[i][1] / series[i - 1][1];
    const pow = Math.round(Math.log10(ratio));
    if (pow !== 0 && Math.abs(ratio / 10 ** pow - 1) < 0.05) {
      console.log(`  split adjusted: ${label} on ${series[i][0]} (x${10 ** pow})`);
      for (let j = 0; j < i; j++) series[j][1] = +(series[j][1] * 10 ** pow).toFixed(4);
    }
  }
  return series;
}
function trailing(series, years) {
  const last = series[series.length - 1];
  const target = new Date(last[0]);
  target.setFullYear(target.getFullYear() - years);
  const t = target.toISOString().slice(0, 10);
  if (series[0][0] > t) return null;
  let past = null;
  for (const p of series) { if (p[0] <= t) past = p; else break; }
  const v = years === 1 ? last[1] / past[1] - 1 : Math.pow(last[1] / past[1], 1 / years) - 1;
  return Math.round(v * 10000) / 100;
}
function thin(series) {
  const dailyFrom = new Date(); dailyFrom.setDate(dailyFrom.getDate() - DAILY_DAYS);
  const cut = dailyFrom.toISOString().slice(0, 10);
  const from = new Date(); from.setDate(from.getDate() - Math.round(YEARS_OF_HISTORY * 365));
  const start = from.toISOString().slice(0, 10);
  const out = [];
  let lastWeek = null;
  for (let i = series.length - 1; i >= 0; i--) { // newest → oldest; keep the last trading day of each week
    const p = series[i];
    if (p[0] < start) break;
    if (p[0] >= cut) { out.push(p); continue; }
    const d = new Date(p[0]);
    const week = Math.floor((d.getTime() / 86400000 + 3) / 7);
    if (week !== lastWeek) { out.push(p); lastWeek = week; }
  }
  return out.reverse();
}
async function history(code) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const r = await fetch(`https://api.mfapi.in/mf/${code}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return (await r.json()).data || [];
    } catch (e) {
      if (attempt === 4) throw e;
      await new Promise((res) => setTimeout(res, 1500 * attempt));
    }
  }
}

const results = new Array(chosen.length);
let next = 0;
let done = 0;
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (next < chosen.length) {
    const i = next++;
    const r = chosen[i];
    try {
      const data = await history(r.code);
      const full = adjustForSplits(data.map((p) => [fromDdMmYyyy(p.date), +(+p.nav).toFixed(4)]).filter((p) => p[1] > 0)
        .sort((a, b) => (a[0] < b[0] ? -1 : 1)), r.name);
      if (!full.length) throw new Error('no NAV history');
      const c = classify(r.cat, r.name);
      const m = master.get(r.code) || {};
      results[i] = {
        code: r.code, isin: r.isin && r.isin.trim().length === 12 ? r.isin.trim() : null,
        name: `${cleanName(r.name)} - Regular Plan - Growth`, amc: r.amc, amfiCategory: r.cat,
        category: c.cls, subCategory: c.sub, risk: c.risk,
        nav: r.nav, navDate: fromDdMonYyyy(r.date),
        return1y: trailing(full, 1), return3y: trailing(full, 3), return5y: trailing(full, 5), return10y: trailing(full, 10),
        launchDate: m.launch || null, minAmount: m.minAmount || null, navDataSince: full[0][0],
        aliases: [], history: thin(full),
      };
    } catch (e) {
      console.log(`  skipped ${r.code} ${r.name}: ${e.message}`);
    }
    if (++done % 50 === 0) console.log(`  ${done}/${chosen.length} histories`);
  }
}));
const schemes = results.filter(Boolean).sort((a, b) => AMCS.findIndex((x) => x.name === a.amc) - AMCS.findIndex((x) => x.name === b.amc)
  || a.category.localeCompare(b.category) || a.subCategory.localeCompare(b.subCategory) || a.name.localeCompare(b.name));

for (const [alias, [amcName, catRe, nameRe]] of Object.entries(ALIASES)) {
  const s = schemes.filter((x) => x.amc === amcName && catRe.test(x.amfiCategory) && (!nameRe || nameRe.test(x.name)))
    .sort((a, b) => a.name.length - b.name.length)[0];
  if (s) s.aliases.push(alias);
  else console.log(`  WARNING: no scheme for demo alias "${alias}"`);
}

fs.writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), sources: ['https://www.amfiindia.com/spages/NAVAll.txt', 'https://portal.amfiindia.com/DownloadSchemeData_Po.aspx?mf=0', 'https://api.mfapi.in/mf/{code}'], amcs: AMCS, schemes }));
const perAmc = AMCS.map((a) => `${a.name.replace(' Mutual Fund', '')}: ${schemes.filter((s) => s.amc === a.name).length}`).join(', ');
console.log(`\n${schemes.length} schemes -> ${OUT} (${(fs.statSync(OUT).size / 1024 / 1024).toFixed(2)} MB)\n${perAmc}`);
