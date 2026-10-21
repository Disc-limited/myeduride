/**
 * High-Density, High-Contrast Code 128 Barcode Generator for MyEduRide
 *
 * Engineered specifically for rapid optical scanning by gate officers and transit escorts.
 * Produces crisp vector bars for both interactive DOM/SVG rendering and jsPDF card print generation.
 */

// Code 128 patterns (0-106). Each entry is a sequence of 6 run-lengths (sum=11 modules),
// except the stop character (106) which has 7 run-lengths (sum=13 modules).
const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112'
];

export interface BarcodeRun {
  isBar: boolean;
  width: number;
}

/**
 * Encodes an ASCII string into Code 128 (Subset B) runs of bars and spaces.
 */
export function encodeCode128Runs(text: string, quietZoneModules = 10): { runs: BarcodeRun[]; totalModules: number } {
  const safeText = (text || '0000').trim().replace(/[^ -~]/g, '');
  const codes: number[] = [104]; // Start B
  let checksum = 104;

  for (let i = 0; i < safeText.length; i++) {
    const val = safeText.charCodeAt(i) - 32;
    codes.push(val);
    checksum += val * (i + 1);
  }

  codes.push(checksum % 103);
  codes.push(106); // Stop

  const runs: BarcodeRun[] = [];
  let totalModules = 0;

  if (quietZoneModules > 0) {
    runs.push({ isBar: false, width: quietZoneModules });
    totalModules += quietZoneModules;
  }

  for (const c of codes) {
    const pat = CODE128_PATTERNS[c];
    let isBar = true;
    for (const ch of pat) {
      const len = Number(ch);
      runs.push({ isBar, width: len });
      totalModules += len;
      isBar = !isBar;
    }
  }

  if (quietZoneModules > 0) {
    runs.push({ isBar: false, width: quietZoneModules });
    totalModules += quietZoneModules;
  }

  return { runs, totalModules };
}

/**
 * Generates an SVG string representation of the bold barcode.
 */
export function generateBarcodeSvg(
  text: string,
  options?: {
    height?: number;
    moduleWidth?: number;
    barColor?: string;
    bgColor?: string;
  }
): string {
  const height = options?.height ?? 50;
  const moduleWidth = options?.moduleWidth ?? 2;
  const barColor = options?.barColor ?? '#000000';
  const bgColor = options?.bgColor ?? 'transparent';

  const { runs, totalModules } = encodeCode128Runs(text, 10);
  const totalWidth = totalModules * moduleWidth;

  let currentX = 0;
  const rects: string[] = [];

  for (const run of runs) {
    const runW = run.width * moduleWidth;
    if (run.isBar) {
      rects.push(`<rect x="${currentX}" y="0" width="${runW}" height="${height}" fill="${barColor}" />`);
    }
    currentX += runW;
  }

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${height}" width="${totalWidth}" height="${height}" style="background-color: ${bgColor}; shape-rendering: crispEdges;">
      ${rects.join('\n')}
    </svg>
  `.trim();
}

/**
 * Generates a base64 SVG data URL for immediate use in <img> tags or HTML Canvas.
 */
export function generateBarcodeDataUrl(
  text: string,
  options?: {
    height?: number;
    moduleWidth?: number;
    barColor?: string;
    bgColor?: string;
  }
): string {
  const svg = generateBarcodeSvg(text, options);
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    return `data:image/svg+xml;base64,${window.btoa(unescape(encodeURIComponent(svg)))}`;
  }
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

/**
 * Renders a crisp vector-grade bold barcode directly into a jsPDF document.
 * This guarantees ultra-sharp, high-contrast, laser-scannable bars on plastic PVC cards.
 */
export function drawBarcodeToPdf(
  doc: any,
  text: string,
  x: number,
  y: number,
  targetWidth: number,
  targetHeight: number,
  options?: {
    quietZoneModules?: number;
  }
) {
  const quietZone = options?.quietZoneModules ?? 8;
  const { runs, totalModules } = encodeCode128Runs(text, quietZone);
  const moduleW = targetWidth / totalModules;

  doc.setFillColor(0, 0, 0);

  let currentX = x;
  for (const run of runs) {
    const runWidth = run.width * moduleW;
    if (run.isBar) {
      // Draw solid bold black vector bar
      doc.rect(currentX, y, runWidth, targetHeight, 'F');
    }
    currentX += runWidth;
  }
}
