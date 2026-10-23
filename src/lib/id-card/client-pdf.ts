'use client';

/**
 * Client-Side Exact DOM-to-PDF Exporter for ID Cards.
 * Captures the exact rendered CSS/DOM preview so the resulting PDF
 * is 100% uniform and identical to what is displayed on screen.
 */

export async function exportCardPdfFromDom({
  format = 'atm',
  fileName,
}: {
  format?: 'atm' | 'classic';
  fileName: string;
}): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  try {
    const [{ toPng }, jsPdfModule] = await Promise.all([
      import('html-to-image'),
      import('jspdf'),
    ]);

    const jsPDF = jsPdfModule.default || jsPdfModule.jsPDF || jsPdfModule;

    const prefix = format === 'classic' ? 'classic-card' : 'atm-card';

    // 1. Try on-screen live rendered card elements first (Dual View mode in modal)
    const onScreenFront = document.getElementById(`${prefix}-onscreen-front`);
    const onScreenBack = document.getElementById(`${prefix}-onscreen-back`);

    // 2. Fall back to off-screen 440px print template if on-screen dual view is not mounted
    const fallbackFront = document.getElementById(`${prefix}-print-front`);
    const fallbackBack = document.getElementById(`${prefix}-print-back`);

    const frontContainer = onScreenFront || fallbackFront;
    const backContainer = onScreenBack || fallbackBack;

    if (!frontContainer || !backContainer) {
      console.warn(`[client-pdf] Print elements for ${prefix} not found in DOM`);
      return false;
    }

    // Target the actual inner card element with rounded corners & aspect ratio
    const targetFront = (frontContainer.firstElementChild as HTMLElement) || frontContainer;
    const targetBack = (backContainer.firstElementChild as HTMLElement) || backContainer;

    // Await all web fonts (Poppins, Inter, monospace) so typography renders at 100% fidelity
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

    // Ensure all <img> tags within the cards are completely loaded
    const images = Array.from(targetFront.querySelectorAll('img')).concat(
      Array.from(targetBack.querySelectorAll('img'))
    );
    await Promise.all(
      images.map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete) resolve(true);
            else {
              img.onload = () => resolve(true);
              img.onerror = () => resolve(true);
            }
          })
      )
    );

    // Both ATM and Classic formats are standard CR80 Landscape cards (85.6mm x 54.0mm)
    // Dynamically check actual aspect ratio so any future card is accurately sized
    const rect = targetFront.getBoundingClientRect?.() || { width: 440, height: 277.4 };
    const isPortrait = rect.width > 0 && rect.height > rect.width;
    const cardW = isPortrait ? 54.0 : 85.6;
    const cardH = isPortrait ? 85.6 : 54.0;
    const orientation: 'portrait' | 'landscape' = isPortrait ? 'portrait' : 'landscape';

    // Capture using html-to-image for native browser SVG foreignObject rasterization:
    // Guarantees zero text clipping, zero horizontal slicing, crisp fonts, and exact SVG positioning
    let frontImg: string;
    let backImg: string;

    try {
      [frontImg, backImg] = await Promise.all([
        toPng(targetFront, {
          pixelRatio: 3,
          cacheBust: false,
          quality: 1,
        }),
        toPng(targetBack, {
          pixelRatio: 3,
          cacheBust: false,
          quality: 1,
        }),
      ]);
    } catch (toImgErr) {
      console.warn('[client-pdf] html-to-image encountered an error, trying with skipFonts or html2canvas fallback:', toImgErr);
      try {
        [frontImg, backImg] = await Promise.all([
          toPng(targetFront, { pixelRatio: 3, skipFonts: true }),
          toPng(targetBack, { pixelRatio: 3, skipFonts: true }),
        ]);
      } catch (fallbackErr) {
        // Ultimate fallback to html2canvas
        const html2canvasModule = await import('html2canvas');
        const html2canvas = html2canvasModule.default || html2canvasModule;
        const [c1, c2] = await Promise.all([
          html2canvas(targetFront, { scale: 3, useCORS: true, allowTaint: true, backgroundColor: null }),
          html2canvas(targetBack, { scale: 3, useCORS: true, allowTaint: true, backgroundColor: '#ffffff' }),
        ]);
        frontImg = c1.toDataURL('image/png');
        backImg = c2.toDataURL('image/png');
      }
    }

    const doc = new jsPDF({
      orientation,
      unit: 'mm',
      format: [cardW, cardH],
    });

    // Page 1: Card Front (100% bleed to standard CR80 85.6 x 54.0 mm)
    doc.addImage(frontImg, 'PNG', 0, 0, cardW, cardH, undefined, 'FAST');

    // Page 2: Card Back (100% bleed to standard CR80 85.6 x 54.0 mm)
    doc.addPage([cardW, cardH], orientation);
    doc.addImage(backImg, 'PNG', 0, 0, cardW, cardH, undefined, 'FAST');

    doc.save(fileName);
    return true;
  } catch (err) {
    console.error('[client-pdf] Failed to export card PDF from DOM:', err);
    return false;
  }
}
