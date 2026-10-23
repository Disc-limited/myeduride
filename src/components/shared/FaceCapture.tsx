'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, X, SwitchCamera, CheckCircle2, AlertCircle, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { averageDescriptors, computeDescriptorFromDataUrl } from '@/lib/face/descriptor';

type FaceCaptureProps = {
  label?: string;
  minPhotos?: number;
  maxPhotos?: number;
  /** 'user' = front/selfie, 'environment' = back/rear (better for photographing someone else) */
  defaultFacingMode?: 'user' | 'environment';
  onChange: (payload: { photos: string[]; face_descriptor: number[] | null }) => void;
};

export default function FaceCapture({
  label = 'Face photos',
  minPhotos = 3,
  maxPhotos = 3,
  defaultFacingMode = 'environment',
  onChange,
}: FaceCaptureProps) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>(defaultFacingMode);
  const [isProcessing, setIsProcessing] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const updateParent = useCallback(async (next: string[]) => {
    if (next.length === 0) {
      onChange({ photos: [], face_descriptor: null });
      return;
    }
    try {
      const descriptors = await Promise.all(next.map((p) => computeDescriptorFromDataUrl(p)));
      onChange({ photos: next, face_descriptor: averageDescriptors(descriptors) });
    } catch {
      onChange({ photos: next, face_descriptor: null });
    }
  }, [onChange]);

  // Cleanly attach stream to video element when camera active
  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (cameraActive && video && stream) {
      video.defaultMuted = true;
      video.muted = true;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      video.srcObject = stream;
      video.play().then(() => {
        setCameraReady(true);
      }).catch((err) => {
        console.warn('[FaceCapture] play error:', err);
      });
    }
  }, [cameraActive, facingMode]);

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const startCamera = async (facing: 'user' | 'environment' = facingMode) => {
    try {
      setCameraReady(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      // Try with facingMode constraint
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: { ideal: facing },
          },
          audio: false,
        });
      } catch {
        // Fallback to basic video without constraints if ideal facing mode fails
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;
      setFacingMode(facing);
      setCameraActive(true);
    } catch (err: any) {
      console.error('[FaceCapture] getUserMedia error:', err);
      toast.error('Webcam stream not accessible. Use "Snap with phone camera" or "Upload photo" below.');
    }
  };

  const flipCamera = () => {
    const next = facingMode === 'user' ? 'environment' : 'user';
    startCamera(next);
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setCameraReady(false);
  };

  const isSolidBlack = (ctx: CanvasRenderingContext2D, width: number, height: number): boolean => {
    try {
      // Sample a 20x20 grid of pixels to test brightness
      const stepX = Math.max(1, Math.floor(width / 20));
      const stepY = Math.max(1, Math.floor(height / 20));
      const sample = ctx.getImageData(0, 0, width, height);
      const data = sample.data;
      let totalLuma = 0;
      let count = 0;
      for (let y = 0; y < height; y += stepY) {
        for (let x = 0; x < width; x += stepX) {
          const idx = (y * width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          totalLuma += (0.299 * r + 0.587 * g + 0.114 * b);
          count++;
        }
      }
      const avgLuma = count > 0 ? totalLuma / count : 0;
      return avgLuma < 3; // Less than 3 is effectively pitch black / empty frame
    } catch {
      return false;
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const vw = video.videoWidth;
    const vh = video.videoHeight;

    if (!vw || !vh || video.readyState < 2) {
      toast.error('Camera stream is still starting — wait 1-2 seconds and try again');
      return;
    }

    try {
      setIsProcessing(true);
      const canvas = document.createElement('canvas');
      canvas.width = vw;
      canvas.height = vh;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context unavailable');

      ctx.drawImage(video, 0, 0, vw, vh);

      if (isSolidBlack(ctx, vw, vh)) {
        toast.error('The camera returned a blank black frame. Tap "Snap with phone camera" below for reliable native capture.');
        setIsProcessing(false);
        return;
      }

      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      if (dataUrl.length < 5000) {
        toast.error('Photo too small — hold steady and capture again');
        setIsProcessing(false);
        return;
      }

      const next = [...photos, dataUrl].slice(0, maxPhotos);
      setPhotos(next);
      await updateParent(next);
      toast.success(`Photo ${next.length}/${maxPhotos} captured`);

      if (next.length >= maxPhotos) stopCamera();
    } catch (err: any) {
      toast.error('Failed to capture photo: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  };

  // Process files selected via native phone camera or gallery upload
  const handleNativeFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose a valid JPG or PNG image');
      return;
    }

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = async () => {
        try {
          const maxDim = 800;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas not supported');

          ctx.drawImage(img, 0, 0, w, h);

          if (isSolidBlack(ctx, w, h)) {
            toast.error('Image appears blank. Please take a clearer photo in good lighting.');
            setIsProcessing(false);
            return;
          }

          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          const next = [...photos, dataUrl].slice(0, maxPhotos);
          setPhotos(next);
          await updateParent(next);
          toast.success(`Photo ${next.length}/${maxPhotos} added`);
        } catch (err: any) {
          toast.error('Error processing photo: ' + (err?.message || ''));
        } finally {
          setIsProcessing(false);
        }
      };
      img.onerror = () => {
        toast.error('Could not load image');
        setIsProcessing(false);
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      toast.error('Could not read image file');
      setIsProcessing(false);
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = async (index: number) => {
    const next = photos.filter((_, i) => i !== index);
    setPhotos(next);
    await updateParent(next);
  };

  const facingLabel = facingMode === 'environment' ? 'Back camera' : 'Front camera';

  return (
    <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/60">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold text-sm text-slate-800">{label} *</h3>
        {photos.length >= minPhotos ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
            <CheckCircle2 size={12} /> Ready
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
            {photos.length}/{minPhotos} needed
          </span>
        )}
      </div>

      <p className="text-xs text-slate-500 mb-3">
        Take or upload {minPhotos} clear facial photos. Required for gate recognition & access badge.
      </p>

      {/* Hidden inputs for 100% reliable native OS camera and gallery */}
      <input
        ref={nativeCameraInputRef}
        type="file"
        accept="image/*"
        capture={facingMode === 'environment' ? 'environment' : 'user'}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleNativeFileSelect(f);
          e.target.value = '';
        }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleNativeFileSelect(f);
          e.target.value = '';
        }}
      />

      {!cameraActive ? (
        <div className="space-y-2">
          {/* Primary Action: Direct Mobile Camera Snap (100% reliable on iOS & Android) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              disabled={photos.length >= maxPhotos || isProcessing}
              onClick={() => nativeCameraInputRef.current?.click()}
              className="py-3 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl flex items-center justify-center gap-2 font-semibold text-xs shadow-sm transition-all active:scale-98"
            >
              <Camera size={16} />
              <span>Snap with Phone Camera</span>
            </button>

            <button
              type="button"
              disabled={photos.length >= maxPhotos || isProcessing}
              onClick={() => galleryInputRef.current?.click()}
              className="py-3 px-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 disabled:opacity-50 rounded-xl flex items-center justify-center gap-2 font-medium text-xs shadow-xs transition-all"
            >
              <Upload size={16} />
              <span>Upload from Gallery</span>
            </button>
          </div>

          {/* Secondary Action: In-Browser Live Video Stream */}
          <button
            type="button"
            disabled={photos.length >= maxPhotos || isProcessing}
            onClick={() => startCamera()}
            className="w-full py-2.5 border border-dashed border-slate-300 rounded-xl flex items-center justify-center gap-2 hover:border-emerald-400 hover:bg-emerald-50/50 text-slate-600 text-xs transition-colors"
          >
            <Camera size={14} className="text-slate-400" />
            <span>Open live camera view ({facingLabel})</span>
          </button>
        </div>
      ) : (
        <div>
          <div className="relative rounded-xl overflow-hidden bg-black mb-3 aspect-4/3 flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onLoadedMetadata={() => setCameraReady(true)}
              onCanPlay={() => setCameraReady(true)}
              className="w-full h-full object-cover"
            />

            {!cameraReady && (
              <div className="absolute inset-0 bg-slate-900/80 flex flex-col items-center justify-center text-white text-xs gap-2">
                <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                <span>Starting camera feed...</span>
              </div>
            )}

            <button
              type="button"
              onClick={flipCamera}
              className="absolute bottom-3 right-3 bg-black/70 backdrop-blur text-white text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-md hover:bg-black/90 active:scale-95 transition-all"
            >
              <SwitchCamera size={13} />
              Flip ({facingMode === 'user' ? 'back' : 'front'})
            </button>
          </div>

          <p className="text-xs text-center text-slate-500 mb-2">Active: {facingLabel}</p>

          <div className="space-y-2">
            <button
              type="button"
              onClick={capturePhoto}
              disabled={photos.length >= maxPhotos || isProcessing}
              className="btn-primary w-full py-2.5 text-sm font-semibold shadow-sm"
            >
              {isProcessing
                ? 'Processing...'
                : photos.length < maxPhotos
                ? `Capture photo ${photos.length + 1}/${maxPhotos}`
                : 'All photos captured'}
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => nativeCameraInputRef.current?.click()}
                className="btn-secondary text-xs py-2 flex items-center justify-center gap-1"
              >
                <Camera size={13} /> Phone Camera
              </button>
              <button
                type="button"
                onClick={stopCamera}
                className="btn-secondary text-xs py-2 text-slate-600"
              >
                Close camera
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Captured Photo Thumbnails */}
      {photos.length > 0 && (
        <div className="flex gap-2.5 mt-3 flex-wrap">
          {photos.map((p, i) => (
            <div key={i} className="relative group">
              <img
                src={p}
                alt={`Face ${i + 1}`}
                className="w-16 h-16 rounded-xl object-cover border-2 border-emerald-500 shadow-xs"
              />
              <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] font-bold px-1 rounded">
                #{i + 1}
              </span>
              <button
                type="button"
                onClick={() => removePhoto(i)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-600 hover:bg-rose-700 text-white rounded-full flex items-center justify-center shadow-md transition-colors"
                title="Remove photo"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <p className={`text-xs mt-2.5 font-medium flex items-center gap-1.5 ${
        photos.length >= minPhotos ? 'text-emerald-700' : 'text-amber-700'
      }`}>
        {photos.length >= minPhotos ? (
          <>
            <CheckCircle2 size={13} />
            <span>Face enrollment ready ({photos.length}/{minPhotos} photos)</span>
          </>
        ) : (
          <>
            <AlertCircle size={13} />
            <span>{photos.length}/{minPhotos} photos captured — take {minPhotos - photos.length} more</span>
          </>
        )}
      </p>
    </div>
  );
}
