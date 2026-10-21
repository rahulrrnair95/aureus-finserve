import { useEffect } from 'react';

export function useTitle(title) {
  useEffect(() => {
    // keep in step with scripts/seo.mjs (fullTitle), which writes the same titles into the static HTML
    document.title = title ? `${title} | Aureus Finserve` : 'Aureus Finserve | Mutual Fund Distributor in Thiruvananthapuram';
  }, [title]);
}

const TEXT_KEY = 'af.textSize';
export function getTextSize() {
  try {
    return localStorage.getItem(TEXT_KEY) === 'large' ? 'large' : 'normal';
  } catch {
    return 'normal';
  }
}
export function applyTextSize(size) {
  document.documentElement.dataset.textSize = size;
  try {
    localStorage.setItem(TEXT_KEY, size);
  } catch {
    /* ignore */
  }
}
