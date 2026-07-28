// @ts-nocheck
'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, ScanLine } from 'lucide-react';
import { toast } from 'sonner';
import StudentAvatar from '@/components/shared/StudentAvatar';
import TodayScanStatusBanner from '@/components/gate/TodayScanStatusBanner';
import StudentPickupVerify from '@/components/pickup/StudentPickupVerify';
import { applyScanHints, isActionBlocked } from '@/lib/gate/scan-hints-client';

function splitName(fullName) {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] || '', last: parts.slice(1).join(' ') || '' };
}

function pickupFromScan(data) {
  return {
    pickupNotice: data.pickup_notice || data.pickup_context?.pickup_notice || null,
    pickupRequest: data.pickup_request || data.pickup_context?.pickup_request || null,
    pickupPersons: data.pickup_persons || data.pickup_context?.pickup_persons || [],
    readyForPickup: !!data.ready_for_pickup,
  };
}

/** Student check-in/out via ID card (admin or gate — same API as gate manager). */
export default function StudentIdScanPanel({
  schoolId,
  mode = 'arrival',
  onModeChange,
  onSuccess,
  initialStudent = null,
  fromReadyQueue = false,
}) {
  const [manualCode, setManualCode] = useState('');
  const [scanned, setScanned] = useState(null);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [facingMode, setFacingMode] = useState('environment');
  const [releaseFromQueue, setReleaseFromQueue] = useState(fromReadyQueue);
  const [autoConfirm, setAutoConfirm] = useState(false);
  const [cameraError, setCameraError] = useState(false);
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
      .catch((err) => console.error('[StudentIdScanPanel] Failed to load jsqr:', err));
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
          console.error('[StudentIdScanPanel] Camera access error:', err);
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
        /* skip */
      }
    }, 400);
  };

  useEffect(() => {
    if (initialStudent?.id && schoolId) {
      const code = initialStudent.qr_code_data || initialStudent.student_id_number;
      if (code) {
        onModeChange?.('departure');
        setReleaseFromQueue(!!fromReadyQueue);
        lookupScan(code);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialStudent?.id, schoolId]);

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
  }, [scanned, schoolId, initialStudent, autoConfirm]);

  const lookupScan = async (code) => {
    const value = (code || manualCode).trim();
    if (!value) {
      toast.error('Scan student ID card or enter ID');
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
      if (!res.ok || data.type !== 'student') {
        throw new Error(data.error || 'Student ID not found');
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
  const block = isActionBlocked(scanned?.today_status, gateAction, false);
  const fullyComplete = scanned?.scan_hints?.already_complete;
  const pickup = scanned ? pickupFromScan(scanned) : null;

  const executeAutoConfirm = async (scannedData) => {
    const check = isActionBlocked(scannedData.today_status, gateAction, false);
    if (check.blocked) {
      toast.error(check.message || 'Action blocked');
      return;
    }
    if (scannedData.scan_hints?.already_complete) {
      toast.info(`${scannedData.person.name} is already checked in/out`);
      return;
    }

    setSaving(true);
    try {
      const body = {
        school_id: schoolId,
        student_id: scannedData.person.id,
        type: mode === 'arrival' ? 'arrival' : 'departure',
        verification_method: 'id_card_scan',
        person_type: 'student',
      };

      if (mode === 'departure') {
        const autoPickup = pickupFromScan(scannedData);
        body.from_ready_queue = releaseFromQueue || autoPickup?.readyForPickup;
        const notice = autoPickup?.pickupNotice;
        const request = autoPickup?.pickupRequest;
        if (notice?.pickup_person_name) {
          body.pickup_person_name = notice.pickup_person_name;
          body.pickup_person_phone = notice.pickup_person_phone;
        } else if (request?.pickup_person_name) {
          body.pickup_person_name = request.pickup_person_name;
          body.pickup_person_phone = request.pickup_person_phone;
        } else if (autoPickup?.pickupPersons?.[0]?.name) {
          body.pickup_person_name = autoPickup.pickupPersons[0].name;
          body.pickup_person_phone = autoPickup.pickupPersons[0].phone;
        }
      }

      const res = await fetch('/api/gate/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not save');
      }
      toast.success(
        `${scannedData.person.name} — ${mode === 'arrival' ? 'checked in' : 'released'} (Auto-Confirm)`
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
      const body = {
        school_id: schoolId,
        student_id: scanned.person.id,
        type: mode === 'arrival' ? 'arrival' : 'departure',
        verification_method: 'id_card_scan',
        person_type: 'student',
      };

      if (mode === 'departure') {
        body.from_ready_queue = releaseFromQueue || pickup?.readyForPickup;
        const notice = pickup?.pickupNotice;
        const request = pickup?.pickupRequest;
        if (notice?.pickup_person_name) {
          body.pickup_person_name = notice.pickup_person_name;
          body.pickup_person_phone = notice.pickup_person_phone;
        } else if (request?.pickup_person_name) {
          body.pickup_person_name = request.pickup_person_name;
          body.pickup_person_phone = request.pickup_person_phone;
        } else if (pickup?.pickupPersons?.[0]?.name) {
          body.pickup_person_name = pickup.pickupPersons[0].name;
          body.pickup_person_phone = pickup.pickupPersons[0].phone;
        }
      }

      const res = await fetch('/api/gate/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
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
        `${scanned.person.name} — ${mode === 'arrival' ? 'checked in' : 'released'} (ID scan)`
      );
      setScanned(null);
      setManualCode('');
      setReleaseFromQueue(false);
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
              <p className="text-xs font-mono text-slate-500">{scanned.person.student_id}</p>
              {scanned.person.class_name && (
                <p className="text-xs text-slate-400">{scanned.person.class_name}</p>
              )}
            </div>
          </div>
          <TodayScanStatusBanner todayStatus={scanned.today_status} />
          {block.message && (
            <p className="text-sm font-semibold text-red-700 bg-red-50 border border-red-100 rounded-xl px-3 py-2 text-center">
              {block.message}
            </p>
          )}
          {mode === 'departure' && pickup && (
            <StudentPickupVerify
              pickupNotice={pickup.pickupNotice}
              pickupRequest={pickup.pickupRequest}
              pickupPersons={pickup.pickupPersons}
              readyForPickup={pickup.readyForPickup || releaseFromQueue}
            />
          )}
          <p
            className={`text-center text-sm font-bold py-2 rounded-xl ${
              mode === 'arrival' ? 'bg-emerald-50 text-emerald-800' : 'bg-orange-50 text-orange-800'
            }`}
          >
            {mode === 'arrival' ? 'STUDENT CHECK IN' : 'STUDENT CHECK OUT / RELEASE'}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary flex-1"
              onClick={() => {
                setScanned(null);
                setManualCode('');
                setReleaseFromQueue(false);
                startCamera();
              }}
            >
              Cancel
            </button>
            {!fullyComplete ? (
              <button
                type="button"
                className="btn-primary flex-1"
                disabled={saving || block.blocked}
                onClick={confirmScan}
              >
                {saving ? 'Saving…' : mode === 'departure' ? 'Confirm release' : 'Confirm scan'}
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary flex-1"
                onClick={() => {
                  setScanned(null);
                  setManualCode('');
                  setReleaseFromQueue(false);
                  startCamera();
                }}
              >
                Done
              </button>
            )}
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
              <ScanLine size={14} /> Scan student ID — one check-in and check-out per day
            </p>
            <input
              className="input font-mono"
              placeholder="Student ID or QR"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
            />
            <button
              type="button"
              className="btn-primary w-full"
              disabled={scanning || saving}
              onClick={() => lookupScan(manualCode)}
            >
              {scanning ? 'Looking up…' : 'Look up student'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
