import jsPDF from 'jspdf';

const generateLandscapeIdCard = (cardData: any) => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [85.6, 54]
  });

  const CARD_W = 85.6;
  const CARD_H = 54;

  const hexToRgb = (hex: string): [number, number, number] => {
    const h = (hex || '#1e3a8a').replace('#', '');
    const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    const n = parseInt(full.slice(0, 6), 16);
    if (Number.isNaN(n)) return [30, 58, 138];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };

  const primaryColor = cardData.school_color || '#1e3a8a';
  const navy = hexToRgb(primaryColor);
  
  const accent: [number, number, number] = [
    Math.min(255, navy[0] + 50),
    Math.min(255, navy[1] + 50),
    Math.min(255, navy[2] + 50)
  ];

  // =========================================================
  // FRONT SIDE (Exact Original Layout Restored)
  // =========================================================
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

  let nameY = 7;
  if (cardData.school_logo) {
    try {
      doc.addImage(cardData.school_logo, 'PNG', CARD_W / 2 - 7, 1.5, 14, 9);
      nameY = 13.5; 
    } catch {
      nameY = 7;
    }
  }

  doc.setTextColor(navy[0], navy[1], navy[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text((cardData.school_name || 'SCHOOL NAME').toUpperCase(), CARD_W / 2, nameY, {
    align: 'center',
    maxWidth: CARD_W - 6,
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.5);
  doc.setTextColor(70, 70, 70);
  doc.text(cardData.school_address || 'Address of School', CARD_W / 2, nameY + 3.5, {
    align: 'center',
    maxWidth: CARD_W - 6,
  });

  const bannerTop = nameY + 6;
  const bannerLabel = cardData.type === 'staff' ? 'STAFF CARD' : 'STUDENT CARD';
  doc.setFillColor(navy[0], navy[1], navy[2]);
  doc.roundedRect(2.5, bannerTop, CARD_W - 5, 6.5, 1.2, 1.2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text(bannerLabel, CARD_W / 2, bannerTop + 3.7, { align: 'center' });

  // FIXED: Reduced passport photo box by 15% (from 23x27 down to 19.5x23)
  const photoX = 4;
  const photoY = bannerTop + 7.5;
  const photoW = 19.5;
  const photoH = 23.0;
  doc.setDrawColor(navy[0], navy[1], navy[2]);
  doc.setLineWidth(0.35);
  doc.roundedRect(photoX, photoY, photoW, photoH, 2, 2, 'S');

  if (cardData.photo_url) {
    try {
      doc.addImage(cardData.photo_url, 'JPEG', photoX + 0.4, photoY + 0.4, photoW - 0.8, photoH - 0.8);
    } catch {
      doc.setFillColor(230, 238, 248);
      doc.roundedRect(photoX + 0.5, photoY + 0.5, photoW - 1, photoH - 1, 1.5, 1.5, 'F');
    }
  } else {
    doc.setFillColor(230, 238, 248);
    doc.roundedRect(photoX + 0.5, photoY + 0.5, photoW - 1, photoH - 1, 1.5, 1.5, 'F');
  }

  const tx = 29;
  let ty = bannerTop + 11.5; 
  const maxTextWidth = 32;

  const details = [
    { label: "NAME", val: cardData.name ? cardData.name.toUpperCase() : '—', bold: true },
    { label: cardData.type === 'student' ? "BIRTH" : "EMAIL", val: cardData.dob || cardData.email || '—', bold: false },
    { label: cardData.type === 'student' ? "ADDRESS" : "ADDRESS", val: cardData.school_address || '—', bold: false },
    { label: "ID NO", val: cardData.id_number || '—', bold: true },
    { label: cardData.type === 'student' ? "CLASS" : "ROLE", val: cardData.class_name || cardData.role_label || '—', bold: false }
  ];

  details.forEach(item => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5);
    doc.setTextColor(navy[0], navy[1], navy[2]);
    doc.text(`${item.label}:`, tx, ty);
    
    doc.setFont('helvetica', item.bold ? 'bold' : 'normal');
    doc.setTextColor(35, 35, 35);
    const splitLines = doc.splitTextToSize(String(item.val), maxTextWidth);
    doc.text(splitLines, tx + 14, ty);
    
    const linesCount = splitLines.length;
    ty += (linesCount * 2.8) + 1.0;
  });

  if (cardData.qr_code_data) {
    try {
      doc.addImage(cardData.qr_code_data, 'PNG', CARD_W - 20.5, 35, 16, 16);
    } catch (e) {
      doc.setDrawColor(navy[0], navy[1], navy[2]);
      doc.rect(CARD_W - 20.5, 35, 16, 16, 'S');
    }
  }

  doc.setFontSize(3.5);
  doc.setTextColor(accent[0], accent[1], accent[2]);
  doc.text('MyEduRide', CARD_W - 2, 3, { align: 'right' });

  // =========================================================
  // BACK SIDE (Logo Included matching your Back Template Note)
  // =========================================================
  doc.addPage([CARD_W, CARD_H], 'landscape');

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, CARD_W, CARD_H, 'F');

  doc.setFillColor(245, 247, 252);
  doc.triangle(CARD_W, 0, CARD_W - 22, 0, CARD_W, 16, 'F');

  let backTextY = 7;
  if (cardData.school_logo) {
    try {
      doc.addImage(cardData.school_logo, 'PNG', CARD_W / 2 - 5, 1.5, 10, 6.5);
      backTextY = 11.5;
    } catch {
      backTextY = 7;
    }
  }

  doc.setTextColor(navy[0], navy[1], navy[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text((cardData.school_name || 'SCHOOL').toUpperCase(), CARD_W / 2, backTextY, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.5);
  doc.setTextColor(60, 60, 60);
  doc.text(cardData.school_address || '', CARD_W / 2, backTextY + 3.5, { align: 'center', maxWidth: CARD_W - 8 });

  doc.setDrawColor(210, 218, 230);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(3, 18, 38, 22, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4.5);
  doc.setTextColor(navy[0], navy[1], navy[2]);
  doc.text('AUTHORISED SIGNATURE', 5, 21);
  
  if (cardData.signature_url) {
    try {
      doc.addImage(cardData.signature_url, 'PNG', 6, 22.5, 30, 8);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(4.5);
      doc.text('Principal / Director', 5, 36);
    } catch {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(4.5);
      doc.text('Authorized by School', 5, 36);
    }
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(4.5);
    doc.text('Authorized by School', 5, 36);
  }

  doc.roundedRect(45, 18, 37, 22, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(4);
  doc.setTextColor(30, 30, 30);
  doc.text(
    `If found, please return this card to ${cardData.school_name || 'the school'}. Thank you.`,
    47,
    23,
    { maxWidth: 33 }
  );

  doc.setFillColor(navy[0], navy[1], navy[2]);
  doc.rect(0, 43, CARD_W, 11, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(3.8);
  const policy = cardData.type === 'staff'
    ? 'Official staff ID. Must be carried on campus.'
    : 'Official student ID. Must be carried on campus at all times.';
  doc.text(policy, CARD_W / 2, 49, { align: 'center', maxWidth: CARD_W - 4 });

  doc.save(`ID_Card_${cardData.id_number || 'download'}.pdf`);
};
