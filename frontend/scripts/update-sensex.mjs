// Refreshes public/market/sensex.json, the copy of the latest BSE Sensex close baked into each build.
// The live site gets the daily value from the Firebase function at /market/sensex (functions/index.js); this file is the
// fallback when that is unavailable. `npm run build:static` runs this first.
//
// Usage: node scripts/update-sensex.mjs            keeps the previous file and exits 0 if the download fails
//        node scripts/update-sensex.mjs --strict   exits 1 on failure
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildSensex } from '../../functions/sensex.js';

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'market', 'sensex.json');
const strict = process.argv.includes('--strict');

function readPrevious() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return null;
  }
}

async function main() {
  const { data, changed } = await buildSensex(readPrevious());
  if (!changed) {
    console.log(`Sensex unchanged: ${data.close} on ${data.asOf}`);
    return;
  }
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`Sensex updated: ${data.close} on ${data.asOf} (${data.changePct >= 0 ? '+' : ''}${data.changePct}%)`);
}

main().catch((e) => {
  console.error(`Sensex update failed: ${e.message}${strict ? '' : ' (keeping the previous file)'}`);
  process.exit(strict ? 1 : 0);
});
