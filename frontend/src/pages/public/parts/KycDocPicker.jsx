import { useEffect, useId, useState } from 'react';
import Button from '../../../components/Button';
import Icon from '../../../components/Icon';
import { KYC_ACCEPT, KYC_MAX_FILE, KYC_TYPES, formatBytes } from '../../../utils/kyc';

/** Reads the first bytes of a file and returns its real type (PDF / JPEG / PNG) or null. */
export async function sniffFile(file) {
  try {
    const b = new Uint8Array(await file.slice(0, 8).arrayBuffer());
    if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) return 'application/pdf';
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'image/png';
  } catch {
    /* unreadable */
  }
  return null;
}

/** Validates one KYC document. Resolves to an error message or ''. */
export async function checkKycFile(file) {
  if (!file) return '';
  const typeOk = KYC_TYPES.includes(file.type) || /\.(pdf|jpe?g|png)$/i.test(file.name);
  if (!typeOk) return 'Only PDF, JPG or PNG files are accepted.';
  if (file.size > KYC_MAX_FILE) return `This file is ${formatBytes(file.size)}. Each file must be 5 MB or smaller.`;
  if (file.size === 0) return 'This file is empty.';
  const real = await sniffFile(file);
  if (!real) return 'This file does not look like a real PDF, JPG or PNG. Please upload the original scan or photo.';
  return '';
}

/**
 * One document slot with drag-and-drop + file picker, preview and per-file validation.
 * Props: type, label, hint, required, file, error, onChange(file|null, error)
 */
export default function KycDocPicker({ type, label, hint, required, file, error, onChange }) {
  const id = useId();
  const [drag, setDrag] = useState(false);
  const [preview, setPreview] = useState(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!file || !(file.type === 'image/jpeg' || file.type === 'image/png')) {
      setPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = async (f) => {
    if (!f) return;
    setChecking(true);
    const err = await checkKycFile(f);
    setChecking(false);
    onChange(err ? null : f, err);
  };

  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  const describedBy = [hintId, error ? errId : null].filter(Boolean).join(' ');

  return (
    <li className={`pub-kyc-doc ${file ? 'is-done' : ''} ${error ? 'is-invalid' : ''}`} data-doc={type}>
      <div className="pub-kyc-doc__head">
        <span className="pub-kyc-doc__status" aria-hidden="true">
          {file ? <Icon name="check" size={16} strokeWidth={2.4} /> : <Icon name="file" size={16} />}
        </span>
        <div className="pub-kyc-doc__title">
          <span id={`${id}-label`}>{label}</span>{' '}
          <span className={`chip ${required ? 'chip--gold' : ''} pub-kyc-doc__badge`}>{required ? 'Required' : 'Optional'}</span>
        </div>
      </div>
      <p id={hintId} className="small muted pub-kyc-doc__hint">
        {hint}
      </p>
      {file ? (
        <div className="pub-kyc-doc__file">
          {preview ? (
            <img src={preview} alt={`Preview of ${label}`} className="pub-kyc-doc__thumb" />
          ) : (
            <span className="pub-kyc-doc__pdf" aria-hidden="true">
              PDF
            </span>
          )}
          <div className="pub-kyc-doc__meta">
            <strong className="pub-break">{file.name}</strong>
            <span className="tiny muted">{formatBytes(file.size)}</span>
          </div>
          <div className="row pub-kyc-doc__actions">
            <label className="btn btn--outline btn--sm pub-kyc-doc__replace">
              <input
                type="file"
                className="sr-only"
                accept={KYC_ACCEPT}
                aria-label={`Replace ${label}`}
                onChange={(e) => {
                  pick(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              Replace
            </label>
            <Button variant="ghost" size="sm" onClick={() => onChange(null, '')} aria-label={`Remove ${label}`}>
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <label
          className={`pub-kyc-drop ${drag ? 'is-drag' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            pick(e.dataTransfer.files?.[0]);
          }}
        >
          <input
            type="file"
            className="sr-only"
            accept={KYC_ACCEPT}
            aria-labelledby={`${id}-label`}
            aria-describedby={describedBy}
            aria-invalid={error ? 'true' : undefined}
            aria-required={required || undefined}
            name={type}
            onChange={(e) => {
              pick(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <Icon name="upload" size={22} />
          <span>
            <strong>{checking ? 'Checking…' : 'Choose a file'}</strong> <span className="hide-sm">or drag it here</span>
          </span>
          <span className="tiny muted">PDF, JPG or PNG · up to 5 MB</span>
        </label>
      )}
      {error && (
        <p id={errId} className="field__error" role="alert" style={{ margin: '0.5rem 0 0' }}>
          {error}
        </p>
      )}
    </li>
  );
}
