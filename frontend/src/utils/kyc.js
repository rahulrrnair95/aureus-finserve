// Shared constants for the online KYC application (public form, status page, staff console). See docs/API.md §8.

export const KYC_STATUS_LABEL = {
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under review',
  VIPV_SCHEDULED: 'Video verification',
  SUBMITTED_TO_KRA: 'Sent to KRA',
  KYC_REGISTERED: 'KYC registered',
  ACTION_REQUIRED: 'Action required',
  REJECTED: 'Rejected',
};
export const kycStatusLabel = (s) => KYC_STATUS_LABEL[s] || s;

/** Happy-path order of statuses (ACTION_REQUIRED / REJECTED are side states). */
export const KYC_FLOW = ['SUBMITTED', 'UNDER_REVIEW', 'VIPV_SCHEDULED', 'SUBMITTED_TO_KRA', 'KYC_REGISTERED'];

export const KYC_TIMELINE = [
  { status: 'SUBMITTED', title: 'Application submitted', text: 'We have your details and documents.' },
  { status: 'UNDER_REVIEW', title: 'Document check', text: 'Our team checks your details against your documents.' },
  { status: 'VIPV_SCHEDULED', title: 'Video verification', text: 'A short video call to verify you in person, as SEBI requires.' },
  { status: 'SUBMITTED_TO_KRA', title: 'Uploaded to the KRA', text: 'We upload your verified KYC to a KYC Registration Agency.' },
  { status: 'KYC_REGISTERED', title: 'KYC registered', text: 'Usually 2–5 working days after the video call. You can then invest.' },
];

export const RESIDENCY_LABEL = { RESIDENT: 'Resident Indian', NRI: 'Non-resident Indian (NRI)' };

export const KYC_MAX_FILE = 5 * 1024 * 1024;
export const KYC_MAX_TOTAL = 20 * 1024 * 1024;
export const KYC_ACCEPT = 'application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png';
export const KYC_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

/** Document checklist (part name = doc type). */
export const KYC_DOCS = {
  PAN_CARD: { label: 'PAN card', hint: 'Front side, all four corners visible and the text readable.' },
  ADDRESS_PROOF: {
    label: 'Address proof',
    hint: 'Masked Aadhaar (only the last 4 digits visible), passport, voter ID or driving licence. Front and back in one PDF if needed.',
  },
  PHOTO: { label: 'Photograph', hint: 'A recent passport-style photo of your face on a plain, light background. No caps or dark glasses.' },
  SIGNATURE: { label: 'Signature', hint: 'Sign on plain white paper with a dark pen and take a clear, close-up photo or scan.' },
  CANCELLED_CHEQUE: { label: 'Cancelled cheque or bank statement', hint: 'Shows your name, account number and IFSC. Helps us link your bank account.' },
  PASSPORT: { label: 'Passport', hint: 'The photo page and the address page of your Indian (or foreign) passport.' },
  OVERSEAS_ADDRESS_PROOF: {
    label: 'Overseas address proof',
    hint: 'Utility bill, bank statement, residence permit or local ID showing your current address abroad (not older than 3 months for bills).',
  },
  VISA_OR_OCI: { label: 'Visa / OCI / PIO card', hint: 'Your current visa, residence permit or OCI card, if you have one.' },
};

export function kycDocs(residency) {
  if (residency === 'NRI') {
    return {
      required: ['PAN_CARD', 'PASSPORT', 'OVERSEAS_ADDRESS_PROOF', 'PHOTO', 'SIGNATURE'],
      optional: ['ADDRESS_PROOF', 'VISA_OR_OCI', 'CANCELLED_CHEQUE'],
    };
  }
  return { required: ['PAN_CARD', 'ADDRESS_PROOF', 'PHOTO', 'SIGNATURE'], optional: ['CANCELLED_CHEQUE'] };
}

/** Per-residency label tweaks. */
export function kycDocLabel(type, residency) {
  if (residency === 'NRI' && type === 'ADDRESS_PROOF') return 'Indian address proof';
  if (residency === 'NRI' && type === 'CANCELLED_CHEQUE') return 'Cancelled cheque (NRE / NRO account)';
  return KYC_DOCS[type]?.label || type;
}

export const GENDERS = [
  { value: 'FEMALE', label: 'Female' },
  { value: 'MALE', label: 'Male' },
  { value: 'TRANSGENDER', label: 'Transgender' },
];
export const MARITAL = [
  { value: 'SINGLE', label: 'Single' },
  { value: 'MARRIED', label: 'Married' },
  { value: 'OTHER', label: 'Other' },
];
export const OCCUPATIONS = [
  { value: 'PRIVATE_SECTOR', label: 'Private sector service' },
  { value: 'PUBLIC_SECTOR', label: 'Public sector service' },
  { value: 'GOVERNMENT', label: 'Government service' },
  { value: 'BUSINESS', label: 'Business' },
  { value: 'PROFESSIONAL', label: 'Professional (doctor, lawyer, CA…)' },
  { value: 'SELF_EMPLOYED', label: 'Self-employed' },
  { value: 'RETIRED', label: 'Retired' },
  { value: 'HOMEMAKER', label: 'Homemaker' },
  { value: 'STUDENT', label: 'Student' },
  { value: 'OTHER', label: 'Other' },
];
export const INCOMES = [
  { value: 'BELOW_1L', label: 'Below ₹1 lakh' },
  { value: '1L_5L', label: '₹1 – 5 lakh' },
  { value: '5L_10L', label: '₹5 – 10 lakh' },
  { value: '10L_25L', label: '₹10 – 25 lakh' },
  { value: '25L_1CR', label: '₹25 lakh – 1 crore' },
  { value: 'ABOVE_1CR', label: 'Above ₹1 crore' },
];
export const optionLabel = (list, v) => list.find((o) => o.value === v)?.label || v || '';

export const INDIAN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];

/** Common countries for NRIs (the field also accepts any other country typed in). */
export const COUNTRIES = [
  'United Arab Emirates', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Oman', 'Bahrain', 'United States', 'United Kingdom', 'Canada',
  'Australia', 'New Zealand', 'Singapore', 'Malaysia', 'Hong Kong', 'Japan', 'Germany', 'France', 'Netherlands', 'Ireland',
  'Switzerland', 'Sweden', 'Italy', 'South Africa', 'Kenya', 'Nigeria', 'Maldives', 'India',
];

export const KYC_CONSENT_TEXT =
  'I consent to Aureus Finserve using these details and documents to complete my KYC with a SEBI-registered KRA (KYC Registration Agency), and to contact me by call, SMS, WhatsApp or email about this application.';

export const PAN_RE = /^[A-Z]{3}P[A-Z][0-9]{4}[A-Z]$/;
export const PIN_RE = /^[1-9]\d{5}$/;

export function formatBytes(n) {
  if (!n && n !== 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Age in completed years for an ISO date string. */
export function ageOn(dob, today = new Date()) {
  const d = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  let a = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) a -= 1;
  return a;
}
