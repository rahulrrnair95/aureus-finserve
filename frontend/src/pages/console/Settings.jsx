import { useState } from 'react';
import { useTitle } from '../../utils/useTitle';
import { useAuth } from '../../auth/AuthContext';
import Button from '../../components/Button';
import { Alert } from '../../components/States';
import Icon from '../../components/Icon';
import ChangePasswordForm from '../auth/ChangePasswordForm';
import { DetailList, PageTitle } from './parts/ui';

export default function Settings() {
  useTitle('Settings');
  const { user, signOut } = useAuth();
  const [leaving, setLeaving] = useState(false);

  return (
    <div className="stack-lg">
      <PageTitle eyebrow="Account" title="Settings" />
      <div className="grid grid-2">
        <section className="card" aria-labelledby="con-set-pw">
          <div className="card__head">
            <h2 id="con-set-pw" className="card__title">
              Change password
            </h2>
          </div>
          <ChangePasswordForm />
        </section>

        <div className="stack-lg">
          <section className="card" aria-labelledby="con-set-me">
            <div className="card__head">
              <h2 id="con-set-me" className="card__title">
                Your account
              </h2>
            </div>
            <DetailList
              items={[
                ['Name', user?.name],
                ['Role', user?.role],
                ['Email', user?.email],
                ['Mobile', user?.mobileMasked],
                ['EUIN', user?.euin],
              ]}
            />
          </section>
          <section className="card stack" aria-labelledby="con-set-sess">
            <h2 id="con-set-sess" className="card__title">
              Session security
            </h2>
            <Alert type="info">
              Staff accounts allow one active session at a time — logging in elsewhere signs this session out. You are signed out automatically after {user?.idleTimeoutMinutes || 30} minutes of
              inactivity.
            </Alert>
            <div>
              <Button
                variant="outline"
                loading={leaving}
                onClick={() => {
                  setLeaving(true);
                  signOut('You have been logged out.');
                }}
              >
                <Icon name="logout" size={18} /> Log out
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
