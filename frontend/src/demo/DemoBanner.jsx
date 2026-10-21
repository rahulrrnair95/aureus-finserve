import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEMO_OTP, demoAccounts } from './mockApi';
import './demo.css';

const TRY = [
  'Browse funds, open a scheme page and its risk-o-meter',
  'Run the 8 calculators (SIP, step-up, goal, retirement, SWP, ELSS…)',
  'Investor: portfolio, holdings, SIP pause / step-up, place an order and watch it get allotted',
  'Investor: approve the order your RM proposed with OTP',
  'Admin: dashboard, clients, leads, order desk, content editor, audit log',
  'Admin: edit home-page text in Content and see it on the site',
];

/** Floating panel shown only in the static demo build: login details and what to try. */
export default function DemoBanner() {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState('logins');
  const navigate = useNavigate();
  return (
    <aside className="demo-panel" aria-label="Demo preview">
      <button type="button" className="demo-panel__toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="demo-panel__dot" aria-hidden="true" />
        Preview · sample data
        <span aria-hidden="true">{open ? '–' : '+'}</span>
      </button>
      {open && (
        <div className="demo-panel__body">
          <p>
            Working preview with fictional data; changes reset on reload. OTP is always <strong>{DEMO_OTP}</strong>.
          </p>
          <div className="demo-panel__tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'logins'} onClick={() => setTab('logins')}>Login details</button>
            <button type="button" role="tab" aria-selected={tab === 'try'} onClick={() => setTab('try')}>Things to try</button>
          </div>
          {tab === 'logins' ? (
            <ul className="demo-panel__accounts">
              {demoAccounts.map((a) => (
                <li key={a.userId}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      navigate('/login', { state: { demo: a } });
                    }}
                  >
                    <span className="demo-panel__who">{a.label}</span>
                    <span className="demo-panel__cred">
                      {a.userId} · {a.password}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <ol className="demo-panel__try">
              {TRY.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ol>
          )}
          {tab === 'logins' && <p className="demo-panel__hint">Tap an account to fill the login form, then press Log in and enter {DEMO_OTP}.</p>}
        </div>
      )}
    </aside>
  );
}
