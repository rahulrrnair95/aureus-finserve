import { useEffect, useState } from 'react';

// BSE Sensex calendar year-end closing values (rounded to the nearest point). Price index, dividends not included.
// Later years come in automatically from /market/sensex.json (see scripts/update-sensex.mjs).
export const SENSEX_YEAR_END = [
  { year: 1990, close: 1048 },
  { year: 1991, close: 1909 },
  { year: 1992, close: 2615 },
  { year: 1993, close: 3346 },
  { year: 1994, close: 3927 },
  { year: 1995, close: 3110 },
  { year: 1996, close: 3085 },
  { year: 1997, close: 3659 },
  { year: 1998, close: 3055 },
  { year: 1999, close: 5005 },
  { year: 2000, close: 3972 },
  { year: 2001, close: 3262 },
  { year: 2002, close: 3377 },
  { year: 2003, close: 5839 },
  { year: 2004, close: 6603 },
  { year: 2005, close: 9398 },
  { year: 2006, close: 13787 },
  { year: 2007, close: 20287 },
  { year: 2008, close: 9647 },
  { year: 2009, close: 17465 },
  { year: 2010, close: 20509 },
  { year: 2011, close: 15455 },
  { year: 2012, close: 19427 },
  { year: 2013, close: 21171 },
  { year: 2014, close: 27499 },
  { year: 2015, close: 26118 },
  { year: 2016, close: 26626 },
  { year: 2017, close: 34057 },
  { year: 2018, close: 36068 },
  { year: 2019, close: 41254 },
  { year: 2020, close: 47751 },
  { year: 2021, close: 58254 },
  { year: 2022, close: 60841 },
  { year: 2023, close: 72240 },
  { year: 2024, close: 78139 },
  { year: 2025, close: 85221 },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2026-10-23" → "23 Oct 2026" */
export const formatAsOf = (iso) => {
  const [y, m, d] = String(iso).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};

const getLatest = (url) =>
  fetch(url, { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => (j && Number.isFinite(j.close) && /^\d{4}-\d{2}-\d{2}$/.test(j.asOf) ? j : null))
    .catch(() => null);

let latestPromise;
/**
 * Latest daily close: the Firebase function /market/sensex (updated every weekday after market close), else the copy
 * baked into the build (/market/sensex.json, from scripts/update-sensex.mjs); null when neither is available.
 */
function loadLatest() {
  latestPromise ??= getLatest('/market/sensex').then((j) => j || getLatest('/market/sensex.json'));
  return latestPromise;
}

export function useSensexLatest() {
  const [latest, setLatest] = useState(null);
  useEffect(() => {
    let live = true;
    loadLatest().then((j) => live && setLatest(j));
    return () => {
      live = false;
    };
  }, []);
  return latest;
}

/**
 * Chart points: year-end closes (built-in list plus any newer years in the daily file), then the latest close for the
 * current year. Each point has `t`, its time in years (a year-end close is at year + 1), used for growth rates.
 */
export function sensexSeries(latest) {
  const byYear = new Map(SENSEX_YEAR_END.map((d) => [d.year, d.close]));
  if (latest?.yearEnd) {
    for (const [y, c] of Object.entries(latest.yearEnd)) if (!byYear.has(Number(y)) && Number.isFinite(c)) byYear.set(Number(y), Math.round(c));
  }
  const points = [...byYear.entries()].sort((a, b) => a[0] - b[0]).map(([year, close]) => ({ year, close, t: year + 1, label: `${year} year-end` }));
  if (latest) {
    const [y, m, d] = latest.asOf.split('-').map(Number);
    if (y > points[points.length - 1].year) {
      const dayOfYear = (Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86400000;
      points.push({ year: y, close: Math.round(latest.close), t: y + dayOfYear / 365.25, label: formatAsOf(latest.asOf), partial: true });
    }
  }
  return points;
}
