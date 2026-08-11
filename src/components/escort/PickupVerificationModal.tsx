// @ts-nocheck
'use client';

import { useState } from 'react';
import { ShieldCheck, QrCode, KeyRound, UserCheck, X, CheckCircle2, AlertCircle, Phone, MapPin } from 'lucide-react';
import { toast } from 'sonner';

interface PickupVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  student?: any;
  onVerificationComplete?: (record: any) => void;
}

export default function PickupVerificationModal({
  isOpen,
  onClose,
  student,
  onVerificationComplete,
}: PickupVerificationModalProps) {
  const [pinCode, setPinCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verificationMode, setVerificationMode] = useState<'pin' | 'qr'>('pin');

  if (!isOpen) return null;

  const sampleStudent = student || {
    id: 'STU-9921',
    name: 'Kiki Isaac',
    class: 'Basic 4 Green',
    school: 'Fortune Springs Montessori',
    guardianName: 'Mrs. Adeaze Isaac',
    guardianPhone: '+234 803 123 4567',
    pickupPoint: 'Main Gate Terminal - Stop #4',
    photo: '/images/landing/student_avatar.png',
  };

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinCode || pinCode.length < 4) {
      toast.error('Please enter a valid 4-digit verification PIN');
      return;
    }

    setVerifying(true);
    setTimeout(() => {
      setVerifying(false);
      toast.success(`Verification Successful! Student pickup confirmed for ${sampleStudent.name}.`);
      if (onVerificationComplete) {
        onVerificationComplete({
          studentId: sampleStudent.id,
          studentName: sampleStudent.name,
          guardianName: sampleStudent.guardianName,
          timestamp: new Date().toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' }),
          status: 'verified',
        });
      }
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-slate-100 relative animate-in fade-in zoom-in duration-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-all"
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
              Student Pickup Verification
            </h3>
            <p className="text-xs text-slate-500">Security PIN & Guardian Handover Check</p>
          </div>
        </div>

        {/* Student Card Info */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#0A1128] text-white flex items-center justify-center font-bold text-lg shrink-0 shadow-sm">
            {sampleStudent.name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1 text-xs">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-sm text-slate-900 truncate">{sampleStudent.name}</h4>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                {sampleStudent.class}
              </span>
            </div>
            <p className="text-slate-500 font-medium mt-0.5">{sampleStudent.school}</p>
            <div className="mt-2 pt-2 border-t border-slate-200/60 space-y-1 text-slate-600 text-[11px]">
              <div className="flex items-center gap-1.5">
                <UserCheck size={13} className="text-slate-400" />
                <span>Guardian: <strong className="text-slate-800">{sampleStudent.guardianName}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Phone size={13} className="text-slate-400" />
                <span>Contact: <strong className="text-slate-800">{sampleStudent.guardianPhone}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin size={13} className="text-slate-400" />
                <span>Stop: <strong className="text-slate-800">{sampleStudent.pickupPoint}</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Verification Mode Toggle */}
        <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setVerificationMode('pin')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              verificationMode === 'pin'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <KeyRound size={15} />
            <span>Guardian PIN</span>
          </button>
          <button
            type="button"
            onClick={() => setVerificationMode('qr')}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              verificationMode === 'qr'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <QrCode size={15} />
            <span>Scan QR Pass</span>
          </button>
        </div>

        {/* Verification Body */}
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
              <p className="text-[10px] text-slate-400">PIN is available on parent's MyEduRide Pass app.</p>
            </div>

            <button
              type="submit"
              disabled={verifying || pinCode.length < 4}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs py-3 px-4 rounded-xl shadow-md shadow-emerald-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {verifying ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Verifying PIN...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <span>Confirm Student Boarding & Release</span>
                </>
              )}
            </button>
          </form>
        ) : (
          <div className="space-y-4 text-center">
            <div className="p-6 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center bg-slate-50 space-y-2">
              <QrCode size={48} className="text-emerald-600 animate-pulse" />
              <p className="text-xs font-bold text-slate-800">Align QR Code within Scanner Frame</p>
              <p className="text-[11px] text-slate-500">Scanning parent's authorized digital pickup pass...</p>
            </div>

            <button
              type="button"
              onClick={() => {
                toast.success('QR Code Scanned Successfully!');
                onClose();
              }}
              className="w-full bg-[#0A1128] hover:bg-[#121E42] text-white font-bold text-xs py-3 px-4 rounded-xl transition-all shadow-md"
            >
              Simulate Camera Scan Match
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
