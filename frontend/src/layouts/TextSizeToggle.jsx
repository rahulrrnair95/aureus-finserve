import { useEffect, useState } from 'react';
import { applyTextSize, getTextSize } from '../utils/useTitle';

const EVT = 'af:textsize';

/** "A / A+" text-size toggle, persisted in localStorage; all instances stay in sync. */
export default function TextSizeToggle() {
  const [size, setSize] = useState(getTextSize);
  useEffect(() => {
    const on = (e) => setSize(e.detail);
    window.addEventListener(EVT, on);
    return () => window.removeEventListener(EVT, on);
  }, []);
  const choose = (s) => {
    applyTextSize(s);
    setSize(s);
    window.dispatchEvent(new CustomEvent(EVT, { detail: s }));
  };
  return (
    <div className="textsize" role="group" aria-label="Text size">
      <button type="button" aria-pressed={size === 'normal'} onClick={() => choose('normal')} aria-label="Normal text size">
        A
      </button>
      <button type="button" aria-pressed={size === 'large'} onClick={() => choose('large')} aria-label="Larger text size">
        A+
      </button>
    </div>
  );
}
