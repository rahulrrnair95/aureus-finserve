// Turns the `vite build --mode demo` output into the shareable preview: a small HTML page plus app.js
// (the app bundle with its sample data), both written to ../artifact/.
import fs from 'fs';
import path from 'path';

const dist = path.resolve('dist-demo');
const outDir = path.resolve('..', 'artifact');
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const js = [...html.matchAll(/<script[^>]+src="\.\/([^"]+)"/g)].map((m) => fs.readFileSync(path.join(dist, m[1]), 'utf8'));
const css = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="\.\/([^"]+)"/g)].map((m) => fs.readFileSync(path.join(dist, m[1]), 'utf8'));
const fonts = html.match(/<link[^>]+href="https:\/\/fonts\.googleapis\.com\/css2[^"]+"[^>]*>/s)?.[0] || '';

const page = `<title>Aureus Finserve</title>
<meta name="description" content="Aureus Finserve — AMFI-registered Mutual Fund Distributor. Wealth Beyond Today.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${fonts.replace(/\s+/g, ' ')}
<style>
${css.join('\n')}
</style>
<div id="root"></div>
<script type="module" src="app.js"></script>
`;

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'aureus-finserve.html'), page);
fs.writeFileSync(path.join(outDir, 'app.js'), js.join('\n'));
console.log(`wrote ${outDir}: aureus-finserve.html (${(page.length / 1024).toFixed(0)} KB) + app.js (${(js.join('').length / 1024 / 1024).toFixed(2)} MB)`);
