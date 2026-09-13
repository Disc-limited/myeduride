// @ts-nocheck
'use client';

import { useState } from 'react';
import {
  ShieldCheck,
  QrCode,
  KeyRound,
  UserCheck,
  X,
  CheckCircle2,
  AlertCircle,
  Phone,
  MapPin,
  Check
} from 'lucide-react';
import { toast } from 'sonner';
import GateIdCardScanner from '@/components/gate/GateIdCardScanner';

interface PickupVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  student?: any;
  defaultAction?: 'morning_pickup' | 'afternoon_dropoff';
  onVerificationComplete?: (record: any) => void;
}

export default function PickupVerificationModal({
  isOpen,
  onClose,
  student,
  defaultAction,
  onVerificationComplete,
}: PickupVerificationModalProps) {
  const [pinCode, setPinCode] = useState('');
  const [manualId, setManualId] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verificationMode, setVerificationMode] = useState<'scan' | 'pin' | 'quick'>('scan');

  if (!isOpen) return null;

  const hasStudent = Boolean(student?.id);
  const sampleStudent = student || {};

  const afternoonByTime = typeof window !== 'undefined' ? new Date().getHours() >= 12 : false;
  const isAfternoonDropoff =
    defaultAction === 'afternoon_dropoff' ||
    sampleStudent?.action === 'afternoon_dropoff' ||
    sampleStudent?.afternoon_status === 'PICKED_UP_FROM_GATE' ||
    (!hasStudent && defaultAction !== 'morning_pickup' && afternoonByTime);

  const actionType = isAfternoonDropoff ? 'afternoon_dropoff' : 'morning_pickup';

  const executeVerification = async (opts?: { pin?: string; scanData?: string; studentId?: string }) => {
    const scanData = (opts?.scanData || manualId || '').trim();
    const studentId = opts?.studentId || sampleStudent.id;
    if (!studentId && !scanData) {
      toast.error('Scan the student ID card or enter the student ID number');
      return;
    }

    setVerifying(true);
    try {
      const res = await fetch('/api/escorts/pickup-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId || undefined,
          scan_data: scanData || undefined,
          school_id: sampleStudent.school_id,
          action: actionType,
          pin_code: opts?.pin || pinCode || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to verify student');
      }

      toast.success(
        json.message ||
          (actionType === 'morning_pickup'
            ? `Pickup verified! ${json.student_name || sampleStudent.name || 'Student'} is on the pickup list.`
            : `Safe arrival! ${json.student_name || sampleStudent.name || 'Student'} signed out of the vehicle.`)
      );

      if (onVerificationComplete) {
        onVerificationComplete(json);
      }
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Verification error');
    } finally {
      setVerifying(false);
    }
  };

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinCode || pinCode.length < 4) {
      toast.error('Please enter a valid 4-digit verification PIN');
      return;
    }
    await executeVerification({ pin: pinCode });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl w-[92vw] max-w-md p-5 sm:p-6 shadow-2xl space-y-4 sm:space-y-5 border border-slate-100 relative animate-in fade-in zoom-in duration-200 max-h-[85vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-all cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-slate-900 leading-tight">
              {actionType === 'morning_pickup' ? 'Student Morning Pickup' : 'Afternoon Doorstep Drop-off'}
            </h3>
            <p className="text-xs text-slate-500">
              {actionType === 'morning_pickup'
                ? 'Scan or enter the student ID to move them onto the bus pickup list'
                : 'Scan or enter the student ID to sign them out of the vehicle'}
            </p>
          </div>
        </div>

        <GateIdCardScanner
          active={isOpen}
          busy={verifying}
          onDetected={(code) => {
            setManualId(code);
            executeVerification({ scanData: code });
          }}
          hint="Scan the student ID card barcode or QR. You can also type the ID below."
        />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            executeVerification({ scanData: manualId });
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
            placeholder="Enter student ID number..."
            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
          <button
            type="submit"
            disabled={verifying || !manualId.trim()}
            className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold disabled:opacity-50 cursor-pointer"
          >
            {verifying ? 'Saving…' : 'Add to list'}
          </button>
        </form>

        {hasStudent && (
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#0A1128] text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-sm">
            {sampleStudent.name?.charAt(0) || 'S'}
          </div>
          <div className="min-w-0 flex-1 text-xs">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-sm text-slate-900 truncate">{sampleStudent.name}</h4>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                {sampleStudent.class || sampleStudent.class_name || 'Passenger'}
              </span>
            </div>
            <p className="text-slate-500 font-medium mt-0.5">{sampleStudent.school || sampleStudent.school_name || 'Destination Campus'}</p>
            <div className="mt-2 pt-2 border-t border-slate-200/60 space-y-1 text-slate-600 text-[11px]">
              <div className="flex items-center gap-1.5">
                <MapPin size={13} className="text-slate-400 shrink-0" />
                <span className="truncate">{sampleStudent.pickupPoint || sampleStudent.pickup_address || 'Designated Home Residence'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Phone size={13} className="text-slate-400 shrink-0" />
                <span>{sampleStudent.guardianName || sampleStudent.parent_name || 'Guardian'}</span>
                {sampleStudent.guardianPhone || sampleStudent.parent_phone ? (
                  <span className="text-slate-400">({sampleStudent.guardianPhone || sampleStudent.parent_phone})</span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
        )}

        {hasStudent && (
          <>
            <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl text-xs font-semibold text-slate-600">
              <button
                type="button"
                onClick={() => setVerificationMode('pin')}
                className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  verificationMode === 'pin'
                    ? 'bg-white text-slate-900 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <KeyRound size={15} />
                <span>Guardian PIN</span>
              </button>
              <button
                type="button"
                onClick={() => setVerificationMode('quick')}
                className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  verificationMode === 'quick'
                    ? 'bg-white text-slate-900 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <UserCheck size={15} />
                <span>1-Tap Confirm</span>
              </button>
            </div>

            {verificationMode === 'pin' ? (
              <form onSubmit={handleVerifyPin} className="space-y-4">
                <div className="space-y-1.5 text-center">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Enter Guardian Security Verification PIN
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="• • • •"
                    className="w-full text-center text-2xl font-mono tracking-widest px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-400 focus:bg-white text-slate-900"
                  />
                  <p className="text-[10px] text-slate-400">PIN is available on parent&apos;s MyEduRide pass.</p>
                </div>

                <button
                  type="submit"
                  disabled={verifying || pinCode.length < 4}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-3 px-4 rounded-xl shadow-md disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {verifying ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Recording in Database...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      <span>{actionType === 'morning_pickup' ? 'Confirm Student Boarded' : 'Confirm Safe Doorstep Drop-off'}</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              <div className="space-y-4 text-center">
                <div className="p-4 border border-emerald-200 rounded-2xl flex flex-col items-center justify-center bg-emerald-50/60 space-y-1.5">
                  <CheckCircle2 size={32} className="text-emerald-600" />
                  <p className="text-xs font-bold text-slate-800">Direct Handover Verification</p>
                  <p className="text-[11px] text-slate-600">
                    {actionType === 'morning_pickup'
                      ? 'Confirm that the student is physically aboard the escort bus. This automatically schedules them for gate sign-in at the school.'
                      : 'Confirm that the student has safely reached their doorstep and been received by the parent.'}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={verifying}
                  onClick={() => executeVerification()}
                  className="w-full bg-[#0A1128] hover:bg-slate-800 text-white font-bold text-xs py-3 px-4 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {verifying ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Recording in Database...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} className="text-emerald-400" />
                      <span>{actionType === 'morning_pickup' ? '1-Tap Confirm Boarded' : '1-Tap Confirm Dropped Off'}</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
