'use client';

import { X, ShieldCheck, CreditCard, Lock } from 'lucide-react';
import StudentAvatar from '@/components/shared/StudentAvatar';

export interface IdCardPreviewData {
  kind: 'student' | 'staff' | 'parent';
  fullName: string;
  idNumber: string;
  className?: string;
  roleLabel?: string;
  photoUrl?: string | null;
  qrData?: string;
  schoolName?: string;
  primaryColor?: string;
}

interface IdCardPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: IdCardPreviewData | null;
}

export function IdCardPreviewModal({ isOpen, onClose, data }: IdCardPreviewModalProps) {
  if (!isOpen || !data) return null;

  const brandColor = data.primaryColor || '#1B4D3E';
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
    data.qrData || data.idNumber
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-200 relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <CreditCard size={18} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Digital ID Pass Preview</h3>
              <p className="text-[11px] text-slate-500 font-semibold">On-screen Verification Only</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Technical Restriction Alert Banner */}
        <div className="bg-slate-900 text-slate-200 rounded-2xl p-3 mb-5 flex items-start gap-2.5 text-left border border-slate-800 shadow-xs">
          <Lock size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="text-[11px] leading-snug">
            <span className="font-bold text-amber-400 block">DISCL Controlled Identifier</span>
            <span>
              Official physical ID card generation, PDF exports, and printing remain under Super Admin / DISCL control. This view is for on-screen identity verification only.
            </span>
          </div>
        </div>

        {/* Digital ID Card Preview Frame */}
        <div className="bg-slate-50 p-4 rounded-3xl border border-slate-200 flex justify-center">
          <div
            className="w-[280px] bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden flex flex-col justify-between"
            style={{ minHeight: '400px' }}
          >
            {/* School Header */}
            <div
              className="p-3 text-white text-center flex flex-col items-center justify-center"
              style={{ backgroundColor: brandColor }}
            >
              <div className="flex items-center gap-1.5 justify-center mb-1">
                <ShieldCheck size={16} className="text-amber-300" />
                <h4 className="text-xs font-black tracking-wide uppercase truncate max-w-[220px]">
                  {data.schoolName || 'MyEduRide School'}
                </h4>
              </div>
              <span className="text-[9px] uppercase font-bold tracking-widest text-amber-200 opacity-90">
                {data.kind === 'student' ? 'Student ID Pass' : data.kind === 'staff' ? 'Staff Pass' : 'Parent Pass'}
              </span>
            </div>

            {/* Body Info */}
            <div className="p-4 flex flex-col items-center text-center space-y-3">
              <div className="p-1 rounded-2xl bg-white border-2 border-slate-100 shadow-xs">
                <StudentAvatar
                  photoUrl={data.photoUrl}
                  firstName={data.fullName.split(' ')[0] || 'User'}
                  lastName={data.fullName.split(' ')[1] || ''}
                  size="lg"
                  accentColor={brandColor}
                />
              </div>

              <div>
                <h3 className="text-sm font-black text-slate-900 leading-tight">{data.fullName}</h3>
                <p className="text-xs font-bold text-slate-500 mt-0.5">
                  {data.kind === 'student'
                    ? data.className || 'Student'
                    : data.kind === 'staff'
                    ? data.roleLabel || 'Staff Member'
                    : 'Authorized Parent'}
                </p>
              </div>

              <div className="w-full bg-slate-50 py-1.5 px-3 rounded-xl border border-slate-100">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">ID Number</span>
                <span className="text-xs font-mono font-black text-slate-800">{data.idNumber}</span>
              </div>

              {/* QR Code */}
              <div className="flex flex-col items-center pt-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrUrl} alt="QR Verification" className="w-24 h-24 rounded-lg border border-slate-200 p-1 bg-white" />
                <span className="text-[9px] font-mono text-slate-400 mt-1">Gate Verification QR</span>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-slate-100 px-3 py-1.5 text-center border-t border-slate-200">
              <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest">
                MyEduRide Safety Network
              </span>
            </div>
          </div>
        </div>

        {/* Modal Action */}
        <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all"
          >
            Close Digital Preview
          </button>
        </div>
      </div>
    </div>
  );
}
