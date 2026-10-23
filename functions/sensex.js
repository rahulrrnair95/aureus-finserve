// BSE Sensex end-of-day data: latest close, previous close and calendar year-end closes.
// Shared by the Cloud Functions in index.js and frontend/scripts/update-sensex.mjs (the copy baked into each build).
//
// Source: Yahoo Finance chart data for ^BSESN. Only closes of finished sessions are kept, never intraday prices.

const URL = 'https://query1.finance.yahoo.com/v8/finance/chart/%5EBSESN?range=2y&interval=1d';

async function fetchCloses() {
  const r = await fetch(URL, { headers: { 'User-Agent': 'Mozilla/5.0 (aureus-finserve sensex updater)', Accept: 'application/json' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const res = (await r.json())?.chart?.result?.[0];
  const ts = res?.timestamp;
  const close = res?.indicators?.quote?.[0]?.close;
  if (!Array.isArray(ts) || !Array.isArray(close)) throw new Error('unexpected response shape');
  const meta = res.meta || {};
  const offset = Number(meta.gmtoffset) || 19800; // IST
  const day = (t) => new Date((t + offset) * 1000).toISOString().slice(0, 10);
  const rows = ts.map((t, i) => ({ date: day(t), close: close[i] })).filter((d) => typeof d.close === 'number' && Number.isFinite(d.close));
  // the daily series can lag a day behind; take today's close from the summary, but only once the session has ended
  const mt = Number(meta.regularMarketTime);
  const sessionEnd = Number(meta.currentTradingPeriod?.regular?.end);
  if (Number.isFinite(mt) && Number.isFinite(meta.regularMarketPrice) && Number.isFinite(sessionEnd) && mt >= sessionEnd) {
    const d = day(mt);
    if (!rows.length || d > rows[rows.length - 1].date) rows.push({ date: d, close: meta.regularMarketPrice });
    else if (d === rows[rows.length - 1].date) rows[rows.length - 1].close = meta.regularMarketPrice;
  }
  // a still-open session's bar is not a close
  if (Number.isFinite(sessionEnd) && Number.isFinite(mt) && mt < sessionEnd && rows.length && rows[rows.length - 1].date === day(mt)) rows.pop();
  return rows;
}

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Downloads the latest data and merges it with `prev` (the last saved result, or null).
 * Returns { data, changed }; throws on a failed or implausible download so bad data never replaces good data.
 */
export async function buildSensex(prev) {
  const rows = await fetchCloses();
  if (rows.length < 2) throw new Error('not enough data points');
  const last = rows[rows.length - 1];
  const before = rows[rows.length - 2];
  if (last.close < 10000 || last.close > 1000000) throw new Error(`implausible close ${last.close}`);
  if (Math.abs(last.close / before.close - 1) > 0.2) throw new Error(`implausible daily move ${before.close} -> ${last.close}`);

  // year-end closes for every completed calendar year in the data, merged into what we already had
  const yearEnd = { ...(prev?.yearEnd || {}) };
  const thisYear = Number(last.date.slice(0, 4));
  for (const d of rows) {
    const y = Number(d.date.slice(0, 4));
    if (y < thisYear) yearEnd[y] = round2(d.close);
  }

  const data = {
    index: 'BSE SENSEX',
    asOf: last.date,
    close: round2(last.close),
    prevClose: round2(before.close),
    changePct: round2((last.close / before.close - 1) * 100),
    yearEnd,
    source: 'Yahoo Finance (^BSESN), end of day',
    updatedAt: new Date().toISOString(),
  };
  // only the market data decides whether anything changed (updatedAt alone does not)
  const changed = !(prev && prev.asOf === data.asOf && prev.close === data.close && JSON.stringify(prev.yearEnd) === JSON.stringify(data.yearEnd));
  return { data, changed };
}
