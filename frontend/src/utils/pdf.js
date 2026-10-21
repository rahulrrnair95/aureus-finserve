import { brand } from '../brand';
// Client-side calculator PDF with the firm logo (jsPDF, lazy-loaded).
// Note: jsPDF's built-in fonts have no ₹ glyph, so values are written with "Rs." in the PDF.

export const CALC_DISCLAIMER = 'Illustrative only, assumes a constant rate of return; actual returns may vary. Not investment advice.';

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        c.getContext('2d').drawImage(img, 0, 0);
        resolve({ data: c.toDataURL('image/png'), w: img.naturalWidth, h: img.naturalHeight });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

const pdfText = (v) => String(v ?? '').replace(/₹\s?/g, 'Rs. ').replace(/[–—]/g, '-');

/**
 * downloadCalculatorPdf({ title, inputs: [[label, value]], results: [[label, value]], notes?: [string], site?: {firmName, arn, phone, email}, url?, fileName? })
 */
export async function downloadCalculatorPdf({ title, inputs = [], results = [], notes = [], site = {}, url, fileName = 'calculation.pdf' }) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;

  // Navy band with gold logo
  doc.setFillColor(11, 33, 55);
  doc.rect(0, 0, W, 110, 'F');
  doc.setDrawColor(212, 175, 108);
  doc.setLineWidth(1);
  doc.line(0, 110, W, 110);
  const logo = await loadImage(brand.fullGold);
  if (logo) {
    const h = 86;
    const w = (logo.w / logo.h) * h;
    doc.addImage(logo.data, 'PNG', M, 12, w, h);
  }
  doc.setTextColor(232, 207, 151);
  doc.setFont('times', 'bold');
  doc.setFontSize(20);
  doc.text(pdfText(title), W - M, 52, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(243, 239, 231);
  doc.text(`Generated ${new Date().toLocaleString('en-IN')}`, W - M, 72, { align: 'right' });

  let y = 150;
  const section = (heading, rows) => {
    if (!rows.length) return;
    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(11, 33, 55);
    doc.text(heading, M, y);
    y += 8;
    doc.setDrawColor(138, 106, 47);
    doc.setLineWidth(0.6);
    doc.line(M, y, M + 60, y);
    y += 18;
    doc.setFontSize(11);
    rows.forEach(([k, v]) => {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(91, 101, 119);
      doc.text(pdfText(k), M, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(27, 36, 51);
      doc.text(pdfText(v), W - M, y, { align: 'right' });
      doc.setDrawColor(235, 229, 217);
      doc.line(M, y + 7, W - M, y + 7);
      y += 24;
    });
    y += 14;
  };
  section('Your inputs', inputs);
  section('Results', results);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(27, 36, 51);
  [...notes, CALC_DISCLAIMER, 'Mutual fund investments are subject to market risks, read all scheme related documents carefully.'].forEach((n) => {
    const lines = doc.splitTextToSize(pdfText(n), W - 2 * M);
    doc.text(lines, M, y);
    y += lines.length * 13 + 6;
  });
  if (url) {
    doc.setTextColor(138, 106, 47);
    doc.textWithLink('Open this calculation online', M, y + 4, { url });
  }

  // Footer compliance
  doc.setFillColor(243, 239, 231);
  doc.rect(0, H - 70, W, 70, 'F');
  doc.setFontSize(8.5);
  doc.setTextColor(27, 36, 51);
  const firm = site.firmName || 'Aureus Finserve';
  const arn = site.arn ? ` | ARN-${String(site.arn).replace(/^ARN-?/i, '')}` : '';
  doc.text(`${firm} - AMFI-registered Mutual Fund Distributor${arn}`, M, H - 46);
  doc.text('We are a mutual fund distributor and do not provide investment advice.', M, H - 32);
  const contact = [site.phone, site.email].filter(Boolean).join(' | ');
  if (contact) doc.text(contact, M, H - 18);

  doc.save(fileName);
}
