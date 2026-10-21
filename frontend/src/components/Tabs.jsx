import { useId, useRef } from 'react';

/**
 * Accessible tabs (roving tabindex, arrow keys).
 * <Tabs tabs={[{id:'a', label:'A'}]} value={id} onChange={setId} label="Order type" />
 * Render the panel yourself with <TabPanel id={value} tabsId={...}> or just content below.
 */
export default function Tabs({ tabs, value, onChange, label }) {
  const base = useId();
  const refs = useRef({});
  const onKey = (e, idx) => {
    let n = null;
    if (e.key === 'ArrowRight') n = (idx + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') n = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = tabs.length - 1;
    if (n !== null) {
      e.preventDefault();
      onChange(tabs[n].id);
      refs.current[tabs[n].id]?.focus();
    }
  };
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => (refs.current[t.id] = el)}
          id={`${base}-${t.id}`}
          role="tab"
          type="button"
          className="tab"
          aria-selected={value === t.id}
          tabIndex={value === t.id ? 0 : -1}
          onClick={() => onChange(t.id)}
          onKeyDown={(e) => onKey(e, i)}
        >
          {t.label}
          {t.badge ? <span className="chip chip--gold" style={{ marginLeft: 6 }}>{t.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}
