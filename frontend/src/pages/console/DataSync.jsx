import { useEffect, useRef, useState } from 'react';
import { useApi } from '../../api/useApi';
import { adminApi } from '../../api/endpoints';
import { friendlyError } from '../../api/client';
import { useTitle } from '../../utils/useTitle';
import { formatDateTime, formatNumber } from '../../utils/format';
import Button from '../../components/Button';
import ConfirmDialog from '../../components/ConfirmDialog';
import DataTable from '../../components/DataTable';
import StatusChip from '../../components/StatusChip';
import { Field } from '../../components/Field';
import { Alert, Async, EmptyState } from '../../components/States';
import { SkeletonBlock } from '../../components/Skeleton';
import { useToast } from '../../components/Toast';
import Icon from '../../components/Icon';
import { PageTitle } from './parts/ui';

const TYPE_LABEL = { NAV: 'NAV import', DETAILS: 'Scheme details', SCHEMES: 'New schemes', NFO: 'NFO import', RTA: 'RTA import' };
const typeLabel = (t) => TYPE_LABEL[t] || t;

const DAYS = { SUN: 'Sundays', MON: 'Mondays', TUE: 'Tuesdays', WED: 'Wednesdays', THU: 'Thursdays', FRI: 'Fridays', SAT: 'Saturdays', 0: 'Sundays', 1: 'Mondays', 2: 'Tuesdays', 3: 'Wednesdays', 4: 'Thursdays', 5: 'Fridays', 6: 'Saturdays', 7: 'Sundays' };

/** "0 30 23 * * *" → "Daily at 23:30", "0 0 2 * * SUN" → "Sundays at 02:00"; anything else is shown as is. */
export function describeCron(cron) {
  if (!cron || cron.trim() === '-') return 'Off';
  const p = cron.trim().split(/\s+/);
  if (p.length !== 6 || !/^\d+$/.test(p[1]) || !/^\d+$/.test(p[2]) || p[3] !== '*' || p[4] !== '*') return cron;
  const time = `${p[2].padStart(2, '0')}:${p[1].padStart(2, '0')}`;
  if (p[5] === '*' || p[5] === '?') return `Daily at ${time}`;
  const day = DAYS[p[5].toUpperCase()];
  return day ? `${day} at ${time}` : cron;
}

const JOBS = [
  {
    key: 'NAV',
    title: 'NAV import',
    text: 'Latest NAVs of all schemes from AMFI (NAVAll.txt); returns are recalculated.',
    button: 'Update NAVs now',
    icon: 'sync',
    run: () => adminApi.syncNav(),
    confirmTitle: 'Update NAVs now?',
    confirmText: 'This downloads the full AMFI NAV file and updates the NAV and returns of every scheme. It takes about a minute.',
    busyText: 'Importing NAVs from AMFI…',
  },
  {
    key: 'DETAILS',
    title: 'Scheme details',
    text: 'Risk-o-meter, expense ratio (Regular plan), fund size, fund managers, benchmark, exit load and minimums.',
    button: 'Refresh scheme details',
    icon: 'file',
    run: () => adminApi.syncDetails(),
    confirmTitle: 'Refresh scheme details?',
    confirmText: 'This fetches the latest disclosed details of every scheme in batches of 50. Values the source does not have are kept. It can take a few minutes.',
    busyText: 'Refreshing scheme details…',
  },
  {
    key: 'SCHEMES',
    title: 'New schemes',
    text: 'Adds new Regular Growth schemes of the AMCs in the AMC list (with ~10 years of NAV history) and hides schemes that AMFI no longer lists.',
    button: 'Check for new schemes',
    icon: 'plus',
    run: () => adminApi.syncSchemes(),
    confirmTitle: 'Check for new schemes?',
    confirmText: 'This compares the AMFI scheme list with the schemes on the site. New schemes are added with their NAV history and details; schemes that are no longer listed are hidden (never deleted). It can take a few minutes.',
    busyText: 'Checking for new schemes…',
  },
  {
    key: 'NFO',
    title: 'NFO import',
    text: 'New fund offers of all fund houses from the AMFI scheme master, with risk-o-meter, benchmark and fund managers from the Scheme Summary Document. Staff edits are kept.',
    button: 'Fetch latest NFOs',
    icon: 'briefcase',
    run: () => adminApi.syncNfos(),
    confirmTitle: 'Fetch the latest NFOs?',
    confirmText: 'This downloads the AMFI scheme master and adds or updates the new fund offers shown on the website (corrections made by staff are kept). It takes up to a minute.',
    busyText: 'Fetching new fund offers…',
  },
];

function runMessage(r) {
  const head = `${typeLabel(r.type)}: ${r.status.toLowerCase()}`;
  return r.summary ? `${head}. ${r.summary}.` : `${head}. ${formatNumber(r.processed)} processed, ${formatNumber(r.failed)} failed.`;
}

export default function DataSync() {
  useTitle('Data sync');
  const runs = useApi(() => adminApi.syncRuns(), []);
  const schedule = useApi(() => adminApi.syncSchedule(), []);
  const toast = useToast();
  const [busy, setBusy] = useState(null); // 'NAV' | 'DETAILS' | 'SCHEMES' | 'NFO' | 'nav' | 'rta'
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [confirm, setConfirm] = useState(null); // job key
  const [expanded, setExpanded] = useState({});
  const [navFile, setNavFile] = useState(null);
  const [rtaFile, setRtaFile] = useState(null);
  const navRef = useRef(null);
  const rtaRef = useRef(null);

  const serverRunning = schedule.data?.running || null;

  // while a scheduled job runs on the server, refresh the status every 10 s
  useEffect(() => {
    if (!serverRunning || busy) return undefined;
    const t = setInterval(() => {
      schedule.reload();
      runs.reload();
    }, 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverRunning, busy]);

  const run = async (kind, fn) => {
    setBusy(kind);
    setError(null);
    setResult(null);
    try {
      const r = await fn();
      setResult(r);
      runs.setData((rows) => [r, ...(rows || []).filter((x) => x.id !== r.id)]);
      if (r.errors?.length) setExpanded((x) => ({ ...x, [r.id]: true }));
      if (r.status === 'FAILED') toast.error(runMessage(r));
      else toast.success(runMessage(r));
      return true;
    } catch (err) {
      const msg = friendlyError(err);
      setError(msg);
      toast.error(msg);
      return false;
    } finally {
      setBusy(null);
      schedule.reload();
    }
  };

  const columns = [
    {
      key: 'type',
      header: 'Type',
      primary: true,
      render: (r) => (
        <div>
          <strong>{typeLabel(r.type)}</strong>
          {r.summary && <div className="tiny muted">{r.summary}</div>}
        </div>
      ),
    },
    { key: 'triggeredBy', header: 'Started by', render: (r) => r.triggeredBy || <span className="muted">–</span> },
    { key: 'startedAt', header: 'Started', render: (r) => formatDateTime(r.startedAt) },
    { key: 'finishedAt', header: 'Finished', render: (r) => (r.finishedAt ? formatDateTime(r.finishedAt) : 'Running…') },
    { key: 'status', header: 'Status', render: (r) => (r.finishedAt ? <StatusChip status={r.status} /> : <StatusChip status="RUNNING" label="Running" />) },
    { key: 'processed', header: 'Processed', num: true, render: (r) => formatNumber(r.processed) },
    { key: 'failed', header: 'Failed', num: true, render: (r) => <span className={r.failed ? 'neg' : undefined}>{formatNumber(r.failed)}</span> },
    {
      key: 'errors',
      header: 'Errors',
      render: (r) =>
        r.errors?.length ? (
          <div>
            <button type="button" className="btn btn--link btn--sm" aria-expanded={!!expanded[r.id]} aria-controls={`con-err-${r.id}`} onClick={() => setExpanded((x) => ({ ...x, [r.id]: !x[r.id] }))}>
              {expanded[r.id] ? 'Hide' : 'Show'} {r.errors.length} error{r.errors.length === 1 ? '' : 's'}
            </button>
            <ul id={`con-err-${r.id}`} className="con-errors" hidden={!expanded[r.id]}>
              {r.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        ) : (
          <span className="muted">None</span>
        ),
    },
  ];

  const job = JOBS.find((j) => j.key === confirm);
  const busyJob = JOBS.find((j) => j.key === busy);

  return (
    <div className="stack-lg">
      <PageTitle eyebrow="Administration" title="Data sync" />

      {busyJob && (
        <Alert type="info" title={busyJob.busyText}>
          Please keep this page open. The result appears here and in the history below when it finishes.
        </Alert>
      )}
      {result && (
        <Alert type={result.status === 'SUCCESS' ? 'success' : result.status === 'PARTIAL' ? 'warning' : 'error'} title={`${typeLabel(result.type)}: ${result.status.toLowerCase()}`}>
          {result.summary ? `${result.summary}. ` : ''}
          {formatNumber(result.processed)} record{result.processed === 1 ? '' : 's'} processed, {formatNumber(result.failed)} failed.
          {result.errors?.length ? ' See the error list in the table below.' : ''}
        </Alert>
      )}
      {error && <Alert type="error">{error}</Alert>}

      <section className="card stack" aria-labelledby="con-sync-auto">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <h2 id="con-sync-auto" className="card__title" style={{ margin: 0 }}>
            Automatic updates
          </h2>
          {schedule.data && (
            <div className="row" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
              <StatusChip status={schedule.data.enabled ? 'SUCCESS' : 'DRAFT'} label={schedule.data.enabled ? 'On' : 'Off'} />
              {serverRunning && <StatusChip status="PENDING" label={`Running: ${typeLabel(serverRunning)}`} />}
            </div>
          )}
        </div>
        <Async state={schedule} skeleton={<SkeletonBlock rows={3} height={22} />}>
          {(s) => (
            <>
              <p className="small muted" style={{ margin: 0 }}>
                {s.enabled
                  ? `Updates run on their own while the backend is running. Times are in ${s.zone} (IST).`
                  : `Scheduled updates are switched off (app.auto-sync.enabled). Use the buttons to update now. Times are in ${s.zone}.`}
              </p>
              <div className="grid grid-2 con-sync-jobs">
                {JOBS.map((j) => {
                  const cfg = j.key === 'NAV' ? s.nav : j.key === 'DETAILS' ? s.details : j.key === 'NFO' ? s.nfo : s.schemes;
                  return (
                    <div key={j.key} className="stack" style={{ gap: '0.6rem' }}>
                      <h3 className="con-h3" style={{ margin: 0 }}>
                        {j.title}
                      </h3>
                      <p className="small muted" style={{ margin: 0 }}>
                        {j.text}
                      </p>
                      <dl className="con-dl">
                        <div className="con-dl__row">
                          <dt>Schedule</dt>
                          <dd>
                            {s.enabled ? describeCron(cfg?.cron) : 'Off'}
                            {j.key === 'NAV' && s.enabled && cfg?.retryCron && cfg.retryCron !== '-' && (
                              <span className="tiny muted">{`\nRetry ${describeCron(cfg.retryCron).replace(/^Daily at/, 'at')} if it did not succeed`}</span>
                            )}
                          </dd>
                        </div>
                        <div className="con-dl__row">
                          <dt>Next run</dt>
                          <dd>{cfg?.nextRun ? formatDateTime(cfg.nextRun) : <span className="muted">–</span>}</dd>
                        </div>
                        <div className="con-dl__row">
                          <dt>Last successful</dt>
                          <dd>{s.lastSuccess?.[j.key] ? formatDateTime(s.lastSuccess[j.key]) : <span className="muted">Never</span>}</dd>
                        </div>
                      </dl>
                      <div>
                        <Button variant={j.key === 'NAV' ? undefined : 'outline'} onClick={() => setConfirm(j.key)} loading={busy === j.key} disabled={!!busy || !!serverRunning}>
                          <Icon name={j.icon} size={18} /> {j.button}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Async>
      </section>

      <div className="grid grid-2">
        <section className="card stack" aria-labelledby="con-sync-nav">
          <h2 id="con-sync-nav" className="card__title">
            Upload NAV file
          </h2>
          <Field label="NAV file (.txt)" hint="AMFI NAVAll.txt format">
            <input ref={navRef} type="file" accept=".txt,text/plain" className="input con-file" onChange={(e) => setNavFile(e.target.files?.[0] || null)} />
          </Field>
          <div>
            <Button
              variant="outline"
              disabled={!navFile || !!busy || !!serverRunning}
              loading={busy === 'nav'}
              onClick={async () => {
                if (await run('nav', () => adminApi.syncNav(navFile))) {
                  setNavFile(null);
                  if (navRef.current) navRef.current.value = '';
                }
              }}
            >
              <Icon name="upload" size={18} /> Upload NAV file
            </Button>
          </div>
        </section>

        <section className="card stack" aria-labelledby="con-sync-rta">
          <h2 id="con-sync-rta" className="card__title">
            Upload RTA CSV
          </h2>
          <Field label="RTA transactions (.csv)" hint="Columns in order: pan,folio_no,scheme_code,date,type,amount,units,nav">
            <input ref={rtaRef} type="file" accept=".csv,text/csv" className="input con-file" onChange={(e) => setRtaFile(e.target.files?.[0] || null)} />
          </Field>
          <div>
            <Button
              variant="outline"
              disabled={!rtaFile || !!busy || !!serverRunning}
              loading={busy === 'rta'}
              onClick={async () => {
                if (await run('rta', () => adminApi.syncRta(rtaFile))) {
                  setRtaFile(null);
                  if (rtaRef.current) rtaRef.current.value = '';
                }
              }}
            >
              <Icon name="upload" size={18} /> Upload RTA CSV
            </Button>
          </div>
        </section>
      </div>

      <section className="stack" aria-labelledby="con-sync-runs">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
          <h2 id="con-sync-runs" style={{ margin: 0 }}>
            Sync history
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              runs.reload();
              schedule.reload();
            }}
            disabled={runs.loading}
          >
            <Icon name="sync" size={16} /> Refresh
          </Button>
        </div>
        <Async state={runs} skeleton={<SkeletonBlock rows={5} height={26} />} empty={(d) => !d.length} emptyView={<EmptyState title="No sync runs yet" icon="sync" />}>
          {(rows) => <DataTable caption="Sync runs" columns={columns} rows={rows} highlight={(r) => r.finishedAt && r.status !== 'SUCCESS'} />}
        </Async>
      </section>

      <ConfirmDialog
        open={!!job}
        title={job?.confirmTitle || ''}
        confirmLabel="Start"
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          const j = job;
          setConfirm(null);
          if (j) run(j.key, j.run);
        }}
      >
        <p>{job?.confirmText}</p>
      </ConfirmDialog>
    </div>
  );
}
