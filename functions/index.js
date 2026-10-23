// Cloud Functions for the Firebase-hosted website. Data is kept in Firestore (collection "market").
//
// sensexDaily  every weekday at 17:00 IST: latest BSE Sensex close            -> market/sensex
// navNightly   every day at 23:30 IST (after AMFI publishes): NAVs + returns -> market/navs
// navMorning   every day at 07:00 IST: retry, in case AMFI published late
// market       serves /market/sensex and /market/navs to the site (Hosting rewrites, cached by the CDN)
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { buildNavs } from './navs.js';
import { buildSensex } from './sensex.js';

initializeApp();
const REGION = 'asia-south1';
const TZ = 'Asia/Kolkata';
// the published site's scheme list decides which NAVs are tracked
const SCHEMES_URL = 'https://aureus-finserve.web.app/static-api/schemes.json';
const doc = (id) => getFirestore().doc(`market/${id}`);

async function refreshSensex() {
  const snap = await doc('sensex').get();
  const { data, changed } = await buildSensex(snap.exists ? snap.data() : null);
  if (changed) await doc('sensex').set(data);
  logger.info(changed ? 'Sensex updated' : 'Sensex unchanged', { asOf: data.asOf, close: data.close });
  return data;
}

async function refreshNavs() {
  const r = await fetch(SCHEMES_URL);
  if (!r.ok) throw new Error(`scheme list: HTTP ${r.status}`);
  const codes = (await r.json()).map((s) => s.code).filter(Boolean);
  const snap = await doc('navs').get();
  const { data, changed } = await buildNavs(codes, snap.exists ? snap.data() : null, (m) => logger.warn(m));
  if (changed) await doc('navs').set(data);
  logger.info(changed ? 'NAVs updated' : 'NAVs unchanged', { asOf: data.asOf, schemes: Object.keys(data.navs).length });
  return data;
}

export const sensexDaily = onSchedule({ schedule: '0 17 * * 1-5', timeZone: TZ, region: REGION, retryCount: 3, memory: '256MiB' }, async () => {
  await refreshSensex();
});

const navJob = { timeZone: TZ, region: REGION, retryCount: 2, memory: '512MiB', timeoutSeconds: 540 };
export const navNightly = onSchedule({ ...navJob, schedule: '30 23 * * *' }, async () => {
  await refreshNavs();
});
export const navMorning = onSchedule({ ...navJob, schedule: '0 7 * * *' }, async () => {
  await refreshNavs();
});

export const market = onRequest({ region: REGION, memory: '512MiB', timeoutSeconds: 300, maxInstances: 2 }, async (req, res) => {
  const which = req.path.endsWith('/navs') ? 'navs' : req.path.endsWith('/sensex') ? 'sensex' : null;
  if (!which) {
    res.status(404).set('Cache-Control', 'no-store').json({ error: 'not found' });
    return;
  }
  try {
    const snap = await doc(which).get();
    // first request after deploying, before the schedule has run: fetch once now
    const data = snap.exists ? snap.data() : await (which === 'navs' ? refreshNavs() : refreshSensex());
    const { refs, ...pub } = data; // refs is an internal cache (NAV reference points), not for browsers
    res.set('Cache-Control', 'public, max-age=300, s-maxage=1800').json(pub);
  } catch (e) {
    logger.error(`market/${which} failed`, e);
    res.status(503).set('Cache-Control', 'no-store').json({ error: 'unavailable' });
  }
});
