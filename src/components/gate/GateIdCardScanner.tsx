'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import { triggerHapticNotification } from '@/lib/platform/haptics';
import {
  cameraVideoConstraints,
  createBarcodeDetector,
  decodeScanFromVideo,
  type BarcodeDetectorLike,
  type JsQRFn,
} from '@/lib/gate/decode-scan-frame';

interface GateIdCardScannerProps {
  active: boolean;
  busy?: boolean;
  onDetected: (code: string) => void;
  hint?: string;
}

type FacingMode = 'environment' | 'user';

export default function GateIdCardScanner({
  active,
  busy = false,
  onDetected,
  hint = 'Align the escort ID card barcode or QR in the frame',
}: GateIdCardScannerProps) {
  const [facingMode, setFacingMode] = useState<FacingMode>('environment');
  const [cameraError, setCameraError] = useState(false);
  const [starting, setStarting] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const jsQRRef = useRef<JsQRFn | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastScannedRef = useRef(new Map<string, number>());
  const busyRef = useRef(busy);
  const onDetectedRef = useRef(onDetected);

  busyRef.current = busy;
  onDetectedRef.current = onDetected;

  useEffect(() => {
    import('jsqr')
      .then((m) => {
        jsQRRef.current = m.default as JsQRFn;
      })
      .catch((err) => console.error('[GateIdCardScanner] Failed to load jsqr:', err));

    detectorRef.current = createBarcodeDetector();
  }, []);

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const emitDetected = (value: string) => {
    const code = value.trim();
    if (!code) return;
    const now = Date.now();
    const last = lastScannedRef.current.get(code) || 0;
    if (now - last < 3000) return;
    lastScannedRef.current.set(code, now);
    triggerHapticNotification('SUCCESS').catch(() => {});
    onDetectedRef.current(code);
  };

  const startQrLoop = () => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    if (!canvasRef.current) canvasRef.current = document.createElement('canvas');

    scanIntervalRef.current = setInterval(async () => {
      const video = videoRef.current;
      if (!video || busyRef.current) return;
      const raw = await decodeScanFromVideo(video, {
        jsQR: jsQRRef.current,
        detector: detectorRef.current,
        canvas: canvasRef.current || undefined,
      });
      if (raw) emitDetected(raw);
    }, 200);
  };

  const startCamera = async (facing: FacingMode = facingMode) => {
    setStarting(true);
    stopCamera();
    let stream: MediaStream | null = null;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: cameraVideoConstraints(facing),
        audio: false,
      });
    } catch {
      try {
        const altFacing: FacingMode = facing === 'environment' ? 'user' : 'environment';
        stream = await navigator.mediaDevices.getUserMedia({
          video: cameraVideoConstraints(altFacing),
          audio: false,
        });
        setFacingMode(altFacing);
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        } catch (err: unknown) {
          setCameraError(true);
          setStarting(false);
          const errObj = err as { name?: string; message?: string };
          const errName = errObj?.name || 'Error';
          if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
            toast.error('Camera blocked — allow camera access, or type the Escort ID below');
          } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
            toast.error('Camera is in use by another app — close it, or type the Escort ID');
          } else {
            toast.error('Camera unavailable — enter the Escort ID instead');
          }
          return;
        }
      }
    }

    if (!stream) {
      setStarting(false);
      return;
    }

    setCameraError(false);
    streamRef.current = stream;
    setFacingMode(facing);
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => {});
    }
    startQrLoop();
    setStarting(false);
  };

  useEffect(() => {
    if (!active) {
      stopCamera();
      return undefined;
    }
    startCamera();
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  if (!active) return null;

  return (
    <div className="rounded-2xl overflow-hidden border-2 border-teal-200 bg-slate-900 shadow-sm">
      <div className="relative aspect-[4/3] bg-slate-900">
        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />

        {!cameraError && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="w-[72%] max-w-[240px] aspect-square rounded-2xl border-2 border-teal-300/90 shadow-[0_0_0_9999px_rgba(15,23,42,0.35)]">
              <div className="absolute inset-x-6 top-1/2 h-0.5 bg-teal-300/80 animate-pulse" />
            </div>
          </div>
        )}

        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 z-10">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/55 text-white text-[10px] font-extrabold uppercase tracking-wide">
            <ScanLine size={12} className="text-teal-300" />
            Scan escort ID card
          </span>
          {busy && (
            <span className="px-2.5 py-1 rounded-full bg-teal-600 text-white text-[10px] font-extrabold">
              Looking up…
            </span>
          )}
        </div>

        {cameraError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-slate-900/92 text-white text-center z-10">
            <Camera size={32} className="text-slate-400 mb-2" />
            <p className="text-xs font-semibold mb-1 text-slate-200">Camera blocked or unavailable</p>
            <p className="text-[11px] text-slate-400 mb-3 max-w-xs">Allow camera permission, or enter the Escort ID below.</p>
            <button
              type="button"
              onClick={() => startCamera()}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Camera size={14} /> Enable camera
            </button>
          </div>
        )}

        {!cameraError && (
          <button
            type="button"
            onClick={() => startCamera(facingMode === 'environment' ? 'user' : 'environment')}
            disabled={starting}
            className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-3 py-2 rounded-full flex items-center gap-1 z-20 cursor-pointer disabled:opacity-50"
          >
            <Camera size={14} /> Flip
          </button>
        )}
      </div>
      <p className="px-3 py-2 text-[11px] text-teal-50/90 bg-teal-900/80 font-medium flex items-center gap-1.5">
        <ScanLine size={13} className="text-teal-300 shrink-0" />
        {hint}
      </p>
    </div>
  );
}
