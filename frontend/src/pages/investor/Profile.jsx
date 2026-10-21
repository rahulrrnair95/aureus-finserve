import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTitle } from '../../utils/useTitle';
import { useApi } from '../../api/useApi';
import { investorApi } from '../../api/endpoints';
import Button from '../../components/Button';
import DataTable from '../../components/DataTable';
import StatusChip from '../../components/StatusChip';
import { Alert, Async } from '../../components/States';
import { SkeletonBlock } from '../../components/Skeleton';
import { useToast } from '../../components/Toast';
import { formatDate, formatINR, formatPct } from '../../utils/format';
import { InfoList, PageTitle } from './parts/common';
import TicketModal from './parts/TicketModal';

const KYC_NOTE = {
  REGISTERED: 'Your KYC is registered but not yet validated by the KRA. Orders can be placed once it is validated.',
  ON_HOLD: 'Your KYC is on hold with the KRA, so new orders cannot be placed. Your RM will help you update the required documents.',
  NOT_FOUND: 'We could not find a KYC record for your PAN. Please complete KYC to start investing — your RM can help.',
};

export default function Profile() {
  useTitle('Profile');
  const toast = useToast();
  const q = useApi(() => investorApi.profile(), []);
  const [req, setReq] = useState(null); // { category, subject, title }

  const ask = (category, subject, title) => () => setReq({ category, subject, title });
  const changeBtn = (category, subject, label) => (
    <Button variant="outline" size="sm" onClick={ask(category, subject, `Request a change — ${label}`)}>
      Request a change
    </Button>
  );

  return (
    <div className="stack-lg">
      <PageTitle eyebrow="Account" title="Your profile" />
      <Async state={q} skeleton={<SkeletonBlock rows={10} />}>
        {(p) => (
          <div className="stack-lg">
            <section className="card" aria-labelledby="inv-pf-personal">
              <div className="card__head">
                <h2 id="inv-pf-personal" className="card__title">
                  Personal details
                </h2>
                {changeBtn('ADDRESS_CHANGE', 'Update my address / contact details', 'personal details')}
              </div>
              <InfoList
                items={[
                  { label: 'Name', value: p.name },
                  { label: 'PAN', value: <span className="num">{p.panMasked}</span> },
                  { label: 'Date of birth', value: formatDate(p.dob) },
                  { label: 'Email', value: p.email },
                  { label: 'Mobile', value: <span className="num">{p.mobileMasked}</span> },
                  { label: 'Address', value: p.address },
                  { label: 'Tax status', value: p.taxStatus },
                  {
                    label: 'KYC status',
                    value: <StatusChip status={p.kycStatus} label={p.kycStatus === 'VALIDATED' ? 'KYC validated' : undefined} />,
                  },
                ]}
              />
              {p.kycStatus && p.kycStatus !== 'VALIDATED' && (
                <div style={{ marginTop: '1rem' }}>
                  <Alert type="warning" title="KYC action needed">
                    {KYC_NOTE[p.kycStatus] || 'Your KYC is not validated yet. Please contact your relationship manager.'} <Link to="/app/rm">Contact your RM</Link>
                  </Alert>
                </div>
              )}
              <p className="tiny muted" style={{ margin: '1rem 0 0' }}>
                For your security, PAN and mobile number are partly hidden. Changes to registered details are verified by our service team and the RTA.
              </p>
            </section>

            <section className="card" aria-labelledby="inv-pf-nominee">
              <div className="card__head">
                <h2 id="inv-pf-nominee" className="card__title">
                  Nominees
                </h2>
                {changeBtn('NOMINEE_CHANGE', 'Update my nominees', 'nominees')}
              </div>
              {p.nominees?.length ? (
                <DataTable
                  caption="Nominees"
                  rowKey={(n, i) => `${n.name}-${i}`}
                  rows={p.nominees}
                  columns={[
                    { key: 'name', header: 'Name', primary: true },
                    { key: 'relation', header: 'Relation' },
                    { key: 'sharePct', header: 'Share', num: true, render: (n) => formatPct(n.sharePct, { decimals: 0 }) },
                  ]}
                />
              ) : (
                <Alert type="warning">No nominee is registered. We recommend adding a nominee to make claims simple for your family.</Alert>
              )}
            </section>

            <section className="card" aria-labelledby="inv-pf-bank">
              <div className="card__head">
                <h2 id="inv-pf-bank" className="card__title">
                  Bank accounts
                </h2>
                {changeBtn('BANK_CHANGE', 'Add or change a bank account', 'bank accounts')}
              </div>
              {p.bankAccounts?.length ? (
                <DataTable
                  caption="Registered bank accounts"
                  rowKey={(b, i) => `${b.accountMasked}-${i}`}
                  rows={p.bankAccounts}
                  columns={[
                    {
                      key: 'bankName',
                      header: 'Bank',
                      primary: true,
                      render: (b) => (
                        <span className="row" style={{ gap: '0.5rem' }}>
                          {b.bankName}
                          {b.primary && <span className="chip chip--navy">Primary</span>}
                        </span>
                      ),
                    },
                    { key: 'accountMasked', header: 'Account', render: (b) => <span className="num">{b.accountMasked}</span> },
                    { key: 'ifsc', header: 'IFSC', render: (b) => <span className="num">{b.ifsc}</span> },
                  ]}
                />
              ) : (
                <p className="small muted">No bank account registered.</p>
              )}
            </section>

            <section className="card" aria-labelledby="inv-pf-mandate">
              <div className="card__head">
                <h2 id="inv-pf-mandate" className="card__title">
                  Auto-debit mandates
                </h2>
                {changeBtn('OTHER', 'Mandate request', 'mandates')}
              </div>
              {p.mandates?.length ? (
                <DataTable
                  caption="Auto-debit mandates"
                  rowKey="id"
                  rows={p.mandates}
                  columns={[
                    { key: 'umrn', header: 'UMRN', primary: true, render: (m) => <span className="num">{m.umrn || 'Awaiting UMRN'}</span> },
                    { key: 'bankName', header: 'Bank' },
                    { key: 'limit', header: 'Limit per debit', num: true, render: (m) => formatINR(m.limit, { decimals: 0 }) },
                    { key: 'status', header: 'Status', render: (m) => <StatusChip status={m.status} /> },
                  ]}
                />
              ) : (
                <p className="small muted">No mandate registered. A mandate lets SIP instalments be debited automatically.</p>
              )}
            </section>
          </div>
        )}
      </Async>

      <TicketModal
        open={!!req}
        title={req?.title || 'Request a change'}
        category={req?.category}
        subject={req?.subject}
        intro="Tell us what needs to change. A service request will be raised and our team will guide you on any documents needed."
        onClose={() => setReq(null)}
        onCreated={(t) => {
          setReq(null);
          toast.success(
            <>
              Request {t?.ref ? <strong>{t.ref}</strong> : ''} raised. <Link to="/app/service">Track it in Service requests</Link>
            </>,
          );
        }}
      />
    </div>
  );
}
