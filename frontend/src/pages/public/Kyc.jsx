import { useEffect, useId, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import { Checkbox, Field, Input, Select, Textarea } from '../../components/Field';
import { PageHead } from '../../components/Misc';
import { Alert } from '../../components/States';
import { publicApi } from '../../api/endpoints';
import { friendlyError } from '../../api/client';
import { useTitle } from '../../utils/useTitle';
import { formatDate } from '../../utils/format';
import {
  COUNTRIES,
  GENDERS,
  INCOMES,
  INDIAN_STATES,
  KYC_CONSENT_TEXT,
  KYC_DOCS,
  KYC_MAX_TOTAL,
  MARITAL,
  OCCUPATIONS,
  PAN_RE,
  PIN_RE,
  RESIDENCY_LABEL,
  ageOn,
  formatBytes,
  kycDocLabel,
  kycDocs,
  optionLabel,
} from '../../utils/kyc';
import { EMAIL_RE, MOBILE_RE } from './parts/content';
import OtpStep from './parts/OtpStep';
import KycDocPicker from './parts/KycDocPicker';

const STEPS = ['Verify mobile', 'Personal details', 'Address', 'Documents', 'Review & submit'];
const OTP_CODES = ['OTP_INVALID', 'OTP_EXPIRED', 'OTP_ATTEMPTS_EXCEEDED'];
const STEP_FIELDS = {
  1: ['residency', 'mobile', 'email', 'otp'],
  2: ['fullName', 'fatherOrSpouseName', 'gender', 'dob', 'pan', 'maritalStatus', 'occupation', 'annualIncome', 'politicallyExposed'],
  3: ['addressLine', 'city', 'state', 'pincode', 'countryOfResidence', 'overseasAddress', 'taxResidencyCountry', 'foreignTin', 'nationality'],
  4: [...Object.keys(KYC_DOCS), 'documents'],
  5: ['preferredVipvSlot', 'consent'],
};
const VIPV_SLOTS = [
  'Any time that suits the team',
  'Weekday morning (9 AM – 12 PM IST)',
  'Weekday afternoon (12 – 4 PM IST)',
  'Weekday evening (4 – 7 PM IST)',
  'Saturday (10 AM – 2 PM IST)',
];

const EMPTY = {
  residency: '',
  mobile: '',
  email: '',
  fullName: '',
  fatherOrSpouseName: '',
  gender: '',
  dob: '',
  pan: '',
  maritalStatus: '',
  occupation: '',
  annualIncome: '',
  politicallyExposed: '',
  addressLine: '',
  city: '',
  state: '',
  pincode: '',
  countryOfResidence: '',
  overseasAddress: '',
  taxResidencyCountry: '',
  foreignTin: '',
  nationality: 'Indian',
  preferredVipvSlot: VIPV_SLOTS[0],
  consent: false,
  website: '',
};

const stepOf = (field) => Number(Object.keys(STEP_FIELDS).find((k) => STEP_FIELDS[k].includes(field)) || 5);
const maxDob = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().slice(0, 10);
};

/**
 * Online KYC application (resident or NRI). All entered data lives in component state only — never in
 * browser storage, because it is personal and sensitive.
 */
export default function Kyc() {
  useTitle('Complete your KYC online');
  const [params] = useSearchParams();
  const type = (params.get('type') || '').toLowerCase();
  const [f, setF] = useState({ ...EMPTY, residency: type === 'nri' ? 'NRI' : type === 'resident' ? 'RESIDENT' : '' });
  const [files, setFiles] = useState({});
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState('');
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  // OTP
  const [challenge, setChallenge] = useState(null);
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [verified, setVerified] = useState(false);
  const [resending, setResending] = useState(false);

  const headingRef = useRef(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
    headingRef.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }, [step, done]);

  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setF((s) => ({ ...s, [k]: v }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }));
    if (alert) setAlert('');
  };
  const setVal = (k, v) => {
    setF((s) => ({ ...s, [k]: v }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }));
    if (alert) setAlert('');
  };

  const docs = kycDocs(f.residency);
  const allowedDocs = [...docs.required, ...docs.optional];
  const totalBytes = Object.entries(files)
    .filter(([t, file]) => file && allowedDocs.includes(t))
    .reduce((s, [, file]) => s + file.size, 0);

  // ------------------------------------------------------------ validation per step
  const validate = (n) => {
    const e = {};
    if (n === 1) {
      if (!f.residency) e.residency = 'Choose where you live.';
      if (!MOBILE_RE.test(f.mobile)) e.mobile = 'Enter a valid 10-digit Indian mobile number.';
      if (!EMAIL_RE.test(f.email.trim())) e.email = 'Enter a valid email address.';
    }
    if (n === 2) {
      if (f.fullName.trim().length < 2) e.fullName = 'Enter your full name exactly as on your PAN card.';
      if (f.fatherOrSpouseName.trim().length < 2) e.fatherOrSpouseName = 'Enter your father’s or spouse’s name.';
      if (!f.gender) e.gender = 'Select your gender.';
      if (!f.dob) e.dob = 'Enter your date of birth.';
      else if ((ageOn(f.dob) ?? 0) < 18) e.dob = 'You must be at least 18 years old to apply online.';
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(f.pan)) e.pan = 'Enter a valid 10-character PAN, e.g. ABCPE1234F.';
      else if (!PAN_RE.test(f.pan)) e.pan = 'Enter an individual PAN — the 4th character is P.';
      if (!f.maritalStatus) e.maritalStatus = 'Select your marital status.';
      if (!f.occupation) e.occupation = 'Select your occupation.';
      if (!f.annualIncome) e.annualIncome = 'Select your annual income range.';
      if (!f.politicallyExposed) e.politicallyExposed = 'Please answer this question.';
    }
    if (n === 3) {
      const nri = f.residency === 'NRI';
      const anyIndian = [f.addressLine, f.city, f.state, f.pincode].some((v) => v.trim());
      if (!nri || anyIndian) {
        const sfx = nri ? ' Or leave the whole Indian address blank.' : '';
        if (f.addressLine.trim().length < 5) e.addressLine = `Enter your address (house, street, area).${sfx}`;
        if (!f.city.trim()) e.city = `Enter your city or town.${sfx}`;
        if (!f.state) e.state = `Select your state.${sfx}`;
        if (!PIN_RE.test(f.pincode)) e.pincode = `Enter a valid 6-digit PIN code.${sfx}`;
      }
      if (nri) {
        if (!f.countryOfResidence.trim()) e.countryOfResidence = 'Enter the country you live in.';
        else if (/^india$/i.test(f.countryOfResidence.trim())) e.countryOfResidence = 'If you live in India, please apply as a resident.';
        if (f.overseasAddress.trim().length < 10) e.overseasAddress = 'Enter your full address abroad, including postal code.';
        if (!f.taxResidencyCountry.trim()) e.taxResidencyCountry = 'Enter your country of tax residence.';
        else if (!/^india$/i.test(f.taxResidencyCountry.trim()) && f.foreignTin.trim().length < 3) e.foreignTin = `Enter your tax identification number in ${f.taxResidencyCountry.trim()}.`;
        if (!f.nationality.trim()) e.nationality = 'Enter your nationality.';
      }
    }
    if (n === 4) {
      docs.required.forEach((t) => {
        if (!files[t]) e[t] = `Upload your ${kycDocLabel(t, f.residency).toLowerCase().replace('pan card', 'PAN card')}.`;
      });
      if (totalBytes > KYC_MAX_TOTAL) e.documents = 'All documents together must be 20 MB or smaller. Please upload smaller scans.';
    }
    if (n === 5) {
      if (!f.consent) e.consent = 'Please give your consent so we can complete your KYC.';
    }
    return e;
  };

  const next = (n) => {
    const e = validate(n);
    // keep per-file errors from the picker on step 4
    const merged = n === 4 ? { ...Object.fromEntries(Object.entries(errors).filter(([k, v]) => KYC_DOCS[k] && v)), ...e } : e;
    setErrors(merged);
    if (Object.values(merged).some(Boolean)) {
      setAlert('Please correct the highlighted fields.');
      return;
    }
    setAlert('');
    setStep(n + 1);
  };

  // ------------------------------------------------------------ OTP
  const sendOtp = async () => {
    const res = await publicApi.leadOtp(f.mobile);
    setChallenge(res);
    setOtp('');
    setOtpError('');
  };
  const onSendOtp = async (ev) => {
    ev.preventDefault();
    const e = validate(1);
    setErrors(e);
    if (Object.keys(e).length) {
      setAlert('Please correct the highlighted fields.');
      return;
    }
    setAlert('');
    setBusy(true);
    try {
      await sendOtp();
    } catch (err) {
      if (err.fields) setErrors(err.fields);
      setAlert(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };
  const onResend = async () => {
    setResending(true);
    try {
      await sendOtp();
    } catch (err) {
      setOtpError(friendlyError(err));
    } finally {
      setResending(false);
    }
  };
  const onVerify = async () => {
    setBusy(true);
    setOtpError('');
    try {
      await publicApi.kycVerifyOtp({ mobile: f.mobile, challengeId: challenge.challengeId, otp });
      setVerified(true);
      setStep(2);
    } catch (err) {
      setOtpError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };
  const changeMobile = () => {
    setVerified(false);
    setChallenge(null);
    setOtp('');
  };

  // ------------------------------------------------------------ submit
  const onSubmit = async (ev) => {
    ev.preventDefault();
    const e = validate(5);
    setErrors(e);
    if (Object.keys(e).length) {
      setAlert('Please correct the highlighted fields.');
      return;
    }
    setBusy(true);
    setAlert('');
    const nri = f.residency === 'NRI';
    const fields = {
      residency: f.residency,
      fullName: f.fullName.trim(),
      fatherOrSpouseName: f.fatherOrSpouseName.trim(),
      gender: f.gender,
      dob: f.dob,
      pan: f.pan,
      mobile: f.mobile,
      email: f.email.trim(),
      maritalStatus: f.maritalStatus,
      occupation: f.occupation,
      annualIncome: f.annualIncome,
      politicallyExposed: f.politicallyExposed === 'YES',
      addressLine: f.addressLine.trim(),
      city: f.city.trim(),
      state: f.state,
      pincode: f.pincode.trim(),
      ...(nri
        ? {
            countryOfResidence: f.countryOfResidence.trim(),
            overseasAddress: f.overseasAddress.trim(),
            taxResidencyCountry: f.taxResidencyCountry.trim(),
            foreignTin: f.foreignTin.trim(),
            nationality: f.nationality.trim(),
          }
        : {}),
      preferredVipvSlot: f.preferredVipvSlot,
      consent: true,
      challengeId: challenge?.challengeId,
      otp,
      website: f.website,
    };
    const upload = Object.fromEntries(Object.entries(files).filter(([t, file]) => file && allowedDocs.includes(t)));
    try {
      const res = await publicApi.kycSubmit(fields, upload);
      setDone(res);
    } catch (err) {
      if (OTP_CODES.includes(err.code)) {
        changeMobile();
        setStep(1);
        setAlert(`${friendlyError(err)} Please verify your mobile number again — your other details are kept.`);
      } else if (err.code === 'VALIDATION' && err.fields) {
        setErrors(err.fields);
        const first = Math.min(...Object.keys(err.fields).map(stepOf));
        setStep(first);
        setAlert(friendlyError(err));
      } else {
        setAlert(friendlyError(err));
      }
    } finally {
      setBusy(false);
    }
  };

  // ------------------------------------------------------------ render
  if (done) {
    return (
      <>
        <PageHead eyebrow="Online KYC" title="Application submitted" lead="Thank you. Your KYC application is with our team." />
        <section className="section pub-tight-top">
          <div className="container pub-narrow">
            <div className="card card--accent pub-kyc-done" role="status">
              <span className="pub-success__icon" aria-hidden="true">
                <Icon name="check" size={26} />
              </span>
              <h2 ref={headingRef} tabIndex={-1} className="pub-kyc-done__title">
                We have received your KYC application
              </h2>
              <p className="muted">Your reference number</p>
              <p className="pub-kyc-ref num">{done.ref}</p>
              <p className="small muted">Please note it down — you will need it, with your mobile number, to track your application. We have also sent it to you by SMS and email.</p>
              <p>
                <strong>Your KYC is not complete yet.</strong> Our team completes the verification and registers your KYC with a KRA:
              </p>
              <ol className="pub-kyc-next">
                <li>
                  <strong>Document check</strong> — we check your details against your documents, usually within one working day.
                </li>
                <li>
                  <strong>Video verification call</strong> — a short video call ({f.preferredVipvSlot.toLowerCase().startsWith('any') ? 'at a time that suits you' : f.preferredVipvSlot}). Keep your original PAN card handy.
                </li>
                <li>
                  <strong>KRA registration</strong> — we upload your verified KYC to a KYC Registration Agency. This usually takes 2–5 working days after the call.
                </li>
                <li>
                  <strong>Confirmation</strong> — we will confirm by SMS and email once your KYC is registered.
                </li>
              </ol>
              <div className="row">
                <Button to={`/kyc/status?ref=${encodeURIComponent(done.ref)}`}>Track your application</Button>
                <Button variant="outline" to="/">
                  Back to home
                </Button>
              </div>
            </div>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHead
        eyebrow="Online KYC"
        title="Complete your KYC online"
        lead="KYC is needed once to invest in mutual funds. Fill in your details and upload your documents — about 10 minutes. Our team does the rest: document check, a short video verification and registration with the KRA."
      />
      <section className="section pub-tight-top">
        <div className="container pub-kyc">
          <div className="pub-kyc__main">
            <Stepper step={step} />
            <div className="card pub-form-card pub-kyc__card">
              <h2 ref={headingRef} tabIndex={-1} className="pub-kyc__h">
                <span className="pub-kyc__h-step">
                  Step {step} of {STEPS.length}
                </span>
                {STEPS[step - 1]}
              </h2>
              {alert && <Alert type="error">{alert}</Alert>}

              {step === 1 && (
                <StepOne
                  f={f}
                  set={set}
                  setVal={setVal}
                  errors={errors}
                  verified={verified}
                  challenge={challenge}
                  otp={otp}
                  setOtp={setOtp}
                  otpError={otpError}
                  busy={busy}
                  resending={resending}
                  onSendOtp={onSendOtp}
                  onResend={onResend}
                  onVerify={onVerify}
                  onBackFromOtp={() => setChallenge(null)}
                  onChangeMobile={changeMobile}
                  onContinue={() => next(1)}
                  setFiles={setFiles}
                />
              )}
              {step === 2 && (
                <StepForm onBack={() => setStep(1)} onNext={() => next(2)}>
                  <PersonalFields f={f} set={set} setVal={setVal} errors={errors} />
                </StepForm>
              )}
              {step === 3 && (
                <StepForm onBack={() => setStep(2)} onNext={() => next(3)}>
                  <AddressFields f={f} set={set} errors={errors} />
                </StepForm>
              )}
              {step === 4 && (
                <StepForm onBack={() => setStep(3)} onNext={() => next(4)}>
                  <DocumentFields
                    residency={f.residency}
                    files={files}
                    errors={errors}
                    totalBytes={totalBytes}
                    onFile={(t, file, err) => {
                      setFiles((s) => ({ ...s, [t]: file }));
                      setErrors((x) => ({ ...x, [t]: err || undefined, documents: undefined }));
                      if (!err) setAlert('');
                    }}
                  />
                </StepForm>
              )}
              {step === 5 && (
                <form onSubmit={onSubmit} noValidate className="stack-lg">
                  <Review f={f} files={files} allowedDocs={allowedDocs} goTo={setStep} />
                  <Field label="Preferred time for your video verification call" hint="Times are Indian Standard Time (IST). We will confirm the exact slot with you." error={errors.preferredVipvSlot}>
                    <Select value={f.preferredVipvSlot} onChange={set('preferredVipvSlot')} options={VIPV_SLOTS} />
                  </Field>
                  <div className="pub-hp" aria-hidden="true">
                    <label>
                      Website
                      <input type="text" name="website" tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} />
                    </label>
                  </div>
                  <div>
                    <Checkbox label={KYC_CONSENT_TEXT} checked={f.consent} onChange={set('consent')} aria-invalid={errors.consent ? 'true' : undefined} />
                    {errors.consent && (
                      <p className="field__error" role="alert">
                        {errors.consent}
                      </p>
                    )}
                  </div>
                  <p className="small muted" style={{ margin: 0 }}>
                    Submitting sends your application to our team. Your KYC is complete only after the video verification and KRA registration — we will keep you posted by SMS and email.
                  </p>
                  <div className="row pub-kyc__nav">
                    <Button variant="ghost" onClick={() => setStep(4)} disabled={busy}>
                      Back
                    </Button>
                    <Button type="submit" variant="gold" loading={busy}>
                      Submit application
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
          <Aside residency={f.residency} />
        </div>
      </section>
    </>
  );
}

// ================================================================ pieces

function Stepper({ step }) {
  return (
    <div className="pub-kyc-progress">
      <ol className="pub-kyc-steps" aria-label="Application progress">
        {STEPS.map((s, i) => {
          const n = i + 1;
          const state = n < step ? 'done' : n === step ? 'current' : 'todo';
          return (
            <li key={s} className={`pub-kyc-steps__item is-${state}`} aria-current={n === step ? 'step' : undefined}>
              <span className="pub-kyc-steps__num" aria-hidden="true">
                {n < step ? <Icon name="check" size={14} strokeWidth={2.6} /> : n}
              </span>
              <span className="pub-kyc-steps__label">
                {s}
                <span className="sr-only">{state === 'done' ? ' (completed)' : state === 'todo' ? ' (not started)' : ' (current step)'}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="progress" aria-hidden="true">
        <div className="progress__bar" style={{ width: `${(step / STEPS.length) * 100}%` }} />
      </div>
    </div>
  );
}

function StepForm({ children, onBack, onNext }) {
  return (
    <form
      noValidate
      className="stack-lg"
      onSubmit={(e) => {
        e.preventDefault();
        onNext();
      }}
    >
      {children}
      <div className="row pub-kyc__nav">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button type="submit">Continue</Button>
      </div>
    </form>
  );
}

/** Radio group rendered as a fieldset (keyboard: arrow keys move between options). */
function RadioGroup({ legend, name, value, options, onChange, error, hint, required }) {
  const id = useId();
  const describedBy = [hint ? `${id}-h` : null, error ? `${id}-e` : null].filter(Boolean).join(' ') || undefined;
  return (
    <fieldset className="field pub-kyc-radios" aria-describedby={describedBy} aria-invalid={error ? 'true' : undefined}>
      <legend className="field__label">
        {legend}
        {required && (
          <span className="field__req" aria-hidden="true">
            *
          </span>
        )}
      </legend>
      <div className="radio-row">
        {options.map((o) => (
          <label key={o.value} className="check">
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
      {hint && (
        <span id={`${id}-h`} className="field__hint">
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-e`} className="field__error" role="alert">
          {error}
        </span>
      )}
    </fieldset>
  );
}

function ResidencyChoice({ value, onChange, error }) {
  const id = useId();
  const opts = [
    { value: 'RESIDENT', title: 'I live in India', sub: 'Resident Indian', icon: 'home' },
    { value: 'NRI', title: 'I live abroad', sub: 'Non-resident Indian (NRI)', icon: 'globe' },
  ];
  return (
    <fieldset className="pub-kyc-choice" aria-describedby={error ? `${id}-e` : undefined}>
      <legend className="field__label">
        Where do you live?
        <span className="field__req" aria-hidden="true">
          *
        </span>
      </legend>
      <div className="pub-kyc-choice__grid">
        {opts.map((o) => (
          <label key={o.value} className={`pub-kyc-choice__opt ${value === o.value ? 'is-selected' : ''}`}>
            <input type="radio" name="residency" value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
            <span className="pub-kyc-choice__icon" aria-hidden="true">
              <Icon name={o.icon} size={22} strokeWidth={1.4} />
            </span>
            <span>
              <strong className="pub-kyc-choice__title">{o.title}</strong>
              <span className="small muted">{o.sub}</span>
            </span>
          </label>
        ))}
      </div>
      {error && (
        <span id={`${id}-e`} className="field__error" role="alert">
          {error}
        </span>
      )}
    </fieldset>
  );
}

function StepOne(p) {
  const { f, set, setVal, errors, verified, challenge } = p;
  const residency = <ResidencyChoice value={f.residency} onChange={(v) => setVal('residency', v)} error={errors.residency} />;
  if (verified) {
    return (
      <form
        noValidate
        className="stack-lg"
        onSubmit={(e) => {
          e.preventDefault();
          p.onContinue();
        }}
      >
        {residency}
        <div className="pub-kyc-verified" role="status">
          <Icon name="check" size={18} strokeWidth={2.2} />
          <span>
            Mobile <strong className="num">XXXXXX{f.mobile.slice(-4)}</strong> verified · {f.email}
          </span>
          <Button variant="link" onClick={p.onChangeMobile}>
            Change
          </Button>
        </div>
        <div className="row pub-kyc__nav">
          <span />
          <Button type="submit">Continue</Button>
        </div>
      </form>
    );
  }
  if (challenge) {
    return (
      <div className="stack">
        <p className="small muted" style={{ margin: 0 }}>
          Applying as: <strong>{RESIDENCY_LABEL[f.residency]}</strong>
        </p>
        <OtpStep
          mobile={f.mobile}
          challengeId={challenge.challengeId}
          devOtp={challenge.devOtp}
          otp={p.otp}
          setOtp={p.setOtp}
          error={p.otpError}
          onSubmit={p.onVerify}
          onResend={p.onResend}
          onBack={p.onBackFromOtp}
          submitting={p.busy}
          resending={p.resending}
          submitLabel="Verify mobile"
        />
      </div>
    );
  }
  return (
    <form onSubmit={p.onSendOtp} noValidate className="stack-lg">
      {residency}
      <div className="form-grid form-grid--2">
        <Field label="Mobile number" error={errors.mobile} hint={f.residency === 'NRI' ? 'Your Indian mobile number (roaming is fine) — we send an OTP to it.' : '10 digits, no country code. We send an OTP to it.'} required>
          <Input value={f.mobile} onChange={(e) => setVal('mobile', e.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" autoComplete="tel-national" />
        </Field>
        <Field label="Email" error={errors.email} hint="We send updates on your application here." required>
          <Input type="email" value={f.email} onChange={set('email')} autoComplete="email" />
        </Field>
      </div>
      <div className="row pub-kyc__nav">
        <span className="small muted">Your details stay on this page until you submit — nothing is saved in your browser.</span>
        <Button type="submit" loading={p.busy}>
          Send OTP
        </Button>
      </div>
    </form>
  );
}

function PersonalFields({ f, set, setVal, errors }) {
  return (
    <div className="form-grid form-grid--2">
      <Field label="Full name (as on PAN card)" error={errors.fullName} required className="span-2">
        <Input value={f.fullName} onChange={set('fullName')} autoComplete="name" maxLength={150} />
      </Field>
      <Field label="Father’s or spouse’s name" error={errors.fatherOrSpouseName} required className="span-2">
        <Input value={f.fatherOrSpouseName} onChange={set('fatherOrSpouseName')} maxLength={150} />
      </Field>
      <Field label="PAN" error={errors.pan} hint="10 characters, e.g. ABCPE1234F" required>
        <Input value={f.pan} onChange={(e) => setVal('pan', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))} autoComplete="off" autoCapitalize="characters" spellCheck={false} />
      </Field>
      <Field label="Date of birth" error={errors.dob} hint="As on your PAN card. You must be 18 or older." required>
        <Input type="date" value={f.dob} onChange={set('dob')} max={maxDob()} min="1900-01-01" autoComplete="bday" />
      </Field>
      <div className="span-2">
        <RadioGroup legend="Gender" name="gender" value={f.gender} options={GENDERS} onChange={(v) => setVal('gender', v)} error={errors.gender} required />
      </div>
      <Field label="Marital status" error={errors.maritalStatus} required>
        <Select value={f.maritalStatus} onChange={set('maritalStatus')} placeholder="Select" options={MARITAL} />
      </Field>
      <Field label="Occupation" error={errors.occupation} required>
        <Select value={f.occupation} onChange={set('occupation')} placeholder="Select" options={OCCUPATIONS} />
      </Field>
      <Field label="Annual income" error={errors.annualIncome} required>
        <Select value={f.annualIncome} onChange={set('annualIncome')} placeholder="Select" options={INCOMES} />
      </Field>
      <div className="span-2">
        <RadioGroup
          legend="Are you a politically exposed person (PEP) or related to one?"
          name="pep"
          value={f.politicallyExposed}
          options={[
            { value: 'NO', label: 'No' },
            { value: 'YES', label: 'Yes' },
          ]}
          onChange={(v) => setVal('politicallyExposed', v)}
          error={errors.politicallyExposed}
          hint="A PEP holds, or has held, a prominent public position — e.g. a senior politician, judge, senior government or military official."
          required
        />
      </div>
    </div>
  );
}

function IndianAddress({ f, set, errors, optional }) {
  return (
    <div className="form-grid form-grid--2">
      <Field label="Address (house, street, area)" error={errors.addressLine} required={!optional} className="span-2">
        <Textarea rows={3} value={f.addressLine} onChange={set('addressLine')} autoComplete="street-address" maxLength={300} />
      </Field>
      <Field label="City / town" error={errors.city} required={!optional}>
        <Input value={f.city} onChange={set('city')} autoComplete="address-level2" maxLength={80} />
      </Field>
      <Field label="State / union territory" error={errors.state} required={!optional}>
        <Select value={f.state} onChange={set('state')} placeholder="Select" options={INDIAN_STATES} />
      </Field>
      <Field label="PIN code" error={errors.pincode} required={!optional}>
        <Input value={f.pincode} onChange={(e) => set('pincode')({ target: { value: e.target.value.replace(/\D/g, '').slice(0, 6) } })} inputMode="numeric" autoComplete="postal-code" />
      </Field>
    </div>
  );
}

function AddressFields({ f, set, errors }) {
  const listId = useId();
  if (f.residency !== 'NRI') {
    return (
      <div className="stack">
        <p className="small muted" style={{ margin: 0 }}>
          Your current address in India. It should match the address proof you upload in the next step.
        </p>
        <IndianAddress f={f} set={set} errors={errors} />
      </div>
    );
  }
  return (
    <div className="stack-lg">
      <datalist id={listId}>
        {COUNTRIES.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <div className="form-grid form-grid--2">
        <Field label="Country of residence" error={errors.countryOfResidence} hint="Start typing to pick from the list" required>
          <Input value={f.countryOfResidence} onChange={set('countryOfResidence')} list={listId} autoComplete="country-name" maxLength={80} />
        </Field>
        <Field label="Nationality" error={errors.nationality} required>
          <Input value={f.nationality} onChange={set('nationality')} maxLength={80} />
        </Field>
        <Field label="Overseas address" error={errors.overseasAddress} hint="Full address abroad including postal / ZIP code. It should match your overseas address proof." required className="span-2">
          <Textarea rows={3} value={f.overseasAddress} onChange={set('overseasAddress')} maxLength={400} />
        </Field>
        <Field label="Country of tax residence" error={errors.taxResidencyCountry} hint="Where you pay income tax (for FATCA / CRS)" required>
          <Input value={f.taxResidencyCountry} onChange={set('taxResidencyCountry')} list={listId} maxLength={80} />
        </Field>
        <Field label="Tax identification number (TIN)" error={errors.foreignTin} hint="E.g. SSN / ITIN (US), NI number / UTR (UK). Not needed if your tax residence is India." required={!!f.taxResidencyCountry.trim() && !/^india$/i.test(f.taxResidencyCountry.trim())}>
          <Input value={f.foreignTin} onChange={set('foreignTin')} autoComplete="off" maxLength={40} spellCheck={false} />
        </Field>
      </div>
      <fieldset className="pub-kyc-fieldset">
        <legend>Indian address (optional)</legend>
        <p className="small muted">If you have an address in India (for example, your family home), add it here. Leave it blank otherwise.</p>
        <IndianAddress f={f} set={set} errors={errors} optional />
      </fieldset>
    </div>
  );
}

function DocumentFields({ residency, files, errors, totalBytes, onFile }) {
  const docs = kycDocs(residency);
  const item = (t, required) => (
    <KycDocPicker key={t} type={t} label={kycDocLabel(t, residency)} hint={KYC_DOCS[t].hint} required={required} file={files[t] || null} error={errors[t]} onChange={(file, err) => onFile(t, file, err)} />
  );
  return (
    <div className="stack">
      <p className="small muted" style={{ margin: 0 }}>
        Clear photos or scans work well. PDF, JPG or PNG, up to 5 MB each and 20 MB in total. Your documents are encrypted and seen only by our KYC team.
      </p>
      <ul className="pub-kyc-docs" aria-label="Required documents">
        {docs.required.map((t) => item(t, true))}
      </ul>
      <h3 className="pub-kyc__sub">Optional documents</h3>
      <ul className="pub-kyc-docs" aria-label="Optional documents">
        {docs.optional.map((t) => item(t, false))}
      </ul>
      <p className={`small ${totalBytes > KYC_MAX_TOTAL ? 'neg' : 'muted'}`} aria-live="polite">
        Total uploaded: {formatBytes(totalBytes)} of 20 MB
      </p>
      {errors.documents && (
        <p className="field__error" role="alert">
          {errors.documents}
        </p>
      )}
    </div>
  );
}

function Review({ f, files, allowedDocs, goTo }) {
  const nri = f.residency === 'NRI';
  const indian = [f.addressLine, `${f.city}${f.state ? `, ${f.state}` : ''}${f.pincode ? ` ${f.pincode}` : ''}`].filter((x) => x && x.trim()).join('\n');
  const groups = [
    {
      step: 1,
      title: 'Contact',
      rows: [
        ['Applying as', RESIDENCY_LABEL[f.residency]],
        ['Mobile', `XXXXXX${f.mobile.slice(-4)} (verified)`],
        ['Email', f.email],
      ],
    },
    {
      step: 2,
      title: 'Personal details',
      rows: [
        ['Full name', f.fullName],
        ['Father’s / spouse’s name', f.fatherOrSpouseName],
        ['PAN', f.pan],
        ['Date of birth', f.dob ? formatDate(f.dob) : ''],
        ['Gender', optionLabel(GENDERS, f.gender)],
        ['Marital status', optionLabel(MARITAL, f.maritalStatus)],
        ['Occupation', optionLabel(OCCUPATIONS, f.occupation)],
        ['Annual income', optionLabel(INCOMES, f.annualIncome)],
        ['Politically exposed', f.politicallyExposed === 'YES' ? 'Yes' : 'No'],
      ],
    },
    {
      step: 3,
      title: 'Address',
      rows: nri
        ? [
            ['Country of residence', f.countryOfResidence],
            ['Overseas address', f.overseasAddress],
            ['Tax residence', f.taxResidencyCountry],
            ['TIN', f.foreignTin],
            ['Nationality', f.nationality],
            ['Indian address', indian || 'Not provided'],
          ]
        : [['Address', indian]],
    },
    {
      step: 4,
      title: 'Documents',
      rows: allowedDocs.filter((t) => files[t]).map((t) => [kycDocLabel(t, f.residency), files[t].name]),
    },
  ];
  return (
    <div className="pub-kyc-review">
      {groups.map((g) => (
        <section key={g.title} className="pub-kyc-review__group" aria-label={g.title}>
          <div className="row row--between">
            <h3 className="pub-kyc__sub">{g.title}</h3>
            <Button variant="link" onClick={() => goTo(g.step)} aria-label={`Edit ${g.title.toLowerCase()}`}>
              Edit
            </Button>
          </div>
          <dl className="pub-kyc-dl">
            {g.rows.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v || '—'}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

function Aside({ residency }) {
  const docs = kycDocs(residency || 'RESIDENT');
  return (
    <aside className="pub-kyc__aside" aria-label="About online KYC">
      <div className="card card--navy on-navy pub-kyc-aside">
        <h2 className="card__title">What you’ll need</h2>
        <ul className="pub-kyc-check">
          <li>Your PAN card</li>
          {residency === 'NRI' ? (
            <>
              <li>Passport</li>
              <li>Proof of your address abroad</li>
            </>
          ) : (
            <li>Address proof (masked Aadhaar, passport, voter ID or driving licence)</li>
          )}
          <li>A recent photo and your signature on white paper</li>
          <li>Your mobile phone for the OTP</li>
        </ul>
        <p className="tiny" style={{ color: 'var(--on-navy-muted)' }}>
          {residency ? `${docs.required.length} required documents for ${residency === 'NRI' ? 'NRIs' : 'residents'}.` : 'Choose resident or NRI to see your exact checklist.'}
        </p>
      </div>
      <div className="card pub-kyc-aside">
        <h2 className="card__title">What happens next</h2>
        <ol className="timeline">
          <li>We check your details and documents.</li>
          <li>A short video verification call (VIPV), as SEBI requires.</li>
          <li>We register your KYC with a KRA — usually 2–5 working days after the call.</li>
          <li>We confirm by SMS and email.</li>
        </ol>
        <p className="small" style={{ margin: 0 }}>
          Already applied? <Link to="/kyc/status">Track your application</Link>
        </p>
      </div>
    </aside>
  );
}
