// @ts-nocheck
'use client';

import { useState } from 'react';
import {
  X,
  ShieldCheck,
  CreditCard,
  QrCode,
  Car,
  MapPin,
  CheckCircle2,
  Lock,
  Sparkles,
  Smartphone,
  Maximize2
} from 'lucide-react';
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
  if (!isOpen) return null;

  const escortName =
    escortData?.full_name ||
    escortData?.name ||
    escortData?.fullName ||
    'MyEduRide Escort';

  const escortCode =
    escortData?.escort_code ||
    escortData?.id ||
    'ESC-5065';

  const escortIdToken = escortData?.id || escortCode;
  const qrPayload = `MYEDURIDE:ESCORT:${escortIdToken}`;

  const vehiclePlate =
    escortData?.vehicle_plate ||
    escortData?.vehicle_reg ||
    escortData?.regNumber ||
    'LAG-104-ED';

  const vehicleName =
    escortData?.vehicle_name ||
    escortData?.vehicle_type ||
    'Toyota HiAce Transit';

  const operatingArea =
    escortData?.operating_area ||
    escortData?.school_name ||
    'Lagos Metropolitan Safety Zone';

  const photo =
    photoSrc(escortData?.photo) ||
    photoSrc(escortData?.photo_url) ||
    photoSrc(escortData?.passport_photograph) ||
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80';

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(
    qrPayload
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl border border-slate-200 relative overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Top Bar */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-xs shadow-xs">
              🛡️
            </div>
            <div>
              <h3 className="text-xs font-black tracking-wide text-white uppercase">
                Digital Gate Pass
              </h3>
              <p className="text-[10px] text-emerald-300 font-semibold">On-Screen Gate Scan Only</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close digital pass"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable ID Pass Card Canvas */}
        <div className="p-4 overflow-y-auto space-y-4">
          
          {/* Card Physical Container (ID Card Badge Layout) */}
          <div className="bg-gradient-to-b from-[#0A1128] via-[#0D1839] to-[#0A1128] text-white rounded-2xl shadow-xl border-2 border-emerald-500/30 overflow-hidden relative">
            
            {/* Lanyard Slot Simulation */}
            <div className="w-16 h-2 bg-slate-800 rounded-full mx-auto mt-2.5 border border-slate-700/60" />

            {/* Header: Brand & Security Tier */}
            <div className="px-4 pt-3 pb-2 text-center border-b border-white/10">
              <div className="flex items-center justify-center gap-1.5 mb-0.5">
                <span className="text-emerald-400 font-black text-sm">MyEduRide</span>
                <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[9px] font-extrabold border border-emerald-500/30">
                  ESCORT PASS
                </span>
              </div>
              <p className="text-[9px] font-extrabold text-slate-300 tracking-widest uppercase">
                Official Transit Personnel Pass
              </p>
            </div>

            {/* Profile Photo & Names */}
            <div className="p-4 flex flex-col items-center text-center">
              <div className="relative mb-2.5">
                <img
                  src={photo}
                  alt={escortName}
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-emerald-400 shadow-md"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80';
                  }}
                />
                <span className="absolute -bottom-1 -right-1 p-1 rounded-full bg-emerald-600 text-white shadow-xs">
                  <ShieldCheck size={12} />
                </span>
              </div>

              <h4 className="font-extrabold text-sm text-white leading-tight">
                {escortName}
              </h4>
              <p className="text-xs font-mono font-bold text-emerald-300 mt-0.5">
                ID: {escortCode}
              </p>

              {/* Transit Details Grid */}
              <div className="w-full mt-3 pt-2.5 border-t border-white/10 grid grid-cols-2 gap-2 text-left text-[10px]">
                <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-slate-400 text-[9px] block">Assigned Vehicle</span>
                  <div className="flex items-center gap-1 mt-0.5 font-bold text-white truncate">
                    <Car size={11} className="text-emerald-400 shrink-0" />
                    <span className="truncate">{vehiclePlate}</span>
                  </div>
                  <span className="text-[8px] text-slate-400 truncate block">{vehicleName}</span>
                </div>

                <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-slate-400 text-[9px] block">Corridor / Zone</span>
                  <div className="flex items-center gap-1 mt-0.5 font-bold text-white truncate">
                    <MapPin size={11} className="text-emerald-400 shrink-0" />
                    <span className="truncate">{operatingArea}</span>
                  </div>
                  <span className="text-[8px] text-emerald-300 font-bold block">Active Transit</span>
                </div>
              </div>

              {/* High-Contrast Scannable QR Code Frame */}
              <div className="w-full mt-3 p-3 rounded-2xl bg-white flex flex-col items-center justify-center shadow-lg border-2 border-emerald-500">
                <div className="text-[9px] font-black text-slate-900 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <QrCode size={12} className="text-emerald-700" />
                  <span>Scan At School Gate</span>
                </div>

                <div className="p-1.5 bg-white rounded-xl border border-slate-200">
                  <img
                    src={qrUrl}
                    alt="Escort Gate Verification QR"
                    className="w-44 h-44 object-contain"
                  />
                </div>

                <div className="mt-1.5 text-center">
                  <span className="font-mono text-[10px] font-black text-slate-800 tracking-wider block">
                    {escortCode}
                  </span>
                  <span className="text-[9px] text-slate-500 font-medium">
                    Presents picked-up student manifest to Gate Officer
                  </span>
                </div>
              </div>

              {/* Verified Badge Footer */}
              <div className="w-full mt-3 pt-2 border-t border-white/10 flex items-center justify-between text-[9px] text-slate-400">
                <span className="flex items-center gap-1 font-bold text-emerald-400">
                  <CheckCircle2 size={11} />
                  <span>CITY MANAGER APPROVED</span>
                </span>
                <span className="font-mono text-[8px] text-slate-400">VALID 2026 FLEET</span>
              </div>
            </div>
          </div>

          {/* Gate Scanning Instructions */}
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] leading-relaxed flex items-start gap-2">
            <Smartphone size={15} className="text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-extrabold block">How gate clearance works:</span>
              <ul className="list-disc pl-3.5 space-y-0.5 text-[10px] text-emerald-800 mt-0.5">
                <li><strong>Morning Drop-off:</strong> Gate Officer scans this QR to check in <em>only</em> students you picked up. Information automatically converts to dropped off.</li>
                <li><strong>Afternoon Pickup:</strong> Gate Officer scans this QR to release students to you. Status automatically converts to picked up.</li>
              </ul>
            </div>
          </div>

        </div>

        {/* Footer Close Button */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 rounded-xl bg-[#0A1128] hover:bg-slate-800 text-white font-black text-xs transition-colors cursor-pointer text-center"
          >
            Close Digital Pass
          </button>
        </div>
      </div>
    </div>
  );
}
