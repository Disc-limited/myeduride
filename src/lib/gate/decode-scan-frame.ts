/**
 * Shared camera-frame decoder for gate / escort ID scanners.
 * Prefers BarcodeDetector when available, then jsQR with higher resolution + inversion.
 */

export type JsQRFn = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options?: { inversionAttempts?: string }
) => { data?: string } | null;

export type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue?: string }>>;
};

const SCAN_MAX_WIDTH = 1280;

export function createBarcodeDetector(): BarcodeDetectorLike | null {
  if (typeof window === 'undefined') return null;
  const Detector = (
    window as unknown as {
      BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike;
    }
  ).BarcodeDetector;
  if (!Detector) return null;
  try {
    return new Detector({
      formats: [
        'qr_code',
        'code_128',
        'code_39',
        'code_93',
        'ean_13',
        'ean_8',
        'upc_a',
        'upc_e',
        'codabar',
        'itf',
      ],
    });
  } catch {
    return null;
  }
}

export async function decodeScanFromVideo(
  video: HTMLVideoElement,
  opts: {
    jsQR: JsQRFn | null;
    detector?: BarcodeDetectorLike | null;
    canvas?: HTMLCanvasElement;
  }
): Promise<string | null> {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;

  const scale = vw > SCAN_MAX_WIDTH ? SCAN_MAX_WIDTH / vw : 1;
  const cw = Math.max(1, Math.round(vw * scale));
  const ch = Math.max(1, Math.round(vh * scale));

  const canvas = opts.canvas || document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d', { willReadFrequently: true } as CanvasRenderingContext2DSettings);
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, cw, ch);

  if (opts.detector) {
    try {
      const codes = await opts.detector.detect(canvas);
      const raw = codes?.[0]?.rawValue?.trim();
      if (raw) return raw;
    } catch {
      /* fall through */
    }
  }

  if (!opts.jsQR) return null;
  try {
    const imageData = ctx.getImageData(0, 0, cw, ch);
    const code = opts.jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'attemptBoth',
    });
    return code?.data?.trim() || null;
  } catch {
    return null;
  }
}

export const cameraVideoConstraints = (facing: 'environment' | 'user') =>
  ({
    facingMode: facing,
    width: { ideal: 1280 },
    height: { ideal: 720 },
  }) as MediaTrackConstraints;
