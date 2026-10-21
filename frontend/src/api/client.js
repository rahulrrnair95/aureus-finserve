// Fetch wrapper: adds Authorization + X-Device-Id, parses JSON errors into ApiError {error, code, fields}.

const TOKEN_KEY = 'af.token';
const DEVICE_KEY = 'af.deviceId';
const BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = uuid();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return 'no-storage-device';
  }
}

// memToken keeps the session working where browser storage is blocked (e.g. sandboxed previews).
let memToken = null;

export function getToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || memToken;
  } catch {
    return memToken;
  }
}

export function setToken(t) {
  memToken = t || null;
  try {
    if (t) sessionStorage.setItem(TOKEN_KEY, t);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export class ApiError extends Error {
  constructor({ error, code, fields, status }) {
    super(error || 'Something went wrong');
    this.error = error || 'Something went wrong';
    this.code = code || (status ? `HTTP_${status}` : 'NETWORK');
    this.fields = fields || null;
    this.status = status || 0;
  }
}

/** Listeners notified when the server says the session is gone. */
const unauthorizedListeners = new Set();
export function onUnauthorized(fn) {
  unauthorizedListeners.add(fn);
  return () => unauthorizedListeners.delete(fn);
}

/** Activity listeners (for idle timer: any successful API call is not user activity, so we don't use it). */

function buildUrl(path, query) {
  let url = `${BASE}/api${path}`;
  if (query) {
    const qs = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.append(k, v);
    });
    const s = qs.toString();
    if (s) url += `?${s}`;
  }
  return url;
}

function headers(extra = {}, json = true) {
  const h = { 'X-Device-Id': getDeviceId(), Accept: 'application/json', ...extra };
  if (json) h['Content-Type'] = 'application/json';
  const t = getToken();
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

async function parseError(res) {
  let body = null;
  try {
    const text = await res.text();
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  const fallback =
    res.status === 429
      ? 'Too many attempts. Please wait a minute and try again.'
      : res.status >= 500
        ? 'Our server ran into a problem. Please try again shortly.'
        : res.status === 404
          ? 'Not found.'
          : res.status === 403
            ? 'You do not have access to this.'
            : 'Request failed.';
  return new ApiError({
    error: body?.error || body?.message || fallback,
    code: body?.code || (res.status === 401 ? 'UNAUTHORIZED' : res.status === 403 ? 'FORBIDDEN' : res.status === 404 ? 'NOT_FOUND' : res.status === 429 ? 'RATE_LIMITED' : undefined),
    fields: body?.fields,
    status: res.status,
  });
}

function handle401(err, path) {
  if (err.status === 401 && (err.code === 'SESSION_EXPIRED' || err.code === 'UNAUTHORIZED') && !path.startsWith('/auth/login') && !path.startsWith('/auth/verify-otp')) {
    const hadToken = !!getToken();
    setToken(null);
    if (hadToken) unauthorizedListeners.forEach((fn) => fn(err));
  }
}

export async function request(method, path, { body, query, signal, raw = false } = {}) {
  let res;
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers: headers({}, !isForm && body !== undefined),
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError({ error: 'Unable to reach the server. Check your connection and try again.', code: 'NETWORK' });
  }
  if (!res.ok) {
    const err = await parseError(res);
    handle401(err, path);
    throw err;
  }
  if (raw) return res;
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const api = {
  get: (path, query, opts) => request('GET', path, { query, ...opts }),
  post: (path, body, opts) => request('POST', path, { body, ...opts }),
  put: (path, body, opts) => request('PUT', path, { body, ...opts }),
  del: (path, opts) => request('DELETE', path, opts),
  upload: (path, formData) => request('POST', path, { body: formData }),
};

/** Fetch with auth header → blob → trigger browser download. */
export async function downloadFile(path, query, fallbackName = 'download') {
  const res = await request('GET', path, { query, raw: true });
  const blob = await res.blob();
  let name = fallbackName;
  const cd = res.headers.get('Content-Disposition') || '';
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
  if (m) name = decodeURIComponent(m[1]);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** Friendly messages for well-known error codes. */
export function friendlyError(err) {
  if (!err) return '';
  switch (err.code) {
    case 'INVALID_CREDENTIALS':
      return 'The user ID or password is incorrect. Please try again.';
    case 'ACCOUNT_LOCKED':
      return err.error || 'Your account is temporarily locked after too many attempts.';
    case 'ACCOUNT_DISABLED':
      return 'This account has been disabled. Please contact us for help.';
    case 'NOT_ACTIVATED':
      return 'Your account is not activated yet. Please use the activation link we sent you, or contact your relationship manager.';
    case 'CAPTCHA_REQUIRED':
      return 'For your security, please answer the question below.';
    case 'CAPTCHA_INVALID':
      return 'The answer to the security question was incorrect. Please try the new question.';
    case 'OTP_INVALID':
      return err.error || 'The OTP you entered is incorrect.';
    case 'OTP_EXPIRED':
      return 'This OTP has expired. Please request a new one.';
    case 'OTP_ATTEMPTS_EXCEEDED':
      return 'Too many incorrect attempts. Please request a new OTP.';
    case 'SESSION_EXPIRED':
      return 'Your session expired. Please log in again.';
    case 'KYC_NOT_VALID':
      return 'Your KYC is not validated, so orders cannot be placed yet. Please contact your relationship manager.';
    case 'RATE_LIMITED':
      return 'Too many attempts. Please wait a few minutes and try again.';
    default:
      return err.error || err.message || 'Something went wrong.';
  }
}
