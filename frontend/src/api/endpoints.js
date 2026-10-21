// Typed-ish wrappers for every endpoint in docs/API.md. Do not add endpoints that are not in the contract.
import { api, downloadFile } from './client';

const enc = encodeURIComponent;

export const authApi = {
  login: (body) => api.post('/auth/login', body),
  loginOtp: (userId) => api.post('/auth/login-otp', { userId }),
  verifyOtp: (body) => api.post('/auth/verify-otp', body),
  resendOtp: (challengeId) => api.post('/auth/resend-otp', { challengeId }),
  forgot: (userId) => api.post('/auth/forgot', { userId }),
  reset: (body) => api.post('/auth/reset', body),
  activateCheck: (token) => api.get(`/auth/activate/${enc(token)}`),
  activateVerify: (body) => api.post('/auth/activate/verify', body),
  activateComplete: (body) => api.post('/auth/activate/complete', body),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  changePasswordOtp: () => api.post('/auth/change-password/otp'),
  changePassword: (body) => api.post('/auth/change-password', body),
  captcha: () => api.get('/auth/captcha'),
};

export const publicApi = {
  site: () => api.get('/public/site'),
  schemes: (q) => api.get('/public/schemes', q),
  schemeFilters: () => api.get('/public/schemes/filters'),
  scheme: (id) => api.get(`/public/schemes/${enc(id)}`),
  articles: (category) => api.get('/public/articles', { category }),
  article: (slug) => api.get(`/public/articles/${enc(slug)}`),
  faqs: () => api.get('/public/faqs'),
  glossary: () => api.get('/public/glossary'),
  testimonials: () => api.get('/public/testimonials'),
  team: () => api.get('/public/team'),
  banners: () => api.get('/public/banners'),
  page: (key) => api.get(`/public/pages/${enc(key)}`),
  home: () => api.get('/public/home'),
  amcs: () => api.get('/public/amcs'),
  about: () => api.get('/public/about'),
  services: () => api.get('/public/services'),
  service: (slug) => api.get(`/public/services/${enc(slug)}`),
  /** multipart: { name, mobile, email, consent, challengeId, otp, casPassword?, website, file } */
  portfolioReview: (fields) => {
    const fd = new FormData();
    Object.entries(fields).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      fd.append(k, typeof v === 'boolean' ? String(v) : v);
    });
    return api.upload('/public/portfolio-review', fd);
  },
  /** logoUrl from /amcs is used as-is; this is only a fallback builder. */
  amcLogoUrl: (id) => `/api/public/amcs/${enc(id)}/logo`,
  leadOtp: (mobile) => api.post('/public/leads/otp', { mobile }),
  lead: (body) => api.post('/public/leads', body),
  /** Online KYC step 1: verify the mobile OTP issued by leadOtp. → { ok, validMinutes } */
  kycVerifyOtp: (body) => api.post('/public/kyc/verify-otp', body),
  /** multipart: flat fields + one File per document type (part name = doc type, e.g. PAN_CARD). → { ref, ok } */
  kycSubmit: (fields, files) => {
    const fd = new FormData();
    Object.entries(fields).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      fd.append(k, typeof v === 'boolean' ? String(v) : v);
    });
    Object.entries(files || {}).forEach(([type, file]) => {
      if (file) fd.append(type, file, file.name);
    });
    return api.upload('/public/kyc', fd);
  },
  /** { ref, mobile } → { ref, status, submittedAt, updatedAt, message } */
  kycStatus: (body) => api.post('/public/kyc/status', body),
  /** New fund offers. q: { status: open|upcoming|closed|all (default open+upcoming), amc, assetClass, q } → [Nfo] */
  nfos: (q) => api.get('/public/nfos', q),
  nfo: (id) => api.get(`/public/nfos/${enc(id)}`),
  nfoOnePager: (id, name) => downloadFile(`/public/nfos/${enc(id)}/one-pager`, undefined, name || `nfo-${id}-one-pager.pdf`),
};

const m = (member) => (member && member !== 'self' ? { member } : {});

export const investorApi = {
  family: () => api.get('/investor/family'),
  portfolio: (member) => api.get('/investor/portfolio', m(member)),
  holdings: (member) => api.get('/investor/holdings', m(member)),
  holdingTxns: (folioId) => api.get(`/investor/holdings/${enc(folioId)}/transactions`),
  transactions: (q) => api.get('/investor/transactions', q),
  sips: (member) => api.get('/investor/sips', m(member)),
  pauseSip: (id, months) => api.post(`/investor/sips/${id}/pause`, { months }),
  resumeSip: (id) => api.post(`/investor/sips/${id}/resume`),
  stepUpSip: (id, stepUpPct) => api.post(`/investor/sips/${id}/step-up`, { stepUpPct }),
  cancelSip: (id) => api.post(`/investor/sips/${id}/cancel`),
  orders: (status) => api.get('/investor/orders', { status }),
  placeOrders: (cart) => api.post('/investor/orders', cart),
  approveOtp: (id) => api.post(`/investor/orders/${id}/approve-otp`),
  approve: (id, body) => api.post(`/investor/orders/${id}/approve`, body),
  reject: (id) => api.post(`/investor/orders/${id}/reject`),
  capitalGains: (fy, member) => api.get('/investor/reports/capital-gains', { fy, ...m(member) }),
  financialYears: () => api.get('/investor/reports/financial-years'),
  downloadReport: (kind, q, name) => downloadFile(`/investor/reports/${kind}/download`, q, name),
  goals: () => api.get('/investor/goals'),
  createGoal: (b) => api.post('/investor/goals', b),
  updateGoal: (id, b) => api.put(`/investor/goals/${id}`, b),
  deleteGoal: (id) => api.del(`/investor/goals/${id}`),
  profile: () => api.get('/investor/profile'),
  tickets: () => api.get('/investor/tickets'),
  createTicket: (b) => api.post('/investor/tickets', b),
  rm: () => api.get('/investor/rm'),
  rmCallback: (b) => api.post('/investor/rm/callback', b),
  notifications: () => api.get('/investor/notifications'),
  readNotification: (id) => api.post(`/investor/notifications/${id}/read`),
  readAllNotifications: () => api.post('/investor/notifications/read-all'),
};

export const adminApi = {
  dashboard: () => api.get('/admin/dashboard'),
  clients: (q) => api.get('/admin/clients', q),
  client: (id) => api.get(`/admin/clients/${id}`),
  createClient: (b) => api.post('/admin/clients', b),
  updateClient: (id, b) => api.put(`/admin/clients/${id}`, b),
  activationLink: (id) => api.post(`/admin/clients/${id}/activation-link`),
  clientStatus: (id, enabled) => api.post(`/admin/clients/${id}/status`, { enabled }),
  rms: () => api.get('/admin/rms'),
  leads: (q) => api.get('/admin/leads', q),
  updateLead: (id, b) => api.put(`/admin/leads/${id}`, b),
  kyc: (q) => api.get('/admin/kyc', q),
  kycDetail: (id) => api.get(`/admin/kyc/${id}`),
  updateKyc: (id, b) => api.put(`/admin/kyc/${id}`, b),
  kycDocument: (id, docId, name) => downloadFile(`/admin/kyc/${id}/documents/${docId}`, undefined, name || `kyc-${id}-document-${docId}`),
  leadAttachment: (id) => downloadFile(`/admin/leads/${id}/attachment`, undefined, `lead-${id}-cas.pdf`),
  orders: (q) => api.get('/admin/orders', q),
  placeOrders: (cart) => api.post('/admin/orders', cart),
  orderStatus: (id, b) => api.post(`/admin/orders/${id}/status`, b),
  tickets: (status) => api.get('/admin/tickets', { status }),
  updateTicket: (id, b) => api.put(`/admin/tickets/${id}`, b),
  brokerage: (month) => api.get('/admin/brokerage', { month }),
  cmsArticles: () => api.get('/admin/cms/articles'),
  createArticle: (b) => api.post('/admin/cms/articles', b),
  updateArticle: (id, b) => api.put(`/admin/cms/articles/${id}`, b),
  deleteArticle: (id) => api.del(`/admin/cms/articles/${id}`),
  cmsFaqs: () => api.get('/admin/cms/faqs'),
  createFaq: (b) => api.post('/admin/cms/faqs', b),
  updateFaq: (id, b) => api.put(`/admin/cms/faqs/${id}`, b),
  deleteFaq: (id) => api.del(`/admin/cms/faqs/${id}`),
  cmsBanners: () => api.get('/admin/cms/banners'),
  createBanner: (b) => api.post('/admin/cms/banners', b),
  updateBanner: (id, b) => api.put(`/admin/cms/banners/${id}`, b),
  deleteBanner: (id) => api.del(`/admin/cms/banners/${id}`),
  cmsPages: () => api.get('/admin/cms/pages'),
  updatePage: (key, b) => api.put(`/admin/cms/pages/${enc(key)}`, b),
  cmsHome: () => api.get('/admin/cms/home'),
  updateHome: (b) => api.put('/admin/cms/home', b),
  cmsAbout: () => api.get('/admin/cms/about'),
  updateAbout: (b) => api.put('/admin/cms/about', b),
  cmsAmcs: () => api.get('/admin/cms/amcs'),
  createAmc: (b) => api.post('/admin/cms/amcs', b),
  updateAmc: (id, b) => api.put(`/admin/cms/amcs/${id}`, b),
  deleteAmc: (id) => api.del(`/admin/cms/amcs/${id}`),
  uploadAmcLogo: (id, file) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.upload(`/admin/cms/amcs/${id}/logo`, fd);
  },
  cmsTestimonials: () => api.get('/admin/cms/testimonials'),
  createTestimonial: (b) => api.post('/admin/cms/testimonials', b),
  updateTestimonial: (id, b) => api.put(`/admin/cms/testimonials/${id}`, b),
  deleteTestimonial: (id) => api.del(`/admin/cms/testimonials/${id}`),
  cmsTeam: () => api.get('/admin/cms/team'),
  createTeamMember: (b) => api.post('/admin/cms/team', b),
  updateTeamMember: (id, b) => api.put(`/admin/cms/team/${id}`, b),
  deleteTeamMember: (id) => api.del(`/admin/cms/team/${id}`),
  cmsServices: () => api.get('/admin/cms/services'),
  updateService: (slug, b) => api.put(`/admin/cms/services/${enc(slug)}`, b),
  updateSite: (b) => api.put('/admin/cms/site', b),
  users: () => api.get('/admin/users'),
  createUser: (b) => api.post('/admin/users', b),
  resetUserPassword: (id) => api.post(`/admin/users/${id}/reset-password`),
  forceLogout: (id) => api.post(`/admin/users/${id}/force-logout`),
  userStatus: (id, enabled) => api.post(`/admin/users/${id}/status`, { enabled }),
  audit: (q) => api.get('/admin/audit', q),
  auditExport: () => downloadFile('/admin/audit/export', undefined, 'audit-log.csv'),
  syncRuns: () => api.get('/admin/sync/runs'),
  syncNav: (file) => {
    if (!file) return api.post('/admin/sync/nav');
    const fd = new FormData();
    fd.append('file', file);
    return api.upload('/admin/sync/nav', fd);
  },
  syncRta: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.upload('/admin/sync/rta', fd);
  },
  syncDetails: () => api.post('/admin/sync/details'),
  syncSchemes: () => api.post('/admin/sync/schemes'),
  syncSchedule: () => api.get('/admin/sync/schedule'),
  syncNfos: () => api.post('/admin/sync/nfos'),
  // New fund offers (RM read-only; writes ADMIN only)
  nfos: (q) => api.get('/admin/nfos', q),
  nfo: (id) => api.get(`/admin/nfos/${id}`),
  createNfo: (b) => api.post('/admin/nfos', b),
  updateNfo: (id, b) => api.put(`/admin/nfos/${id}`, b),
  uploadNfoOnePager: (id, file) => {
    const fd = new FormData();
    fd.append('file', file, file.name);
    return api.upload(`/admin/nfos/${id}/one-pager`, fd);
  },
  deleteNfoOnePager: (id) => api.del(`/admin/nfos/${id}/one-pager`),
  nfoOnePager: (id, name) => downloadFile(`/admin/nfos/${id}/one-pager`, undefined, name || `nfo-${id}-one-pager.pdf`),
};
