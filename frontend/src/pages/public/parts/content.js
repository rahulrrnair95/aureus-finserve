// Static public-site content shared by Home, Services, ServiceDetail and Contact.

export const INTEREST_OPTIONS = [
  { value: 'SIP', label: 'Systematic Investment Plan (SIP)' },
  { value: 'LUMPSUM', label: 'Lump sum investment' },
  { value: 'ELSS', label: 'Tax-saving funds (ELSS)' },
  { value: 'RETIREMENT', label: 'Retirement planning' },
  { value: 'CHILD_EDUCATION', label: 'Child education planning' },
  { value: 'NRI', label: 'NRI investments' },
  { value: 'PORTFOLIO_REVIEW', label: 'Portfolio review' },
  { value: 'OTHER', label: 'Something else' },
];

export const interestLabel = (v) => INTEREST_OPTIONS.find((o) => o.value === v)?.label || v;

/** Per-service presentation metadata keyed by /public/services slug (fallback copy if the API is unavailable). */
export const SERVICE_META = {
  sip: { interest: 'SIP', icon: 'repeat', title: 'Systematic Investment Plans', short: 'Invest a fixed amount every month and build wealth with discipline.' },
  'lump-sum': { interest: 'LUMPSUM', icon: 'rupee', title: 'Lump sum investments', short: 'Put a bonus or surplus savings to work in one considered investment.' },
  'tax-saving-elss': { interest: 'ELSS', icon: 'shield', title: 'Tax-saving funds (ELSS)', short: 'Equity Linked Savings Schemes with a three-year lock-in, eligible under Section 80C (old regime).' },
  retirement: { interest: 'RETIREMENT', icon: 'sun', title: 'Retirement planning', short: 'Estimate the corpus you may need and work towards it steadily.' },
  'child-education': { interest: 'CHILD_EDUCATION', icon: 'graduation', title: 'Child education planning', short: 'Plan for school, college or overseas study with goal-linked investing.' },
  'regular-income-swp': { interest: 'OTHER', icon: 'layers', title: 'Regular income (SWP)', short: 'Draw a regular cash flow from your investments through a systematic withdrawal plan.' },
  nri: { interest: 'NRI', icon: 'globe', title: 'NRI investments', short: 'Invest in Indian mutual funds from abroad, subject to scheme eligibility.' },
  'portfolio-review': { interest: 'PORTFOLIO_REVIEW', icon: 'file', title: 'Portfolio review', short: 'Share your CAS and our team will walk you through your existing portfolio.' },
};

/** The six services featured on the home page, in order. */
export const HOME_SERVICE_SLUGS = ['sip', 'lump-sum', 'tax-saving-elss', 'retirement', 'child-education', 'nri'];

export const ICON_NAMES = new Set(['repeat', 'rupee', 'shield', 'sun', 'graduation', 'layers', 'globe', 'file', 'chart', 'target', 'pie', 'briefcase', 'users', 'calc', 'leaf', 'clock', 'book', 'home', 'family']);

export const serviceIcon = (s) => (s?.icon && ICON_NAMES.has(s.icon) ? s.icon : SERVICE_META[s?.slug]?.icon || 'briefcase');

export const HOME_FALLBACK = {
  hero: {
    headline: 'Grow your wealth with the right mutual funds',
    subline: 'Aureus Finserve helps families invest in mutual funds with clarity — from a first SIP to planning for retirement — with a dedicated relationship manager and one secure dashboard.',
    primaryCtaLabel: 'Book a free consultation',
    secondaryCtaLabel: 'Calculate your SIP',
  },
  whyChooseUs: [
    { title: 'AMFI-registered', text: 'A registered mutual fund distributor, following AMFI’s code of conduct.' },
    { title: 'Dedicated relationship manager', text: 'One point of contact who knows your family’s goals.' },
    { title: 'One dashboard for all your funds', text: 'Track every folio, SIP and goal in a single secure place.' },
    { title: 'Paperless investing', text: 'Online KYC, mandates and transactions — no forms to courier.' },
  ],
  howItWorks: [
    { step: 1, title: 'Talk to us', text: 'Share your goals and time horizon with our team.' },
    { step: 2, title: 'Complete KYC', text: 'A quick, paperless KYC and bank mandate set-up.' },
    { step: 3, title: 'Start investing and track online', text: 'Invest in schemes you choose and follow progress in your dashboard.' },
  ],
  sections: { trust: true, services: true, why: true, how: true, calculator: true, amcs: true, testimonials: true, articles: true },
};

export const initials = (name) =>
  String(name || '')
    .split(/\s+/)
    // "Mohan and Mini" -> "MM", not "MA"
    .filter((w) => /^[\p{L}\p{N}]/u.test(w) && !/^and$/i.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

export const CONSENT_TEXT =
  'I authorise Aureus Finserve and its representatives to contact me by call, SMS, WhatsApp or email about my enquiry, even if my number is registered on the DND / NCPR list.';

export const MOBILE_RE = /^[6-9]\d{9}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
