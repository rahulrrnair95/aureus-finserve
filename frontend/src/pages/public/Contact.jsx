import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Button from '../../components/Button';
import Icon from '../../components/Icon';
import { Checkbox, Field, Input, Select, Textarea } from '../../components/Field';
import { ExtLink, PageHead } from '../../components/Misc';
import { Alert } from '../../components/States';
import { publicApi } from '../../api/endpoints';
import { friendlyError } from '../../api/client';
import { useSite } from '../../auth/SiteContext';
import { useTitle } from '../../utils/useTitle';
import { CONSENT_TEXT, EMAIL_RE, INTEREST_OPTIONS, MOBILE_RE } from './parts/content';
import OtpStep from './parts/OtpStep';
import { PhoneLinks, firstPhone } from '../../utils/phone';
import { STATIC_SITE } from '../../utils/siteMode';
import { StaticContactPage } from '../../static/StaticContact';

const OTP_CODES = ['OTP_INVALID', 'OTP_EXPIRED', 'OTP_ATTEMPTS_EXCEEDED'];

export function waLink(num) {
  num = firstPhone(num) || num;
  let d = String(num || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.length === 10) d = `91${d}`;
  return `https://wa.me/${d}`;
}

function SidePanel() {
  const { site } = useSite();
  const wa = waLink(site.whatsapp || site.phone);
  return (
    <aside className="pub-contact-side stack-lg" aria-label="Contact details">
      <div className="card card--navy">
        <span className="eyebrow">Reach us directly</span>
        <ul className="pub-contact-list">
          {site.phone && (
            <li>
              <Icon name="phone" size={18} />
              <span>
                <PhoneLinks value={site.phone} />
              </span>
            </li>
          )}
          {wa && (
            <li>
              <Icon name="chat" size={18} />
              <ExtLink href={wa}>WhatsApp us</ExtLink>
            </li>
          )}
          {site.email && (
            <li>
              <Icon name="mail" size={18} />
              <a href={`mailto:${site.email}`} className="pub-break">
                {site.email}
              </a>
            </li>
          )}
          {site.address && (
            <li>
              <Icon name="pin" size={18} />
              <span style={{ whiteSpace: 'pre-line' }}>{site.address}</span>
            </li>
          )}
          {site.officeHours && (
            <li>
              <Icon name="clock" size={18} />
              <span style={{ whiteSpace: 'pre-line' }}>{site.officeHours}</span>
            </li>
          )}
        </ul>
      </div>
      {site.mapEmbedUrl && (
        <div className="pub-map pub-map--sm">
          <iframe src={site.mapEmbedUrl} title="Map showing the Aureus Finserve office" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        </div>
      )}
    </aside>
  );
}

// The static build (no backend) shows a contact panel instead of the enquiry form + OTP step.
export default function Contact() {
  return STATIC_SITE ? <StaticContactPage /> : <ContactForm />;
}

function ContactForm() {
  useTitle('Contact us');
  const [sp] = useSearchParams();
  const pre = sp.get('interest');
  const [f, setF] = useState({
    name: '',
    mobile: '',
    email: '',
    city: '',
    interest: INTEREST_OPTIONS.some((o) => o.value === pre) ? pre : '',
    // optional prefill, e.g. from an NFO page: /contact?interest=OTHER&message=I'm interested in the NFO: …
    message: (sp.get('message') || '').slice(0, 1000),
    consent: false,
    website: '',
  });
  const [errors, setErrors] = useState({});
  const [alert, setAlert] = useState('');
  const [step, setStep] = useState(1);
  const [challenge, setChallenge] = useState(null);
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const validate = () => {
    const e = {};
    if (!f.name.trim()) e.name = 'Please enter your name.';
    if (!MOBILE_RE.test(f.mobile)) e.mobile = 'Enter a valid 10-digit mobile number.';
    if (f.email.trim() && !EMAIL_RE.test(f.email.trim())) e.email = 'Enter a valid email address.';
    if (!f.interest) e.interest = 'Please choose what you’d like to discuss.';
    if (f.message.length > 1000) e.message = 'Please keep your message under 1,000 characters.';
    if (!f.consent) e.consent = 'Please give your consent so we can contact you.';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const sendOtp = async () => {
    const res = await publicApi.leadOtp(f.mobile);
    setChallenge(res);
    setOtp('');
    setOtpError('');
  };

  const onStart = async (ev) => {
    ev.preventDefault();
    setAlert('');
    if (!validate()) return;
    setBusy(true);
    try {
      await sendOtp();
      setStep(2);
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

  const onSubmit = async () => {
    setBusy(true);
    setOtpError('');
    try {
      await publicApi.lead({
        name: f.name.trim(),
        mobile: f.mobile,
        email: f.email.trim(),
        city: f.city.trim(),
        interest: f.interest,
        message: f.message.trim(),
        consent: true,
        challengeId: challenge.challengeId,
        otp,
        website: f.website,
      });
      setDone(true);
    } catch (err) {
      if (OTP_CODES.includes(err.code)) setOtpError(friendlyError(err));
      else if (err.code === 'VALIDATION' && err.fields) {
        setErrors(err.fields);
        setAlert(friendlyError(err));
        setStep(1);
      } else setOtpError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHead eyebrow="Contact" title="Book a call with our team" lead="Tell us a little about what you’re planning. A member of our team will call you back, usually within one working day." />
      <section className="section">
        <div className="container pub-contact">
          <div>
            {done ? (
              <div className="card card--accent pub-success" role="status">
                <span className="pub-success__icon" aria-hidden="true">
                  <Icon name="check" size={28} />
                </span>
                <h2 className="card__title">Thank you, {f.name.split(' ')[0]}</h2>
                <p>We have received your enquiry and will be in touch shortly on the number you verified.</p>
                <div className="row">
                  <Button variant="outline" to="/">
                    Back to home
                  </Button>
                  <Button variant="ghost" to="/calculators">
                    Try our calculators
                  </Button>
                </div>
              </div>
            ) : (
              <div className="card pub-form-card">
                <h2 className="card__title">{step === 1 ? 'Your details' : 'Verify your mobile number'}</h2>
                <p className="tiny muted" aria-live="polite">
                  Step {step} of 2
                </p>
                {alert && <Alert type="error">{alert}</Alert>}
                {step === 1 ? (
                  <form onSubmit={onStart} noValidate className="stack">
                    <div className="form-grid form-grid--2">
                      <Field label="Full name" error={errors.name} required>
                        <Input value={f.name} onChange={set('name')} autoComplete="name" maxLength={120} />
                      </Field>
                      <Field label="Mobile number" error={errors.mobile} hint="10 digits, no country code" required>
                        <Input value={f.mobile} onChange={(e) => setF((s) => ({ ...s, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }))} inputMode="numeric" autoComplete="tel-national" />
                      </Field>
                      <Field label="Email" error={errors.email}>
                        <Input type="email" value={f.email} onChange={set('email')} autoComplete="email" />
                      </Field>
                      <Field label="City" error={errors.city}>
                        <Input value={f.city} onChange={set('city')} autoComplete="address-level2" />
                      </Field>
                      <Field label="I’d like to discuss" error={errors.interest} required className="span-2">
                        <Select value={f.interest} onChange={set('interest')} placeholder="Choose a topic" options={INTEREST_OPTIONS} />
                      </Field>
                      <Field label="Message" error={errors.message} hint="Optional — anything you’d like us to know before we call" className="span-2">
                        <Textarea rows={4} value={f.message} onChange={set('message')} maxLength={1000} />
                      </Field>
                    </div>
                    <div className="pub-hp" aria-hidden="true">
                      <label>
                        Website
                        <input type="text" name="website" tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} />
                      </label>
                    </div>
                    <div>
                      <Checkbox label={CONSENT_TEXT} checked={f.consent} onChange={set('consent')} aria-invalid={errors.consent ? 'true' : undefined} />
                      {errors.consent && (
                        <p className="field__error" role="alert">
                          {errors.consent}
                        </p>
                      )}
                    </div>
                    <div className="row">
                      <Button type="submit" loading={busy}>
                        Continue
                      </Button>
                      <span className="tiny muted">We’ll send an OTP to verify your number.</span>
                    </div>
                    <p className="tiny muted" style={{ margin: 0 }}>
                      We use your details only to respond to this enquiry. See our <Link to="/legal/privacy">privacy policy</Link>.
                    </p>
                  </form>
                ) : (
                  <OtpStep
                    mobile={f.mobile}
                    challengeId={challenge?.challengeId}
                    devOtp={challenge?.devOtp}
                    otp={otp}
                    setOtp={setOtp}
                    error={otpError}
                    onSubmit={onSubmit}
                    onResend={onResend}
                    onBack={() => setStep(1)}
                    submitting={busy}
                    resending={resending}
                  />
                )}
              </div>
            )}
          </div>
          <SidePanel />
        </div>
      </section>
    </>
  );
}
