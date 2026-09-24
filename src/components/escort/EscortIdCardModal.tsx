// @ts-nocheck
'use client';

import { useState } from 'react';
import {
  X,
  ShieldCheck,
  CreditCard,
  QrCode,
  Smartphone,
  Maximize2,
  CheckCircle2,
  Car,
  MapPin,
  Lock,
} from 'lucide-react';
import AtmCardPass from '@/components/id-card/AtmCardPass';
import { photoSrc } from '@/lib/photo';

interface EscortIdCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  escortData: {
    id?: string;
    escort_code?: string;
    name?: string;
    fullName?: string;
    full_name?: string;
    photo?: string | null;
    photo_url?: string | null;
    passport_photograph?: string | null;
    phone?: string;
    vehicle_plate?: string;
    vehicle_reg?: string;
    regNumber?: string;
    vehicle_name?: string;
    vehicle_type?: string;
    operating_area?: string;
    school_name?: string;
  };
}

export default function EscortIdCardModal({
  isOpen,
  onClose,
  escortData,
}: EscortIdCardModalProps) {
  const [activeTab, setActiveTab] = useState<'atm' | 'qr'>('atm');

  if (!isOpen) return null;

  const escortName =
    escortData?.full_name ||
    escortData?.name ||
    escortData?.fullName ||
    'MyEduRide Escort';

  const escortCode =
    escortData?.escort_code ||
    escortData?.id ||
    'ESC-OFFICIAL';

  const escortIdToken = escortData?.id || escortCode;
  const qrPayload = `MYEDURIDE:ESCORT:${escortIdToken}`;

  const vehiclePlate =
    escortData?.vehicle_plate ||
    escortData?.vehicle_reg ||
    escortData?.regNumber ||
    'Plate Pending';

  const vehicleName =
    escortData?.vehicle_name ||
    escortData?.vehicle_type ||
    'Transit Shuttle';

  const operatingArea =
    escortData?.operating_area ||
    escortData?.school_name ||
    'Designated Safety Zone';

  const photo =
    photoSrc(escortData?.photo) ||
    photoSrc(escortData?.photo_url) ||
    photoSrc(escortData?.passport_photograph) ||
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80';

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${encodeURIComponent(
    qrPayload
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 relative overflow-hidden flex flex-col max-h-[94vh]">
        {/* Modal Top Bar */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-300 to-amber-500 text-slate-950 flex items-center justify-center font-black text-sm shadow-md">
              🛡️
            </div>
            <div>
              <h3 className="text-xs font-black tracking-wide text-white uppercase">
                Digital Gate Pass
              </h3>
              <p className="text-[10px] text-emerald-300 font-semibold">
                ATM Smart Card &amp; Gate Scan
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close digital pass"
          >
            <X size={18} />
          </button>
        </div>

        {/* View Switcher: ATM Smart Card vs Giant QR */}
        <div className="px-4 pt-3 pb-1 flex gap-1.5 bg-slate-50 border-b border-slate-200/80">
          <button
            type="button"
            onClick={() => setActiveTab('atm')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'atm'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <CreditCard size={14} />
            <span>ATM Smart Card</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('qr')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'qr'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <QrCode size={14} />
            <span>Instant Gate Scan QR</span>
          </button>
        </div>

        {/* Modal Body Canvas */}
        <div className="p-4 overflow-y-auto space-y-4">
          {activeTab === 'atm' ? (
            /* ATM SMART CARD VIEW */
            <div className="space-y-3">
              <AtmCardPass
                cardType="escort"
                cardholderName={escortName}
                idNumber={escortCode}
                photoUrl={photo}
                qrUrl={qrUrl}
                qrPayload={qrPayload}
                vehiclePlate={vehiclePlate}
                vehicleName={vehicleName}
                operatingArea={operatingArea}
                schoolName={escortData?.school_name || 'Lagos Metropolitan Safety Zone'}
                validThru="09/27"
              />

              {/* Verified Badge Summary */}
              <div className="p-3 rounded-2xl bg-slate-900 text-white text-xs space-y-2 border border-slate-800">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Assigned Transit Vehicle:</span>
                  <span className="font-bold text-amber-300 flex items-center gap-1">
                    <Car size={12} />
                    <span>{vehiclePlate} ({vehicleName})</span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Security Approval Status:</span>
                  <span className="font-bold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 size={12} />
                    <span>CITY MANAGER APPROVED</span>
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* GIANT GATE SCAN QR VIEW */
            <div className="p-4 rounded-2xl bg-white border-2 border-emerald-500 shadow-lg flex flex-col items-center justify-center space-y-3 text-center">
              <div className="p-2 bg-white rounded-2xl shadow-inner border border-slate-200">
                <img
                  src={qrUrl}
                  alt="Escort Gate Verification QR"
                  className="w-56 h-56 object-contain"
                />
              </div>

              <div>
                <span className="font-mono text-xs font-black text-slate-900 tracking-widest block uppercase">
                  {escortCode}
                </span>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  Gate Officer: Scan to load escort’s picked-up passenger manifest
                </p>
              </div>
            </div>
          )}

          {/* Gate Clearance Protocol Box */}
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] leading-relaxed flex items-start gap-2">
            <Smartphone size={15} className="text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-extrabold block">Official Gate Protocol:</span>
              <ul className="list-disc pl-3.5 space-y-0.5 text-[10px] text-emerald-800 mt-0.5">
                <li>
                  <strong>Morning Drop-off:</strong> Gate Officer scans this pass to check in <em>only</em> students you picked up. Converts to dropped off.
                </li>
                <li>
                  <strong>Afternoon Pickup:</strong> Gate Officer scans this pass to release students for afternoon transit. Converts to picked up.
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer Close Button */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs transition-colors cursor-pointer text-center shadow-xs"
          >
            Close Digital Pass
          </button>
        </div>
      </div>
    </div>
  );
}
