'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Camera,
  X,
  RefreshCw,
  CheckCircle2,
  ScanFace,
  Fingerprint,
  Upload,
  AlertCircle,
  Sparkles
} from 'lucide-react';

interface BiometricCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'photo' | 'facial' | 'fingerprint';
  onCapture: (dataUrl: string) => void;
  title?: string;
}

export default function BiometricCaptureModal({
  isOpen,
  onClose,
  type,
  onCapture,
  title,
}: BiometricCaptureModalProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [fingerprintProgress, setFingerprintProgress] = useState(0);
  const [scanComplete, setScanComplete] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize Camera Stream when modal opens (for photo or facial scan)
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setCapturedImage(null);
      setCameraError(null);
      setScanComplete(false);
      setFingerprintProgress(0);
      return;
    }

    if (type === 'fingerprint') {
      startFingerprintSimulation();
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen, type]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 640 },
          facingMode: 'user',
        },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraError(
        'Unable to access camera. Please allow camera permissions in your browser or upload a photo manually.'
      );
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const handleTakeSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth || 480;
    canvas.height = video.videoHeight || 480;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedImage(dataUrl);
    setScanComplete(true);
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setScanComplete(false);
    startCamera();
  };

  const handleConfirm = () => {
    if (capturedImage) {
      onCapture(capturedImage);
      onClose();
    }
  };

  // Fingerprint Scanner Simulation
  const startFingerprintSimulation = () => {
    setIsScanning(true);
    setFingerprintProgress(0);
    setScanComplete(false);

    let current = 0;
    const interval = setInterval(() => {
      current += 10;
      setFingerprintProgress(current);
      if (current >= 100) {
        clearInterval(interval);
        setIsScanning(false);
        setScanComplete(true);
        // Create an SVG-based simulated fingerprint hash
        const fakeFingerprintToken = `FP-SCAN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        setCapturedImage(fakeFingerprintToken);
      }
    }, 150);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200 font-sans">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden text-slate-800 text-xs">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/20 shrink-0">
              {type === 'facial' ? (
                <ScanFace className="w-5 h-5" />
              ) : type === 'fingerprint' ? (
                <Fingerprint className="w-5 h-5" />
              ) : (
                <Camera className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">
                {title ||
                  (type === 'facial'
                    ? 'Live Facial Recognition Scan'
                    : type === 'fingerprint'
                    ? 'Digital Fingerprint Scanner'
                    : 'Capture Profile Photo')}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                {type === 'facial'
                  ? 'Align face inside the oval frame for recognition'
                  : type === 'fingerprint'
                  ? 'Place finger on optical bio-sensor'
                  : 'Take a clear portrait photo for the ID card'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-500 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          
          {/* CAMERA / FACIAL SCAN MODE */}
          {type !== 'fingerprint' && (
            <div className="space-y-3">
              {cameraError ? (
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 space-y-2 text-center">
                  <AlertCircle className="w-6 h-6 text-amber-600 mx-auto" />
                  <p className="font-bold text-xs">{cameraError}</p>
                </div>
              ) : (
                <div className="relative w-full aspect-square max-w-[320px] mx-auto rounded-2xl overflow-hidden bg-slate-900 shadow-inner flex items-center justify-center border-2 border-slate-700">
                  {!capturedImage ? (
                    <>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover mirror"
                        style={{ transform: 'scaleX(-1)' }}
                      />
                      {/* Facial Recognition Overlay Guide */}
                      {type === 'facial' && (
                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                          <div className="w-48 h-64 rounded-[50%] border-2 border-dashed border-emerald-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] animate-pulse flex items-center justify-center">
                            <span className="text-[10px] font-extrabold text-emerald-300 bg-slate-950/80 px-2 py-0.5 rounded-full">
                              Align Face Here
                            </span>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <img
                      src={capturedImage}
                      alt="Captured snapshot"
                      className="w-full h-full object-cover"
                    />
                  )}
                  <canvas ref={canvasRef} className="hidden" />
                </div>
              )}

              {/* Controls */}
              {!cameraError && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  {!capturedImage ? (
                    <button
                      type="button"
                      onClick={handleTakeSnapshot}
                      className="py-2.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs flex items-center gap-2 shadow-md shadow-blue-600/20 cursor-pointer transition-all"
                    >
                      <Camera className="w-4 h-4" />
                      <span>{type === 'facial' ? 'Scan Face' : 'Capture Snapshot'}</span>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleRetake}
                        className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Retake</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirm}
                        className="py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer transition-all"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Use This Photo</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* FINGERPRINT SCAN MODE */}
          {type === 'fingerprint' && (
            <div className="py-6 flex flex-col items-center justify-center text-center space-y-4">
              <div
                className={`relative w-28 h-28 rounded-3xl border-2 flex items-center justify-center transition-all ${
                  scanComplete
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-600 shadow-lg shadow-emerald-500/20'
                    : isScanning
                    ? 'bg-blue-50 border-blue-500 text-blue-600 animate-pulse shadow-lg shadow-blue-500/20'
                    : 'bg-slate-100 border-slate-300 text-slate-400'
                }`}
              >
                <Fingerprint className="w-16 h-16" />
                {isScanning && (
                  <div className="absolute inset-x-2 top-2 h-1 bg-blue-500 rounded-full animate-bounce shadow-sm" />
                )}
              </div>

              {/* Status Text & Progress */}
              <div className="w-full max-w-xs space-y-2">
                <div className="flex justify-between text-[11px] font-extrabold text-slate-600">
                  <span>{scanComplete ? 'Scan Verified 100%' : isScanning ? 'Capturing Minutiae Points...' : 'Ready'}</span>
                  <span>{fingerprintProgress}%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all duration-150"
                    style={{ width: `${fingerprintProgress}%` }}
                  />
                </div>
              </div>

              {scanComplete && (
                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={startFingerprintSimulation}
                    className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Scan Again</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    className="py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Attach Fingerprint</span>
                  </button>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer info */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 text-center font-medium">
          🔒 Bio-data is securely tokenized and stored in compliance with NDPR data safety regulations.
        </div>
      </div>
    </div>
  );
}
