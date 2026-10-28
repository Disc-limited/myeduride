import QRCode from 'qrcode';
import { EDURIDE_EMBLEM_DATA_URL } from './eduride-assets';
import { drawBarcodeToPdf } from './barcode';

export type IdCardFormat = 'atm' | 'classic';

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
  gradeSection?: string;
  routeCode?: string;
  guardianName?: string;
  guardianPhone?: string;
  homeStop?: string;
  validThru?: string;
  transportStatus?: string;
};

export type SchoolBranding = {
  name: string;
  address?: string | null;
  locationAddress?: string | null;
  locationLandmark?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
  signatureUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  photoBgColor?: string | null;
};

const CARD_W = 85.6;
const CARD_H = 54.0;

function hexToRgb(hex: string): [number, number, number] {
  const h = (hex || '#0C3B5E').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(n)) return [12, 59, 94];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function schoolFullAddress(school: SchoolBranding): string {
  const parts: string[] = [
    school.locationAddress?.trim() || '',
    school.address?.trim() || '',
    school.locationLandmark ? `Landmark: ${school.locationLandmark.trim()}` : '',
  ].filter((p): p is string => Boolean(p && p.trim()));
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

async function resolveLogoDataUrl(logoUrl: string | null | undefined): Promise<string | null> {
  if (!logoUrl) return null;
  if (logoUrl.startsWith('data:')) return logoUrl;
  if (typeof window !== 'undefined') {
    try {
      const { imageUrlToDataUrl } = await import('@/lib/photo');
      return await imageUrlToDataUrl(logoUrl);
    } catch {
      return null;
    }
  }
  return null;
}

async function resolveSignatureDataUrl(signatureUrl: string | null | undefined): Promise<string | null> {
  if (!signatureUrl) return null;
  if (signatureUrl.startsWith('data:')) return signatureUrl;
  if (typeof window !== 'undefined') {
    try {
      const { imageUrlToDataUrl } = await import('@/lib/photo');
      return await imageUrlToDataUrl(signatureUrl);
    } catch {
      return null;
    }
  }
  return null;
}

function drawSchoolLogoPlaceholder(doc: any, x: number, y: number, w: number, h: number) {
  doc.setFillColor(254, 243, 199);
  doc.roundedRect(x, y, w, h, 0.8, 0.8, 'F');
  doc.setDrawColor(217, 119, 6);
  doc.setLineWidth(0.18);
  doc.roundedRect(x, y, w, h, 0.8, 0.8, 'S');

  doc.setTextColor(180, 83, 9);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(1.9);
  doc.text('ADD', x + w / 2, y + 2.0, { align: 'center' });
  doc.text('SCHOOL', x + w / 2, y + 3.4, { align: 'center' });
  doc.text('LOGO', x + w / 2, y + 4.8, { align: 'center' });
}

function formatCardNumber(raw: string): string {
  const clean = (raw || '2604 8213 0010').toUpperCase().trim();
  if (clean.includes('-')) {
    return clean.replace(/-/g, ' ');
  }
  const compact = clean.replace(/\s+/g, '');
  const parts = compact.match(/.{1,4}/g);
  return parts ? parts.join(' ') : compact;
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
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.4);
  doc.setFillColor(255, 255, 255);
  doc.circle(waveX - 3.0, waveY, 0.6, 'F');
  doc.lines([[0.6, 1.2], [-0.6, 1.2]], waveX - 1.2, waveY - 1.2, [1, 1]);
  doc.lines([[1.0, 2.0], [-1.0, 2.0]], waveX + 0.4, waveY - 2.0, [1, 1]);
}

/* ========================================================================= */
/* FORMAT 1: RESTRUCTURED ATM SMART CARD PASS (MATCHING USER PDF TEMPLATE)   */
/* ========================================================================= */

async function drawAtmFront(
  doc: any,
  person: IdCardPerson,
  school: SchoolBranding,
  navy: [number, number, number],
  accent: [number, number, number]
) {
  // 1. Deep Rich Navy / Teal Gradient Base matching Template Page 1
  doc.setFillColor(11, 79, 108);
  doc.roundedRect(0, 0, CARD_W, CARD_H, 2.5, 2.5, 'F');

  // Subtle darker base diagonal
  doc.setFillColor(navy[0], navy[1], navy[2]);
  doc.triangle(0, 0, CARD_W * 0.9, 0, 0, CARD_H * 0.9, 'F');

  // Subtle concentric radar contour ripples on the right side ONLY (clean background, no lines across chip/name)
  doc.setDrawColor(20, 95, 125);
  doc.setLineWidth(0.12);
  doc.circle(CARD_W - 14.0, 26.0, 16.0, 'S');
  doc.circle(CARD_W - 14.0, 26.0, 23.0, 'S');
  doc.circle(CARD_W - 14.0, 26.0, 31.0, 'S');

  // Fine outer card rim
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.2);
  doc.roundedRect(0.8, 0.8, CARD_W - 1.6, CARD_H - 1.6, 2.0, 2.0, 'S');

  // 2. TOP HEADER ROW:
  // Left: MyEduRide Brand Badge Pill
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(4.2, 2.5, 26.0, 6.2, 1.2, 1.2, 'F');

  try {
    doc.addImage(EDURIDE_EMBLEM_DATA_URL, 'PNG', 4.8, 3.0, 5.2, 5.2);
  } catch {
    doc.setFillColor(245, 158, 11);
    doc.roundedRect(4.8, 3.0, 5.2, 5.2, 1.0, 1.0, 'F');
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.2);
  doc.setTextColor(12, 59, 94);
  doc.text('MyEduRide', 10.8, 5.4);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(2.0);
  doc.setTextColor(100, 116, 139);
  doc.text('THE STUDENT SAFETY PLATFORM', 10.8, 7.6);

  // Opposite Right: School Crest Badge + School Name + Address + Contactless Wave
  // Wave symbol at far right
  drawContactlessWave(doc, CARD_W - 6.5, 5.6);

  // School crest badge
  const crestW = 6.0;
  const crestH = 6.0;
  const crestX = 33.0;
  const crestY = 2.5;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(crestX, crestY, crestW, crestH, 1.0, 1.0, 'F');

  const logoData = await resolveLogoDataUrl(school.logoUrl);
  if (logoData) {
    try {
      const fmt = logoData.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(logoData, fmt, crestX + 0.4, crestY + 0.4, crestW - 0.8, crestH - 0.8);
    } catch {
      drawSchoolLogoPlaceholder(doc, crestX, crestY, crestW, crestH);
    }
  } else {
    drawSchoolLogoPlaceholder(doc, crestX, crestY, crestW, crestH);
  }

  // School Name (bold, clear) and Address (clean, distinct)
  const headerTextX = crestX + crestW + 1.8;
  const headerMaxW = CARD_W - 8.0 - headerTextX;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.4);
  doc.setTextColor(245, 250, 255);
  const schoolTitle = (school.name || 'DAMZY SCHOOL').toUpperCase();
  doc.text(schoolTitle, headerTextX, 5.2, { maxWidth: headerMaxW });

  const schoolAddr = (school.locationAddress || school.address || '').trim();
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(2.6);
  doc.setTextColor(203, 213, 225);
  doc.text(schoolAddr || 'Campus Address', headerTextX, 7.8, { maxWidth: headerMaxW });

  // 3. Middle Row: Metallic Gold EMV Chip
  const chipX = 4.2;
  const chipY = 12.8;
  const chipW = 11.5;
  const chipH = 9.0;
  drawEmvChip(doc, chipX, chipY, chipW, chipH);

  // 4. Passport Photograph Frame with Orbit Arc & Satellite Dots (Proportionate 35 x 45mm ratio)
  const photoW = 19.5;
  const photoH = 25.0;
  const photoX = CARD_W - photoW - 4.5;
  const photoY = 13.5;

  // Decorative Orbit Arc (Only curves across top-right to bottom-left, matching web UI)
  const arcCx = photoX + photoW / 2;
  const arcCy = photoY + photoH / 2;
  const arcR = 15.5;
  const startAngle = Math.PI * 0.58; // bottom-left
  const endAngle = -Math.PI * 0.18; // top-right
  const steps = 24;

  doc.setDrawColor(74, 222, 128); // #4ADE80
  doc.setLineWidth(0.45);
  let prevX = arcCx + arcR * Math.cos(startAngle);
  let prevY = arcCy + arcR * Math.sin(startAngle);
  for (let i = 1; i <= steps; i++) {
    const a = startAngle + (endAngle - startAngle) * (i / steps);
    const curX = arcCx + arcR * Math.cos(a);
    const curY = arcCy + arcR * Math.sin(a);
    doc.line(prevX, prevY, curX, curY);
    prevX = curX;
    prevY = curY;
  }

  // Top-Right Gold Satellite Dot
  doc.setFillColor(251, 191, 36);
  doc.circle(arcCx + arcR * Math.cos(endAngle), arcCy + arcR * Math.sin(endAngle), 1.0, 'F');

  // Bottom-Left Gold Accent Dot
  doc.circle(arcCx + arcR * Math.cos(startAngle), arcCy + arcR * Math.sin(startAngle), 0.8, 'F');

  // White Photo Box
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(photoX, photoY, photoW, photoH, 1.2, 1.2, 'F');
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.35);
  doc.roundedRect(photoX, photoY, photoW, photoH, 1.2, 1.2, 'S');

  const photoData = await resolvePhotoDataUrl(person);
  if (photoData) {
    try {
      const fmt = photoData.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(photoData, fmt, photoX + 0.35, photoY + 0.35, photoW - 0.7, photoH - 3.2);
    } catch {
      drawPhotoPlaceholder(doc, photoX, photoY, photoW, photoH - 2.8);
    }
  } else {
    drawPhotoPlaceholder(doc, photoX, photoY, photoW, photoH - 2.8);
  }

  // Caption at bottom of photo frame: PHOTO · 35 × 45 MM
  doc.setFillColor(255, 255, 255);
  doc.rect(photoX + 0.2, photoY + photoH - 2.8, photoW - 0.4, 2.6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(2.3);
  doc.setTextColor(100, 116, 139);
  doc.text('PHOTO · 35 × 45 MM', photoX + photoW / 2, photoY + photoH - 0.9, { align: 'center' });

  // 5. Card Number, Cardholder Name & Accent Line
  const formattedCardNumber = formatCardNumber(person.idNumber);
  const numY = 26.5;

  // Embossed Number with shadow
  doc.setFont('courier', 'bold');
  doc.setFontSize(7.6);
  doc.setTextColor(10, 20, 30);
  doc.text(formattedCardNumber, 4.3, numY + 0.2);
  doc.setTextColor(255, 255, 255);
  doc.text(formattedCardNumber, 4.2, numY);

  // Cardholder Full Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.6);
  doc.setTextColor(255, 255, 255);
  doc.text(person.fullName.toUpperCase(), 4.2, 31.0, { maxWidth: photoX - 5.5 });

  // Gold accent line
  doc.setFillColor(251, 191, 36);
  doc.roundedRect(4.2, 32.6, 9.0, 0.55, 0.25, 0.25, 'F');

  // 6. Bottom Metadata Row
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(2.4);
  doc.setTextColor(203, 213, 225);
  doc.text('VALID THRU', 4.2, 38.5);
  doc.setFont('courier', 'bold');
  doc.setFontSize(4.4);
  doc.setTextColor(255, 255, 255);
  doc.text(person.validThru || '07/27', 4.2, 42.5);

  const gradeLabel = person.kind === 'staff' ? 'ROLE · DEPT' : 'GRADE · SECTION';
  const gradeVal = person.gradeSection || person.className || person.roleLabel || '10 · C';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(2.4);
  doc.setTextColor(203, 213, 225);
  doc.text(gradeLabel, 18.0, 38.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.4);
  doc.setTextColor(255, 255, 255);
  doc.text(gradeVal.toUpperCase(), 18.0, 42.5, { maxWidth: 28 });

  // Status Pill Badge: TRANSPORT ACTIVE
  const statusPillW = 26.5;
  const statusPillH = 4.4;
  const statusPillX = CARD_W - statusPillW - 4.5;
  const statusPillY = 41.5;

  doc.setFillColor(16, 120, 68);
  doc.setDrawColor(52, 211, 153);
  doc.setLineWidth(0.2);
  doc.roundedRect(statusPillX, statusPillY, statusPillW, statusPillH, 2.2, 2.2, 'FD');

  doc.setFillColor(251, 191, 36);
  doc.circle(statusPillX + 2.6, statusPillY + statusPillH / 2, 0.7, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(2.8);
  doc.setTextColor(255, 255, 255);
  doc.text(person.transportStatus || 'TRANSPORT ACTIVE', statusPillX + statusPillW / 2 + 1.0, statusPillY + 3.1, {
    align: 'center',
  });
}

async function drawAtmBack(
  doc: any,
  school: SchoolBranding,
  person: IdCardPerson
) {
  const logoData = await resolveLogoDataUrl(school.logoUrl);

  // 1. Light Clean Card Base matching Template Page 2
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(0, 0, CARD_W, CARD_H, 2.5, 2.5, 'F');

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.25);
  doc.roundedRect(0.8, 0.8, CARD_W - 1.6, CARD_H - 1.6, 2.0, 2.0, 'S');

  // 2. Full-Width Magnetic Stripe Across Top
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 2.5, CARD_W, 7.5, 'F');

  // 3. Mid-Top Section: Signature Strip & Enlarged QR Code Box
  const sigX = 4.2;
  const sigY = 11.5;
  const sigW = 48.0;
  const sigH = 10.0;

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(sigX, sigY, sigW, sigH, 1.0, 1.0, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.18);
  doc.roundedRect(sigX, sigY, sigW, sigH, 1.0, 1.0, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(2.3);
  doc.setTextColor(148, 163, 184);
  doc.text('AUTHORISED SIGNATURE', sigX + 1.2, sigY + 2.4);

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(sigX + 1.0, sigY + 3.2, sigW - 2.0, sigH - 4.2, 0.6, 0.6, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.12);
  doc.roundedRect(sigX + 1.0, sigY + 3.2, sigW - 2.0, sigH - 4.2, 0.6, 0.6, 'S');

  const signatureData = await resolveSignatureDataUrl(school.signatureUrl);
  if (signatureData) {
    try {
      const fmt = signatureData.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(signatureData, fmt, sigX + 2.0, sigY + 3.4, 25.0, sigH - 4.6);
    } catch {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(3.2);
      doc.setTextColor(100, 116, 139);
      doc.text('Principal Signature', sigX + 2.5, sigY + 6.3);
    }
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(3.2);
    doc.setTextColor(100, 116, 139);
    doc.text('Principal Signature', sigX + 2.5, sigY + 6.3);
  }

  // Right: Prominently Enlarged QR Code Box for Fast Gate Scanning
  const qrBoxW = 28.0;
  const qrBoxH = 34.0;
  const qrBoxX = CARD_W - qrBoxW - 4.2;
  const qrBoxY = 11.5;

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(qrBoxX, qrBoxY, qrBoxW, qrBoxH, 1.2, 1.2, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.18);
  doc.roundedRect(qrBoxX, qrBoxY, qrBoxW, qrBoxH, 1.2, 1.2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(2.2);
  doc.setTextColor(100, 116, 139);
  doc.text('GATE SCAN QR', qrBoxX + qrBoxW / 2, qrBoxY + 3.0, { align: 'center' });

  try {
    const qrPayload = person.qrData || `MYEDURIDE:${person.kind === 'staff' ? 'STAFF:' : ''}${person.idNumber}`;
    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      width: 400,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    });
    doc.addImage(qrDataUrl, 'PNG', qrBoxX + 2.0, qrBoxY + 4.2, qrBoxW - 4.0, qrBoxW - 4.0);
  } catch (err) {
    console.error('[pdf] Back QR code generation error:', err);
  }

  doc.setFillColor(209, 250, 229);
  doc.roundedRect(qrBoxX + 3.0, qrBoxY + qrBoxH - 4.5, qrBoxW - 6.0, 3.2, 0.6, 0.6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(2.0);
  doc.setTextColor(4, 120, 87);
  doc.text('SCAN TO VERIFY', qrBoxX + qrBoxW / 2, qrBoxY + qrBoxH - 2.2, { align: 'center' });

  // 4. Middle Section: IN CASE OF EMERGENCY + VERIFIED Seal
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(2.6);
  doc.setTextColor(148, 163, 184);
  doc.text('IN CASE OF EMERGENCY', 4.2, 24.0);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(2.3);
  doc.setTextColor(148, 163, 184);
  doc.text('GUARDIAN', 4.2, 26.6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(3.8);
  doc.setTextColor(15, 23, 42);
  doc.text(person.guardianName || 'Mrs. Ngozi Okafor', 4.2, 29.8, { maxWidth: 16 });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(2.3);
  doc.setTextColor(148, 163, 184);
  doc.text('PHONE', 21.0, 26.6);
  doc.setFont('courier', 'bold');
  doc.setFontSize(3.8);
  doc.setTextColor(15, 23, 42);
  doc.text(person.guardianPhone || '+234 800 000 0000', 21.0, 29.8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(2.3);
  doc.setTextColor(148, 163, 184);
  doc.text('HOME STOP', 38.0, 26.6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(3.8);
  doc.setTextColor(15, 23, 42);
  doc.text(person.homeStop || 'Ring Road Junction', 38.0, 29.8, { maxWidth: 11 });

  // Circular VERIFIED Seal positioned alongside emergency details
  const sealX = 50.5;
  const sealY = 27.5;
  doc.setFillColor(209, 250, 229);
  doc.setDrawColor(52, 211, 153);
  doc.setLineWidth(0.25);
  doc.circle(sealX, sealY, 3.0, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(1.8);
  doc.setTextColor(4, 120, 87);
  doc.text('VERIFIED', sealX, sealY + 0.6, { align: 'center' });

  // 5. Bottom Section: Legal Disclaimer + Card ID + Brand Emblem
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(2.1);
  doc.setTextColor(100, 116, 139);
  const retPhone = school.phone || '+234 800 000 0001';
  const campusAddr = (school.locationAddress || school.address || '').trim();
  const retText = campusAddr
    ? `If found, please return to ${school.name || 'the school'}, ${campusAddr} or call ${retPhone}.`
    : `If found, please return to ${school.name || 'the school'} or call ${retPhone}.`;
  doc.text(retText, 4.2, 35.0, { maxWidth: qrBoxX - 6.0 });
  doc.text(
    `This card is non-transferable and remains the property of ${school.name || 'the school'}.`,
    4.2,
    37.8,
    { maxWidth: qrBoxX - 6.0 }
  );

  // Card ID Number
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(2.2);
  doc.setTextColor(148, 163, 184);
  doc.text('CARD ID NUMBER', 4.2, 43.5);

  doc.setFont('courier', 'bold');
  doc.setFontSize(3.6);
  doc.setTextColor(15, 23, 42);
  doc.text(formatCardNumber(person.idNumber), 4.2, 47.5);

  // School Crest (if available) + Brand Emblem (positioned to left of QR box)
  if (logoData) {
    try {
      const fmt = logoData.includes('image/png') ? 'PNG' : 'JPEG';
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(30.0, 42.5, 5.0, 5.0, 0.8, 0.8, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.1);
      doc.roundedRect(30.0, 42.5, 5.0, 5.0, 0.8, 0.8, 'S');
      doc.addImage(logoData, fmt, 30.5, 43.0, 4.0, 4.0);
    } catch {
      /* ignore */
    }
  }

  try {
    const embX = logoData ? 36.5 : 30.0;
    doc.addImage(EDURIDE_EMBLEM_DATA_URL, 'PNG', embX, 42.5, 5.0, 5.0);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(2.8);
    doc.setTextColor(12, 59, 94);
    doc.text('MyEduRide', embX + 5.5, 44.8);

    doc.setFontSize(1.4);
    doc.setTextColor(100, 116, 139);
    doc.text('STUDENT SAFETY', embX + 5.5, 46.8);
  } catch {
    /* ignore */
  }
}

/* ========================================================================= */
/* FORMAT 2: CLASSIC PRINT LAYOUT (RETAINED FOR LEGACY PRINTING)             */
/* ========================================================================= */

async function drawClassicFront(
  doc: any,
  person: IdCardPerson,
  school: SchoolBranding,
  navy: [number, number, number],
  accent: [number, number, number]
) {
  // Solid Primary Color Base
  doc.setFillColor(navy[0], navy[1], navy[2]);
  doc.roundedRect(0, 0, CARD_W, CARD_H, 2.0, 2.0, 'F');

  // Outer border
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.25);
  doc.roundedRect(0.8, 0.8, CARD_W - 1.6, CARD_H - 1.6, 2.0, 2.0, 'S');

  // Top Header Banner
  const classicLogoData = await resolveLogoDataUrl(school.logoUrl);
  const logoBoxX = 4.5;
  const logoBoxY = 2.5;
  const logoBoxSize = 7.5;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(logoBoxX, logoBoxY, logoBoxSize, logoBoxSize, 1.2, 1.2, 'F');
  if (classicLogoData) {
    try {
      const fmt = classicLogoData.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(classicLogoData, fmt, logoBoxX + 0.4, logoBoxY + 0.4, logoBoxSize - 0.8, logoBoxSize - 0.8);
    } catch {
      drawSchoolLogoPlaceholder(doc, logoBoxX, logoBoxY, logoBoxSize, logoBoxSize);
    }
  } else {
    drawSchoolLogoPlaceholder(doc, logoBoxX, logoBoxY, logoBoxSize, logoBoxSize);
  }
  const textStartX = 13.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.4);
  doc.setTextColor(255, 255, 255);
  doc.text((school.name || 'MYEDURIDE SCHOOL').toUpperCase(), textStartX, 5.8, { maxWidth: CARD_W - textStartX - 28.0 });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(2.4);
  doc.setTextColor(220, 230, 245);
  doc.text(school.locationAddress || school.address || 'Student Safety Platform', textStartX, 9.0, { maxWidth: CARD_W - textStartX - 28.0 });

  // Top Right Role Badge
  const badgeText = person.kind === 'staff' ? (person.roleLabel || 'STAFF ID').toUpperCase() : 'STUDENT ID';
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(CARD_W - 26.0, 3.2, 21.5, 4.5, 1.0, 1.0, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(3.0);
  doc.setTextColor(15, 23, 42);
  doc.text(badgeText, CARD_W - 15.25, 6.4, { align: 'center' });

  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.2);
  doc.line(4.5, 11.2, CARD_W - 4.5, 11.2);

  // Enlarged Photo Box (Classic dimensions: 24.5mm x 31.0mm)
  const photoW = 24.5;
  const photoH = 31.0;
  const photoX = 4.5;
  const photoY = 13.0;

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
      drawPhotoPlaceholder(doc, photoX, photoY, photoW, photoH);
    }
  } else {
    drawPhotoPlaceholder(doc, photoX, photoY, photoW, photoH);
  }

  // Details Column
  const detailX = 31.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(2.6);
  doc.setTextColor(190, 210, 235);
  doc.text('FULL NAME', detailX, 16.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.8);
  doc.setTextColor(255, 255, 255);
  doc.text(person.fullName.toUpperCase(), detailX, 20.5, { maxWidth: 26.5 });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(2.6);
  doc.setTextColor(190, 210, 235);
  doc.text('ID NUMBER', detailX, 25.5);
  doc.setFont('courier', 'bold');
  doc.setFontSize(4.8);
  doc.setTextColor(110, 231, 183);
  doc.text(person.idNumber.toUpperCase(), detailX, 29.5);

  const subLabel = person.kind === 'staff' ? 'ROLE' : 'CLASS';
  const subValue = person.kind === 'staff' ? person.roleLabel || 'Staff Member' : person.className || 'General';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(2.6);
  doc.setTextColor(190, 210, 235);
  doc.text(subLabel, detailX, 34.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.2);
  doc.setTextColor(255, 255, 255);
  doc.text(subValue.toUpperCase(), detailX, 38.5, { maxWidth: 26.5 });

  // QR Code Box (Classic Right Side - Prominently Enlarged)
  const qrBoxW = 23.5;
  const qrBoxH = 23.5;
  const qrBoxX = CARD_W - qrBoxW - 4.5;
  const qrBoxY = 15.0;

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(qrBoxX, qrBoxY, qrBoxW, qrBoxH, 1.5, 1.5, 'F');
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.3);
  doc.roundedRect(qrBoxX, qrBoxY, qrBoxW, qrBoxH, 1.5, 1.5, 'S');

  try {
    const qrPayload = person.qrData || `MYEDURIDE:${person.idNumber}`;
    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      width: 400,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    });
    doc.addImage(qrDataUrl, 'PNG', qrBoxX + 1.2, qrBoxY + 1.2, qrBoxW - 2.4, qrBoxH - 2.4);
  } catch (err) {
    console.error('[pdf] Classic QR error:', err);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(2.5);
  doc.setTextColor(220, 235, 255);
  doc.text('Gate Scannable', qrBoxX + qrBoxW / 2, qrBoxY + qrBoxH + 3.2, { align: 'center' });

  // Footer Verification Bar
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.2);
  doc.line(4.5, CARD_H - 7.5, CARD_W - 4.5, CARD_H - 7.5);

  doc.setFont('courier', 'bold');
  doc.setFontSize(2.8);
  doc.setTextColor(210, 230, 250);
  doc.text('DISCL Gate Verified', 4.5, CARD_H - 4.2);
  doc.text('MyEduRide Protection Network', CARD_W - 4.5, CARD_H - 4.2, { align: 'right' });
}

async function drawClassicBack(
  doc: any,
  school: SchoolBranding,
  person: IdCardPerson,
  navy: [number, number, number]
) {
  const classicLogoData = await resolveLogoDataUrl(school.logoUrl);

  // White card background
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(0, 0, CARD_W, CARD_H, 2.0, 2.0, 'F');

  doc.setDrawColor(200, 210, 225);
  doc.setLineWidth(0.25);
  doc.roundedRect(0.8, 0.8, CARD_W - 1.6, CARD_H - 1.6, 2.0, 2.0, 'S');

  // Top School Banner
  doc.setFillColor(navy[0], navy[1], navy[2]);
  doc.rect(0, 0, CARD_W, 8.5, 'F');

  let backBannerX = 4.5;
  if (classicLogoData) {
    try {
      const fmt = classicLogoData.includes('image/png') ? 'PNG' : 'JPEG';
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(4.5, 1.2, 6.0, 6.0, 0.8, 0.8, 'F');
      doc.addImage(classicLogoData, fmt, 4.8, 1.5, 5.4, 5.4);
      backBannerX = 12.0;
    } catch {
      backBannerX = 4.5;
    }
  } else {
    doc.setFillColor(254, 243, 199);
    doc.roundedRect(4.5, 1.8, 14.0, 5.0, 0.8, 0.8, 'F');
    doc.setTextColor(180, 83, 9);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(2.2);
    doc.text('ADD SCHOOL LOGO', 11.5, 5.0, { align: 'center' });
    backBannerX = 20.5;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.0);
  doc.setTextColor(255, 255, 255);
  doc.text((school.name || 'SCHOOL INFORMATION').toUpperCase(), backBannerX, 5.6, { maxWidth: CARD_W - backBannerX - 20.0 });
  doc.setFontSize(2.6);
  doc.text('Card Back', CARD_W - 4.5, 5.6, { align: 'right' });

  // Campus Address
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(2.6);
  doc.setTextColor(100, 116, 139);
  doc.text('CAMPUS FULL ADDRESS', 4.5, 12.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(2.8);
  doc.setTextColor(30, 41, 59);
  const addrLines = doc.splitTextToSize(schoolFullAddress(school), CARD_W - 9.0);
  doc.text(addrLines, 4.5, 16.0);

  // Authorised Signature & If Found Boxes
  const boxY = 22.0;
  const boxW = (CARD_W - 12.0) / 2;
  const boxH = 14.0;

  // Signature Box
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(4.5, boxY, boxW, boxH, 1.0, 1.0, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.18);
  doc.roundedRect(4.5, boxY, boxW, boxH, 1.0, 1.0, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(2.4);
  doc.setTextColor(100, 116, 139);
  doc.text('AUTHORISED SIGNATURE', 6.0, boxY + 3.0);

  const classicSigData = await resolveSignatureDataUrl(school.signatureUrl);
  if (classicSigData) {
    try {
      const fmt = classicSigData.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(classicSigData, fmt, 6.0, boxY + 4.5, 22.0, 8.0);
    } catch {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(3.6);
      doc.setTextColor(100, 116, 139);
      doc.text('Principal Signature', 7.0, boxY + 9.5);
    }
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(3.6);
    doc.setTextColor(100, 116, 139);
    doc.text('Principal Signature', 7.0, boxY + 9.5);
  }

  // If Found Box
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(4.5 + boxW + 3.0, boxY, boxW, boxH, 1.0, 1.0, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.18);
  doc.roundedRect(4.5 + boxW + 3.0, boxY, boxW, boxH, 1.0, 1.0, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(2.4);
  doc.setTextColor(100, 116, 139);
  doc.text('IF FOUND', 4.5 + boxW + 4.5, boxY + 3.0);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(2.4);
  doc.setTextColor(51, 65, 85);
  const retMsg = `Please return to ${school.name || 'the school'} or call ${school.phone || '+234 800 000 0001'}.`;
  doc.text(doc.splitTextToSize(retMsg, boxW - 3.0), 4.5 + boxW + 4.5, boxY + 6.5);

  // Bold Code 128 Barcode at bottom for gate & escort quick scan
  const barcodeW = 46.0;
  const barcodeH = 8.0;
  const barcodeX = 4.5;
  const barcodeY = 38.5;

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(barcodeX, barcodeY, barcodeW, barcodeH, 0.6, 0.6, 'F');
  drawBarcodeToPdf(doc, person.idNumber, barcodeX + 1.0, barcodeY + 0.5, barcodeW - 2.0, barcodeH - 1.0);

  doc.setFont('courier', 'bold');
  doc.setFontSize(3.2);
  doc.setTextColor(30, 41, 59);
  doc.text(formatCardNumber(person.idNumber), barcodeX + barcodeW / 2, 49.0, { align: 'center' });

  // Hotline and Property
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(2.5);
  doc.setTextColor(100, 116, 139);
  doc.text('HOTLINE: 0814 521 7045', CARD_W - 4.5, 42.0, { align: 'right' });
  doc.setFontSize(2.2);
  doc.text('Official ID · Property of the school', CARD_W - 4.5, 45.5, { align: 'right' });
}

function drawPhotoPlaceholder(
  doc: any,
  x: number,
  y: number,
  w: number,
  h: number
) {
  doc.setFillColor(241, 245, 249);
  doc.rect(x + 0.3, y + 0.3, w - 0.6, h - 0.6, 'F');

  // Head circle with border
  doc.setFillColor(203, 213, 225);
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.2);
  doc.circle(x + w / 2, y + h * 0.38, 4.0, 'FD');

  // Torso / Shoulders rounded arc
  doc.roundedRect(x + w * 0.16, y + h * 0.62, w * 0.68, h * 0.36, 3.2, 3.2, 'FD');
}

/* ========================================================================= */
/* EXPORTED PDF BUILDERS: SUPPORTS BOTH ATM AND CLASSIC PRINT FORMATS        */
/* ========================================================================= */

export async function buildIdCardsPdfBuffer(
  persons: IdCardPerson[],
  school: SchoolBranding,
  format: IdCardFormat = 'atm'
): Promise<ArrayBuffer> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [CARD_W, CARD_H],
  });

  const navy = hexToRgb(school.primaryColor || (format === 'atm' ? '#0C3B5E' : '#0C2340'));
  const accent = hexToRgb(school.accentColor || (format === 'atm' ? '#10B981' : '#28A745'));

  for (let i = 0; i < persons.length; i++) {
    const person = persons[i];
    if (i > 0) doc.addPage();

    if (format === 'classic') {
      await drawClassicFront(doc, person, school, navy, accent);
      doc.addPage();
      await drawClassicBack(doc, school, person, navy);
    } else {
      await drawAtmFront(doc, person, school, navy, accent);
      doc.addPage();
      await drawAtmBack(doc, school, person);
    }
  }

  return doc.output('arraybuffer') as ArrayBuffer;
}

export async function generateIdCardsPdf(
  persons: IdCardPerson[],
  school: SchoolBranding,
  fileName?: string,
  format: IdCardFormat = 'atm'
): Promise<void> {
  const buffer = await buildIdCardsPdfBuffer(persons, school, format);
  const blob = new Blob([buffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || `id_cards_${format}_${new Date().toISOString().split('T')[0]}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
