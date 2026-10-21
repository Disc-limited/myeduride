'use client';

import { useState, useEffect } from 'react';
import { X, CreditCard, FileBadge2 } from 'lucide-react';
import AtmCardPass from './AtmCardPass';
import ClassicCardPass from './ClassicCardPass';
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
  schoolPhone?: string;
  signatureUrl?: string | null;
  logoUrl?: string | null;
  primaryColor?: string;
  gradeSection?: string;
  routeCode?: string;
  guardianName?: string;
  guardianPhone?: string;
  homeStop?: string;
  validThru?: string;
}

interface IdCardPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: IdCardPreviewData | null;
}

export function IdCardPreviewModal({ isOpen, onClose, data }: IdCardPreviewModalProps) {
  const [cardFormat, setCardFormat] = useState<'atm' | 'classic'>('atm');
  const [viewMode, setViewMode] = useState<'both' | 'front' | 'back' | '3d'>('both');
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
    setViewMode('both');
  }, [data]);

  if (!isOpen || !data) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-4xl sm:max-w-5xl shadow-2xl border border-slate-200 relative overflow-hidden flex flex-col max-h-[94vh] transition-all duration-300">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white p-1 border border-slate-200 flex items-center justify-center shadow-xs shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/eduride_emblem.png" alt="MyEduRide" className="w-full h-full object-contain" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Digital ID Pass</h3>
              <p className="text-[11px] text-slate-500 font-semibold">
                ATM Smart Card &amp; Classic Print Layout
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Primary Layout Switcher: ATM Smart Card vs Classic Print Layout */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mb-3">
          <div className="flex bg-slate-100 p-1 rounded-2xl gap-1 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setCardFormat('atm')}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                cardFormat === 'atm'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CreditCard size={14} />
              <span>ATM Smart Card (New Format)</span>
            </button>
            <button
              type="button"
              onClick={() => setCardFormat('classic')}
              className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                cardFormat === 'classic'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileBadge2 size={14} />
              <span>Classic Print Layout (Retained)</span>
            </button>
          </div>

          {/* Sub-view: Dual / Front / Back / 3D */}
          <div className="flex bg-slate-50 border border-slate-200 p-1 rounded-xl gap-1 text-[11px] w-full sm:w-auto justify-center">
            <button
              type="button"
              onClick={() => setViewMode('both')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                viewMode === 'both' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Dual View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('front')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                viewMode === 'front' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Front
            </button>
            <button
              type="button"
              onClick={() => setViewMode('back')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                viewMode === 'back' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Back (Barcode)
            </button>
            <button
              type="button"
              onClick={() => setViewMode('3d')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                viewMode === '3d' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              3D Flip
            </button>
          </div>
        </div>

        {/* Modal Body Canvas */}
        <div className="overflow-y-auto flex-1 p-2 bg-slate-50/70 rounded-2xl border border-slate-100">
          {cardFormat === 'atm' ? (
            <div className="py-2 space-y-3">
              <AtmCardPass
                viewMode={viewMode}
                cardType={data.kind === 'student' ? 'student' : data.kind === 'staff' ? 'staff' : 'parent'}
                cardholderName={data.fullName}
                idNumber={data.idNumber}
                photoUrl={data.photoUrl}
                qrUrl={qrDataUrl}
                qrPayload={data.qrData || `MYEDURIDE:${data.idNumber}`}
                schoolName={data.schoolName || 'Official School Campus'}
                schoolAddress={data.schoolAddress}
                schoolPhone={data.schoolPhone}
                logoUrl={data.logoUrl}
                classNameOrRole={data.className || data.roleLabel || 'Student'}
                gradeSection={data.gradeSection || data.className || data.roleLabel}
                routeCode={data.routeCode}
                guardianName={data.guardianName}
                guardianPhone={data.guardianPhone}
                homeStop={data.homeStop}
                signatureUrl={data.signatureUrl}
                validThru={data.validThru || '07/27'}
                primaryColor={data.primaryColor || '#0C3B5E'}
                accentColor="#10B981"
              />
            </div>
          ) : (
            <div className="py-2 space-y-3">
              <ClassicCardPass
                viewMode={viewMode}
                cardType={data.kind === 'student' ? 'student' : data.kind === 'staff' ? 'staff' : 'parent'}
                cardholderName={data.fullName}
                idNumber={data.idNumber}
                photoUrl={data.photoUrl}
                qrUrl={qrDataUrl}
                qrPayload={data.qrData || `MYEDURIDE:${data.idNumber}`}
                schoolName={data.schoolName || 'Official School Campus'}
                schoolAddress={data.schoolAddress}
                schoolLandmark={data.schoolLandmark}
                schoolPhone={data.schoolPhone}
                logoUrl={data.logoUrl}
                classNameOrRole={data.className || data.roleLabel}
                gradeSection={data.gradeSection || data.className || data.roleLabel}
                signatureUrl={data.signatureUrl}
                primaryColor={data.primaryColor || '#0C2340'}
                accentColor="#28A745"
              />
            </div>
          )}
        </div>

        {/* Footer Hint & Close Button */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[10px] text-slate-400">
            💡 Point scanner or phone camera at screen to test scan barcode &amp; QR
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}
