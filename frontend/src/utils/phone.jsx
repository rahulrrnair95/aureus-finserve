// Phone fields may hold several numbers ("+91 9020467232, +91 6282659654").

/** Individual numbers from a phone field, split on commas, slashes, semicolons or " or ". */
export const splitPhones = (v) =>
  String(v || '')
    .split(/\s*(?:,|\/|;|\bor\b)\s*/i)
    .map((p) => p.trim())
    .filter((p) => /\d{6,}/.test(p.replace(/\D/g, '')));

/** tel: href for one number (keeps a leading +). */
export const telHref = (num) => `tel:${String(num).trim().startsWith('+') ? '+' : ''}${String(num).replace(/\D/g, '')}`;

/** First number of a phone field (for single-target links such as the floating call button or WhatsApp). */
export const firstPhone = (v) => splitPhones(v)[0] || '';

/** Each number as its own call link, separated by ", ". */
export function PhoneLinks({ value }) {
  const nums = splitPhones(value);
  return nums.map((n, i) => (
    <span key={n}>
      {i > 0 && ', '}
      <a href={telHref(n)}>{n}</a>
    </span>
  ));
}
