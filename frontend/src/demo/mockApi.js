// Demo mode: answers /api/* calls in the browser from a snapshot recorded from the real backend
// (see docs/API.md). Used only by the static preview build (`npm run build:demo`); the real app
// talks to the Spring Boot backend. Changes live in memory and reset on reload.
import snapshot from './snapshot.json';

export const DEMO_OTP = '123456';

const clone = (x) => JSON.parse(JSON.stringify(x));
const db = clone(snapshot);
const P = db.public;
const now = () => new Date().toISOString().slice(0, 19);
const today = () => new Date().toISOString().slice(0, 10);
let seq = 100;

function json(body, status = 200, headers = {}) {
  return new Response(body === undefined ? '' : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}
const fail = (status, code, error, fields) => json({ error, code, ...(fields ? { fields } : {}) }, status);
const ok = (x = { ok: true }) => json(x);

// ---------- automatic updates (GET /admin/sync/schedule) ----------
const IST_MS = 5.5 * 3600 * 1000;
/** Next IST occurrence of hh:mm (on weekday 0=Sunday when given), as a local ISO timestamp. */
function nextIst(hh, mm, weekday) {
  const nowIst = new Date(Date.now() + IST_MS); // UTC fields of this Date = IST wall clock
  const d = new Date(Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate(), hh, mm));
  while (d <= nowIst || (weekday !== undefined && d.getUTCDay() !== weekday)) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 19);
}
function demoSchedule(runs) {
  const last = (t) => runs.find((r) => r.type === t && r.finishedAt && r.status !== 'FAILED')?.finishedAt || null;
  return {
    enabled: true,
    zone: 'Asia/Kolkata',
    running: null,
    catchUpOnStart: true,
    nav: { cron: '0 30 23 * * *', nextRun: nextIst(23, 30), retryCron: '0 0 7 * * *', nextRetry: nextIst(7, 0) },
    details: { cron: '0 30 0 * * *', nextRun: nextIst(0, 30) },
    schemes: { cron: '0 0 0 * * *', nextRun: nextIst(0, 0) },
    nfo: { cron: '0 0 8 * * *', nextRun: nextIst(8, 0) },
    lastSuccess: { NAV: last('NAV'), DETAILS: last('DETAILS'), SCHEMES: last('SCHEMES'), NFO: last('NFO') },
  };
}

function keyOf(path, params) {
  const entries = [...params.entries()].filter(([, v]) => v !== '').sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const s = new URLSearchParams(entries).toString();
  return s ? `${path}?${s}` : path;
}

// ---------- users / sessions ----------
const users = db.users;
const tokenOf = (name) => `demo-${name}`;
function sessionUser(req) {
  const h = req.headers.get('Authorization') || '';
  const name = h.startsWith('Bearer demo-') ? h.slice('Bearer demo-'.length) : null;
  return name && users[name] ? { name, ...users[name], me: users[name].store['/auth/me'] } : null;
}
function findUser(userId) {
  const id = String(userId || '').trim().toLowerCase();
  return Object.entries(users).find(([, u]) => u.userId.toLowerCase() === id || u.store['/auth/me'].email?.toLowerCase() === id);
}
const maskEmail = (e) => (e ? e.replace(/^(.{2}).*(@.*)$/, '$1***$2') : null);
function challenge(prefix, name) {
  const me = name ? users[name].store['/auth/me'] : null;
  return { challengeId: `${prefix}:${name || 'x'}:${++seq}`, maskedMobile: me?.mobileMasked || 'XXXXXX0000', maskedEmail: maskEmail(me?.email) || 'yo***@example.com', devOtp: DEMO_OTP };
}
function checkOtp(otp) {
  if (String(otp) !== DEMO_OTP) return fail(400, 'OTP_INVALID', `Incorrect OTP. In this demo the OTP is always ${DEMO_OTP}.`);
  return null;
}
const PW_RULE = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,64}$/;

async function auth(req, path, body) {
  if (path === '/auth/login') {
    const found = findUser(body.userId);
    if (String(body.userId).replace(/\D/g, '') === '9876500002') return fail(403, 'NOT_ACTIVATED', 'This account is not activated yet.');
    if (!found || found[1].password !== body.password) return fail(401, 'INVALID_CREDENTIALS', 'The user ID or password is incorrect.');
    return ok({ status: 'OTP_REQUIRED', ...challenge('login', found[0]) });
  }
  if (path === '/auth/login-otp') {
    const found = findUser(body.userId);
    if (!found || found[1].store['/auth/me'].role !== 'INVESTOR') return ok({ status: 'OTP_REQUIRED', ...challenge('login', null) });
    return ok({ status: 'OTP_REQUIRED', ...challenge('login', found[0]) });
  }
  if (path === '/auth/verify-otp') {
    const bad = checkOtp(body.otp);
    if (bad) return bad;
    const name = String(body.challengeId || '').split(':')[1];
    if (!users[name]) return fail(400, 'OTP_INVALID', 'This sign-in request is no longer valid. Please log in again.');
    return ok({ status: 'OK', token: tokenOf(name), user: users[name].store['/auth/me'] });
  }
  if (path === '/auth/resend-otp') {
    const [prefix, name] = String(body.challengeId || '').split(':');
    return ok(challenge(prefix || 'login', users[name] ? name : null));
  }
  if (path === '/auth/forgot') {
    const found = findUser(body.userId);
    return ok(challenge('forgot', found?.[0] || null));
  }
  if (path === '/auth/reset' || path === '/auth/activate/complete') {
    const bad = checkOtp(body.otp);
    if (bad) return bad;
    if (!PW_RULE.test(body.newPassword || '')) return fail(400, 'VALIDATION', 'Password must be 8–64 characters with a letter, a number and a symbol.', { newPassword: 'Does not meet the password policy' });
    return ok();
  }
  if (path.startsWith('/auth/activate/') && req.method === 'GET') {
    return db.activation ? ok({ name: db.activation.name, valid: true }) : fail(404, 'NOT_FOUND', 'This activation link is invalid or has expired.');
  }
  if (path === '/auth/activate/verify') {
    const a = db.activation;
    if (!a || String(body.pan).toUpperCase() !== a.pan || body.dob !== a.dob) return fail(400, 'VALIDATION', 'PAN or date of birth does not match our records.');
    return ok({ challengeId: `activate:x:${++seq}`, maskedMobile: 'XXXXXX0002', maskedEmail: 'ka***@example.com', devOtp: DEMO_OTP });
  }
  if (path === '/auth/captcha') return ok({ captchaId: 'demo', question: 'What is 4 + 7?' });
  const u = sessionUser(req);
  if (!u) return fail(401, 'UNAUTHORIZED', 'Please log in.');
  if (path === '/auth/me') return ok(u.me);
  if (path === '/auth/logout') return ok();
  if (path === '/auth/change-password/otp') return ok(challenge('change', u.name));
  if (path === '/auth/change-password') {
    const bad = checkOtp(body.otp);
    if (bad) return bad;
    if (body.currentPassword !== u.password) return fail(400, 'VALIDATION', 'Current password is incorrect.', { currentPassword: 'Incorrect password' });
    if (!PW_RULE.test(body.newPassword || '')) return fail(400, 'VALIDATION', 'New password does not meet the policy.', { newPassword: 'Does not meet the password policy' });
    users[u.name].password = body.newPassword;
    return ok();
  }
  return fail(404, 'NOT_FOUND', 'Not found.');
}

// ---------- public ----------
const RISK_ORDER = ['LOW', 'LOW_TO_MODERATE', 'MODERATE', 'MODERATELY_HIGH', 'HIGH', 'VERY_HIGH'];
function schemes(params) {
  let list = P['/public/schemes#all'].slice();
  const q = (params.get('q') || '').toLowerCase();
  if (q) list = list.filter((s) => s.name.toLowerCase().includes(q) || s.amc.toLowerCase().includes(q) || (s.subCategory || '').toLowerCase().includes(q));
  for (const f of ['category', 'subCategory', 'amc', 'risk']) {
    const v = params.get(f);
    if (v) list = list.filter((s) => s[f] === v);
  }
  const sort = params.get('sort');
  const num = (v) => (v == null ? -Infinity : v);
  if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === 'aum') list.sort((a, b) => num(b.aumCr) - num(a.aumCr));
  else if (sort === 'risk') list.sort((a, b) => RISK_ORDER.indexOf(a.risk) - RISK_ORDER.indexOf(b.risk));
  else if (sort) list.sort((a, b) => num(b[sort]) - num(a[sort]));
  const page = +params.get('page') || 0;
  const size = +params.get('size') || 20;
  return { items: list.slice(page * size, page * size + size), total: list.length, page, size };
}

// ---------- online KYC (docs/API.md §8) ----------
const KYC_MESSAGES = {
  SUBMITTED: 'We have received your application. Our team will check your details and documents shortly.',
  UNDER_REVIEW: 'Our team is checking your details and documents. We will contact you to schedule a short video verification call.',
  VIPV_SCHEDULED: 'Your video verification call is being scheduled. We will call or message you on your registered mobile number.',
  SUBMITTED_TO_KRA: 'Your verified KYC has been uploaded to the KYC Registration Agency (KRA). Registration usually completes in 2-5 working days.',
  KYC_REGISTERED: 'Your KYC is registered with the KRA. You can now invest in mutual funds.',
  ACTION_REQUIRED: 'We need something more from you to continue. Please check the SMS / e-mail from us or call our office.',
  REJECTED: 'We could not process this application. Our team will contact you with the reason and the next steps.',
};
const KYC_REQUIRED = { RESIDENT: ['PAN_CARD', 'ADDRESS_PROOF', 'PHOTO', 'SIGNATURE'], NRI: ['PAN_CARD', 'PASSPORT', 'OVERSEAS_ADDRESS_PROOF', 'PHOTO', 'SIGNATURE'] };
const KYC_LABELS = { PAN_CARD: 'PAN card', ADDRESS_PROOF: 'Address proof', PHOTO: 'Photograph', SIGNATURE: 'Signature', CANCELLED_CHEQUE: 'Cancelled cheque', PASSPORT: 'Passport', OVERSEAS_ADDRESS_PROOF: 'Overseas address proof', VISA_OR_OCI: 'Visa / OCI card' };
// public status lookups: seeded sample apps (recorded with their sample mobiles) + apps submitted in this session
const kycPublic = clone(P['#kycStatus'] || []);
const kycApps = () => kycPublic;
const staffStores = () => Object.values(users).filter((u) => u.store['/auth/me'].role !== 'INVESTOR').map((u) => u.store);
const maskText = (s) => (!s ? null : s.length <= 10 ? `${s[0]}*****` : `${s.slice(0, 4)} ***** ${s.slice(-4)}`);

function kycSubmit(fd) {
  const g = (k) => (fd instanceof FormData ? fd.get(k) : fd[k]);
  if (g('website')) return ok({ ref: `KYC${String(++seq).padStart(10, '0')}`, ok: true });
  const residency = g('residency');
  const fields = {};
  if (!['RESIDENT', 'NRI'].includes(residency)) fields.residency = 'Choose whether you live in India or abroad';
  if (!/^[A-Z]{3}P[A-Z]\d{4}[A-Z]$/.test(String(g('pan') || '').toUpperCase())) fields.pan = 'Enter an individual PAN (the 4th character is P)';
  if (g('consent') !== 'true') fields.consent = 'Please give your consent so we can complete your KYC';
  const docs = [];
  for (const t of KYC_REQUIRED[residency] || []) {
    const f = g(t);
    if (!f || !f.size) fields[t] = `Upload your ${KYC_LABELS[t].toLowerCase().replace('pan card', 'PAN card')}`;
  }
  for (const t of Object.keys(KYC_LABELS)) {
    const f = g(t);
    if (f && f.size) {
      if (f.size > 5 * 1024 * 1024) fields[t] = `${KYC_LABELS[t]}: each file must be 5 MB or smaller`;
      docs.push({ id: ++seq, docType: t, label: KYC_LABELS[t], fileName: f.name, contentType: f.type, sizeBytes: f.size, uploadedAt: now() });
    }
  }
  if (Object.keys(fields).length) return fail(400, 'VALIDATION', Object.values(fields)[0], fields);
  const bad = checkOtp(g('otp'));
  if (bad) return bad;
  const id = ++seq;
  const d = new Date();
  const ref = `KYC${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}${String(id % 10000).padStart(4, '0')}`;
  const mobile = String(g('mobile') || '').replace(/\D/g, '').slice(-10);
  const pan = String(g('pan')).toUpperCase();
  const nri = residency === 'NRI';
  const row = {
    id, ref, residency, fullName: g('fullName'), panMasked: `XXXXX${pan.slice(5)}`, mobileMasked: `XXXXXX${mobile.slice(-4)}`, email: g('email'),
    location: nri ? g('countryOfResidence') : [g('city'), g('state')].filter(Boolean).join(', '), status: 'SUBMITTED', assignedRmId: null, assignedRmName: null,
    documentCount: docs.length, createdAt: now(), updatedAt: now(),
  };
  const dob = String(g('dob') || '');
  const detail = {
    ...row, fatherOrSpouseName: g('fatherOrSpouseName'), gender: g('gender'), dobMasked: dob ? `XX-XX-${dob.slice(0, 4)}` : null,
    age: dob ? new Date().getFullYear() - Number(dob.slice(0, 4)) : null, maritalStatus: g('maritalStatus'), occupation: g('occupation'), annualIncome: g('annualIncome'),
    politicallyExposed: g('politicallyExposed') === 'true', addressMasked: maskText(g('addressLine')), city: g('city') || null, state: g('state') || null, pincode: g('pincode') || null,
    countryOfResidence: nri ? g('countryOfResidence') : null, overseasAddressMasked: nri ? maskText(g('overseasAddress')) : null, taxResidencyCountry: nri ? g('taxResidencyCountry') : null,
    foreignTinMasked: nri && g('foreignTin') ? `XXXX${String(g('foreignTin')).slice(-4)}` : null, nationality: nri ? g('nationality') : null,
    preferredVipvSlot: g('preferredVipvSlot'), consent: true, consentAt: now(), staffNotes: null, documents: docs,
  };
  for (const S of staffStores()) {
    (S['/admin/kyc'] = S['/admin/kyc'] || []).unshift(clone(row));
    S[`/admin/kyc/${id}`] = clone(detail);
    if (S['/admin/dashboard']) S['/admin/dashboard'].pendingKyc = (S['/admin/dashboard'].pendingKyc || 0) + 1;
  }
  kycPublic.push({ ref, mobile, status: 'SUBMITTED', submittedAt: now(), updatedAt: now() });
  return ok({ ref, ok: true });
}

// ---------- new fund offers (status recomputed from the dates, so the preview stays current) ----------
const nfoStore = () => (P['/public/nfos#all'] = P['/public/nfos#all'] || []);
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dayDiff = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);
const NFO_STAFF_KEYS = ['hidden', 'source', 'staffEditedFields', 'onePagerFileName', 'onePagerSize', 'createdAt', 'updatedAt'];
function nfoView(n, staff) {
  const t = today();
  const closesBy = n.closeDate || addDays(n.openDate, 15);
  const status = n.openDate > t ? 'UPCOMING' : t > closesBy ? 'CLOSED' : 'OPEN';
  const v = { ...n, closesBy, closeDateConfirmed: !!n.closeDate, status, daysLeft: status === 'CLOSED' ? null : dayDiff(t, closesBy), opensInDays: status === 'UPCOMING' ? dayDiff(t, n.openDate) : null };
  if (!staff) NFO_STAFF_KEYS.forEach((k) => delete v[k]);
  return v;
}
const NFO_RANK = { OPEN: 0, UPCOMING: 1, CLOSED: 2 };
function nfoOrder(a, b) {
  return (b.featured - a.featured) || NFO_RANK[a.status] - NFO_RANK[b.status]
    || (a.status === 'UPCOMING' ? a.openDate.localeCompare(b.openDate) : a.status === 'CLOSED' ? b.closesBy.localeCompare(a.closesBy) : a.closesBy.localeCompare(b.closesBy))
    || a.schemeName.localeCompare(b.schemeName);
}
function nfoList(params, staff) {
  const st = (params.get('status') || '').toLowerCase();
  const want = st === 'all' || (staff && !st) ? ['OPEN', 'UPCOMING', 'CLOSED'] : st ? [st.toUpperCase()] : ['OPEN', 'UPCOMING'];
  const amc = params.get('amc'), cls = params.get('assetClass'), q = (params.get('q') || '').toLowerCase();
  const recent = addDays(today(), -30);
  const rows = nfoStore().map((n) => nfoView(n, true))
    .filter((n) => staff || (!n.hidden && n.closesBy >= recent))
    .filter((n) => want.includes(n.status) && (!amc || n.amc === amc) && (!cls || n.assetClass === cls))
    .filter((n) => !q || [n.schemeName, n.amc, n.amcLegalName, n.subCategory, n.amfiCategory, n.schemeCode].some((v) => (v || '').toLowerCase().includes(q)));
  rows.sort(staff ? (a, b) => b.openDate.localeCompare(a.openDate) : nfoOrder);
  return staff ? rows : rows.map((n) => nfoView(n, false));
}
function nfoAdmin(req, path, params, body, u) {
  const m = req.method;
  const list = nfoStore();
  if (m === 'GET' && path === '/admin/nfos') return ok(nfoList(params, true));
  if (m !== 'GET' && u.me.role !== 'ADMIN') return fail(403, 'FORBIDDEN', 'You do not have access to this.');
  if (m === 'POST' && path === '/admin/nfos') {
    const fields = {};
    if (!body.amc) fields.amc = 'Enter the AMC (fund house)';
    if (!body.schemeName) fields.schemeName = 'Enter the scheme name';
    if (!body.assetClass) fields.assetClass = 'Choose the category';
    if (!body.openDate) fields.openDate = 'Enter the date the NFO opens';
    if (Object.keys(fields).length) return fail(400, 'VALIDATION', Object.values(fields)[0], fields);
    const n = {
      id: ++seq, schemeCode: null, amcLegalName: body.amc, schemeType: null, amfiCategory: null, subCategory: null, minAmountText: null, closeDate: null,
      closeDateSource: null, riskometer: null, benchmark: null, fundManagers: null, exitLoad: null, objective: null, sidUrl: null, hasOnePager: false,
      onePagerUrl: null, onePagerUpdatedAt: null, featured: false, hidden: false, source: 'MANUAL', onePagerFileName: null, onePagerSize: null,
      ...body, minAmount: body.minAmount ? Number(body.minAmount) : null, staffEditedFields: Object.keys(body), createdAt: now(), updatedAt: now(),
    };
    if (n.closeDate) n.closeDateSource = 'STAFF';
    list.unshift(n);
    return ok(nfoView(n, true));
  }
  const r = path.match(/^\/admin\/nfos\/(\d+)(\/one-pager)?$/);
  if (!r) return fail(404, 'NOT_FOUND', 'Not found.');
  const n = list.find((x) => String(x.id) === r[1]);
  if (!n) return fail(404, 'NOT_FOUND', 'NFO not found');
  if (r[2]) {
    if (m === 'GET') return fail(404, 'NOT_FOUND', 'One-pager files are not included in this demo preview.');
    if (m === 'DELETE') Object.assign(n, { hasOnePager: false, onePagerUrl: null, onePagerFileName: null, onePagerSize: null, onePagerUpdatedAt: null });
    else {
      const f = body instanceof FormData ? body.get('file') : null;
      if (!f || !f.size) return fail(400, 'VALIDATION', 'Choose the one-pager PDF', { file: 'Choose the one-pager PDF' });
      Object.assign(n, { hasOnePager: true, onePagerUrl: '/api/public/nfos/' + n.id + '/one-pager', onePagerFileName: f.name, onePagerSize: f.size, onePagerUpdatedAt: now() });
    }
    n.updatedAt = now();
    return ok(nfoView(n, true));
  }
  if (m === 'GET') return ok(nfoView(n, true));
  if (body.closeDate && body.closeDate < (body.openDate || n.openDate)) {
    return fail(400, 'VALIDATION', 'The close date cannot be before the open date', { closeDate: 'The close date cannot be before the open date' });
  }
  const changed = Object.keys(body).filter((k) => body[k] !== n[k]);
  Object.assign(n, body, { updatedAt: now() });
  if ('closeDate' in body) n.closeDateSource = body.closeDate ? 'STAFF' : null;
  n.staffEditedFields = [...new Set([...(n.staffEditedFields || []), ...changed.filter((k) => k !== 'featured' && k !== 'hidden')])];
  return ok(nfoView(n, true));
}

async function publicApi(req, path, params, body) {
  if (req.method === 'GET') {
    if (path === '/public/schemes') return ok(schemes(params));
    if (path === '/public/nfos') return ok(nfoList(params, false));
    const nr = path.match(/^\/public\/nfos\/(\d+)(\/one-pager)?$/);
    if (nr) {
      const n = nfoStore().find((x) => String(x.id) === nr[1] && !x.hidden);
      if (!n) return fail(404, 'NOT_FOUND', 'NFO not found');
      return nr[2] ? fail(404, 'NOT_FOUND', 'One-pager files are not included in this demo preview.') : ok(nfoView(n, false));
    }
    if (path === '/public/articles') {
      const c = params.get('category');
      const list = P['/public/articles'];
      return ok(c ? list.filter((a) => a.category === c) : list);
    }
    if (P[path] !== undefined) return ok(P[path]);
    return fail(404, 'NOT_FOUND', 'Not found.');
  }
  if (path === '/public/leads/otp') return ok({ challengeId: `lead:x:${++seq}`, devOtp: DEMO_OTP });
  if (path === '/public/kyc/verify-otp') {
    const bad = checkOtp(body.otp);
    return bad || ok({ ok: true, validMinutes: 60 });
  }
  if (path === '/public/kyc') return kycSubmit(body);
  if (path === '/public/kyc/status') {
    const ref = String(body.ref || '').trim().toUpperCase();
    const mobile = String(body.mobile || '').replace(/\D/g, '').slice(-10);
    const a = kycApps().find((x) => x.ref === ref && x.mobile === mobile);
    if (!a) return fail(404, 'NOT_FOUND', 'We could not find an application with this reference number and mobile number.');
    return ok({ ref: a.ref, status: a.status, submittedAt: a.submittedAt, updatedAt: a.updatedAt, message: KYC_MESSAGES[a.status] });
  }
  if (path === '/public/leads' || path === '/public/portfolio-review') {
    const otp = body instanceof FormData ? body.get('otp') : body.otp;
    const bad = checkOtp(otp);
    if (bad) return bad;
    const consent = body instanceof FormData ? body.get('consent') === 'true' : body.consent;
    if (!consent) return fail(400, 'VALIDATION', 'Please give your consent so we can contact you.', { consent: 'Required' });
    return ok({ id: ++seq, ok: true });
  }
  return fail(404, 'NOT_FOUND', 'Not found.');
}

// ---------- helpers on a user's store ----------
const lists = (S, prefix) => Object.keys(S).filter((k) => (k === prefix || k.startsWith(prefix + '?')) && Array.isArray(S[k])).map((k) => S[k]);
function patchEverywhere(S, prefix, id, patch) {
  let found = null;
  for (const l of lists(S, prefix)) for (const x of l) if (String(x.id) === String(id)) { Object.assign(x, typeof patch === 'function' ? patch(x) : patch); found = x; }
  return found;
}
const schemeById = (id) => P['/public/schemes#all'].find((s) => String(s.id) === String(id));
function holdingByFolio(S, folioId) {
  for (const l of lists(S, '/investor/holdings')) { const h = l.find((x) => String(x.folioId) === String(folioId)); if (h) return h; }
  for (const k of Object.keys(S)) if (k.startsWith('/admin/clients/')) { const h = (S[k].holdings || []).find((x) => String(x.folioId) === String(folioId)); if (h) return h; }
  return null;
}
function storeForInvestor(investorId) {
  return Object.values(users).find((u) => String(u.store['/auth/me'].investorId) === String(investorId))?.store;
}

function notify(S, type, title, message) {
  const l = S['/investor/notifications'];
  if (l) l.unshift({ id: ++seq, type, title, message, read: false, createdAt: now() });
}
function advance(order, S, status, note) {
  order.status = status;
  order.history = [...(order.history || []), { status, at: now(), note }];
  if (S) notify(S, 'ORDER', `Order ${order.ref}: ${status.replace(/_/g, ' ').toLowerCase()}`, `${order.schemeName} — ${note}`);
}
function simulateExchange(order, S) {
  setTimeout(() => advance(order, S, 'PAYMENT_RECEIVED', 'Payment confirmed by the exchange (demo)'), 15000);
  setTimeout(() => advance(order, S, 'ALLOTTED', 'Units allotted at the latest NAV (demo)'), 30000);
}

function buildOrders(S, cart, placedBy, status) {
  if (!cart.riskAcknowledged) return [null, fail(400, 'VALIDATION', 'Please confirm you have read the scheme documents and understand the risk.', { riskAcknowledged: 'Required' })];
  if (!cart.items?.length) return [null, fail(400, 'VALIDATION', 'Your cart is empty.')];
  const out = [];
  for (const it of cart.items) {
    const h = it.folioId ? holdingByFolio(S, it.folioId) : null;
    const s = schemeById(it.schemeId || h?.schemeId);
    const t = it.targetSchemeId ? schemeById(it.targetSchemeId) : null;
    if (it.type === 'LUMPSUM' && s && it.amount < s.minLumpsum) return [null, fail(400, 'VALIDATION', `Minimum lump sum for ${s.name} is ₹${s.minLumpsum}.`)];
    if (it.type === 'SIP' && s && it.amount < s.minSip) return [null, fail(400, 'VALIDATION', `Minimum SIP for ${s.name} is ₹${s.minSip}.`)];
    const id = ++seq;
    const d = new Date();
    out.push({
      id, ref: `AF${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}${String(id).padStart(4, '0')}`,
      investorId: cart.investorId, investorName: h?.investorName || placedBy.investorName,
      type: it.type, schemeId: s?.id ?? null, schemeName: s?.name || h?.schemeName || 'Scheme',
      targetSchemeId: t?.id ?? null, targetSchemeName: t?.name ?? null,
      folioId: it.folioId ?? null, folioNo: h?.folioNo ?? null,
      amount: it.amount ?? null, units: it.units ?? null, allUnits: !!it.allUnits,
      sipDay: it.sipDay ?? null, installments: it.installments ?? null,
      paymentMode: cart.paymentMode, status, placedBy: placedBy.name, placedByRole: placedBy.role,
      exchangeRef: status === 'PLACED' ? `BSE${100000 + id}` : null, createdAt: now(),
      history: [{ status, at: now(), note: status === 'PLACED' ? 'Order placed on exchange (demo)' : 'Raised by your RM — awaiting your OTP approval' }],
    });
  }
  return [out, null];
}

// ---------- investor ----------
async function investor(req, path, params, body, u) {
  const S = u.store;
  const m = req.method;
  if (m === 'GET') {
    if (path.endsWith('/download')) {
      const fmt = params.get('format') === 'xlsx' ? 'xlsx' : 'pdf';
      const f = P[`#download.${fmt}`];
      const bin = Uint8Array.from(atob(f.b64), (c) => c.charCodeAt(0));
      return new Response(bin, { status: 200, headers: { 'Content-Type': f.type, 'Content-Disposition': `attachment; filename="aureus-${path.split('/')[3]}.${fmt}"` } });
    }
    const exact = keyOf(path, params);
    if (path === '/investor/transactions') {
      const member = params.get('member');
      let list = S[member ? `${path}?member=${member}` : path] || [];
      const from = params.get('from'), to = params.get('to'), type = params.get('type');
      if (from) list = list.filter((t) => t.date >= from);
      if (to) list = list.filter((t) => t.date <= to);
      if (type) list = list.filter((t) => t.type === type);
      return ok(list);
    }
    if (path === '/investor/orders') {
      const st = params.get('status');
      const list = S[path] || [];
      return ok(st ? list.filter((o) => o.status === st) : list);
    }
    if (S[exact] !== undefined) return ok(S[exact]);
    if (S[path] !== undefined) return ok(S[path]);
    if (path.match(/^\/investor\/holdings\/\d+\/transactions$/)) return ok([]);
    if (path === '/investor/reports/capital-gains') return ok({ fy: params.get('fy'), rows: [], totals: { stcg: 0, ltcg: 0, total: 0 } });
    return fail(404, 'NOT_FOUND', 'Not found.');
  }
  let r;
  if ((r = path.match(/^\/investor\/sips\/(\d+)\/(pause|resume|step-up|cancel)$/))) {
    const [, id, act] = r;
    const patch = act === 'pause'
      ? (x) => { const d = new Date(); d.setMonth(d.getMonth() + (body.months || 1)); return { status: 'PAUSED', pausedUntil: d.toISOString().slice(0, 10) }; }
      : act === 'resume' ? { status: 'ACTIVE', pausedUntil: null }
        : act === 'step-up' ? { stepUpPct: body.stepUpPct }
          : { status: 'CANCELLED', nextDebitDate: null };
    const sip = patchEverywhere(S, '/investor/sips', id, patch);
    return sip ? ok(sip) : fail(404, 'NOT_FOUND', 'SIP not found.');
  }
  if (path === '/investor/orders') {
    const [orders, err] = buildOrders(S, body, { name: u.me.name, role: 'INVESTOR', investorName: u.me.name }, 'PLACED');
    if (err) return err;
    S['/investor/orders'].unshift(...orders);
    orders.forEach((o) => { notify(S, 'ORDER', `Order ${o.ref} placed`, `${o.schemeName} — sent to the exchange (demo)`); simulateExchange(o, S); });
    return ok(orders);
  }
  if ((r = path.match(/^\/investor\/orders\/(\d+)\/(approve-otp|approve|reject)$/))) {
    const [, id, act] = r;
    const o = (S['/investor/orders'] || []).find((x) => String(x.id) === id);
    if (!o) return fail(404, 'NOT_FOUND', 'Order not found.');
    if (act === 'approve-otp') return ok({ challengeId: `approve:${u.name}:${++seq}`, devOtp: DEMO_OTP });
    if (act === 'approve') {
      const bad = checkOtp(body.otp);
      if (bad) return bad;
      o.exchangeRef = `BSE${100000 + o.id}`;
      advance(o, S, 'PLACED', 'Approved by you with OTP and placed on exchange (demo)');
      simulateExchange(o, S);
      return ok(o);
    }
    advance(o, S, 'CANCELLED', 'Rejected by you');
    return ok(o);
  }
  if (path === '/investor/goals' && m === 'POST') {
    const g = goalWithProgress(S, { id: ++seq, ...body });
    S['/investor/goals'].push(g);
    return ok(g);
  }
  if ((r = path.match(/^\/investor\/goals\/(\d+)$/))) {
    const l = S['/investor/goals'];
    const i = l.findIndex((g) => String(g.id) === r[1]);
    if (i < 0) return fail(404, 'NOT_FOUND', 'Goal not found.');
    if (m === 'DELETE') { l.splice(i, 1); return ok(); }
    l[i] = goalWithProgress(S, { ...l[i], ...body });
    return ok(l[i]);
  }
  if (path === '/investor/tickets') {
    const t = { id: ++seq, ref: `SR${String(seq).padStart(6, '0')}`, ...body, status: 'OPEN', createdAt: now(), updatedAt: now(), comments: [] };
    S['/investor/tickets'].unshift(t);
    return ok(t);
  }
  if (path === '/investor/rm/callback') {
    S['/investor/tickets']?.unshift({ id: ++seq, ref: `SR${String(seq).padStart(6, '0')}`, category: 'OTHER', subject: 'Call back request', description: `${body.preferredTime || ''} ${body.note || ''}`.trim(), status: 'OPEN', createdAt: now(), updatedAt: now(), comments: [] });
    return ok();
  }
  if (path === '/investor/notifications/read-all') { (S['/investor/notifications'] || []).forEach((n) => { n.read = true; }); return ok(); }
  if ((r = path.match(/^\/investor\/notifications\/(\d+)\/read$/))) { patchEverywhere(S, '/investor/notifications', r[1], { read: true }); return ok(); }
  return fail(404, 'NOT_FOUND', 'Not found.');
}
function goalWithProgress(S, g) {
  const hs = S['/investor/holdings?member=all'] || S['/investor/holdings'] || [];
  const currentValue = hs.filter((h) => (g.folioIds || []).map(String).includes(String(h.folioId))).reduce((a, h) => a + h.value, 0);
  return { ...g, currentValue: Math.round(currentValue * 100) / 100, progressPct: g.targetAmount ? Math.min(100, Math.round((currentValue / g.targetAmount) * 1000) / 10) : 0 };
}

// ---------- staff console ----------
const CMS_PUBLIC = { faqs: '/public/faqs', testimonials: '/public/testimonials', team: '/public/team', banners: '/public/banners', amcs: '/public/amcs' };
function syncPublic(coll, list) {
  const key = CMS_PUBLIC[coll];
  if (!key) return;
  P[key] = list.filter((x) => x.active !== false && (coll !== 'testimonials' || x.consent !== false));
}

async function admin(req, path, params, body, u) {
  const S = u.store;
  const m = req.method;
  const isAdmin = u.me.role === 'ADMIN';
  const adminOnly = /^\/admin\/(brokerage|cms|users|audit|sync)/.test(path) || (/^\/admin\/clients\/\d+(\/status)?$/.test(path) && m === 'PUT') || /\/clients\/\d+\/status$/.test(path) || /\/orders\/\d+\/status$/.test(path);
  if (adminOnly && !isAdmin) return fail(403, 'FORBIDDEN', 'You do not have access to this.');
  if (path.startsWith('/admin/nfos')) return nfoAdmin(req, path, params, body, u);
  if (m === 'GET') {
    if (path === '/admin/clients') {
      let l = S[path] || [];
      const q = (params.get('q') || '').toLowerCase(), rm = params.get('rmId');
      if (q) l = l.filter((c) => [c.name, c.email, c.panMasked, c.mobileMasked].some((v) => (v || '').toLowerCase().includes(q)));
      if (rm) l = l.filter((c) => String(c.rmId) === rm);
      return ok(l);
    }
    if (path === '/admin/leads') {
      let l = S[path] || [];
      const q = (params.get('q') || '').toLowerCase(), st = params.get('status');
      if (st) l = l.filter((x) => x.status === st);
      if (q) l = l.filter((x) => [x.name, x.mobile, x.email, x.city].some((v) => (v || '').toLowerCase().includes(q)));
      return ok(l);
    }
    if (path === '/admin/orders') {
      let l = S[path] || [];
      const st = params.get('status'), c = params.get('clientId');
      if (st) l = l.filter((x) => x.status === st);
      if (c) l = l.filter((x) => String(x.investorId) === c);
      return ok(l);
    }
    if (path === '/admin/tickets') {
      const st = params.get('status');
      return ok(st ? (S[path] || []).filter((x) => x.status === st) : S[path] || []);
    }
    if (path === '/admin/audit') {
      let l = S['/admin/audit#all'] || [];
      const q = (params.get('q') || '').toLowerCase(), a = params.get('action'), from = params.get('from'), to = params.get('to');
      if (q) l = l.filter((x) => [x.userName, x.detail, x.entity, x.ip].some((v) => (v || '').toLowerCase().includes(q)));
      if (a) l = l.filter((x) => x.action === a);
      if (from) l = l.filter((x) => x.at.slice(0, 10) >= from);
      if (to) l = l.filter((x) => x.at.slice(0, 10) <= to);
      const page = +params.get('page') || 0, size = +params.get('size') || 50;
      return ok({ items: l.slice(page * size, page * size + size), total: l.length });
    }
    if (path === '/admin/audit/export') {
      const rows = (S['/admin/audit#all'] || []).map((x) => [x.at, x.userName, x.role, x.action, x.entity, x.entityId, x.detail, x.ip].map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
      return new Response(['at,user,role,action,entity,entityId,detail,ip', ...rows].join('\n'), { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="audit-log.csv"' } });
    }
    if (path.match(/^\/admin\/leads\/\d+\/attachment$/)) return fail(404, 'NOT_FOUND', 'No CAS file is attached to this sample lead.');
    if (path === '/admin/kyc') {
      let l = S[path] || [];
      const q = (params.get('q') || '').toLowerCase(), st = params.get('status');
      if (st) l = l.filter((x) => x.status === st);
      if (q) l = l.filter((x) => [x.fullName, x.ref, x.email, x.location].some((v) => (v || '').toLowerCase().includes(q)));
      return ok(l);
    }
    if (path === '/admin/sync/schedule') return ok(demoSchedule(S['/admin/sync/runs'] || []));
    if (path.match(/^\/admin\/kyc\/\d+\/documents\/\d+$/)) return fail(404, 'NOT_FOUND', 'Document files are not included in this demo preview.');
    if (path.match(/^\/admin\/kyc\/\d+$/) && S[path] === undefined) return fail(403, 'FORBIDDEN', 'This KYC application is assigned to another relationship manager.');
    const exact = keyOf(path, params);
    if (S[exact] !== undefined) return ok(S[exact]);
    if (S[path] !== undefined) return ok(S[path]);
    if (path.startsWith('/admin/clients/')) return fail(403, 'FORBIDDEN', 'This client is not assigned to you.');
    return fail(404, 'NOT_FOUND', 'Not found.');
  }

  let r;
  // CMS documents
  if (path === '/admin/cms/home' || path === '/admin/cms/about') {
    S[path] = body;
    P[path.replace('/admin/cms', '/public')] = body;
    return ok(body);
  }
  if (path === '/admin/cms/site') {
    Object.assign(P['/public/site'], body, { stats: { ...P['/public/site'].stats, ...(body.stats || {}) }, socials: { ...P['/public/site'].socials, ...(body.socials || {}) } });
    return ok(P['/public/site']);
  }
  if ((r = path.match(/^\/admin\/cms\/pages\/(.+)$/))) {
    const key = decodeURIComponent(r[1]);
    const page = { key, ...body, updatedAt: now() };
    const l = S['/admin/cms/pages'] || [];
    const i = l.findIndex((p) => p.key === key);
    if (i >= 0) l[i] = page; else l.push(page);
    P[`/public/pages/${key}`] = page;
    return ok(page);
  }
  if ((r = path.match(/^\/admin\/cms\/services\/(.+)$/))) {
    const slug = decodeURIComponent(r[1]);
    const l = S['/admin/cms/services'] || [];
    const i = l.findIndex((s) => s.slug === slug);
    const svc = { ...(l[i] || {}), ...body, slug };
    if (i >= 0) l[i] = svc;
    P[`/public/services/${slug}`] = svc;
    const card = (P['/public/services'] || []).find((s) => s.slug === slug);
    if (card) Object.assign(card, { title: svc.title, shortText: svc.shortText });
    return ok(svc);
  }
  if ((r = path.match(/^\/admin\/cms\/amcs\/(\d+)\/logo$/))) {
    const file = body instanceof FormData ? body.get('file') : null;
    const url = file ? URL.createObjectURL(file) : null;
    const amc = patchEverywhere(S, '/admin/cms/amcs', r[1], { logoUrl: url });
    syncPublic('amcs', S['/admin/cms/amcs']);
    return amc ? ok(amc) : fail(404, 'NOT_FOUND', 'AMC not found.');
  }
  if ((r = path.match(/^\/admin\/cms\/(articles|faqs|banners|amcs|testimonials|team)(?:\/(\d+))?$/))) {
    const [, coll, id] = r;
    const key = `/admin/cms/${coll}`;
    const l = (S[key] = S[key] || []);
    let item;
    if (m === 'POST') { item = { id: ++seq, ...body, updatedAt: now() }; l.push(item); }
    else if (m === 'PUT') { item = l.find((x) => String(x.id) === id); if (!item) return fail(404, 'NOT_FOUND', 'Not found.'); Object.assign(item, body, { updatedAt: now() }); }
    else { const i = l.findIndex((x) => String(x.id) === id); if (i >= 0) l.splice(i, 1); }
    if (coll === 'articles' && item) item.status = !item.publishAt ? 'DRAFT' : item.publishAt > now() ? 'SCHEDULED' : 'PUBLISHED';
    syncPublic(coll, l);
    return ok(item || { ok: true });
  }
  // clients
  if (path === '/admin/clients' && m === 'POST') {
    const rm = isAdmin ? (S['/admin/rms'] || []).find((x) => String(x.id) === String(body.rmId)) : { id: u.me.id, name: u.me.name };
    const c = { id: ++seq, name: body.name, panMasked: `XXXXX${String(body.pan || '').slice(5)}`, mobileMasked: `XXXXXX${String(body.mobile || '').slice(-4)}`, email: body.email, rmId: rm?.id ?? null, rmName: rm?.name ?? null, aum: 0, sipCount: 0, kycStatus: body.kycStatus || 'VALIDATED', loginStatus: 'NOT_ACTIVATED', familyHeadId: body.familyHeadId ?? null, familyHeadName: null, relation: body.relation ?? null, createdAt: now() };
    S['/admin/clients'].unshift(c);
    S[`/admin/clients/${c.id}`] = { ...c, dob: body.dob, address: body.address, family: [], holdings: [], sips: [], orders: [] };
    return ok({ client: c, activationLink: `${location.origin}/activate/demo-${c.id}` });
  }
  if ((r = path.match(/^\/admin\/clients\/(\d+)(?:\/(activation-link|status))?$/))) {
    const [, id, act] = r;
    if (act === 'activation-link') return ok({ activationLink: `${location.origin}/activate/demo-${id}` });
    const patch = act === 'status' ? { loginStatus: body.enabled ? 'ACTIVE' : 'DISABLED' } : { name: body.name, email: body.email, kycStatus: body.kycStatus, address: body.address };
    const c = patchEverywhere(S, '/admin/clients', id, patch);
    if (S[`/admin/clients/${id}`]) Object.assign(S[`/admin/clients/${id}`], patch);
    return c ? ok(c) : fail(404, 'NOT_FOUND', 'Client not found.');
  }
  if ((r = path.match(/^\/admin\/leads\/(\d+)$/))) {
    const rm = body.assignedRmId ? (S['/admin/rms'] || []).find((x) => String(x.id) === String(body.assignedRmId)) : null;
    const lead = patchEverywhere(S, '/admin/leads', r[1], { ...body, ...(rm ? { assignedRmName: rm.name } : {}) });
    return lead ? ok(lead) : fail(404, 'NOT_FOUND', 'Lead not found.');
  }
  if ((r = path.match(/^\/admin\/kyc\/(\d+)$/))) {
    const d = S[path];
    if (!d) return fail(404, 'NOT_FOUND', 'KYC application not found.');
    if (!isAdmin && body.assignedRmId && String(body.assignedRmId) !== String(d.assignedRmId)) return fail(403, 'FORBIDDEN', 'Only an admin can reassign KYC applications');
    const rm = isAdmin && body.assignedRmId ? (S['/admin/rms'] || []).find((x) => String(x.id) === String(body.assignedRmId)) : null;
    const wasPending = ['SUBMITTED', 'UNDER_REVIEW', 'VIPV_SCHEDULED', 'ACTION_REQUIRED'].includes(d.status);
    const patch = { status: body.status || d.status, staffNotes: body.staffNotes ?? d.staffNotes, updatedAt: now() };
    if (rm) Object.assign(patch, { assignedRmId: rm.id, assignedRmName: rm.name });
    else if (!isAdmin && !d.assignedRmId) Object.assign(patch, { assignedRmId: u.me.id, assignedRmName: u.me.name });
    Object.assign(d, patch);
    patchEverywhere(S, '/admin/kyc', r[1], { status: d.status, assignedRmId: d.assignedRmId, assignedRmName: d.assignedRmName, updatedAt: d.updatedAt });
    const isPending = ['SUBMITTED', 'UNDER_REVIEW', 'VIPV_SCHEDULED', 'ACTION_REQUIRED'].includes(d.status);
    if (S['/admin/dashboard'] && wasPending !== isPending) S['/admin/dashboard'].pendingKyc = Math.max(0, (S['/admin/dashboard'].pendingKyc || 0) + (isPending ? 1 : -1));
    const pub = kycPublic.find((x) => x.ref === d.ref);
    if (pub) Object.assign(pub, { status: d.status, updatedAt: d.updatedAt });
    return ok(d);
  }
  if ((r = path.match(/^\/admin\/tickets\/(\d+)$/))) {
    const t = patchEverywhere(S, '/admin/tickets', r[1], (x) => ({ status: body.status || x.status, updatedAt: now(), comments: body.comment ? [...(x.comments || []), { by: u.me.name, text: body.comment, at: now() }] : x.comments }));
    return t ? ok(t) : fail(404, 'NOT_FOUND', 'Ticket not found.');
  }
  if (path === '/admin/orders' && m === 'POST') {
    const [orders, err] = buildOrders(S, body, { name: u.me.name, role: u.me.role, investorName: (S['/admin/clients'] || []).find((c) => String(c.id) === String(body.investorId))?.name }, 'PENDING_APPROVAL');
    if (err) return err;
    S['/admin/orders'].unshift(...orders);
    const IS = storeForInvestor(body.investorId);
    if (IS?.['/investor/orders']) {
      IS['/investor/orders'].unshift(...clone(orders));
      notify(IS, 'ORDER', 'Order awaiting your approval', `${u.me.name} proposed ${orders.length} order(s). Approve with OTP in Orders.`);
    }
    return ok(orders);
  }
  if ((r = path.match(/^\/admin\/orders\/(\d+)\/status$/))) {
    const o = (S['/admin/orders'] || []).find((x) => String(x.id) === r[1]);
    if (!o) return fail(404, 'NOT_FOUND', 'Order not found.');
    advance(o, null, body.status, body.note || 'Updated by admin');
    return ok(o);
  }
  // users
  if (path === '/admin/users' && m === 'POST') {
    const user = { id: ++seq, name: body.name, email: body.email, mobileMasked: `XXXXXX${String(body.mobile || '').slice(-4)}`, role: body.role, euin: body.euin, enabled: true, loginStatus: 'ACTIVE', lastLoginAt: null };
    S['/admin/users'].push(user);
    return ok({ user, tempPassword: 'Temp@' + Math.floor(1000 + Math.random() * 9000) + '!' });
  }
  if ((r = path.match(/^\/admin\/users\/(\d+)\/(reset-password|force-logout|status)$/))) {
    if (r[2] === 'reset-password') return ok({ tempPassword: 'Temp@' + Math.floor(1000 + Math.random() * 9000) + '!' });
    if (r[2] === 'force-logout') return ok();
    const user = patchEverywhere(S, '/admin/users', r[1], { enabled: body.enabled, loginStatus: body.enabled ? 'ACTIVE' : 'DISABLED' });
    return user ? ok(user) : fail(404, 'NOT_FOUND', 'User not found.');
  }
  if (path === '/admin/sync/nav' || path === '/admin/sync/rta') {
    const run = { id: ++seq, type: path.endsWith('nav') ? 'NAV' : 'RTA', startedAt: now(), finishedAt: now(), status: 'SUCCESS', processed: path.endsWith('nav') ? 24 : 0, failed: 0, errors: ['Demo mode: no data was imported.'], summary: null, triggeredBy: u.me.name };
    (S['/admin/sync/runs'] = S['/admin/sync/runs'] || []).unshift(run);
    return ok(run);
  }
  if (path === '/admin/sync/nfos') {
    const views = nfoStore().map((n) => nfoView(n, true)).filter((n) => !n.hidden);
    const c = (st) => views.filter((n) => n.status === st).length;
    const run = {
      id: ++seq, type: 'NFO', startedAt: now(), finishedAt: now(), status: 'SUCCESS', processed: views.length, failed: 0,
      errors: ['Demo mode: nothing was downloaded or changed.'], summary: c('OPEN') + ' open, ' + c('UPCOMING') + ' upcoming, ' + c('CLOSED') + ' recently closed; 0 new, 0 updated (demo)',
      triggeredBy: u.me.name,
    };
    (S['/admin/sync/runs'] = S['/admin/sync/runs'] || []).unshift(run);
    return ok(run);
  }
  if (path === '/admin/sync/details' || path === '/admin/sync/schemes') {
    const details = path.endsWith('details');
    const run = {
      id: ++seq, type: details ? 'DETAILS' : 'SCHEMES', startedAt: now(), finishedAt: now(), status: 'SUCCESS', processed: details ? 24 : 24, failed: 0,
      errors: ['Demo mode: nothing was downloaded or changed.'],
      summary: details ? 'Details found for 24 of 24 schemes, 0 changed' : 'Added 0, deactivated 0, reactivated 0 (24 Regular Growth schemes of 6 AMCs in the AMFI file)',
      triggeredBy: u.me.name,
    };
    (S['/admin/sync/runs'] = S['/admin/sync/runs'] || []).unshift(run);
    return ok(run);
  }
  return fail(404, 'NOT_FOUND', 'Not found.');
}

// ---------- router ----------
async function handle(req) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*?\/api(?=\/)/, '');
  const params = url.searchParams;
  let body = null;
  if (req.method !== 'GET' && req.method !== 'DELETE') {
    const ct = req.headers.get('Content-Type') || '';
    if (ct.includes('multipart/form-data')) body = await req.formData();
    else { const t = await req.text(); body = t ? JSON.parse(t) : {}; }
  }
  if (path.startsWith('/auth/')) return auth(req, path, body || {});
  if (path.startsWith('/public/')) return publicApi(req, path, params, body || {});
  const u = sessionUser(req);
  if (!u) return fail(401, 'UNAUTHORIZED', 'Please log in.');
  if (path.startsWith('/investor/')) return u.me.role === 'INVESTOR' ? investor(req, path, params, body || {}, u) : fail(403, 'FORBIDDEN', 'You do not have access to this.');
  if (path.startsWith('/admin/')) return u.me.role !== 'INVESTOR' ? admin(req, path, params, body || {}, u) : fail(403, 'FORBIDDEN', 'You do not have access to this.');
  return fail(404, 'NOT_FOUND', 'Not found.');
}

export function installMockApi() {
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const raw = typeof input === 'string' ? input : input.url;
    if (!raw.includes('/api/')) return realFetch(input, init);
    const req = typeof input === 'string' ? new Request(raw.startsWith('/') ? 'https://demo.local' + raw : raw, init) : input;
    await new Promise((r) => setTimeout(r, 120 + Math.random() * 180)); // feel like a network
    try {
      return await handle(req);
    } catch (e) {
      console.error('[demo api]', e);
      return fail(500, 'INTERNAL_ERROR', 'The demo could not handle this request.');
    }
  };
}

export const demoAccounts = [
  { label: 'Investor · Priya Menon', userId: '9876543210', password: 'Priya@2026' },
  { label: 'Investor · Venkat Rao', userId: '9876500001', password: 'Rao@2026' },
  { label: 'Relationship manager · Ananya', userId: 'ananya@aureusfinserve.in', password: 'Rm@2026!' },
  { label: 'Admin', userId: 'admin@aureusfinserve.in', password: 'Admin@2026' },
];
export const today_ = today;
