// Static build (`npm run build:static`, Vite mode `static`): the public site only, served from Firebase Hosting with no
// backend. Public GET calls are answered from JSON snapshots (src/static/staticApi.js); login, investor / staff areas,
// online KYC and every form that posts to the backend are hidden. The normal build is unaffected (flag is false).
export const STATIC_SITE = import.meta.env.VITE_STATIC === '1';

/** Shown where a form used to be, and returned as the error of any blocked API call. */
export const STATIC_UNAVAILABLE = 'This feature is not available on this version of the website. Please call or WhatsApp us.';
