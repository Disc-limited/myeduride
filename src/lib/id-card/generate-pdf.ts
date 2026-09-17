import QRCode from 'qrcode';
import { EDURIDE_EMBLEM_DATA_URL } from './eduride-assets';

export type IdCardPerson = {
  kind: 'student' | 'staff';
  fullName: string;
  idNumber: string;
  qrData: string;
  /** Pre-loaded base64 data URL — preferred for PDF */
  photoDataUrl?: string | null;
  photoUrl?: string | null;
  birth?: string;
  address?: string;
  className?: string;
  roleLabel?: string;
};

export type SchoolBranding = {
  name: string;
  address?: string | null;
  locationAddress?: string | null;
  locationLandmark?: string | null;
  logoUrl?: string | null;
  signatureUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  photoBgColor?: string | null;
};

const CARD_W = 85.6;
const CARD_H = 54;

function hexToRgb(hex: string): [number, number, number] {
  const h = (hex || '#1e3a8a').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(n)) return [30, 58, 138];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function lighterRgb(rgb: [number, number, number], amount = 45): [number, number, number] {
  return [
    Math.min(255, rgb[0] + amount),
    Math.min(255, rgb[1] + amount),
    Math.min(255, rgb[2] + amount),
  ];
}

/** Prefer pinned location address, then school address. */
/** Prefer pinned location address, then school address. */
function schoolFullAddress(school: SchoolBranding): string {
  const parts: string[] = [
    school.locationAddress?.trim() || '',
    school.address?.trim() || '',
    school.locationLandmark ? `Landmark: ${school.locationLandmark.trim()}` : '',
  ].filter((p): p is string => Boolean(p && p.trim()));
  // Deduplicate if location_address === address
  const unique: string[] = [];
  for (const p of parts) {
    if (!unique.some((u) => u.toLowerCase() === p.toLowerCase())) unique.push(p);
  }
  return unique.join('\n') || 'School address on file';
}

async function resolvePhotoDataUrl(person: IdCardPerson): Promise<string | null> {
  if (person.photoDataUrl) return person.photoDataUrl;
  if (!person.photoUrl || typeof window === 'undefined') return null;
  try {
    const { imageUrlToDataUrl } = await import('@/lib/photo');
    return await imageUrlToDataUrl(person.photoUrl);
  } catch {
    return null;
  }
}

function formatCardNumber(raw: string): string {
  const clean = (raw || 'STU-2026-0000').toUpperCase().trim();
  if (clean.includes('-')) {
    return clean.replace(/-/g, '   ');
  }
  const compact = clean.replace(/\s+/g, '');
  const parts = compact.match(/.{1,4}/g);
  return parts ? parts.join('   ') : compact;
}

function drawEmvChip(doc: any, chipX: number, chipY: number, chipW = 11.5, chipH = 9.0) {
  // Base Gold Tone
  doc.setFillColor(212, 168, 48);
  doc.roundedRect(chipX, chipY, chipW, chipH, 1.2, 1.2, 'F');

  // Top/Left Highlight Sheen
  doc.setFillColor(242, 206, 95);
  doc.roundedRect(chipX + 0.3, chipY + 0.3, chipW - 0.6, chipH - 0.6, 0.9, 0.9, 'F');

  // Core Plate
  doc.setFillColor(218, 175, 55);
  doc.roundedRect(chipX + 0.6, chipY + 0.6, chipW - 1.2, chipH - 1.2, 0.7, 0.7, 'F');

  // Micro-circuit Etching Lines
  doc.setDrawColor(155, 115, 20);
  doc.setLineWidth(0.18);
  doc.roundedRect(chipX + 3.8, chipY + 2.3, chipW - 7.6, chipH - 4.6, 0.4, 0.4, 'S');

  doc.line(chipX + 0.6, chipY + chipH / 2, chipX + 3.8, chipY + chipH / 2);
  doc.line(chipX + chipW - 3.8, chipY + chipH / 2, chipX + chipW - 0.6, chipY + chipH / 2);
  doc.line(chipX + chipW / 2, chipY + 0.6, chipX + chipW / 2, chipY + 2.3);
  doc.line(chipX + chipW / 2, chipY + chipH - 2.3, chipX + chipW / 2, chipY + chipH - 0.6);

  doc.line(chipX + 0.6, chipY + 2.6, chipX + 3.8, chipY + 2.6);
  doc.line(chipX + 0.6, chipY + chipH - 2.6, chipX + 3.8, chipY + chipH - 2.6);
  doc.line(chipX + chipW - 3.8, chipY + 2.6, chipX + chipW - 0.6, chipY + 2.6);
  doc.line(chipX + chipW - 3.8, chipY + chipH - 2.6, chipX + chipW - 0.6, chipY + chipH - 2.6);

  doc.setDrawColor(170, 128, 25);
  doc.setLineWidth(0.25);
  doc.roundedRect(chipX, chipY, chipW, chipH, 1.2, 1.2, 'S');
}

function drawContactlessWave(doc: any, waveX: number, waveY: number) {
  doc.setDrawColor(215, 230, 250);
  doc.setLineWidth(0.35);
  doc.lines([[0.5, 0.8], [-0.5, 0.8]], waveX + 0.4, waveY - 0.8, [1, 1]);
  doc.lines([[0.9, 1.6], [-0.9, 1.6]], waveX + 1.4, waveY - 1.6, [1, 1]);
  doc.lines([[1.3, 2.4], [-1.3, 2.4]], waveX + 2.4, waveY - 2.4, [1, 1]);
}

async function drawFront(
  doc: any,
  person: IdCardPerson,
  school: SchoolBranding,
  navy: [number, number, number],
  accent: [number, number, number]
) {
  // 1. Dark luxury background derived from primary school color
  const bgR = Math.max(6, Math.min(26, Math.round(navy[0] * 0.35)));
  const bgG = Math.max(8, Math.min(30, Math.round(navy[1] * 0.35)));
  const bgB = Math.max(16, Math.min(45, Math.round(navy[2] * 0.35)));

  doc.setFillColor(bgR, bgG, bgB);
  doc.rect(0, 0, CARD_W, CARD_H, 'F');

  // Angled metallic facets for luxury card sheen
  doc.setFillColor(navy[0], navy[1], navy[2]);
  doc.triangle(0, 0, CARD_W * 0.72, 0, 0, CARD_H * 0.55, 'F');

  doc.setFillColor(Math.min(255, navy[0] + 25), Math.min(255, navy[1] + 25), Math.min(255, navy[2] + 40));
  doc.triangle(0, 0, CARD_W * 0.40, 0, 0, CARD_H * 0.30, 'F');

  doc.setFillColor(Math.max(3, bgR - 4), Math.max(5, bgG - 4), Math.max(10, bgB - 6));
  doc.triangle(CARD_W * 0.35, CARD_H, CARD_W, CARD_H * 0.35, CARD_W, CARD_H, 'F');

  // Fine silver outer rim
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.25);
  doc.roundedRect(0.8, 0.8, CARD_W - 1.6, CARD_H - 1.6, 2.0, 2.0, 'S');

  // 2. Top Header Bar: Official MyEduRide Logo Emblem & Name
  try {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(4.0, 3.2, 5.0, 5.0, 1.0, 1.0, 'F');
    doc.addImage(EDURIDE_EMBLEM_DATA_URL, 'PNG', 4.3, 3.5, 4.4, 4.4);
  } catch {
    doc.setFillColor(245, 158, 11);
    doc.roundedRect(4.0, 3.2, 5.0, 5.0, 1.0, 1.0, 'F');
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.text('MyEduRide', 10.5, 5.5);

  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.18);
  doc.roundedRect(24.5, 3.6, 11.5, 2.8, 0.6, 0.6, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(3.0);
  doc.setTextColor(225, 235, 250);
  doc.text('SMART PASS', 30.25, 5.6, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(3.8);
  doc.setTextColor(190, 210, 235);
  doc.text((school.name || 'Official School Network').toUpperCase(), 10.2, 8.4, { maxWidth: 35 });

  // Top Right Role Badge
  const isStaff = person.kind === 'staff';
  const badgeText = isStaff
    ? person.roleLabel ? person.roleLabel.toUpperCase() : 'OFFICIAL STAFF PASS'
    : 'VERIFIED STUDENT PASS';
  const badgeBg = isStaff ? [88, 28, 135] : [6, 95, 70];
  const badgeBorder = isStaff ? [192, 132, 252] : [52, 211, 153];

  doc.setFillColor(badgeBg[0], badgeBg[1], badgeBg[2]);
  doc.setDrawColor(badgeBorder[0], badgeBorder[1], badgeBorder[2]);
  doc.setLineWidth(0.2);
  doc.roundedRect(CARD_W - 32.5, 3.2, 28.5, 4.2, 1.0, 1.0, 'FD');
  doc.setTextColor(badgeBorder[0], badgeBorder[1], badgeBorder[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(3.3);
  doc.text(badgeText, CARD_W - 18.25, 6.2, { align: 'center' });

  // 3. Middle Row: Metallic Gold EMV Chip & Contactless Wave
  const chipX = 6.0;
  const chipY = 16.5;
  const chipW = 11.5;
  const chipH = 9.0;
  drawEmvChip(doc, chipX, chipY, chipW, chipH);
  drawContactlessWave(doc, chipX + chipW + 2.8, chipY + chipH / 2);

  // 4. Cardholder Passport Photo Frame (Front Right)
  const photoW = 18.0;
  const photoH = 22.5;
  const photoX = CARD_W - photoW - 4.5;
  const photoY = 12.0;

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(photoX, photoY, photoW, photoH, 1.5, 1.5, 'F');
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.4);
  doc.roundedRect(photoX, photoY, photoW, photoH, 1.5, 1.5, 'S');

  const photoData = await resolvePhotoDataUrl(person);
  if (photoData) {
    try {
      const fmt = photoData.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(photoData, fmt, photoX + 0.35, photoY + 0.35, photoW - 0.7, photoH - 0.7);
    } catch {
      drawPhotoPlaceholder(doc, photoX, photoY, photoW, photoH, person, navy);
    }
  } else {
    drawPhotoPlaceholder(doc, photoX, photoY, photoW, photoH, person, navy);
  }

  // Verified Badge on bottom-right of photo
  doc.setFillColor(16, 185, 129);
  doc.circle(photoX + photoW - 1.5, photoY + photoH - 1.5, 2.2, 'F');
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.3);
  doc.circle(photoX + photoW - 1.5, photoY + photoH - 1.5, 2.2, 'S');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(3.0);
  doc.text('OK', photoX + photoW - 1.5, photoY + photoH - 0.6, { align: 'center' });

  // 5. Bottom Embossed Typography
  const formattedCardNumber = formatCardNumber(person.idNumber);
  const numY = 37.0;

  // Embossed number with drop shadow
  doc.setFont('courier', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(10, 15, 25);
  doc.text(formattedCardNumber, 6.1, numY + 0.25);
  doc.setTextColor(245, 250, 255);
  doc.text(formattedCardNumber, 6.0, numY);

  // Cardholder Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(2.8);
  doc.setTextColor(145, 165, 190);
  doc.text('CARDHOLDER NAME', 6.0, 41.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.setTextColor(255, 255, 255);
  doc.text(person.fullName.toUpperCase(), 6.0, 45.5, { maxWidth: CARD_W - 30 });

  const subText = isStaff
    ? person.roleLabel ? `ROLE: ${person.roleLabel.toUpperCase()}` : 'OFFICIAL STAFF'
    : person.className ? `CLASS: ${person.className.toUpperCase()}` : 'VERIFIED STUDENT';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(3.3);
  doc.setTextColor(110, 231, 183);
  doc.text(subText, 6.0, 48.8);

  // Valid Thru (Right Aligned)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(2.8);
  doc.setTextColor(145, 165, 190);
  doc.text('VALID THRU', CARD_W - 4.5, 41.5, { align: 'right' });

  doc.setFont('courier', 'bold');
  doc.setFontSize(5.0);
  doc.setTextColor(240, 245, 255);
  doc.text('09/27', CARD_W - 4.5, 45.5, { align: 'right' });
}

function drawPhotoPlaceholder(
  doc: any,
  x: number,
  y: number,
  w: number,
  h: number,
  person: IdCardPerson,
  navy: [number, number, number]
) {
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(x + 0.4, y + 0.4, w - 0.8, h - 0.8, 1.2, 1.2, 'F');
  doc.setTextColor(203, 213, 225);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  const initials = person.fullName
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  doc.text(initials || 'ID', x + w / 2, y + h / 2 + 1.5, { align: 'center' });
}

async function drawBack(
  doc: any,
  school: SchoolBranding,
  person: IdCardPerson,
  navy: [number, number, number]
) {
  // 1. Dark base tone matching Front
  const bgR = Math.max(6, Math.min(26, Math.round(navy[0] * 0.35)));
  const bgG = Math.max(8, Math.min(30, Math.round(navy[1] * 0.35)));
  const bgB = Math.max(16, Math.min(45, Math.round(navy[2] * 0.35)));

  doc.setFillColor(bgR, bgG, bgB);
  doc.rect(0, 0, CARD_W, CARD_H, 'F');

  // Outer border
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.25);
  doc.roundedRect(0.8, 0.8, CARD_W - 1.6, CARD_H - 1.6, 2.0, 2.0, 'S');

  // 2. Full-Width Magnetic Stripe (Standard CR80)
  doc.setFillColor(15, 18, 24);
  doc.rect(0, 3.2, CARD_W, 9.2, 'F');
  doc.setFillColor(32, 38, 48);
  doc.rect(0, 5.8, CARD_W, 1.2, 'F');

  // 3. Left Section: Authorized Signature Strip & Handover Box
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(2.8);
  doc.setTextColor(155, 175, 200);
  doc.text('AUTHORIZED SIGNATURE / HANDOVER CODE', 4.5, 16.0);

  const sigX = 4.5;
  const sigY = 17.0;
  const sigW = 47.0;
  const sigH = 8.5;

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(sigX, sigY, sigW, sigH, 0.8, 0.8, 'F');
  doc.setDrawColor(200, 212, 228);
  doc.setLineWidth(0.2);
  doc.roundedRect(sigX, sigY, sigW, sigH, 0.8, 0.8, 'S');

  if (school.signatureUrl && String(school.signatureUrl).startsWith('data:')) {
    try {
      const fmt = school.signatureUrl.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(school.signatureUrl, fmt, sigX + 2.0, sigY + 1.0, 25.0, sigH - 2.0);
    } catch {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(5.0);
      doc.setTextColor(45, 45, 55);
      doc.text(person.fullName.toLowerCase(), sigX + 3.0, sigY + 5.5);
    }
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(5.0);
    doc.setTextColor(45, 45, 55);
    doc.text(person.fullName.toLowerCase(), sigX + 3.0, sigY + 5.5);
  }

  // Security pattern inside strip
  doc.setFont('courier', 'normal');
  doc.setFontSize(3.0);
  doc.setTextColor(185, 190, 200);
  doc.text('/// SECURE ///', sigX + sigW - 16.0, sigY + 5.5);

  // Security CVV / Code Box
  doc.setFillColor(245, 158, 11);
  doc.roundedRect(sigX + sigW - 7.0, sigY + 1.0, 6.0, sigH - 2.0, 0.6, 0.6, 'F');
  doc.setTextColor(15, 23, 42);
  doc.setFont('courier', 'bold');
  doc.setFontSize(3.8);
  const cvv = String(Math.abs((person.idNumber || '000').split('').reduce((a, c) => a + c.charCodeAt(0), 123)) % 900 + 100);
  doc.text(cvv, sigX + sigW - 4.0, sigY + 5.2, { align: 'center' });

  // Campus Address & Return Policy
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(3.4);
  doc.setTextColor(245, 250, 255);
  doc.text((school.name || 'Official School Network').toUpperCase(), 4.5, 28.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(2.9);
  doc.setTextColor(175, 190, 210);
  const addrLines = doc.splitTextToSize(schoolFullAddress(school), 47.0);
  doc.text(addrLines, 4.5, 31.5);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(2.6);
  doc.setTextColor(140, 160, 185);
  doc.text(`Official Campus Pass · Property of ${school.name || 'the school'} · Gate Scannable`, 4.5, 39.5, { maxWidth: 47.0 });

  // 4. Right Section: High-Density Gate Scannable QR Code
  const qrBoxW = 24.5;
  const qrBoxH = 24.5;
  const qrBoxX = CARD_W - qrBoxW - 4.5;
  const qrBoxY = 15.5;

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(qrBoxX, qrBoxY, qrBoxW, qrBoxH, 1.5, 1.5, 'F');
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.5);
  doc.roundedRect(qrBoxX, qrBoxY, qrBoxW, qrBoxH, 1.5, 1.5, 'S');

  try {
    const qrPayload = person.qrData || `MYEDURIDE:${person.kind === 'staff' ? 'STAFF:' : ''}${person.idNumber}`;
    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      width: 512,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    });
    doc.addImage(qrDataUrl, 'PNG', qrBoxX + 1.5, qrBoxY + 1.5, qrBoxW - 3.0, qrBoxH - 3.0);
  } catch (err) {
    console.error('[pdf] Back QR code generation error:', err);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(3.2);
  doc.setTextColor(52, 211, 153);
  doc.text('SCAN AT CAMPUS GATE', qrBoxX + qrBoxW / 2, qrBoxY + qrBoxH + 3.2, { align: 'center' });

  // 5. Bottom Verification Authority Bar
  doc.setFillColor(6, 9, 16);
  doc.rect(0, 47.0, CARD_W, 7.0, 'F');
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.15);
  doc.line(0, 47.0, CARD_W, 47.0);

  try {
    doc.addImage(EDURIDE_EMBLEM_DATA_URL, 'PNG', 4.5, 48.5, 4.0, 4.0);
  } catch {
    /* ignore */
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(3.2);
  doc.setTextColor(52, 211, 153);
  doc.text('DISCL GATE VERIFIED  ·  SECURE ACCESS', 9.5, 51.5);

  doc.setFont('courier', 'bold');
  doc.setFontSize(3.0);
  doc.setTextColor(160, 175, 195);
  doc.text('HOTLINE: 0800-MYEDURIDE', CARD_W - 4.5, 51.5, { align: 'right' });
}

export async function buildIdCardsPdfBuffer(
  persons: IdCardPerson[],
  school: SchoolBranding
): Promise<ArrayBuffer> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [CARD_W, CARD_H],
  });

  const navy = hexToRgb(school.primaryColor || '#0D4A71');
  const accent = hexToRgb(school.accentColor || '#28A745');

  for (let i = 0; i < persons.length; i++) {
    const person = persons[i];
    if (i > 0) doc.addPage();
    await drawFront(doc, person, school, navy, accent);
    doc.addPage();
    await drawBack(doc, school, person, navy);
  }

  return doc.output('arraybuffer') as ArrayBuffer;
}

export async function generateIdCardsPdf(
  persons: IdCardPerson[],
  school: SchoolBranding,
  fileName?: string
): Promise<void> {
  const buffer = await buildIdCardsPdfBuffer(persons, school);
  const blob = new Blob([buffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || `id_cards_${new Date().toISOString().split('T')[0]}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
