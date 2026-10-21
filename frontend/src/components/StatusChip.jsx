import { humanize } from '../utils/format';

const TONE = {
  // Order
  PENDING_APPROVAL: 'warning',
  PLACED: 'info',
  PAYMENT_RECEIVED: 'info',
  ALLOTTED: 'success',
  FAILED: 'danger',
  CANCELLED: 'neutral',
  // SIP
  ACTIVE: 'success',
  PAUSED: 'warning',
  // KYC
  VALIDATED: 'success',
  REGISTERED: 'info',
  ON_HOLD: 'warning',
  NOT_FOUND: 'danger',
  // Login
  NOT_ACTIVATED: 'warning',
  LOCKED: 'danger',
  DISABLED: 'neutral',
  // Lead
  NEW: 'gold',
  CONTACTED: 'info',
  CONVERTED: 'success',
  LOST: 'neutral',
  // Ticket
  OPEN: 'gold',
  IN_PROGRESS: 'info',
  RESOLVED: 'success',
  CLOSED: 'neutral',
  // Online KYC application
  SUBMITTED: 'gold',
  UNDER_REVIEW: 'info',
  VIPV_SCHEDULED: 'info',
  SUBMITTED_TO_KRA: 'info',
  KYC_REGISTERED: 'success',
  ACTION_REQUIRED: 'warning',
  // Content / sync / mandate
  DRAFT: 'neutral',
  SCHEDULED: 'info',
  PUBLISHED: 'success',
  SUCCESS: 'success',
  PARTIAL: 'warning',
  PENDING: 'warning',
  REJECTED: 'danger',
  STCG: 'warning',
  LTCG: 'info',
  ENABLED: 'success',
};

export default function StatusChip({ status, label }) {
  if (!status) return null;
  const tone = TONE[status] || 'neutral';
  return <span className={`chip ${tone !== 'neutral' ? `chip--${tone}` : ''}`}>{label || humanize(status)}</span>;
}
