// @ts-nocheck
'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, ScanLine, MapPin, KeyRound, CheckCircle2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import StudentAvatar from '@/components/shared/StudentAvatar';
import TodayScanStatusBanner from '@/components/gate/TodayScanStatusBanner';
import StudentPickupVerify from '@/components/pickup/StudentPickupVerify';
import EscortBatchReceptionModal from '@/components/gate/EscortBatchReceptionModal';
import ParentReceptionModal from '@/components/gate/ParentReceptionModal';
import { applyScanHints, isActionBlocked } from '@/lib/gate/scan-hints-client';
import { triggerHapticNotification } from '@/lib/platform/haptics';

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
  onModeChange = () => {},
  onSuccess = () => {},
  initialStudent = null,
  fromReadyQueue = false,
  onForgotId,
  hideModeSwitcher = false,
  staffList = [],
}: {
  schoolId?: string;
  mode?: string;
  onModeChange?: (mode: string) => void;
  onSuccess?: () => void;
  initialStudent?: any;
  fromReadyQueue?: boolean;
  onForgotId?: (() => void) | null;
  hideModeSwitcher?: boolean;
  staffList?: any[];
}) {
  const [manualCode, setManualCode] = useState('');
  const [scanned, setScanned] = useState(null);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [facingMode, setFacingMode] = useState('environment');
  const [releaseFromQueue, setReleaseFromQueue] = useState(fromReadyQueue);
  const [autoConfirm, setAutoConfirm] = useState(true);
  const [cameraError, setCameraError] = useState(false);
  const [escortBatchData, setEscortBatchData] = useState<any | null>(null);
  const [parentReceptionData, setParentReceptionData] = useState<any | null>(null);
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
      if (!res.ok) {
        throw new Error(data.error || 'ID card or QR not found');
      }

      if (data.type === 'parent') {
        stopCamera();
        setParentReceptionData(data);
        triggerHapticNotification('SUCCESS').catch(() => {});
        toast.success(`Parent ID Verified: ${data.parent?.full_name || 'Parent'}`);
        return;
      }

      if (data.type === 'escort_batch') {
        stopCamera();
        setEscortBatchData(data);
        triggerHapticNotification('SUCCESS').catch(() => {});
        toast.success(`Escort Transit Verified: ${data.escort?.name} (${data.students?.length || 0} students)`);
        return;
      }

      if (data.type !== 'student') {
        throw new Error(data.error || 'Student ID not found');
      }

      triggerHapticNotification('SUCCESS').catch(() => {});
      if (autoConfirm) {
        await executeAutoConfirm(data);
      } else {
        stopCamera();
        applyScanHints(data, { toast, setMode: onModeChange });
        setScanned(data);
      }
    } catch (e) {
      triggerHapticNotification('ERROR').catch(() => {});
      toast.error(e.message || 'Scan failed');
      if (!scanned || autoConfirm) {
        startCamera();
      }
    } finally {
      setScanning(false);
    }
  };

  const isScannedAlreadyIn = Boolean(scanned?.today_status?.has_arrival);
  const isScannedAlreadyOut = Boolean(scanned?.today_status?.has_departure);
  const effectiveGateAction = (isScannedAlreadyIn && !isScannedAlreadyOut)
    ? 'departure'
    : (mode === 'arrival' ? 'arrival' : 'departure');

  const block = isActionBlocked(scanned?.today_status, effectiveGateAction, false);
  const fullyComplete = scanned?.scan_hints?.already_complete || (isScannedAlreadyIn && isScannedAlreadyOut);
  const pickup = scanned ? pickupFromScan(scanned) : null;

  const executeAutoConfirm = async (scannedData) => {
    const isAlreadyIn = Boolean(scannedData.today_status?.has_arrival);
    const isAlreadyOut = Boolean(scannedData.today_status?.has_departure);

    // Smart direction detection: if already checked in and not yet departed, auto-route to departure
    let effectiveMode = mode;
    if (isAlreadyIn && !isAlreadyOut) {
      effectiveMode = 'departure';
      onModeChange?.('departure');
    } else if (scannedData.scan_hints?.suggested_mode === 'departure' && mode === 'arrival') {
      effectiveMode = 'departure';
      onModeChange?.('departure');
    }

    if (scannedData.scan_hints?.already_complete || (isAlreadyIn && isAlreadyOut)) {
      toast.info(`${scannedData.person.name} is already checked in and out today`);
      return;
    }

    const check = isActionBlocked(scannedData.today_status, effectiveMode, false);
    if (check.blocked) {
      toast.error(check.message || 'Action blocked');
      return;
    }

    setSaving(true);
    try {
      const body = {
        school_id: schoolId,
        student_id: scannedData.person.id,
        type: effectiveMode === 'arrival' ? 'arrival' : 'departure',
        verification_method: 'id_card_scan',
        person_type: 'student',
      };

      if (effectiveMode === 'departure') {
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
        `${scannedData.person.name} — ${effectiveMode === 'arrival' ? 'checked in' : 'signed out / released'} (Auto-Confirm)`
      );
      setScanned(null);
      setManualCode('');
      setReleaseFromQueue(false);
      onSuccess?.();
      startCamera();
    } catch (e) {
      toast.error(e.message || 'Auto-confirm failed');
    } finally {
      setSaving(false);
    }
  };

  const confirmScan = async () => {
    if (!scanned?.person || saving) return;
    
    const isAlreadyIn = Boolean(scanned.today_status?.has_arrival);
    const isAlreadyOut = Boolean(scanned.today_status?.has_departure);

    let effectiveMode = mode;
    if (isAlreadyIn && !isAlreadyOut) {
      effectiveMode = 'departure';
    }

    if (fullyComplete || (isAlreadyIn && isAlreadyOut)) {
      toast.info(`${scanned.person.name} has already checked in and out today.`);
      return;
    }

    const currentBlock = isActionBlocked(scanned.today_status, effectiveMode, false);
    if (currentBlock.blocked) {
      toast.error(currentBlock.message || 'This action is blocked for today.');
      return;
    }

    setSaving(true);
    try {
      const body = {
        school_id: schoolId,
        student_id: scanned.person.id,
        type: effectiveMode === 'arrival' ? 'arrival' : 'departure',
        verification_method: 'id_card_scan',
        person_type: 'student',
      };

      if (effectiveMode === 'departure') {
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
        `${scanned.person.name} — ${effectiveMode === 'arrival' ? 'checked in' : 'signed out / released'} (ID scan)`
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
      {/* Mode Switcher Tabs */}
      {!hideModeSwitcher && (
        <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200 shadow-xs">
          <button
            type="button"
            onClick={() => onModeChange?.('arrival')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              mode === 'arrival'
                ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-500/50'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <CheckCircle2 size={16} /> Student Check In (Arrival)
          </button>
          <button
            type="button"
            onClick={() => onModeChange?.('departure')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              mode === 'departure'
                ? 'bg-orange-600 text-white shadow-md ring-2 ring-orange-500/50'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <RotateCcw size={16} /> Student Sign Out (Release)
          </button>
        </div>
      )}

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
          {scanned.school_location && (
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-900 bg-emerald-50/90 border border-emerald-200/80 rounded-xl px-2.5 py-1.5 font-medium">
              <MapPin size={13} className="text-emerald-700 shrink-0" />
              <span className="truncate">
                {scanned.school_location.name}
                {scanned.school_location.gps_coords ? ` (${scanned.school_location.gps_coords})` : ''}
              </span>
              <span className="ml-auto text-[10px] font-bold text-emerald-700 uppercase shrink-0">Geofence Verified</span>
            </div>
          )}
          <TodayScanStatusBanner todayStatus={scanned.today_status} />
          {block.message && (
            <p className={`text-sm font-semibold rounded-xl px-3 py-2 text-center border ${
              block.isNotice
                ? 'text-amber-800 bg-amber-50 border-amber-200'
                : 'text-red-700 bg-red-50 border-red-100'
            }`}>
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
            className={`text-center text-xs font-black py-2 rounded-xl border ${
              mode === 'arrival'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-orange-50 text-orange-800 border-orange-200'
            }`}
          >
            {mode === 'arrival' ? 'STUDENT CHECK IN (ARRIVAL)' : 'STUDENT SIGN OUT (DEPARTURE / RELEASE)'}
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
                className={`flex-1 py-3 px-4 rounded-xl font-black text-xs text-white transition-all cursor-pointer shadow-md ${
                  mode === 'departure'
                    ? 'bg-orange-600 hover:bg-orange-500 shadow-orange-600/30 ring-2 ring-orange-400/50'
                    : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30 ring-2 ring-emerald-400/50'
                }`}
                disabled={saving}
                onClick={confirmScan}
              >
                {saving ? 'Processing…' : mode === 'departure' ? 'Confirm Student Sign Out (Release)' : 'Confirm Student Check-in'}
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
        <div className="card-elevated overflow-hidden border-2 border-slate-200 shadow-lg">
          {/* Active Station Mode Indicator Banner */}
          <div className={`px-4 py-3 border-b flex items-center justify-between ${
            mode === 'departure'
              ? 'bg-gradient-to-r from-orange-600 via-amber-600 to-orange-700 text-white border-orange-500'
              : 'bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white border-emerald-600'
          }`}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center font-black shadow-inner">
                {mode === 'departure' ? <RotateCcw size={18} /> : <CheckCircle2 size={18} />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-xs uppercase tracking-wider">
                    {mode === 'departure' ? 'Student Sign Out Station Active' : 'Student Check In Station Active'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-white/25 uppercase tracking-wide border border-white/30">
                    {mode === 'departure' ? 'Campus Release' : 'Arrival Check In'}
                  </span>
                </div>
                <p className="text-[11px] text-white/90 font-medium mt-0.5">
                  {mode === 'departure'
                    ? 'Scan barcode / QR code on student ID card to record departure & release student from campus.'
                    : 'Scan barcode / QR code on student ID card to record morning arrival check-in.'}
                </p>
              </div>
            </div>
          </div>

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

            <p className="text-xs text-slate-600 flex items-center gap-1.5 font-medium">
              <ScanLine size={15} className={mode === 'departure' ? 'text-orange-600' : 'text-emerald-600'} />
              {mode === 'departure'
                ? 'Scan barcode or enter student ID number to record student sign out (departure)'
                : 'Scan barcode or enter student ID number to record student check in (arrival)'}
            </p>
            <input
              className="input font-mono"
              placeholder={mode === 'departure' ? "Enter Student ID number to Sign Out..." : "Enter Student ID number to Check In..."}
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  lookupScan(manualCode);
                }
              }}
            />
            <button
              type="button"
              className={`w-full py-3 px-4 rounded-xl font-black text-xs text-white transition-all cursor-pointer shadow-md ${
                mode === 'departure'
                  ? 'bg-orange-600 hover:bg-orange-500 shadow-orange-600/30 ring-2 ring-orange-400/40'
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30 ring-2 ring-emerald-400/40'
              }`}
              disabled={scanning || saving}
              onClick={() => lookupScan(manualCode)}
            >
              {scanning
                ? 'Looking up…'
                : mode === 'departure'
                ? 'Scan / Look Up for Student Sign Out'
                : 'Scan / Look Up for Student Check In'}
            </button>

            {onForgotId && (
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    onForgotId();
                  }}
                  className="w-full py-2.5 px-3 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
                >
                  <KeyRound size={15} className="text-amber-600 shrink-0" />
                  <span>
                    {mode === 'departure'
                      ? 'Student forgot ID card? Search & Sign Out Manually'
                      : 'Student forgot ID card? Search & Check In Manually'}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {escortBatchData && (
        <EscortBatchReceptionModal
          schoolId={schoolId}
          batchData={escortBatchData}
          onClose={() => {
            setEscortBatchData(null);
            startCamera();
          }}
          onSuccess={() => {
            setEscortBatchData(null);
            onSuccess?.();
            startCamera();
          }}
        />
      )}

      {parentReceptionData && (
        <ParentReceptionModal
          isOpen={!!parentReceptionData}
          data={parentReceptionData}
          schoolId={schoolId || ''}
          staffList={staffList}
          onClose={() => {
            setParentReceptionData(null);
            startCamera();
          }}
          onSuccess={() => {
            setParentReceptionData(null);
            onSuccess?.();
            startCamera();
          }}
        />
      )}
    </div>
  );
}
