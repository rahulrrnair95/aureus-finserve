// Search-focused titles, shared by the app (useTitle, Home) and the static build (scripts/seo.mjs),
// so the title Google sees in the HTML is the same one the page sets after it loads. Plain JS: no JSX or imports.

const SITE = 'Aureus Finserve';

export const HOME_TITLE = `Mutual Funds & SIP Investment in Trivandrum | ${SITE}`;

/** Exact-path titles (without the "| Aureus Finserve" suffix). Pages not listed keep their own heading as title. */
export const SEO_TITLES = {
  '/about': 'About Us – Mutual Fund Distributor in Thiruvananthapuram',
  '/services': 'Mutual Fund Services – SIP, ELSS, Retirement & NRI',
  '/services/sip': 'Start a SIP in Trivandrum – SIP Investment Plans',
  '/services/lump-sum': 'Lump Sum Mutual Fund Investment',
  '/services/tax-saving-elss': 'ELSS Tax Saving Mutual Funds (Section 80C)',
  '/services/retirement': 'Retirement Planning with Mutual Funds',
  '/services/child-education': 'Child Education Planning with Mutual Funds',
  '/services/regular-income-swp': 'SWP – Monthly Income from Mutual Funds',
  '/services/nri': 'Mutual Fund Investment for NRIs from Kerala',
  '/services/portfolio-review': 'Mutual Fund Portfolio Review',
  '/amc-partners': 'Mutual Fund Houses (AMCs) We Distribute',
  '/funds': 'Mutual Fund NAV & Returns – Explore All Schemes',
  '/nfo': 'Mutual Fund NFOs – New Fund Offers Open Now',
  '/calculators': 'Mutual Fund & SIP Calculators',
  '/calculators/sip': 'SIP Calculator – Calculate SIP Returns Online',
  '/calculators/lump-sum': 'Lumpsum Calculator – Mutual Fund Returns',
  '/calculators/step-up-sip': 'Step-up SIP Calculator (Top-up SIP)',
  '/calculators/goal': 'Goal Planning SIP Calculator',
  '/calculators/retirement': 'Retirement Calculator – Corpus & SIP Needed',
  '/calculators/swp': 'SWP Calculator – Systematic Withdrawal Plan',
  '/calculators/elss': 'ELSS Tax Saving Calculator (Section 80C)',
  '/calculators/cost-of-delay': 'SIP Cost of Delay Calculator',
  '/learn': 'Learn Mutual Funds – Articles, FAQs & Glossary',
  '/contact': 'Contact Us – Mutual Fund Distributor in Trivandrum',
};

/** Full document title for a path; `title` is the page's own heading (null on the home page). */
export function seoTitle(pathname, title) {
  const p = String(pathname || '/').replace(/\/+$/, '') || '/';
  if (p === '/') return HOME_TITLE;
  if (SEO_TITLES[p]) return `${SEO_TITLES[p]} | ${SITE}`;
  if (title && /^\/funds\/\d+$/.test(p)) return `${title.replace(/\s*-\s*Regular Plan\s*-\s*Growth$/i, '')} – NAV & Returns | ${SITE}`;
  return title ? `${title} | ${SITE}` : HOME_TITLE;
}

