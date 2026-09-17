'use client';

import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Car,
  MapPin,
  Sparkles,
  RotateCw,
  QrCode,
  Building2,
  Phone,
  Lock,
} from 'lucide-react';
import AtmChip from './AtmChip';
import { photoSrc } from '@/lib/photo';

export interface AtmCardPassProps {
  cardType?: 'escort' | 'student' | 'staff' | 'parent';
  cardholderName: string;
  idNumber: string;
  photoUrl?: string | null;
  qrUrl?: string | null;
  qrPayload?: string;
  vehiclePlate?: string;
  vehicleName?: string;
  operatingArea?: string;
  schoolName?: string;
  schoolAddress?: string;
  classNameOrRole?: string;
  validThru?: string;
  securityPin?: string | null;
  primaryColor?: string;
  accentColor?: string;
  onCardClick?: () => void;
  showFlipButton?: boolean;
}

export default function AtmCardPass({
  cardType = 'escort',
  cardholderName,
  idNumber,
  photoUrl,
  qrUrl,
  qrPayload,
  vehiclePlate,
  vehicleName,
  operatingArea,
  schoolName,
  schoolAddress,
  classNameOrRole,
  validThru = '09/27',
  securityPin,
  primaryColor,
  accentColor,
  onCardClick,
  showFlipButton = true,
}: AtmCardPassProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleToggleFlip = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsFlipped((prev) => !prev);
    if (onCardClick) onCardClick();
  };

  const formattedName = (cardholderName || 'CARDHOLDER NAME').toUpperCase();

  // Format ID into credit-card clusters
  const cleanId = (idNumber || 'ESC-2026-0000').toUpperCase();
  const formatCardNumber = (raw: string) => {
    const clean = (raw || '').toUpperCase().trim();
    if (clean.includes('-')) {
      return clean.replace(/-/g, '  ');
    }
    const compact = clean.replace(/\s+/g, '');
    const parts = compact.match(/.{1,4}/g);
    return parts ? parts.join('  ') : compact;
  };

  const photo =
    photoSrc(photoUrl) ||
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=240&auto=format&fit=crop&q=80';

  const defaultQrUrl =
    qrUrl ||
    `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(
      qrPayload || `MYEDURIDE:${cardType.toUpperCase()}:${cleanId}`
    )}`;

  const roleBadge =
    cardType === 'escort'
      ? 'OFFICIAL TRANSIT ESCORT'
      : cardType === 'student'
        ? 'VERIFIED STUDENT PASS'
        : cardType === 'staff'
          ? 'OFFICIAL STAFF PASS'
          : 'PARENT / GUARDIAN PASS';

  // MyEduRide Brand Color System:
  // Primary Navy: #0C2340 (or custom school primary)
  // Brand Green: #28A745 (or custom school accent)
  // Brand Gold: #FBC02D
  const activePrimary = primaryColor || '#0C2340';
  const activeAccent = accentColor || '#28A745';
  const brandGold = '#FBC02D';

  const gradientBackground = `linear-gradient(135deg, ${activePrimary} 0%, #091a33 45%, #040d1a 100%)`;

  return (
    <div className="w-full max-w-[400px] mx-auto select-none">
      {/* 3D PERSPECTIVE CONTAINER */}
      <div
        className="w-full relative cursor-pointer group"
        style={{
          perspective: '1000px',
          aspectRatio: '1.586 / 1',
        }}
        onClick={() => handleToggleFlip()}
      >
        <div
          className="w-full h-full relative transition-transform duration-700 ease-out"
          style={{
            transformStyle: 'preserve-3d',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          {/* ========================================================= */}
          {/* CARD FRONT (ATM LANDSCAPE) */}
          {/* ========================================================= */}
          <div
            className="absolute inset-0 w-full h-full rounded-2xl p-4 sm:p-5 flex flex-col justify-between text-white shadow-2xl border border-white/20 overflow-hidden"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              background: gradientBackground,
            }}
          >
            {/* Holographic Sheen & Radial Foil Light */}
            <div
              className="absolute inset-0 pointer-events-none opacity-30 mix-blend-overlay"
              style={{
                background:
                  'radial-gradient(circle at 20% 15%, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 65%)',
              }}
            />
            <div
              className="absolute -right-16 -bottom-16 w-56 h-56 rounded-full pointer-events-none opacity-25"
              style={{
                background: `radial-gradient(circle, ${activeAccent} 0%, transparent 70%)`,
              }}
            />

            {/* TOP BAR: BRAND LOGO & NETWORK BADGE */}
            <div className="relative z-10 flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-white p-1 flex items-center justify-center shadow-md shrink-0 border border-white/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/eduride_emblem.png"
                    alt="MyEduRide"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-sm tracking-tight text-white drop-shadow-sm">
                      MyEduRide
                    </span>
                    <span
                      className="text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded border tracking-wider"
                      style={{
                        backgroundColor: `${activeAccent}25`,
                        color: '#ffffff',
                        borderColor: `${activeAccent}60`,
                      }}
                    >
                      SMART PASS
                    </span>
                  </div>
                  <p className="text-[9px] font-semibold text-slate-300 truncate max-w-[170px]">
                    {schoolName || 'Lagos Metropolis Campus Network'}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span
                  className="inline-block text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border shadow-sm"
                  style={{
                    backgroundColor: `${activeAccent}25`,
                    color: activeAccent === '#28A745' ? '#34ce57' : activeAccent,
                    borderColor: `${activeAccent}60`,
                  }}
                >
                  {roleBadge}
                </span>
              </div>
            </div>

            {/* MIDDLE ROW: EMV CHIP + CONTACTLESS WAVE + PASSPORT PHOTO */}
            <div className="relative z-10 flex items-center justify-between gap-3 my-auto">
              <div className="flex items-center gap-3">
                {/* Gold Metallic EMV Chip */}
                <AtmChip size="md" />

                {/* Contactless Wave Symbol (RFID / NFC) */}
                <svg
                  className="w-5 h-5 text-white/70 drop-shadow-sm shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M8.5 16.5a5 5 0 0 1 0-9" />
                  <path d="M12 19a8.5 8.5 0 0 0 0-14" />
                  <path d="M15.5 21.5a12 12 0 0 0 0-19" />
                </svg>
              </div>

              {/* Passport Photograph Frame */}
              <div className="relative shrink-0">
                <div className="w-14 h-16 sm:w-16 sm:h-18 rounded-xl overflow-hidden border-2 border-white/40 shadow-lg bg-slate-900">
                  <img
                    src={photo}
                    alt={formattedName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=240&auto=format&fit=crop&q=80';
                    }}
                  />
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center border border-white shadow-xs">
                  <ShieldCheck size={11} className="stroke-[3]" />
                </div>
              </div>
            </div>

            {/* BOTTOM SECTION: EMBOSSED NUMBER, NAME & VALIDITY */}
            <div className="relative z-10 space-y-1">
              {/* Embossed Card Number */}
              <div className="font-mono text-xs sm:text-sm font-black tracking-[0.16em] text-slate-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] truncate">
                {formatCardNumber(cleanId)}
              </div>

              {/* Cardholder Details */}
              <div className="flex items-end justify-between gap-2 pt-0.5 text-[10px]">
                <div className="min-w-0">
                  <span className="block text-[8px] font-bold uppercase tracking-wider text-slate-400">
                    Cardholder Name
                  </span>
                  <span className="font-black text-xs text-white tracking-wide truncate block drop-shadow-sm">
                    {formattedName}
                  </span>
                  {(classNameOrRole || vehiclePlate) && (
                    <span className="text-[9px] font-bold text-slate-300 flex items-center gap-1 truncate">
                      {vehiclePlate && <Car size={10} className="text-amber-300 shrink-0" />}
                      <span>{vehiclePlate ? `Fleet: ${vehiclePlate}` : classNameOrRole}</span>
                    </span>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <span className="block text-[8px] font-bold uppercase tracking-wider text-slate-400">
                    Valid Thru
                  </span>
                  <span className="font-mono font-black text-[11px] text-slate-200">
                    {validThru}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* CARD BACK (MAGNETIC STRIPE, SIGNATURE, & GATE QR) */}
          {/* ========================================================= */}
          <div
            className="absolute inset-0 w-full h-full rounded-2xl flex flex-col justify-between text-white shadow-2xl border border-white/20 overflow-hidden"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              background: gradientBackground,
            }}
          >
            {/* Magnetic Stripe */}
            <div className="w-full h-9 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-y border-slate-800 relative shadow-inner mt-2">
              <div className="w-full h-full opacity-40 bg-[repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(255,255,255,0.05)_4px,rgba(255,255,255,0.05)_8px)]" />
            </div>

            {/* Mid Section: Signature Panel & High-Contrast Gate Scan QR */}
            <div className="px-4 py-2 flex items-center justify-between gap-3 flex-1">
              {/* Left Column: Signature Strip & Terms */}
              <div className="flex-1 min-w-0 space-y-2">
                {/* Signature Panel with CVV / Security PIN */}
                <div>
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                    Authorized Signature / Handover Code
                  </span>
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-7 bg-white rounded-md px-2 flex items-center justify-between border border-slate-300 shadow-inner">
                      <span className="italic font-serif text-[11px] text-slate-700 font-bold truncate">
                        {formattedName.toLowerCase()}
                      </span>
                      <span className="font-mono text-[8px] text-slate-400 tracking-widest select-none">
                        {'/// SECURE ///'}
                      </span>
                    </div>

                    {securityPin && (
                      <div className="h-7 px-2 bg-amber-400 text-slate-950 rounded-md flex items-center justify-center font-mono font-black text-xs shadow-xs">
                        {securityPin}
                      </div>
                    )}
                  </div>
                </div>

                {/* Transit / Campus Details Strip */}
                <div className="text-[9px] text-slate-300 space-y-0.5 leading-tight">
                  <div className="flex items-center gap-1">
                    <MapPin size={10} className="text-amber-300 shrink-0" />
                    <span className="truncate">{schoolAddress || operatingArea || 'Lagos Metropolitan Zone'}</span>
                  </div>
                  <p className="text-[8px] text-slate-400">
                    Official Transit &amp; Campus Pass · Property of {schoolName || 'the school'} · Gate Scannable
                  </p>
                </div>
              </div>

              {/* Right Column: High-Density Gate Scan QR Code */}
              <div className="shrink-0 flex flex-col items-center">
                <div className="p-1.5 bg-white rounded-xl shadow-lg border-2 border-emerald-400">
                  <img
                    src={defaultQrUrl}
                    alt="Gate Verification QR Code"
                    className="w-20 h-20 sm:w-22 sm:h-22 object-contain"
                  />
                </div>
                <span className="text-[8px] font-mono font-black text-emerald-300 tracking-wider mt-1 uppercase">
                  Scan At Campus Gate
                </span>
              </div>
            </div>

            {/* Bottom Bar: Hotline & Verification Authority */}
            <div className="px-4 py-2 bg-black/40 border-t border-white/10 flex items-center justify-between text-[8px] text-slate-400">
              <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/eduride_emblem.png" alt="MyEduRide" className="w-3.5 h-3.5 object-contain" />
                <span>{cardType === 'escort' ? 'CITY MANAGER VERIFIED' : 'DISCL GATE VERIFIED'}</span>
              </div>
              <div className="flex items-center gap-1 text-slate-300 font-mono">
                <Phone size={9} />
                <span>HOTLINE: 0814 521 7045</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FLIP CONTROLS & HINT */}
      {showFlipButton && (
        <div className="mt-3 flex items-center justify-between px-1 text-xs">
          <button
            type="button"
            onClick={() => handleToggleFlip()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-all cursor-pointer shadow-2xs text-[11px]"
          >
            <RotateCw size={13} className="text-slate-600" />
            <span>{isFlipped ? 'Flip to Front View' : 'Flip to QR & Signature (Back)'}</span>
          </button>

          <span className="text-[10px] text-slate-400 font-medium">
            Tap card to flip
          </span>
        </div>
      )}
    </div>
  );
}
