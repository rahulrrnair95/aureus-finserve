// Client-side mirror of the server password policy (server is authoritative).
export function passwordChecks(pw = '', { pan = '', mobile = '' } = {}) {
  const lower = pw.toLowerCase();
  const notPanMobile =
    pw.length > 0 &&
    (!pan || lower !== String(pan).toLowerCase()) &&
    (!mobile || lower !== String(mobile).toLowerCase()) &&
    !/^\d{10}$/.test(pw) &&
    !/^[a-z]{5}\d{4}[a-z]$/i.test(pw);
  return [
    { key: 'length', label: '8 to 64 characters', ok: pw.length >= 8 && pw.length <= 64 },
    { key: 'letter', label: 'At least one letter', ok: /[A-Za-z]/.test(pw) },
    { key: 'digit', label: 'At least one number', ok: /\d/.test(pw) },
    { key: 'symbol', label: 'At least one symbol (e.g. @ # $ !)', ok: /[^A-Za-z0-9]/.test(pw) },
    { key: 'notId', label: 'Not your PAN or mobile number', ok: notPanMobile },
  ];
}

export function passwordValid(pw, ctx) {
  return passwordChecks(pw, ctx).every((c) => c.ok);
}

/** Hint text for the User ID field. */
export function detectUserIdType(v = '') {
  const s = v.trim();
  if (!s) return 'Enter your registered mobile number, email or PAN';
  if (/^\d{1,10}$/.test(s)) return s.length === 10 ? 'Detected: mobile number' : 'Looks like a mobile number — 10 digits';
  if (s.includes('@')) return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) ? 'Detected: email address' : 'Looks like an email address';
  if (/^[A-Za-z]{5}\d{4}[A-Za-z]$/.test(s)) return 'Detected: PAN';
  if (/^[A-Za-z]{1,5}\d{0,4}[A-Za-z]?$/.test(s)) return 'Looks like a PAN — format AAAAA9999A';
  return 'Enter your registered mobile number, email or PAN';
}
