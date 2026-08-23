// @ts-nocheck
'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import StudentAvatar from '@/components/shared/StudentAvatar';
import TodayScanStatusBanner from '@/components/gate/TodayScanStatusBanner';
import { applyScanHints, isActionBlocked } from '@/lib/gate/scan-hints-client';

function splitName(fullName) {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] || '', last: parts.slice(1).join(' ') || '' };
}

/**
 * Scan-only staff sign-in/out (gate manager or school admin with staff ID card).
 */
export default function StaffIdScanPanel({
  schoolId,
  mode = 'arrival',
  onModeChange = () => {},
  onSuccess = () => {},
}) {
  const [manualCode, setManualCode] = useState('');
  const [scanned, setScanned] = useState(null);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [facingMode, setFacingMode] = useState('environment');
  const [autoConfirm, setAutoConfirm] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const jsQRRef = useRef(null);
  const lastScannedRef = useRef(new Map());

  useEffect(() => {
    import('jsqr')
      .then((m) => {
        jsQRRef.current = m.default;
      })
      .catch((err) => console.error('[StaffIdScanPanel] Failed to load jsqr:', err));
  }, []);

  const [cameraError, setCameraError] = useState(false);

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const startCamera = async (facing = facingMode) => {
    if (streamRef.current && streamRef.current.active && facing === facingMode) {
      if (videoRef.current && videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        await videoRef.current.play().catch(() => {});
      }
      setCameraError(false);
      startQrScanning();
      return;
    }

    stopCamera();
    let stream = null;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing },
        audio: false,
      });
    } catch {
      try {
        const altFacing = facing === 'environment' ? 'user' : 'environment';
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: altFacing },
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
          console.error('[StaffIdScanPanel] Camera access error:', err);
          setCameraError(true);
          const errObj = err as { name?: string; message?: string };
          const errName = errObj?.name || 'Error';
          const errMsg = errObj?.message || 'Camera blocked or unavailable';
          if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
            toast.error('Camera blocked by browser — click 🔒 icon in address bar to Allow Camera');
          } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
            toast.error('Camera in use by another app — close Zoom/Meet or other tabs');
          } else {
            toast.error(`Camera error (${errName}): ${errMsg}`);
          }
          return;
        }
      }
    }

    if (stream) {
      setCameraError(false);
      streamRef.current = stream;
      setFacingMode(facing);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      startQrScanning();
    }
  };

  const pauseQrScanning = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
  };

  const startQrScanning = () => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
    scanIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || saving || scanning || (scanned && !autoConfirm)) return;
      const vw = videoRef.current.videoWidth;
      const vh = videoRef.current.videoHeight;
      if (!vw || !vh) return;
      const canvas = document.createElement('canvas');
      canvas.width = vw;
      canvas.height = vh;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(videoRef.current, 0, 0);
      const imageData = ctx.getImageData(0, 0, vw, vh);
      try {
        if (!jsQRRef.current) return;
        const code = jsQRRef.current(imageData.data, imageData.width, imageData.height);
        if (code?.data) {
          const lastScanned = lastScannedRef.current;
          const now = Date.now();
          if (lastScanned.has(code.data) && now - lastScanned.get(code.data) < 3000) {
            return;
          }
          lastScanned.set(code.data, now);

          if (!autoConfirm) {
            clearInterval(scanIntervalRef.current);
            scanIntervalRef.current = null;
          }
          await lookupScan(code.data);
        }
      } catch {
        /* skip frame */
      }
    }, 400);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    if (!scanned || autoConfirm) {
      if (!streamRef.current || !streamRef.current.active) {
        startCamera();
      } else {
        startQrScanning();
      }
    } else {
      pauseQrScanning();
    }
  }, [scanned, schoolId, autoConfirm]);

  const lookupScan = async (code) => {
    const value = (code || manualCode).trim();
    if (!value) {
      toast.error('Scan staff ID card or enter ID number');
      return;
    }
    if (!schoolId) {
      toast.error('School not loaded');
      return;
    }
    setScanning(true);
    try {
      const res = await fetch('/api/gate/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ scan_data: value, school_id: schoolId }),
      });
      const data = await res.json();
      if (!res.ok || data.type !== 'staff') {
        throw new Error(data.error || 'Staff ID not found');
      }

      if (autoConfirm) {
        await executeAutoConfirm(data);
      } else {
        stopCamera();
        applyScanHints(data, { toast, setMode: onModeChange });
        setScanned(data);
      }
    } catch (e) {
      toast.error(e.message || 'Scan failed');
      if (!scanned || autoConfirm) {
        startCamera();
      }
    } finally {
      setScanning(false);
    }
  };

  const gateAction = mode === 'arrival' ? 'arrival' : 'departure';
  const block = isActionBlocked(scanned?.today_status, gateAction, true);
  const fullyComplete = scanned?.scan_hints?.already_complete;

  const executeAutoConfirm = async (scannedData) => {
    const check = isActionBlocked(scannedData.today_status, gateAction, true);
    if (check.blocked) {
      toast.error(check.message || 'Action blocked');
      return;
    }
    if (scannedData.scan_hints?.already_complete) {
      toast.info(`${scannedData.person.name} is already signed in/out`);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/gate/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          school_id: schoolId,
          type: mode === 'arrival' ? 'arrival' : 'departure',
          verification_method: 'id_card_scan',
          person_type: 'staff',
          staff_profile_id: scannedData.person.id,
          user_id: scannedData.person.user_id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not save');
      }
      toast.success(
        `${scannedData.person.name} — ${mode === 'arrival' ? 'signed in' : 'signed out'} (Auto-Confirm)`
      );
      onSuccess?.();
    } catch (e) {
      toast.error(e.message || 'Auto-confirm failed');
    } finally {
      setSaving(false);
    }
  };

  const confirmScan = async () => {
    if (!scanned?.person || saving || block.blocked || fullyComplete) return;

    setSaving(true);
    try {
      const res = await fetch('/api/gate/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          school_id: schoolId,
          type: mode === 'arrival' ? 'arrival' : 'departure',
          verification_method: 'id_card_scan',
          person_type: 'staff',
          staff_profile_id: scanned.person.id,
          user_id: scanned.person.user_id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.already_recorded) {
          toast.error(data.error || 'Already signed in or out today');
          setScanned((prev) =>
            prev
              ? {
                  ...prev,
                  today_status: data.today_status ?? prev.today_status,
                  scan_hints: data.scan_hints ?? prev.scan_hints,
                }
              : prev
          );
          return;
        }
        throw new Error(data.error || 'Could not save');
      }
      toast.success(
        `${scanned.person.name} — ${mode === 'arrival' ? 'signed in' : 'signed out'} (ID scan)`
      );
      setScanned(null);
      setManualCode('');
      onSuccess?.();
      startCamera();
    } catch (e) {
      toast.error(e.message || 'Failed');
    }
    setSaving(false);
  };

  const names = scanned?.person?.name ? splitName(scanned.person.name) : { first: '', last: '' };

  return (
    <div className="space-y-4">
      {scanned?.person && !autoConfirm && (
        <div className="card-elevated p-4 space-y-4">
          <div className="flex items-center gap-3">
            <StudentAvatar
              photoUrl={scanned.person.photo_url}
              firstName={names.first}
              lastName={names.last}
              size="md"
            />
            <div>
              <p className="font-bold">{scanned.person.name}</p>
              <p className="text-xs font-mono text-slate-500">{scanned.person.staff_id}</p>
              <p className="text-xs text-violet-600 capitalize">{scanned.person.role_label || 'Staff'}</p>
            </div>
          </div>
          <TodayScanStatusBanner todayStatus={scanned.today_status} isStaff />
          {block.message && (
            <p className="text-sm font-semibold text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2 text-center">
              {block.message}
            </p>
          )}
          <p className="text-center text-sm font-bold py-2 rounded-xl bg-violet-50 text-violet-800">
            {mode === 'arrival' ? 'STAFF SIGN IN (ID card)' : 'STAFF SIGN OUT (ID card)'}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary flex-1"
              onClick={() => {
                setScanned(null);
                setManualCode('');
                startCamera();
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary flex-1"
              disabled={saving || block.blocked || fullyComplete}
              onClick={confirmScan}
            >
              {saving ? 'Saving…' : fullyComplete ? 'Done for today' : 'Confirm scan'}
            </button>
          </div>
        </div>
      )}

      {(!scanned || autoConfirm) && (
        <div className="card-elevated overflow-hidden">
          <div className="relative aspect-[4/3] bg-slate-900">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-slate-900/90 text-white text-center z-10">
                <Camera size={36} className="text-slate-400 mb-2" />
                <p className="text-xs font-semibold mb-1 text-slate-200">Camera Access Paused or Blocked</p>
                <p className="text-[11px] text-slate-400 mb-3 max-w-xs">Allow browser camera permissions or tap below to retry</p>
                <button
                  type="button"
                  onClick={() => startCamera()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <Camera size={14} /> Enable / Retry Camera
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => startCamera(facingMode === 'environment' ? 'user' : 'environment')}
              className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-3 py-2 rounded-full flex items-center gap-1 z-20"
            >
              <Camera size={14} /> Flip
            </button>
          </div>
          
          <div className="p-4 space-y-3">
            {/* Auto-Confirm Toggle Switch */}
            <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-slate-50/50">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-900 font-sans">Auto-Confirm Mode</span>
                <span className="text-[10px] text-slate-500 font-sans">Continuous scanning without clicks</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const val = !autoConfirm;
                  setAutoConfirm(val);
                  toast.info(val ? 'Auto-Confirm enabled' : 'Manual confirmation enabled');
                }}
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  autoConfirm ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    autoConfirm ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <p className="text-xs text-slate-500 flex items-center gap-1">
              <ScanLine size={14} /> Scan staff ID QR — one sign-in and one sign-out per day
            </p>
            <input
              className="input font-mono"
              placeholder="Or type staff ID number"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
            />
            <button
              type="button"
              className="btn-primary w-full"
              disabled={scanning || saving}
              onClick={() => lookupScan(manualCode)}
            >
              {scanning ? 'Looking up…' : 'Look up staff ID'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
