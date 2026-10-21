// Generates the Postman collection + environments for the Aureus Finserve API (docs/API.md).
// Usage: node docs/postman/build-collection.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------- helpers
const url = (p, query = []) => {
  const [pathPart] = p.split('?');
  return {
    raw: '{{baseUrl}}' + p,
    host: ['{{baseUrl}}'],
    path: pathPart.replace(/^\//, '').split('/'),
    ...(query.length ? { query: query.map(([key, value, disabled]) => ({ key, value, ...(disabled ? { disabled: true } : {}) })) } : {}),
  };
};
const json = (obj) => ({ mode: 'raw', raw: JSON.stringify(obj, null, 2), options: { raw: { language: 'json' } } });
const form = (fields) => ({ mode: 'formdata', formdata: fields.map(([key, value, type = 'text']) => (type === 'file' ? { key, type: 'file', src: value } : { key, value, type: 'text' })) });
const test = (lines) => [{ listen: 'test', script: { type: 'text/javascript', exec: lines } }];

function req(name, method, p, { query = [], body, desc, events, noAuth } = {}) {
  return {
    name,
    ...(events ? { event: events } : {}),
    request: {
      method,
      ...(noAuth ? { auth: { type: 'noauth' } } : {}),
      header: body && body.mode === 'raw' ? [{ key: 'Content-Type', value: 'application/json' }] : [],
      url: url(p, query),
      ...(body ? { body } : {}),
      ...(desc ? { description: desc } : {}),
    },
    response: [],
  };
}
const folder = (name, items, description) => ({ name, ...(description ? { description } : {}), item: items });

// test scripts that carry the OTP flow forward
const saveChallenge = test([
  'const j = pm.response.json();',
  "if (j.challengeId) pm.collectionVariables.set('challengeId', j.challengeId);",
  "if (j.devOtp) pm.collectionVariables.set('otp', j.devOtp);",
  "if (j.token) pm.collectionVariables.set('token', j.token);",
  "pm.test('status 2xx', () => pm.response.to.be.success);",
]);
const saveToken = test([
  'const j = pm.response.json();',
  "if (j.token) { pm.collectionVariables.set('token', j.token); console.log('Logged in as', j.user && j.user.name); }",
  "pm.test('logged in', () => pm.expect(j.status).to.eql('OK'));",
]);

// ---------------------------------------------------------------- 0. quick login
const quickLogin = folder('0. Log in (run these first)', [
  req('Log in - step 1: password', 'POST', '/api/auth/login', {
    noAuth: true, events: saveChallenge,
    body: json({ userId: '{{userId}}', password: '{{password}}' }),
    desc: 'User ID = mobile, e-mail or PAN. Returns an OTP challenge. In dev mode the OTP comes back as devOtp and is saved to {{otp}} automatically.',
  }),
  req('Log in - step 2: verify OTP', 'POST', '/api/auth/verify-otp', {
    noAuth: true, events: saveToken,
    body: json({ challengeId: '{{challengeId}}', otp: '{{otp}}', rememberDevice: false }),
    desc: 'Saves the session token to {{token}}; every other request sends it as Bearer auth. If dev mode is off, type the OTP from the SMS/e-mail into the otp variable first.',
  }),
  req('Who am I', 'GET', '/api/auth/me'),
  req('Log out', 'POST', '/api/auth/logout'),
], 'Set userId / password in the environment (admin, RM or investor), then run step 1 and step 2.');

// ---------------------------------------------------------------- 1. auth
const auth = folder('1. Auth', [
  req('Log in with OTP only (investors)', 'POST', '/api/auth/login-otp', { noAuth: true, events: saveChallenge, body: json({ userId: '{{userId}}' }) }),
  req('Resend OTP', 'POST', '/api/auth/resend-otp', { noAuth: true, events: saveChallenge, body: json({ challengeId: '{{challengeId}}' }) }),
  req('CAPTCHA (after 3 wrong passwords)', 'GET', '/api/auth/captcha', { noAuth: true }),
  req('Forgot password - send OTP', 'POST', '/api/auth/forgot', { noAuth: true, events: saveChallenge, body: json({ userId: '{{userId}}' }) }),
  req('Forgot password - reset', 'POST', '/api/auth/reset', { noAuth: true, body: json({ challengeId: '{{challengeId}}', otp: '{{otp}}', newPassword: 'NewPass@2026' }) }),
  req('Activation link - check', 'GET', '/api/auth/activate/{{activationToken}}', { noAuth: true }),
  req('Activation - verify PAN + DOB', 'POST', '/api/auth/activate/verify', { noAuth: true, events: saveChallenge, body: json({ token: '{{activationToken}}', pan: 'ABCDE1234F', dob: '1990-01-31' }) }),
  req('Activation - set password', 'POST', '/api/auth/activate/complete', { noAuth: true, body: json({ challengeId: '{{challengeId}}', otp: '{{otp}}', newPassword: 'MyPass@2026' }) }),
  req('Change password - send OTP', 'POST', '/api/auth/change-password/otp', { events: saveChallenge }),
  req('Change password', 'POST', '/api/auth/change-password', { body: json({ currentPassword: '{{password}}', newPassword: 'NewPass@2026', challengeId: '{{challengeId}}', otp: '{{otp}}' }) }),
]);

// ---------------------------------------------------------------- 2. public website
const pub = folder('2. Public website (no login)', [
  folder('Site & content', [
    req('Site settings (firm, ARN, contacts)', 'GET', '/api/public/site', { noAuth: true }),
    req('Home page content', 'GET', '/api/public/home', { noAuth: true }),
    req('About page', 'GET', '/api/public/about', { noAuth: true }),
    req('Team', 'GET', '/api/public/team', { noAuth: true }),
    req('Testimonials', 'GET', '/api/public/testimonials', { noAuth: true }),
    req('Banners', 'GET', '/api/public/banners', { noAuth: true }),
    req('Services', 'GET', '/api/public/services', { noAuth: true }),
    req('Service detail', 'GET', '/api/public/services/sip', { noAuth: true }),
    req('Legal / info page', 'GET', '/api/public/pages/privacy', { noAuth: true, desc: 'Keys: about, disclaimer, privacy, terms, commission, grievance' }),
    req('Articles', 'GET', '/api/public/articles', { noAuth: true, query: [['category', '', true]] }),
    req('Article', 'GET', '/api/public/articles/{{articleSlug}}', { noAuth: true }),
    req('FAQs', 'GET', '/api/public/faqs', { noAuth: true }),
    req('Glossary', 'GET', '/api/public/glossary', { noAuth: true }),
  ]),
  folder('Funds, AMCs & NFOs', [
    req('Schemes (fund explorer)', 'GET', '/api/public/schemes', { noAuth: true, query: [['q', 'flexi'], ['category', 'EQUITY', true], ['subCategory', '', true], ['amc', 'HDFC Mutual Fund', true], ['risk', '', true], ['sort', 'return3y'], ['page', '0'], ['size', '20']] }),
    req('Scheme filters', 'GET', '/api/public/schemes/filters', { noAuth: true }),
    req('Scheme detail', 'GET', '/api/public/schemes/{{schemeId}}', { noAuth: true }),
    req('AMC partners', 'GET', '/api/public/amcs', { noAuth: true }),
    req('AMC logo', 'GET', '/api/public/amcs/1/logo', { noAuth: true }),
    req('NFOs', 'GET', '/api/public/nfos', { noAuth: true, query: [['status', 'open'], ['amc', '', true], ['assetClass', '', true], ['q', '', true]], desc: 'status = open | upcoming | closed | all' }),
    req('NFO detail', 'GET', '/api/public/nfos/{{nfoId}}', { noAuth: true }),
    req('NFO one-pager (PDF)', 'GET', '/api/public/nfos/{{nfoId}}/one-pager', { noAuth: true }),
  ]),
  folder('Enquiry, portfolio review & KYC', [
    req('Send mobile OTP (enquiry / KYC)', 'POST', '/api/public/leads/otp', { noAuth: true, events: saveChallenge, body: json({ mobile: '{{mobile}}' }) }),
    req('Submit enquiry', 'POST', '/api/public/leads', { noAuth: true, body: json({ name: 'Test Client', mobile: '{{mobile}}', email: 'client@example.com', city: 'Thiruvananthapuram', interest: 'SIP', message: 'Please call me about SIPs.', consent: true, challengeId: '{{challengeId}}', otp: '{{otp}}', website: '' }) }),
    req('Portfolio review (CAS upload)', 'POST', '/api/public/portfolio-review', { noAuth: true, body: form([['name', 'Test Client'], ['mobile', '{{mobile}}'], ['email', 'client@example.com'], ['consent', 'true'], ['challengeId', '{{challengeId}}'], ['otp', '{{otp}}'], ['casPassword', ''], ['website', ''], ['file', '', 'file']]), desc: 'Choose a CAS PDF (≤10 MB) for the file field.' }),
    req('KYC - verify OTP', 'POST', '/api/public/kyc/verify-otp', { noAuth: true, body: json({ mobile: '{{mobile}}', challengeId: '{{challengeId}}', otp: '{{otp}}' }) }),
    req('KYC - submit application', 'POST', '/api/public/kyc', {
      noAuth: true,
      body: form([
        ['residency', 'RESIDENT'], ['fullName', 'Test Applicant'], ['fatherOrSpouseName', 'Parent Name'], ['gender', 'MALE'], ['dob', '1990-05-15'],
        ['pan', 'ABCPZ9876Q'], ['mobile', '{{mobile}}'], ['email', 'kyc@example.com'], ['maritalStatus', 'SINGLE'], ['occupation', 'PRIVATE_SECTOR'],
        ['annualIncome', '5L_10L'], ['politicallyExposed', 'false'], ['addressLine', 'House name, Street'], ['city', 'Thiruvananthapuram'], ['state', 'Kerala'],
        ['pincode', '695006'], ['preferredVipvSlot', 'Weekday evening (4 - 7 PM IST)'], ['consent', 'true'], ['challengeId', '{{challengeId}}'], ['otp', '{{otp}}'], ['website', ''],
        ['PAN_CARD', '', 'file'], ['ADDRESS_PROOF', '', 'file'], ['PHOTO', '', 'file'], ['SIGNATURE', '', 'file'],
      ]),
      desc: 'Residents: PAN_CARD, ADDRESS_PROOF, PHOTO, SIGNATURE (CANCELLED_CHEQUE optional). NRIs (residency=NRI) also need PASSPORT and OVERSEAS_ADDRESS_PROOF plus countryOfResidence, overseasAddress, taxResidencyCountry, foreignTin, nationality. Files: PDF/JPG/PNG ≤5 MB.',
    }),
    req('KYC - track status', 'POST', '/api/public/kyc/status', { noAuth: true, body: json({ ref: 'KYC2610200001', mobile: '{{mobile}}' }) }),
  ]),
]);

// ---------------------------------------------------------------- 3. investor
const inv = folder('3. Investor (log in as an investor)', [
  folder('Portfolio', [
    req('Family members', 'GET', '/api/investor/family'),
    req('Portfolio summary', 'GET', '/api/investor/portfolio', { query: [['member', 'all', true]] }),
    req('Holdings', 'GET', '/api/investor/holdings', { query: [['member', 'all', true]] }),
    req('Folio transactions', 'GET', '/api/investor/holdings/{{folioId}}/transactions'),
    req('Transactions', 'GET', '/api/investor/transactions', { query: [['member', '', true], ['from', '2025-04-01', true], ['to', '', true], ['type', '', true]] }),
  ]),
  folder('SIPs', [
    req('SIPs', 'GET', '/api/investor/sips'),
    req('Pause SIP', 'POST', '/api/investor/sips/{{sipId}}/pause', { body: json({ months: 2 }) }),
    req('Resume SIP', 'POST', '/api/investor/sips/{{sipId}}/resume'),
    req('Step-up SIP', 'POST', '/api/investor/sips/{{sipId}}/step-up', { body: json({ stepUpPct: 10 }) }),
    req('Cancel SIP', 'POST', '/api/investor/sips/{{sipId}}/cancel'),
  ]),
  folder('Orders', [
    req('Orders', 'GET', '/api/investor/orders', { query: [['status', '', true]] }),
    req('Place orders (cart)', 'POST', '/api/investor/orders', { body: json({ investorId: '{{investorId}}', paymentMode: 'UPI', riskAcknowledged: true, items: [{ type: 'LUMPSUM', schemeId: '{{schemeId}}', amount: 5000 }] }) }),
    req('Approve RM order - send OTP', 'POST', '/api/investor/orders/{{orderId}}/approve-otp', { events: saveChallenge }),
    req('Approve RM order', 'POST', '/api/investor/orders/{{orderId}}/approve', { body: json({ challengeId: '{{challengeId}}', otp: '{{otp}}' }) }),
    req('Reject RM order', 'POST', '/api/investor/orders/{{orderId}}/reject'),
  ]),
  folder('Reports', [
    req('Financial years', 'GET', '/api/investor/reports/financial-years'),
    req('Capital gains', 'GET', '/api/investor/reports/capital-gains', { query: [['fy', '2025-26'], ['member', '', true]] }),
    req('Download report (PDF / Excel)', 'GET', '/api/investor/reports/statement/download', { query: [['format', 'pdf'], ['fy', '', true], ['member', '', true]], desc: 'kind = statement | transactions | capital-gains; format = pdf | xlsx. Use "Send and Download".' }),
  ]),
  folder('Goals, profile & service', [
    req('Goals', 'GET', '/api/investor/goals'),
    req('Create goal', 'POST', '/api/investor/goals', { body: json({ name: 'Retirement', type: 'RETIREMENT', targetAmount: 10000000, targetDate: '2045-03-31', folioIds: [] }) }),
    req('Update goal', 'PUT', '/api/investor/goals/{{goalId}}', { body: json({ name: 'Retirement', type: 'RETIREMENT', targetAmount: 12000000, targetDate: '2045-03-31', folioIds: [] }) }),
    req('Delete goal', 'DELETE', '/api/investor/goals/{{goalId}}'),
    req('Profile (KYC, nominees, banks, mandates)', 'GET', '/api/investor/profile'),
    req('Service requests', 'GET', '/api/investor/tickets'),
    req('Raise service request', 'POST', '/api/investor/tickets', { body: json({ category: 'ADDRESS_CHANGE', subject: 'Update my address', description: 'I have moved to a new address.' }) }),
    req('My RM', 'GET', '/api/investor/rm'),
    req('Request a call back', 'POST', '/api/investor/rm/callback', { body: json({ preferredTime: 'Evening (4 pm – 7 pm)', note: 'About SIP options' }) }),
    req('Notifications', 'GET', '/api/investor/notifications'),
    req('Mark notification read', 'POST', '/api/investor/notifications/{{notificationId}}/read'),
    req('Mark all read', 'POST', '/api/investor/notifications/read-all'),
  ]),
]);

// ---------------------------------------------------------------- 4. staff console
const id = (n) => `{{${n}}}`;
const crud = (label, base, sample) => [
  req(`${label} - list`, 'GET', base),
  req(`${label} - create`, 'POST', base, { body: json(sample) }),
  req(`${label} - update`, 'PUT', `${base}/${id('itemId')}`, { body: json(sample) }),
  req(`${label} - delete`, 'DELETE', `${base}/${id('itemId')}`),
];
const admin = folder('4. Staff console (log in as admin or RM)', [
  req('Dashboard', 'GET', '/api/admin/dashboard'),
  folder('Clients', [
    req('Clients', 'GET', '/api/admin/clients', { query: [['q', '', true], ['rmId', '', true]] }),
    req('Client detail', 'GET', '/api/admin/clients/{{clientId}}'),
    req('Create client', 'POST', '/api/admin/clients', { body: json({ name: 'New Client', pan: 'ABCPN1234K', dob: '1985-07-20', email: 'new.client@example.com', mobile: '9876512345', address: 'Thiruvananthapuram, Kerala', kycStatus: 'VALIDATED', rmId: null, familyHeadId: null, relation: null }) }),
    req('Update client (admin)', 'PUT', '/api/admin/clients/{{clientId}}', { body: json({ name: 'New Client', pan: 'ABCPN1234K', dob: '1985-07-20', email: 'new.client@example.com', mobile: '9876512345', address: 'Thiruvananthapuram, Kerala', kycStatus: 'VALIDATED' }) }),
    req('Activation link', 'POST', '/api/admin/clients/{{clientId}}/activation-link'),
    req('Enable / disable login (admin)', 'POST', '/api/admin/clients/{{clientId}}/status', { body: json({ enabled: true }) }),
    req('RMs', 'GET', '/api/admin/rms'),
  ]),
  folder('Leads, KYC & tickets', [
    req('Leads', 'GET', '/api/admin/leads', { query: [['status', 'NEW', true], ['q', '', true]] }),
    req('Update lead', 'PUT', '/api/admin/leads/{{leadId}}', { body: json({ status: 'CONTACTED', followUpDate: '2026-10-25', notes: 'Called, will send SID.' }) }),
    req('Lead CAS attachment', 'GET', '/api/admin/leads/{{leadId}}/attachment'),
    req('KYC requests', 'GET', '/api/admin/kyc', { query: [['status', '', true], ['q', '', true]] }),
    req('KYC request detail', 'GET', '/api/admin/kyc/{{kycId}}'),
    req('Update KYC request', 'PUT', '/api/admin/kyc/{{kycId}}', { body: json({ status: 'UNDER_REVIEW', staffNotes: 'Documents look fine.' }), desc: 'Status: SUBMITTED, UNDER_REVIEW, VIPV_SCHEDULED, SUBMITTED_TO_KRA, KYC_REGISTERED, ACTION_REQUIRED, REJECTED' }),
    req('Download KYC document', 'GET', '/api/admin/kyc/{{kycId}}/documents/{{docId}}'),
    req('Service tickets', 'GET', '/api/admin/tickets', { query: [['status', '', true]] }),
    req('Update ticket', 'PUT', '/api/admin/tickets/{{ticketId}}', { body: json({ status: 'IN_PROGRESS', comment: 'Working on it.' }) }),
  ]),
  folder('Orders & brokerage', [
    req('Orders', 'GET', '/api/admin/orders', { query: [['status', '', true], ['clientId', '', true]] }),
    req('Place order for client (needs client OTP approval)', 'POST', '/api/admin/orders', { body: json({ investorId: '{{clientId}}', paymentMode: 'UPI', riskAcknowledged: true, items: [{ type: 'LUMPSUM', schemeId: '{{schemeId}}', amount: 10000 }] }) }),
    req('Override order status (admin)', 'POST', '/api/admin/orders/{{orderId}}/status', { body: json({ status: 'ALLOTTED', note: 'Reconciled with exchange' }) }),
    req('Brokerage (admin)', 'GET', '/api/admin/brokerage', { query: [['month', '2026-09', true]] }),
  ]),
  folder('NFOs', [
    req('NFOs', 'GET', '/api/admin/nfos', { query: [['status', '', true], ['q', '', true]] }),
    req('NFO detail', 'GET', '/api/admin/nfos/{{nfoId}}'),
    req('Add NFO manually', 'POST', '/api/admin/nfos', { body: json({ amcName: 'Example Mutual Fund', schemeName: 'Example Flexi Cap Fund', assetClass: 'EQUITY', subCategory: 'Flexi Cap', openDate: '2026-11-01', closeDate: '2026-11-15', minAmount: 1000 }) }),
    req('Update NFO', 'PUT', '/api/admin/nfos/{{nfoId}}', { body: json({ closeDate: '2026-11-04', featured: true }) }),
    req('Upload one-pager (PDF)', 'POST', '/api/admin/nfos/{{nfoId}}/one-pager', { body: form([['file', '', 'file']]) }),
    req('Download one-pager', 'GET', '/api/admin/nfos/{{nfoId}}/one-pager'),
    req('Remove one-pager', 'DELETE', '/api/admin/nfos/{{nfoId}}/one-pager'),
  ]),
  folder('Content (CMS, admin)', [
    ...crud('Articles', '/api/admin/cms/articles', { title: 'What is a SIP?', slug: 'what-is-a-sip', summary: 'Short summary', category: 'Basics', body: 'Paragraph one.\n\n## Subheading\n\nParagraph two.', publishAt: '2026-10-21T09:00:00', readMinutes: 4, videoUrl: null }),
    ...crud('FAQs', '/api/admin/cms/faqs', { question: 'Question?', answer: 'Answer.', category: 'General', sortOrder: 10 }),
    ...crud('Banners', '/api/admin/cms/banners', { title: 'Start your SIP', text: 'Book a consultation', ctaLabel: 'Contact us', ctaUrl: '/contact', active: true, startsAt: null, endsAt: null }),
    ...crud('AMC partners', '/api/admin/cms/amcs', { name: 'Example Mutual Fund', website: 'https://www.example.com', active: true, sortOrder: 200 }),
    req('AMC partners - upload logo', 'POST', '/api/admin/cms/amcs/{{itemId}}/logo', { body: form([['file', '', 'file']]) }),
    ...crud('Testimonials', '/api/admin/cms/testimonials', { name: 'Client Name', city: 'Kochi', text: 'Very helpful team.', photoUrl: null, consent: true, active: true }),
    ...crud('Team', '/api/admin/cms/team', { name: 'Rahul Rajesh', designation: 'Founder', euin: null, bio: 'Bio', isFounder: true, qualifications: 'NISM Series V-A certified; Graduate', yearsExperience: 10, photoUrl: null, sortOrder: 1 }),
    req('Pages - list', 'GET', '/api/admin/cms/pages'),
    req('Pages - update', 'PUT', '/api/admin/cms/pages/privacy', { body: json({ title: 'Privacy Policy', body: '## What we collect\n\n...' }) }),
    req('Home content', 'GET', '/api/admin/cms/home'),
    req('Home content - update', 'PUT', '/api/admin/cms/home', { body: json({ hero: { headline: 'Grow your wealth with the right mutual funds', subline: '...', primaryCtaLabel: 'Book a free consultation', secondaryCtaLabel: 'Calculate your SIP' } }), desc: 'Send the full object returned by GET (hero, whyChooseUs, howItWorks, sections).' }),
    req('About content', 'GET', '/api/admin/cms/about'),
    req('About content - update', 'PUT', '/api/admin/cms/about', { body: json({ story: '...', mission: '...', vision: '...', values: [], milestones: [] }) }),
    req('Services', 'GET', '/api/admin/cms/services'),
    req('Service - update', 'PUT', '/api/admin/cms/services/sip', { body: json({ title: 'SIP investing', shortText: '...' }) }),
    req('Site settings - update', 'PUT', '/api/admin/cms/site', { body: json({ phone: '+91 9020467232', whatsapp: '+91 9020467232', email: 'rahulrrnair95@gmail.com', address: '...', officeHours: 'Mon-Sat, 9:30 AM - 6:00 PM', mapEmbedUrl: null, stats: {}, socials: {} }) }),
  ]),
  folder('Users & audit (admin)', [
    req('Staff users', 'GET', '/api/admin/users'),
    req('Create staff user', 'POST', '/api/admin/users', { body: json({ name: 'Hima Mohan', email: 'hima@aureusfinserve.com', mobile: '9876500000', role: 'ADMIN', euin: null }) }),
    req('Reset staff password', 'POST', '/api/admin/users/{{userIdNum}}/reset-password'),
    req('Force logout', 'POST', '/api/admin/users/{{userIdNum}}/force-logout'),
    req('Enable / disable staff user', 'POST', '/api/admin/users/{{userIdNum}}/status', { body: json({ enabled: true }) }),
    req('Audit log', 'GET', '/api/admin/audit', { query: [['q', '', true], ['action', '', true], ['from', '', true], ['to', '', true], ['page', '0'], ['size', '50']] }),
    req('Audit log CSV', 'GET', '/api/admin/audit/export'),
  ]),
  folder('Data sync (admin)', [
    req('Schedule (automatic updates)', 'GET', '/api/admin/sync/schedule'),
    req('Sync history', 'GET', '/api/admin/sync/runs'),
    req('Update NAVs now (AMFI)', 'POST', '/api/admin/sync/nav', { desc: 'Takes 2-3 minutes. Optionally send a NAVAll.txt as form-data "file".' }),
    req('Refresh scheme details', 'POST', '/api/admin/sync/details'),
    req('Check for new schemes', 'POST', '/api/admin/sync/schemes'),
    req('Fetch latest NFOs', 'POST', '/api/admin/sync/nfos'),
    req('Import RTA CSV', 'POST', '/api/admin/sync/rta', { body: form([['file', '', 'file']]), desc: 'CSV: pan,folio_no,scheme_code,date,type,amount,units,nav' }),
  ]),
]);

// ---------------------------------------------------------------- collection
const vars = {
  token: '', challengeId: '', otp: '', deviceId: 'postman-device-1',
  schemeId: '1', nfoId: '1', articleSlug: 'swp-regular-income', activationToken: '', mobile: '9876500123',
  folioId: '', sipId: '', orderId: '', goalId: '', notificationId: '', investorId: '',
  clientId: '', leadId: '', kycId: '', docId: '', ticketId: '', itemId: '', userIdNum: '',
};
const collection = {
  info: {
    name: 'Aureus Finserve API',
    _postman_id: '6f1f3a5e-0b8e-4b7a-9d2a-aureusfinserve',
    description: [
      'REST API of the Aureus Finserve website (Spring Boot backend). Contract: docs/API.md.',
      '',
      '1. Import this collection and one environment (Local or Live) and select it.',
      '2. Set userId / password in the environment.',
      '3. Run "0. Log in" step 1 and step 2: the token is saved and sent on every request.',
      '',
      'Every request also sends an X-Device-Id header ({{deviceId}}).',
      'Errors look like { "error": "...", "code": "...", "fields": { ... } }.',
    ].join('\n'),
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}', type: 'string' }] },
  event: [{ listen: 'prerequest', script: { type: 'text/javascript', exec: ["pm.request.headers.upsert({ key: 'X-Device-Id', value: pm.collectionVariables.get('deviceId') || 'postman-device-1' });"] } }],
  variable: Object.entries(vars).map(([key, value]) => ({ key, value })),
  item: [quickLogin, auth, pub, inv, admin],
};

const env = (name, baseUrl, userId) => ({
  id: name.toLowerCase().replace(/\W+/g, '-'),
  name,
  values: [
    { key: 'baseUrl', value: baseUrl, type: 'default', enabled: true },
    { key: 'userId', value: userId, type: 'default', enabled: true },
    { key: 'password', value: '', type: 'secret', enabled: true },
  ],
  _postman_variable_scope: 'environment',
});

fs.writeFileSync(path.join(here, 'Aureus-Finserve.postman_collection.json'), JSON.stringify(collection, null, 2));
fs.writeFileSync(path.join(here, 'Aureus-Finserve-Local.postman_environment.json'), JSON.stringify(env('Aureus Finserve - Local', 'http://localhost:8080', 'admin@aureusfinserve.in'), null, 2));
fs.writeFileSync(path.join(here, 'Aureus-Finserve-Live.postman_environment.json'), JSON.stringify(env('Aureus Finserve - Live', 'https://aureusfinserve.com', 'admin@aureusfinserve.in'), null, 2));
const count = (items) => items.reduce((n, i) => n + (i.item ? count(i.item) : 1), 0);
console.log('requests:', count(collection.item));
