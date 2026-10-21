// Static build only: writes one HTML file per public page (with its own title, description, canonical URL, social
// preview tags and structured data), plus sitemap.xml and robots.txt. Firebase serves /about from about.html and
// /services/sip from services/sip.html (cleanUrls), so search engines get page-specific tags before any JS runs.
// Called from vite.config.js after the static bundle is written; reads the snapshot in static-data/.
import fs from 'fs';
import path from 'path';
import { seoTitle } from '../src/seoContent.js';

const ORIGIN = 'https://aureusfinserve.com';
const SITE = 'Aureus Finserve';
const CITY = 'Thiruvananthapuram (Trivandrum), Kerala';
const OG_IMAGE = `${ORIGIN}/brand/og-image.png`;

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clip = (s, n = 160) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length <= n ? t : `${t.slice(0, n - 1).replace(/\s+\S*$/, '')}…`;
};
const ld = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

function readJson(dir, file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  } catch {
    return fallback;
  }
}

/** "Mon-Sat, 9:30 AM - 6:00 PM ..." -> schema.org opening hours (falls back to Mon-Sat 09:30-18:00). */
function openingHours(text) {
  const m = /(\d{1,2}):(\d{2})\s*([AP]M)\s*-\s*(\d{1,2}):(\d{2})\s*([AP]M)/i.exec(text || '');
  const to24 = (h, min, ap) => `${String((Number(h) % 12) + (/p/i.test(ap) ? 12 : 0)).padStart(2, '0')}:${min}`;
  return {
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    opens: m ? to24(m[1], m[2], m[3]) : '09:30',
    closes: m ? to24(m[4], m[5], m[6]) : '18:00',
  };
}

function businessLd(site) {
  const phones = String(site.phone || '').split(',').map((p) => p.trim()).filter(Boolean);
  const addr = String(site.address || '');
  const pin = /\b(\d{6})\b/.exec(addr)?.[1];
  return {
    '@context': 'https://schema.org',
    '@type': 'FinancialService',
    '@id': `${ORIGIN}/#business`,
    name: site.firmName || SITE,
    slogan: site.tagline,
    description: `AMFI-registered mutual fund distributor (${site.arn}) in ${CITY}. SIP, lump sum, tax-saving ELSS, retirement and NRI investments in regular plans of mutual funds.`,
    url: ORIGIN,
    logo: `${ORIGIN}/brand/logo-full-navy.png`,
    image: OG_IMAGE,
    telephone: phones[0],
    email: site.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: addr.replace(/,?\s*Thiruvananthapuram.*$/i, ''),
      addressLocality: 'Thiruvananthapuram',
      addressRegion: 'Kerala',
      postalCode: pin,
      addressCountry: 'IN',
    },
    areaServed: ['Thiruvananthapuram', 'Kerala', 'India'],
    openingHoursSpecification: [openingHours(site.officeHours)],
    identifier: site.arn ? { '@type': 'PropertyValue', name: 'AMFI Registration Number (ARN)', value: site.arn } : undefined,
    founder: site.founder ? { '@type': 'Person', name: site.founder } : undefined,
  };
}

/** Every public page: { path, title, description, type?, ld? }. */
function pages(dir) {
  const site = readJson(dir, 'site.json', {});
  const team = readJson(dir, 'team.json', []);
  const founder = team.find((t) => t.isFounder)?.name;
  const biz = businessLd({ ...site, founder });
  const arn = site.arn ? ` (${site.arn})` : '';
  const list = [
    {
      path: '/',
      title: null,
      heading: readJson(dir, 'home.json', {}).hero?.headline || 'Grow your wealth with the right mutual funds',
      description: `${SITE} is an AMFI-registered mutual fund distributor${arn} in ${CITY}. Start a SIP, invest a lump sum, save tax with ELSS and plan retirement with personal service.`,
      ld: [
        biz,
        { '@context': 'https://schema.org', '@type': 'WebSite', '@id': `${ORIGIN}/#website`, name: SITE, alternateName: 'Aureus Finserve Mutual Funds', url: `${ORIGIN}/` },
      ],
    },
    { path: '/about', title: 'About us', description: `Meet ${SITE}${founder ? `, founded by ${founder}` : ''}: an AMFI-registered mutual fund distributor${arn} in ${CITY} helping individuals and families invest with clarity and discipline.` },
    { path: '/services', title: 'Services', description: `Mutual fund services from ${SITE}: SIP, lump sum, tax saving (ELSS), retirement, child education, regular income (SWP), NRI investments and portfolio review.` },
    { path: '/amc-partners', title: 'AMC partners', description: `Fund houses whose regular plan schemes ${SITE} distributes, with the number of schemes from each AMC.` },
    { path: '/funds', title: 'Fund explorer', description: 'Explore mutual fund schemes with latest NAVs, 1/3/5/10-year returns, risk-o-meter and expense ratios from AMFI data. Filter by AMC, category and risk.' },
    { path: '/nfo', title: 'New fund offers', description: 'Mutual fund NFOs that are open now or opening soon, with dates, minimum investment, risk-o-meter and scheme details.' },
    { path: '/calculators', title: 'Mutual fund calculators', description: 'Free SIP, lump sum, step-up SIP, goal, retirement, SWP, ELSS tax and cost-of-delay calculators. Illustrations only.' },
    { path: '/learn', title: 'Knowledge centre', description: 'Learn about mutual funds: articles on SIPs, ELSS, debt funds and the risk-o-meter, plus FAQs and a glossary of mutual fund terms.', html: faqHtml(readJson(dir, 'faqs.json', [])) },
    { path: '/contact', title: 'Contact us', description: `Contact ${SITE} in ${CITY}. ${site.phone ? `Call ${site.phone}` : 'Call us'}${site.officeHours ? `, ${site.officeHours}` : ''}.`, ld: [biz] },
  ];

  const calcs = [
    ['sip', 'SIP calculator', 'See how a monthly SIP could grow over time with this free SIP calculator.'],
    ['lump-sum', 'Lump sum calculator', 'Estimate the future value of a one-time mutual fund investment.'],
    ['step-up-sip', 'Step-up SIP calculator', 'Compare a SIP that rises every year with a flat SIP.'],
    ['goal', 'Goal calculator', 'Find the future cost of a goal and the SIP or lump sum it may need.'],
    ['retirement', 'Retirement calculator', 'Estimate the retirement corpus you may need and the monthly SIP to build it.'],
    ['swp', 'SWP calculator', 'Plan regular withdrawals (SWP) and see how long a corpus may last.'],
    ['elss', 'ELSS tax saving calculator', 'Estimate tax saved under Section 80C (old regime) by investing in ELSS.'],
    ['cost-of-delay', 'Cost of delay calculator', 'See what waiting a few months to start a SIP could cost.'],
  ];
  for (const [id, title, d] of calcs) list.push({ path: `/calculators/${id}`, title, description: `${d} Illustrative only.` });

  for (const f of safeList(path.join(dir, 'services'))) {
    const s = readJson(path.join(dir, 'services'), f, null);
    if (!s?.slug) continue;
    list.push({
      path: `/services/${s.slug}`,
      title: s.title,
      description: clip(`${s.shortText || ''} ${s.whatItIs || ''}`),
      html:
        (s.whatItIs ? `<h2>What it is</h2><p>${esc(s.whatItIs)}</p>` : '') +
        (s.whoItSuits ? `<h2>Who it suits</h2><p>${esc(s.whoItSuits)}</p>` : '') +
        (s.howItWorks?.length ? `<h2>How it works</h2><ol>${s.howItWorks.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : '') +
        faqHtml(s.faqs || []),
      ld: s.faqs?.length ? [faqLd(s.faqs)] : undefined,
    });
  }

  for (const a of readJson(dir, 'articles.json', [])) {
    if (!a.slug) continue;
    list.push({
      path: `/learn/articles/${a.slug}`,
      title: a.title,
      description: clip(a.summary),
      type: 'article',
      lastmod: a.publishedAt?.slice(0, 10),
      html: markdownHtml(readJson(path.join(dir, 'articles'), `${a.slug}.json`, {}).body),
      ld: [{ '@context': 'https://schema.org', '@type': 'Article', headline: a.title, description: clip(a.summary), datePublished: a.publishedAt, author: { '@type': 'Organization', name: SITE }, publisher: { '@id': `${ORIGIN}/#business` }, image: OG_IMAGE, mainEntityOfPage: `${ORIGIN}/learn/articles/${a.slug}` }],
    });
  }

  const legal = { disclaimer: 'Disclaimer', privacy: 'Privacy policy', terms: 'Terms of use', commission: 'Commission disclosure' };
  for (const [key, fallback] of Object.entries(legal)) {
    const p = readJson(path.join(dir, 'pages'), `${key}.json`, {});
    list.push({ path: `/legal/${key}`, title: p.title || fallback, description: clip(String(p.body || '').replace(/[#*_>`-]/g, ' ')) || `${fallback} of ${SITE}.` });
  }

  for (const s of readJson(dir, 'schemes.json', [])) {
    const name = String(s.name || '').replace(/ - Regular Plan - Growth$/, '');
    const nav = s.nav != null ? ` Latest NAV ₹${s.nav}${s.navDate ? ` (${s.navDate})` : ''}.` : '';
    list.push({
      path: `/funds/${s.id}`,
      title: s.name,
      description: clip(`${name}: ${s.subCategory || s.category || 'mutual fund'} scheme of ${s.amc}.${nav} Returns, risk-o-meter, expense ratio and fund details.`),
      lastmod: s.navDate,
    });
  }

  for (const n of readJson(dir, 'nfos.json', [])) {
    list.push({
      path: `/nfo/${n.id}`,
      title: `${n.schemeName} (NFO)`,
      description: clip(`New fund offer of ${n.amc}: ${n.schemeName}.${n.openDate ? ` Opens ${n.openDate}` : ''}${n.closeDate ? `, closes ${n.closeDate}` : ''}. ${n.subCategory || ''} scheme details and documents.`),
      noSitemap: n.status === 'CLOSED',
    });
  }
  return list;
}

function faqLd(faqs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } })),
  };
}

function faqHtml(faqs) {
  if (!faqs.length) return '';
  return `<h2>Frequently asked questions</h2>${faqs.map((f) => `<h3>${esc(f.question)}</h3><p>${esc(f.answer)}</p>`).join('')}`;
}

/** Just enough of the article markdown (## headings, - lists, paragraphs) for crawlers. */
function markdownHtml(md) {
  const inline = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, '$1');
  return String(md || '')
    .split(/\n{2,}/)
    .map((block) => {
      const b = block.trim();
      if (!b) return '';
      const h = /^(#{2,4})\s+(.*)$/.exec(b);
      if (h) return `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`;
      const lines = b.split('\n');
      if (lines.every((l) => /^\s*([-*]|\d+\.)\s+/.test(l))) return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*([-*]|\d+\.)\s+/, ''))}</li>`).join('')}</ul>`;
      return `<p>${inline(b.replace(/\n/g, ' '))}</p>`;
    })
    .join('');
}

const SECTIONS = { services: 'Services', calculators: 'Calculators', funds: 'Fund explorer', nfo: 'New fund offers', learn: 'Knowledge centre' };

function breadcrumbLd(p, name) {
  const parts = p.path.split('/').filter(Boolean);
  if (!parts.length) return null;
  const items = [{ name: 'Home', url: `${ORIGIN}/` }];
  if (parts.length > 1 && SECTIONS[parts[0]]) items.push({ name: SECTIONS[parts[0]], url: `${ORIGIN}/${parts[0]}` });
  items.push({ name, url: `${ORIGIN}${p.path}` });
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: it.url })),
  };
}

// Plain links to the main pages in the pre-rendered text (React replaces it all once the app starts).
const NAV = [
  ['/', 'Home'],
  ['/services/sip', 'Start a SIP'],
  ['/services/tax-saving-elss', 'ELSS tax saving'],
  ['/services/retirement', 'Retirement planning'],
  ['/services/nri', 'NRI investments'],
  ['/funds', 'Fund explorer'],
  ['/calculators/sip', 'SIP calculator'],
  ['/learn', 'Learn'],
  ['/about', 'About us'],
  ['/contact', 'Contact us'],
];

function safeList(dir) {
  try {
    return fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
}

// Which page component a URL renders and the snapshot files it reads first, so each HTML file can ask the browser to
// fetch them alongside the main script instead of one after another (page code, then data).
const PAGE_SRC = [
  [/^\/$/, 'Home'],
  [/^\/about$/, 'About'],
  [/^\/services$/, 'Services'],
  [/^\/services\//, 'ServiceDetail'],
  [/^\/amc-partners$/, 'AmcPartners'],
  [/^\/funds$/, 'FundExplorer'],
  [/^\/funds\//, 'SchemeDetail'],
  [/^\/nfo$/, 'Nfos'],
  [/^\/nfo\//, 'NfoDetail'],
  [/^\/calculators/, 'Calculators'],
  [/^\/learn$/, 'Knowledge'],
  [/^\/learn\/articles\//, 'Article'],
  [/^\/contact$/, 'Contact'],
  [/^\/legal\//, 'LegalPage'],
];
const PAGE_DATA = {
  '/': ['home.json', 'banners.json', 'services.json', 'amcs.json', 'nfos.json', 'testimonials.json', 'articles.json'],
  '/about': ['about.json', 'team.json'],
};

function preloads(p, chunks, entryFiles) {
  const name = PAGE_SRC.find(([re]) => re.test(p.path))?.[1];
  const files = new Set();
  const add = (key) => {
    const c = chunks[key];
    if (!c || files.has(c.file)) return;
    files.add(c.file);
    c.imports.forEach((f) => {
      const k = Object.keys(chunks).find((x) => chunks[x].file === f);
      if (k) add(k);
      else files.add(f);
    });
  };
  if (name) add(`src/pages/public/${name}.jsx`);
  return [
    ...[...files].filter((f) => !entryFiles.has(f)).map((f) => `<link rel="modulepreload" crossorigin href="/${f}" />`),
    ...['site.json', ...(PAGE_DATA[p.path] || [])].map((f) => `<link rel="preload" as="fetch" crossorigin href="/static-api/${f}" />`),
  ];
}

function render(template, p, chunks = {}) {
  const url = p.path === '/' ? `${ORIGIN}/` : `${ORIGIN}${p.path}`;
  const title = seoTitle(p.path, p.title);
  const desc = clip(p.description);
  const heading = p.heading || p.title || SITE;
  const crumbs = breadcrumbLd(p, p.title || SITE);
  // readable text for crawlers and for the moment before the scripts load
  const body =
    `<div class="seo-pre"><nav aria-label="Site">${NAV.map(([href, label]) => `<a href="${href}">${label}</a>`).join(' · ')}</nav>` +
    `<h1>${esc(heading)}</h1><p>${esc(p.description)}</p>${p.html || ''}</div>`;
  // files the template already loads (entry script and its modulepreloads)
  const entryFiles = new Set([...template.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map((m) => m[1]));
  const head = [
    ...preloads(p, chunks, entryFiles),
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:site_name" content="${SITE}" />`,
    `<meta property="og:type" content="${p.type || 'website'}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(desc)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${OG_IMAGE}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:locale" content="en_IN" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    ...[...(p.ld || []), crumbs].filter(Boolean).map(ld),
    '<style>.seo-pre{max-width:60rem;margin:0 auto;padding:1.5rem 1rem;font-family:Montserrat,system-ui,sans-serif;color:#0b2137;line-height:1.6}.seo-pre nav{font-size:.875rem}</style>',
  ].join('\n    ');
  return template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${esc(desc)}" />`)
    .replace('</head>', `    ${head}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${body}</div>`);
}

export function writeSeo(outDir, dataDir, chunks = {}) {
  const template = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
  const meta = readJson(dataDir, 'meta.json', {});
  const today = (meta.generatedAt || new Date().toISOString()).slice(0, 10);
  const list = pages(dataDir);
  for (const p of list) {
    const file = p.path === '/' ? 'index.html' : `${p.path.slice(1)}.html`;
    fs.mkdirSync(path.dirname(path.join(outDir, file)), { recursive: true });
    fs.writeFileSync(path.join(outDir, file), render(template, p, chunks));
  }
  const urls = list
    .filter((p) => !p.noSitemap)
    .map((p) => `  <url><loc>${p.path === '/' ? `${ORIGIN}/` : ORIGIN + p.path}</loc><lastmod>${p.lastmod || today}</lastmod></url>`);
  fs.writeFileSync(path.join(outDir, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);
  fs.writeFileSync(
    path.join(outDir, 'robots.txt'),
    ['User-agent: *', 'Allow: /', 'Disallow: /app', 'Disallow: /console', 'Disallow: /login', 'Disallow: /forgot-password', 'Disallow: /activate', '', `Sitemap: ${ORIGIN}/sitemap.xml`, ''].join('\n'),
  );
  return { pages: list.length, sitemap: urls.length };
}
