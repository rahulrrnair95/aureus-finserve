// Search-focused titles and local FAQs, shared by the app (useTitle, Home) and the static build (scripts/seo.mjs),
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

/** Shown on the home page and published as FAQPage structured data. */
export const LOCAL_FAQS = [
  {
    question: 'How do I start a SIP in Thiruvananthapuram?',
    answer:
      'Call or WhatsApp us, or visit our office at Pangode, Thirumala. You need a PAN, completed KYC and a bank account. Many schemes accept SIPs from Rs 500 a month, and we help you complete KYC and register the SIP online.',
  },
  {
    question: 'Is Aureus Finserve registered with AMFI?',
    answer: 'Yes. Aureus Finserve is an AMFI-registered mutual fund distributor (ARN-372611). We distribute regular plans of mutual funds and do not provide investment advice.',
  },
  {
    question: 'Do I pay a fee to invest in mutual funds through you?',
    answer:
      'We do not charge you a separate fee. As a distributor we receive commission from the fund houses, which is part of the scheme’s expense ratio; regular plans have a higher expense ratio than direct plans. Details are in our commission disclosure.',
  },
  {
    question: 'Which areas do you serve?',
    answer:
      'We meet clients across Thiruvananthapuram (Trivandrum), including Thirumala, Pangode, Poojappura, Peroorkada, Vattiyoorkavu, Sasthamangalam and Kowdiar, and serve investors in the rest of Kerala, India and NRIs online.',
  },
  {
    question: 'Can NRIs from Kerala invest in mutual funds through you?',
    answer: 'Yes. NRIs can invest through NRE or NRO accounts in most schemes, subject to each fund house’s rules; some AMCs restrict investors resident in the US and Canada.',
  },
];
