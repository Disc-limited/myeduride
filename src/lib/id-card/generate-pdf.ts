import QRCode from 'qrcode';

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

async function drawFront(
  doc: any,
  person: IdCardPerson,
  school: SchoolBranding,
  navy: [number, number, number],
  accent: [number, number, number]
) {
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, CARD_W, CARD_H, 'F');

  doc.setFillColor(245, 247, 252);
  doc.triangle(0, 0, 30, 0, 0, 20, 'F');
  doc.setFillColor(235, 242, 252);
  doc.triangle(CARD_W, CARD_H, CARD_W - 18, CARD_H, CARD_W, CARD_H - 14, 'F');

  doc.setFillColor(accent[0], accent[1], accent[2]);
  doc.triangle(0, 0, 40, 0, 0, 12, 'F');
  doc.setFillColor(navy[0], navy[1], navy[2]);
  doc.triangle(0, 0, 24, 0, 0, 8, 'F');

  let nameY = 5.8;
  if (school.logoUrl && String(school.logoUrl).startsWith('data:')) {
    try {
      const fmt = school.logoUrl.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(school.logoUrl, fmt, CARD_W / 2 - 6, 1.0, 12, 6.8);
      nameY = 10.5;
    } catch {
      nameY = 5.8;
    }
  }

  doc.setTextColor(navy[0], navy[1], navy[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text((school.name || 'SCHOOL NAME').toUpperCase(), CARD_W / 2, nameY, {
    align: 'center',
    maxWidth: CARD_W - 6,
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(3.8);
  doc.setTextColor(70, 70, 70);
  const frontAddr = (school.locationAddress || school.address || 'Campus Gate & Safety Network').toString();
  doc.text(frontAddr, CARD_W / 2, nameY + 2.8, {
    align: 'center',
    maxWidth: CARD_W - 8,
  });

  const bannerTop = nameY + 4.2;
  const bannerLabel = person.kind === 'staff' ? 'STAFF CARD' : 'STUDENT CARD';
  doc.setFillColor(navy[0], navy[1], navy[2]);
  doc.roundedRect(2.5, bannerTop, CARD_W - 5, 4.8, 1.0, 1.0, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.text(bannerLabel, CARD_W / 2, bannerTop + 3.2, { align: 'center' });

  // Enlarged portrait space for clearly visible faces (26.5mm x 32mm)
  const photoX = 3.2;
  const photoY = bannerTop + 5.5;
  const photoW = 26.5;
  const photoH = 32.0;

  const photoBgRgb = hexToRgb(school.photoBgColor || '#FFFFFF');
  doc.setFillColor(photoBgRgb[0], photoBgRgb[1], photoBgRgb[2]);
  doc.roundedRect(photoX, photoY, photoW, photoH, 1.8, 1.8, 'F');

  doc.setDrawColor(navy[0], navy[1], navy[2]);
  doc.setLineWidth(0.35);
  doc.roundedRect(photoX, photoY, photoW, photoH, 1.8, 1.8, 'S');

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

  // Extended & high-contrast QR / Barcode space (24.5mm x 24.5mm)
  const qrSize = 24.5;
  const qrX = CARD_W - qrSize - 3.2;
  const qrY = bannerTop + 5.5;
  const qrPayload = person.qrData || `MYEDURIDE:${person.idNumber}`;

  const tx = 31.0;
  let ty = bannerTop + 8.5;
  const maxTextWidth = Math.max(16, qrX - tx - 2);

  const drawDataLine = (label: string, value: string, isBoldValue = false) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(4.6);
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.text(`${label}:`, tx, ty);

    doc.setFont('helvetica', isBoldValue ? 'bold' : 'normal');
    doc.setTextColor(35, 35, 35);
    const splitLines = doc.splitTextToSize(String(value || '—'), maxTextWidth);
    doc.text(splitLines, tx + 12, ty);

    const linesCount = splitLines.length;
    ty += linesCount * 2.5 + 0.8;
  };

  drawDataLine('NAME', person.fullName, true);
  drawDataLine('ID NO', person.idNumber, true);
  if (person.kind === 'student' && person.className) drawDataLine('CLASS', person.className, true);
  if (person.kind === 'staff' && person.roleLabel) drawDataLine('ROLE', person.roleLabel, true);
  if (person.birth && person.birth !== '—') {
    drawDataLine(person.kind === 'student' ? 'BIRTH' : 'EMAIL', person.birth);
  }
  drawDataLine('ADDRESS', person.address || '—');

  try {
    // Level 'M' error correction produces larger, crisper dots for phone & hardware scanner reliability
    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      width: 512,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    });
    // White pad behind QR for quiet zone on cards
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(qrX - 0.8, qrY - 0.8, qrSize + 1.6, qrSize + 1.6, 1.2, 1.2, 'F');
    doc.setDrawColor(210, 218, 230);
    doc.setLineWidth(0.2);
    doc.roundedRect(qrX - 0.8, qrY - 0.8, qrSize + 1.6, qrSize + 1.6, 1.2, 1.2, 'S');
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

    // Human-readable ID label beneath the QR / Barcode
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(4.2);
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.text(person.idNumber, qrX + qrSize / 2, qrY + qrSize + 3.0, { align: 'center' });
  } catch (e) {
    console.error('[id-card] QR failed:', e);
    doc.setDrawColor(0, 0, 0);
    doc.rect(qrX, qrY, qrSize, qrSize, 'S');
    doc.setFontSize(4);
    doc.text('QR ERROR', qrX + qrSize / 2, qrY + qrSize / 2, { align: 'center' });
  }

  doc.setFontSize(3.2);
  doc.setTextColor(accent[0], accent[1], accent[2]);
  doc.text('MyEduRide', CARD_W - 2, 2.6, { align: 'right' });
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
  doc.setFillColor(230, 238, 248);
  doc.roundedRect(x + 0.5, y + 0.5, w - 1, h - 1, 1.5, 1.5, 'F');
  doc.setTextColor(navy[0], navy[1], navy[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  const initials = person.fullName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  doc.text(initials || '?', x + w / 2, y + h / 2 + 2, { align: 'center' });
}

function drawBack(
  doc: any,
  school: SchoolBranding,
  kind: 'student' | 'staff',
  navy: [number, number, number]
) {
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, CARD_W, CARD_H, 'F');

  doc.setFillColor(245, 247, 252);
  doc.triangle(CARD_W, 0, CARD_W - 22, 0, CARD_W, 16, 'F');

  // Top brand strip
  doc.setFillColor(navy[0], navy[1], navy[2]);
  doc.rect(0, 0, CARD_W, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.text('SCHOOL INFORMATION — CARD BACK', CARD_W / 2, 5.2, { align: 'center' });

  let y = 12;
  if (school.logoUrl && String(school.logoUrl).startsWith('data:')) {
    try {
      const fmt = school.logoUrl.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(school.logoUrl, fmt, 4, y - 1, 10, 6.5);
    } catch {
      /* ignore */
    }
  }

  doc.setTextColor(navy[0], navy[1], navy[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text((school.name || 'SCHOOL').toUpperCase(), 16, y + 2.5, { maxWidth: CARD_W - 20 });

  y = 20.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.5);
  doc.setTextColor(navy[0], navy[1], navy[2]);
  doc.text('FULL SCHOOL ADDRESS', 4, y);

  y += 3.2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.5);
  doc.setTextColor(40, 40, 40);
  const addrLines = doc.splitTextToSize(schoolFullAddress(school), CARD_W - 8);
  doc.text(addrLines, 4, y);
  y += Math.min(addrLines.length, 4) * 2.6 + 2;

  // Signature + return boxes
  const boxTop = Math.min(y, 28);
  doc.setDrawColor(210, 218, 230);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(3, boxTop, 40, 16.5, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4);
  doc.setTextColor(navy[0], navy[1], navy[2]);
  doc.text('AUTHORISED SIGNATURE', 5, boxTop + 3.2);

  if (school.signatureUrl && String(school.signatureUrl).startsWith('data:')) {
    try {
      const fmt = school.signatureUrl.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(school.signatureUrl, fmt, 5.5, boxTop + 4.2, 32, 7.5);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(3.8);
      doc.setTextColor(60, 60, 60);
      doc.text('Principal / Director', 5, boxTop + 14.5);
    } catch {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(navy[0], navy[1], navy[2]);
      doc.text('Authorised by school', 23, boxTop + 9.5, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(3.5);
      doc.setTextColor(90, 90, 90);
      doc.text('Official Campus Validation', 23, boxTop + 13.5, { align: 'center' });
    }
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.text('Authorised by school', 23, boxTop + 9.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(3.5);
    doc.setTextColor(90, 90, 90);
    doc.text('Official Campus Validation', 23, boxTop + 13.5, { align: 'center' });
  }

  doc.roundedRect(45, boxTop, 37.5, 16.5, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4);
  doc.setTextColor(navy[0], navy[1], navy[2]);
  doc.text('IF FOUND', 47, boxTop + 3.2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(3.8);
  doc.setTextColor(35, 35, 35);
  doc.text(
    `Please return this card to ${school.name || 'the school'} at the address shown. Thank you.`,
    47,
    boxTop + 6.5,
    { maxWidth: 33 }
  );

  doc.setFillColor(navy[0], navy[1], navy[2]);
  doc.rect(0, 46.5, CARD_W, 7.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(3.6);
  const policy =
    kind === 'staff'
      ? 'Official staff ID. Must be carried on campus. Property of the school.'
      : 'Official student ID. Must be carried on campus at all times. Property of the school.';
  doc.text(policy, CARD_W / 2, 51, { align: 'center', maxWidth: CARD_W - 4 });
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

  const navy = hexToRgb(school.primaryColor || '#1e3a8a');
  const accent = lighterRgb(navy, 50);

  for (let i = 0; i < persons.length; i++) {
    const person = persons[i];
    if (i > 0) doc.addPage();
    await drawFront(doc, person, school, navy, accent);
    doc.addPage();
    drawBack(doc, school, person.kind, navy);
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
