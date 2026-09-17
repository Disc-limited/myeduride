'use client';

import { useState, useEffect } from 'react';
import { X, ShieldCheck, CreditCard, Lock, QrCode } from 'lucide-react';
import StudentAvatar from '@/components/shared/StudentAvatar';
import { photoSrc } from '@/lib/photo';
import QRCode from 'qrcode';

export interface IdCardPreviewData {
  kind: 'student' | 'staff' | 'parent';
  fullName: string;
  idNumber: string;
  className?: string;
  roleLabel?: string;
  photoUrl?: string | null;
  qrData?: string;
  schoolName?: string;
  schoolAddress?: string;
  schoolLandmark?: string;
  signatureUrl?: string | null;
  logoUrl?: string | null;
  primaryColor?: string;
}

interface IdCardPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: IdCardPreviewData | null;
}

export function IdCardPreviewModal({ isOpen, onClose, data }: IdCardPreviewModalProps) {
  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    if (data?.qrData || data?.idNumber) {
      const payload = data.qrData || `MYEDURIDE:${data.idNumber}`;
      QRCode.toDataURL(payload, {
        width: 320,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#ffffff' },
      })
        .then(setQrDataUrl)
        .catch(() => setQrDataUrl(''));
    } else {
      setQrDataUrl('');
    }
    setActiveSide('front');
  }, [data]);

  if (!isOpen || !data) return null;

  const brandColor = data.primaryColor || '#1B4D3E';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-200 relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <CreditCard size={18} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Digital ID Pass</h3>
              <p className="text-[11px] text-slate-500 font-semibold">Live Scannable QR & Dual-Sided Layout</p>
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

        {/* Tab Switcher: Front / Back */}
        <div className="flex bg-slate-100 p-1 rounded-2xl mb-4 gap-1">
          <button
            type="button"
            onClick={() => setActiveSide('front')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeSide === 'front'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Front Pass
          </button>
          <button
            type="button"
            onClick={() => setActiveSide('back')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeSide === 'back'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Back (School & Signature)
          </button>
        </div>

        {/* Digital ID Card Preview Frame */}
        <div className="bg-slate-50 p-4 rounded-3xl border border-slate-200 flex justify-center">
          {activeSide === 'front' ? (
            /* FRONT CARD */
            <div
              className="w-[280px] bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden flex flex-col justify-between"
              style={{ minHeight: '410px' }}
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
                {/* Enlarged Photo Space */}
                <div className="w-24 h-28 rounded-2xl bg-white border-2 border-slate-100 shadow-md overflow-hidden flex items-center justify-center p-0.5">
                  <StudentAvatar
                    photoUrl={data.photoUrl}
                    firstName={data.fullName.split(' ')[0] || 'User'}
                    lastName={data.fullName.split(' ')[1] || ''}
                    size="xl"
                    accentColor={brandColor}
                    className="!w-full !h-full !rounded-xl object-cover"
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

                {/* Extended Scannable QR Code */}
                <div className="flex flex-col items-center pt-1">
                  <div className="w-24 h-24 rounded-xl border border-slate-200 p-1.5 bg-white shadow-sm flex items-center justify-center">
                    {qrDataUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={qrDataUrl} alt="Gate Verification QR" className="w-full h-full object-contain" />
                    ) : (
                      <QrCode className="w-full h-full text-slate-900" />
                    )}
                  </div>
                  <span className="text-[9px] font-mono font-bold text-slate-500 mt-1">Gate Scannable QR</span>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-slate-100 px-3 py-1.5 text-center border-t border-slate-200">
                <span className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest">
                  MyEduRide Safety Network
                </span>
              </div>
            </div>
          ) : (
            /* BACK CARD */
            <div
              className="w-[280px] bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden flex flex-col justify-between"
              style={{ minHeight: '410px' }}
            >
              {/* School Header Banner */}
              <div
                className="p-3 text-white text-center flex flex-col items-center justify-center"
                style={{ backgroundColor: brandColor }}
              >
                <span className="text-[10px] uppercase font-bold tracking-widest text-amber-200 block mb-0.5">
                  School Information
                </span>
                <h4 className="text-xs font-black tracking-wide uppercase truncate max-w-[220px]">
                  {data.schoolName || 'Official School Campus'}
                </h4>
              </div>

              {/* Body: Address & Signature */}
              <div className="p-4 flex flex-col justify-between flex-1 space-y-4 text-left">
                {/* Full School Address */}
                <div className="space-y-1">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
                    Campus Address & Location
                  </span>
                  <p className="text-xs font-bold text-slate-800 leading-snug">
                    {data.schoolAddress || 'Official School Campus Address'}
                  </p>
                  {data.schoolLandmark && (
                    <p className="text-[10px] text-emerald-700 font-semibold">📍 Landmark: {data.schoolLandmark}</p>
                  )}
                </div>

                {/* Authorised Signature Box */}
                <div className="border border-slate-200 rounded-2xl p-3 bg-slate-50">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Authorised Signature
                  </span>
                  <div className="min-h-[52px] flex items-center justify-center">
                    {data.signatureUrl ? (
                      <div className="text-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photoSrc(data.signatureUrl) || undefined}
                          alt="Principal Signature"
                          className="h-10 max-h-10 object-contain mx-auto"
                        />
                        <span className="text-[9px] font-serif italic text-slate-500 block">Principal / Director</span>
                      </div>
                    ) : (
                      <div className="text-center py-1">
                        <span className="text-xs font-black tracking-wider text-emerald-800 uppercase block">
                          Authorised by school
                        </span>
                        <span className="text-[8px] text-slate-400 font-medium">Official Campus Validation</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Return Policy */}
                <div className="border border-slate-100 rounded-xl p-2.5 bg-slate-50/50">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                    If Found
                  </span>
                  <p className="text-[10px] text-slate-600 leading-tight">
                    Please return this ID to <strong className="font-bold text-slate-800">{data.schoolName || 'the school'}</strong> at the campus address shown.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-slate-100 px-3 py-2 text-center border-t border-slate-200">
                <span className="text-[8px] font-extrabold text-slate-500 uppercase tracking-widest block">
                  Official Campus ID · Property of the School
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Hint & Close Button */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[10px] text-slate-400">
            💡 Point phone scanner at QR to verify
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}

