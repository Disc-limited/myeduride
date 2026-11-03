'use client';

/**
 * Client-Side Exact DOM-to-PDF Exporter for ID Cards.
 * Captures the exact rendered CSS/DOM preview so the resulting PDF
 * is 100% uniform and identical to what is displayed on screen.
 */

export async function exportCardPdfFromDom({
  format = 'atm',
  fileName,
  containerId,
}: {
  format?: 'atm' | 'classic';
  fileName: string;
  containerId?: string;
}): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  try {
    const [{ toPng }, jsPdfModule] = await Promise.all([
      import('html-to-image'),
      import('jspdf'),
    ]);

    const jsPDF = jsPdfModule.default || jsPdfModule.jsPDF || jsPdfModule;
    const prefix = format === 'classic' ? 'classic-card' : 'atm-card';

    const pairs: Array<{ front: HTMLElement; back: HTMLElement }> = [];

    // 1. If explicit containerId is provided, look for card export pairs
    if (containerId) {
      const container = document.getElementById(containerId);
      if (container) {
        const pairWrappers = Array.from(container.querySelectorAll<HTMLElement>('.id-card-export-pair'));
        if (pairWrappers.length > 0) {
          for (const pw of pairWrappers) {
            const front = pw.querySelector<HTMLElement>('.id-card-export-front');
            const back = pw.querySelector<HTMLElement>('.id-card-export-back');
            if (front && back) pairs.push({ front, back });
          }
        } else {
          const front = container.querySelector<HTMLElement>('.id-card-export-front');
          const back = container.querySelector<HTMLElement>('.id-card-export-back');
          if (front && back) pairs.push({ front, back });
        }
      }
    }

    // 2. If no container or pairs found yet, search for default on-screen or fallback print elements
    if (pairs.length === 0) {
      const fallbackFront = document.getElementById(`${prefix}-print-front`);
      const fallbackBack = document.getElementById(`${prefix}-print-back`);

      const onScreenFront = document.getElementById(`${prefix}-onscreen-front`);
      const onScreenBack = document.getElementById(`${prefix}-onscreen-back`);

      // Prefer fallback print container as it is strictly calibrated at 440x277.4px
      if (fallbackFront && fallbackBack) {
        pairs.push({ front: fallbackFront, back: fallbackBack });
      } else if (onScreenFront && onScreenBack) {
        pairs.push({ front: onScreenFront, back: onScreenBack });
      } else {
        const frontContainer = fallbackFront || onScreenFront;
        const backContainer = fallbackBack || onScreenBack;
        if (frontContainer && backContainer) {
          pairs.push({ front: frontContainer, back: backContainer });
        }
      }
    }

    if (pairs.length === 0) {
      console.warn(`[client-pdf] Print elements for ${prefix} not found in DOM`);
      return false;
    }

    // Await all web fonts (Poppins, Inter, monospace) so typography renders at 100% fidelity
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

    // Capture each card pair
    const renderedCards: Array<{
      frontImg: string;
      backImg: string;
      cardW: number;
      cardH: number;
      orientation: 'portrait' | 'landscape';
    }> = [];

    for (const pair of pairs) {
      // Target the actual inner card element with rounded corners & aspect ratio
      const targetFront = (pair.front.firstElementChild as HTMLElement) || pair.front;
      const targetBack = (pair.back.firstElementChild as HTMLElement) || pair.back;

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
      const rect = targetFront.getBoundingClientRect?.() || { width: 440, height: 277.4 };
      const isPortrait = rect.width > 0 && rect.height > rect.width;
      const cardW = isPortrait ? 54.0 : 85.6;
      const cardH = isPortrait ? 85.6 : 54.0;
      const orientation: 'portrait' | 'landscape' = isPortrait ? 'portrait' : 'landscape';

      let frontImg: string;
      let backImg: string;

      try {
        [frontImg, backImg] = await Promise.all([
          toPng(targetFront, {
            pixelRatio: 3,
            cacheBust: false,
            quality: 1,
            skipFonts: true,
          }),
          toPng(targetBack, {
            pixelRatio: 3,
            cacheBust: false,
            quality: 1,
            skipFonts: true,
          }),
        ]);
      } catch (toImgErr) {
        console.warn('[client-pdf] html-to-image encountered an error, trying html2canvas fallback:', toImgErr);
        // Fallback to html2canvas with CORS enabled
        const html2canvasModule = await import('html2canvas');
        const html2canvas = html2canvasModule.default || html2canvasModule;
        const [c1, c2] = await Promise.all([
          html2canvas(targetFront, { scale: 3, useCORS: true, backgroundColor: null }),
          html2canvas(targetBack, { scale: 3, useCORS: true, backgroundColor: '#ffffff' }),
        ]);
        frontImg = c1.toDataURL('image/png');
        backImg = c2.toDataURL('image/png');
      }

      renderedCards.push({ frontImg, backImg, cardW, cardH, orientation });
    }

    if (renderedCards.length === 0) return false;

    const first = renderedCards[0];
    const doc = new jsPDF({
      orientation: first.orientation,
      unit: 'mm',
      format: [first.cardW, first.cardH],
    });

    let isFirstCard = true;
    for (const card of renderedCards) {
      if (!isFirstCard) {
        doc.addPage([card.cardW, card.cardH], card.orientation);
      }
      // Front Page (100% bleed to standard CR80 85.6 x 54.0 mm)
      doc.addImage(card.frontImg, 'PNG', 0, 0, card.cardW, card.cardH, undefined, 'FAST');

      // Back Page (100% bleed to standard CR80 85.6 x 54.0 mm)
      doc.addPage([card.cardW, card.cardH], card.orientation);
      doc.addImage(card.backImg, 'PNG', 0, 0, card.cardW, card.cardH, undefined, 'FAST');

      isFirstCard = false;
    }

    doc.save(fileName);
    return true;
  } catch (err) {
    console.error('[client-pdf] Failed to export card PDF from DOM:', err);
    return false;
  }
}
