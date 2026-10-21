// Adds scheme details to backend/src/main/resources/seed/schemes.json (run after build-scheme-seed.mjs):
//  - risk-o-meter level, benchmark, fund size (AUM, all plans): AMFI daily disclosures
//  - expense ratio (Regular plan TER): daily TER filings on AMFI
//  - fund managers, benchmark, exit load, objective, minimum amounts, allotment date: AMFI Scheme Summary Documents
// compiled by TigZig (https://www.tigzig.com/apis/mf-nav, free to use with attribution), keyed by AMFI scheme code.
// Usage: node tools/enrich-scheme-details.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(here, '..', 'backend', 'src', 'main', 'resources', 'seed', 'schemes.json');
const API = 'https://api.tigzig.com/mf/v1/details?schemes=';
const BATCH = 50; // API maximum per call

const RISK = {
  'low': 'LOW', 'low to moderate': 'LOW_TO_MODERATE', 'moderate': 'MODERATE',
  'moderately high': 'MODERATELY_HIGH', 'high': 'HIGH', 'very high': 'VERY_HIGH',
};
const toRisk = (s) => RISK[(s || '').toLowerCase().replace(/\s*risk\s*$/, '').replace(/\s+/g, ' ').trim()] || null;
const clean = (s) => (s || '').replace(/\s+/g, ' ').trim() || null;
const cap = (s, n) => (s && s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s);
const rupees = (s) => {
  const m = /(?:Rs\.?|₹|INR)\s*([\d,]+(?:\.\d+)?)/i.exec(s || '') || /^\s*([\d,]+)\s*$/.exec(s || '');
  const v = m ? Math.round(+m[1].replace(/,/g, '')) : null;
  return v && v >= 1 && v <= 1000000 ? v : null;
};
// minimum monthly SIP from the SSD "terms_sip" text, e.g. "Minimum amount: For SIP DSIP, WSIP, MSIP - Rs. 100; QSIP - Rs. 1500"
// AMCs word this differently, e.g. "MSIP - Rs. 100", "SIP - D-500/W-500/M-500", "Monthly 1000.00",
// "SIP - 100/500", "SIP - Minimum amount: 1000", "MinimumAmount: Rs.500.00", "Minimum amount: 100".
function minSip(text) {
  if (!text) return null;
  const seg = (text.split('|').find((p) => /minimum amount/i.test(p)) || text).replace(/\s+/g, ' ');
  const NUM = '(?:Rs\\.?|₹|INR)?\\s*([\\d,]+(?:\\.\\d+)?)';
  const patterns = [
    new RegExp(`MSIP[^\\d;|]{0,20}?${NUM}`, 'i'),
    new RegExp(`\\bM\\s*-\\s*${NUM}`),
    new RegExp(`Monthly(?:\\s*SIP)?\\s*[-:]?\\s*${NUM}`, 'i'),
    new RegExp(`SIP[^\\d;|]{0,40}?${NUM}`, 'i'),
    new RegExp(`Minimum\\s*amount\\s*:?[^\\d;|]{0,30}?${NUM}`, 'i'),
  ];
  for (const re of patterns) {
    const m = re.exec(seg);
    const v = m ? Math.round(+m[1].replace(/,/g, '')) : null;
    if (v && v >= 50 && v <= 100000) return v;
  }
  return null;
}
function managers(list) {
  if (!Array.isArray(list) || !list.length) return null;
  // scheme managers first, then dedicated overseas / commodity / debt managers
  const rank = (m) => (/overseas|foreign|gold|silver|commodit|debt|arbitrage|dedicated/i.test(m.role || '') ? 1 : 0);
  const names = [...new Set([...list].sort((a, b) => rank(a) - rank(b)).map((m) => clean(m.name)).filter(Boolean))];
  return cap(names.join(', '), 150);
}

const seed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const byCode = new Map(seed.schemes.map((s) => [String(s.code), s]));
const codes = [...byCode.keys()];
let found = 0;
const stats = { risk: 0, expenseRatio: 0, aumCr: 0, fundManager: 0, benchmark: 0, exitLoad: 0, objective: 0, minSip: 0, minLumpsum: 0 };

for (let i = 0; i < codes.length; i += BATCH) {
  const batch = codes.slice(i, i + BATCH);
  let json;
  for (let attempt = 1; ; attempt++) {
    try {
      const r = await fetch(API + batch.join(','));
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      json = await r.json();
      break;
    } catch (e) {
      if (attempt >= 4) throw e;
      await new Promise((res) => setTimeout(res, 2000 * attempt));
    }
  }
  for (const d of json.data || []) {
    const s = byCode.get(String(d.scheme_code));
    if (!s) continue;
    found++;
    const daily = d.amfi_daily || {};
    const ssd = d.ssd || {};
    const ter = d.ter || {};
    const det = {
      risk: toRisk(daily.riskometer) || toRisk(ssd.riskometer_level) || toRisk(ssd.riskometer),
      expenseRatio: typeof ter.regular === 'number' ? ter.regular : null,
      terDate: ter.date || null,
      aumCr: typeof daily.fund_aum_cr_all_plans === 'number' ? Math.round(daily.fund_aum_cr_all_plans * 100) / 100 : null,
      aumDate: daily.aum_date || null,
      fundManager: managers(ssd.fund_managers),
      benchmark: cap(clean(ssd.benchmark_tier1_std || daily.benchmark || ssd.benchmark_tier1_filed), 150),
      exitLoad: cap(clean(ssd.exit_load), 1000),
      objective: cap(clean(ssd.objective), 2000),
      minSip: minSip(ssd.terms_sip),
      minLumpsum: rupees(ssd.min_application_amount),
      allotmentDate: ssd.allotment_date ? ssd.allotment_date.slice(0, 10) : null,
      ssdDate: ssd.doc_date ? ssd.doc_date.slice(0, 10) : null,
    };
    for (const k of Object.keys(stats)) if (det[k] != null) stats[k]++;
    s.details = det;
  }
  console.log(`  ${Math.min(i + BATCH, codes.length)}/${codes.length}`);
}

seed.detailsSource = 'AMFI daily disclosures, TER filings and Scheme Summary Documents (compiled by TigZig, https://www.tigzig.com/apis/mf-nav)';
seed.detailsFetchedAt = new Date().toISOString();
fs.writeFileSync(FILE, JSON.stringify(seed));
console.log(`\ndetails found for ${found}/${codes.length} schemes`);
console.log(Object.entries(stats).map(([k, v]) => `${k}: ${v}`).join(', '));
