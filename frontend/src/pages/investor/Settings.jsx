import { useState } from 'react';
import { useTitle } from '../../utils/useTitle';
import { useAuth } from '../../auth/AuthContext';
import ChangePasswordForm from '../auth/ChangePasswordForm';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import { InfoList, PageTitle } from './parts/common';

export default function Settings() {
  useTitle('Settings');
  const { user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const idle = user?.idleTimeoutMinutes || 15;

  return (
    <div className="stack-lg">
      <PageTitle eyebrow="Account" title="Settings" />
      <div className="inv-ov-grid">
        <section className="card" aria-labelledby="inv-set-pw">
          <h2 id="inv-set-pw" className="card__title">
            Change password
          </h2>
          <p className="small muted">For your security we will send an OTP to your registered mobile and email before the change takes effect.</p>
          <ChangePasswordForm />
        </section>
        <div className="stack-lg">
          <section className="card" aria-labelledby="inv-set-acc">
            <h2 id="inv-set-acc" className="card__title">
              Your login
            </h2>
            <InfoList
              items={[
                { label: 'Name', value: user?.name },
                { label: 'Email', value: user?.email },
                { label: 'Mobile', value: <span className="num">{user?.mobileMasked}</span> },
                { label: 'PAN', value: <span className="num">{user?.panMasked}</span> },
              ]}
            />
          </section>
          <section className="card" aria-labelledby="inv-set-text">
            <h2 id="inv-set-text" className="card__title">
              Text size
            </h2>
            <p className="small" style={{ margin: 0 }}>
              Prefer larger text? Use the <strong>A</strong> / <strong>A+</strong> buttons in the top bar of every page. Your choice is remembered on this device. Your browser’s zoom (Ctrl / ⌘ and +) also works throughout the site.
            </p>
          </section>
          <section className="card" aria-labelledby="inv-set-out">
            <h2 id="inv-set-out" className="card__title">
              Session & security
            </h2>
            <p className="small">
              For your protection you are logged out automatically after {idle} minutes of inactivity, and every session ends after 8 hours. Always log out on shared devices.
            </p>
            <Button
              variant="outline"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                await signOut('You have been logged out.');
              }}
            >
              <Icon name="logout" size={16} /> Log out
            </Button>
          </section>
        </div>
      </div>
    </div>
  );
}
