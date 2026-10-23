// Cloud Functions for the Firebase-hosted website.
//
// sensexDaily  every weekday at 17:00 IST, saves the latest BSE Sensex close to Firestore (market/sensex)
// sensex       serves that document at https://<site>/market/sensex (Hosting rewrite, cached by the CDN)
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { buildSensex } from './sensex.js';

initializeApp();
const REGION = 'asia-south1';
const sensexDoc = () => getFirestore().doc('market/sensex');

async function refresh() {
  const snap = await sensexDoc().get();
  const { data, changed } = await buildSensex(snap.exists ? snap.data() : null);
  if (changed) await sensexDoc().set(data);
  logger.info(changed ? 'Sensex updated' : 'Sensex unchanged', { asOf: data.asOf, close: data.close });
  return data;
}

export const sensexDaily = onSchedule(
  { schedule: '0 17 * * 1-5', timeZone: 'Asia/Kolkata', region: REGION, retryCount: 3, memory: '256MiB' },
  async () => {
    await refresh();
  }
);

export const sensex = onRequest({ region: REGION, memory: '256MiB', maxInstances: 2 }, async (req, res) => {
  try {
    const snap = await sensexDoc().get();
    // first request after deploying, before the schedule has run: fetch once now
    const data = snap.exists ? snap.data() : await refresh();
    res.set('Cache-Control', 'public, max-age=300, s-maxage=1800').json(data);
  } catch (e) {
    logger.error('Sensex read failed', e);
    res.set('Cache-Control', 'no-store').status(503).json({ error: 'unavailable' });
  }
});
