import { useEffect } from 'react';
import { seoTitle } from '../seoContent';

export function useTitle(title) {
  useEffect(() => {
    // same titles as the static HTML written by scripts/seo.mjs
    document.title = seoTitle(window.location.pathname, title);
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
