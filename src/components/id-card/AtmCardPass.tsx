'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, RotateCw } from 'lucide-react';
import AtmChip from './AtmChip';
import Barcode from './Barcode';
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
  schoolPhone?: string;
  logoUrl?: string | null;
  classNameOrRole?: string;
  gradeSection?: string;
  routeCode?: string;
  guardianName?: string;
  guardianPhone?: string;
  homeStop?: string;
  validThru?: string;
  securityPin?: string | null;
  signatureUrl?: string | null;
  transportStatus?: string;
  barcodeValue?: string;
  primaryColor?: string;
  accentColor?: string;
  onCardClick?: () => void;
  showFlipButton?: boolean;
  viewMode?: '3d' | 'front' | 'back' | 'both';
  forcedSide?: 'front' | 'back';
}

export default function AtmCardPass({
  cardType = 'student',
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
  schoolPhone,
  logoUrl,
  classNameOrRole,
  gradeSection,
  routeCode,
  guardianName,
  guardianPhone,
  homeStop,
  validThru = '07/27',
  securityPin,
  signatureUrl,
  transportStatus = 'TRANSPORT ACTIVE',
  barcodeValue,
  primaryColor,
  accentColor,
  onCardClick,
  showFlipButton = true,
  viewMode = '3d',
  forcedSide,
}: AtmCardPassProps) {
  const [isFlipped, setIsFlipped] = useState(forcedSide === 'back');
  const [sigError, setSigError] = useState(false);

  useEffect(() => {
    setSigError(false);
  }, [signatureUrl]);

  useEffect(() => {
    if (forcedSide) {
      setIsFlipped(forcedSide === 'back');
    }
  }, [forcedSide]);

  const handleToggleFlip = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsFlipped((prev) => !prev);
    if (onCardClick) onCardClick();
  };

  const formattedName = (cardholderName || 'AMARA OKAFOR').toUpperCase();
  const cleanId = (idNumber || '2604 8213 0010').toUpperCase().trim();

  // Format ID into clean readable spaced clusters e.g. "2604 8213 0010"
  const formatCardNumber = (raw: string) => {
    const clean = (raw || '').toUpperCase().trim();
    if (clean.includes('-')) {
      return clean.replace(/-/g, ' ');
    }
    const compact = clean.replace(/\s+/g, '');
    const parts = compact.match(/.{1,4}/g);
    return parts ? parts.join(' ') : compact;
  };

  const displayNumber = formatCardNumber(cleanId);
  const barcodeRaw = barcodeValue || cleanId.replace(/\s+/g, '');

  const photo = photoSrc(photoUrl);

  const defaultQrUrl =
    qrUrl ||
    `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=4&data=${encodeURIComponent(
      qrPayload || `MYEDURIDE:${cardType.toUpperCase()}:${cleanId.replace(/\s+/g, '')}`
    )}`;

  // Default Fallbacks matching reference card design
  const activeSchool = schoolName || 'IGBINADION EDUCATION CENTER';
  const activeGradeSection = gradeSection || classNameOrRole || (cardType === 'escort' ? 'FLEET DRIVER' : '10 · C');
  const activeRoute = routeCode || (vehiclePlate ? `RT-${vehiclePlate.slice(0, 4)}` : 'R-14');
  const activeGuardian = guardianName || (cardType === 'student' ? 'Mrs. Ngozi Okafor' : 'Official Emergency Contact');
  const activePhone = guardianPhone || '+234 800 000 0000';
  const activeHomeStop = homeStop || operatingArea || 'Ring Road Junction';
  const returnPhone = schoolPhone || '+234 800 000 0001';

  // MyEduRide Rich Brand Colors
  const activePrimary = primaryColor || '#0C3B5E';
  const activeAccent = accentColor || '#10B981';

  // Resolved School Logo with guaranteed crest fallback
  const resolvedLogo = (logoUrl ? photoSrc(logoUrl) : null) || '/images/landing/school_badge_1.png';

  // Resolved Authorized Signature
  const resolvedSignature = signatureUrl ? photoSrc(signatureUrl) : null;
  const hasSignature = !!resolvedSignature && !sigError;

  // Shared Front Card JSX
  const frontCardJsx = (
    <div
      className="w-full h-full rounded-3xl p-4 sm:p-5 flex flex-col justify-between text-white shadow-2xl overflow-hidden border border-white/20 select-none relative"
      style={{
        background: `radial-gradient(ellipse at 80% 65%, #0B4F6C 0%, ${activePrimary} 45%, #051F33 100%)`,
        aspectRatio: '1.586 / 1',
      }}
    >
      {/* Topographic Contour Wave Accents */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none opacity-20"
        viewBox="0 0 400 252"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="330" cy="126" r="80" stroke="white" strokeWidth="1" strokeDasharray="3 3" />
        <circle cx="330" cy="126" r="120" stroke="white" strokeWidth="1" opacity="0.6" />
        <circle cx="330" cy="126" r="160" stroke="#34D399" strokeWidth="1" opacity="0.4" />
        <circle cx="330" cy="126" r="210" stroke="white" strokeWidth="1" opacity="0.3" />
        <circle cx="80" cy="120" r="110" stroke="white" strokeWidth="0.8" opacity="0.25" />
      </svg>

      {/* TOP HEADER ROW: MYEDURIDE LOGO (LEFT) & SCHOOL LOGO, NAME, ADDRESS (OPPOSITE RIGHT) */}
      <div className="relative z-10 flex items-center justify-between gap-3">
        {/* Left: White Brand Pill Badge */}
        <div className="bg-white rounded-xl px-2.5 py-1 inline-flex items-center gap-1.5 shadow-md shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/eduride_emblem.png"
            alt="MyEduRide"
            className="w-5 h-5 object-contain shrink-0"
          />
          <div>
            <span className="block font-black text-[11px] sm:text-xs text-[#0C3B5E] tracking-tight leading-none">
              MyEduRide
            </span>
            <span className="block text-[6px] sm:text-[6.5px] font-extrabold text-slate-500 tracking-wider uppercase leading-none mt-0.5">
              THE STUDENT SAFETY PLATFORM
            </span>
          </div>
        </div>

        {/* Opposite (Right): School Emblem, Name, Campus Address & Contactless Wave */}
        <div className="flex items-center gap-2 min-w-0 justify-end flex-1">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white p-1 shadow-md border border-white/50 shrink-0 flex items-center justify-center overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resolvedLogo}
              alt={activeSchool}
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/images/landing/school_badge_1.png';
              }}
            />
          </div>
          <div className="min-w-0 text-left sm:text-right">
            <div className="text-[9px] sm:text-[10px] font-black text-slate-100 tracking-[0.14em] uppercase py-0.5 leading-normal max-w-[200px] sm:max-w-[240px] truncate">
              {activeSchool}
            </div>
            <div className="text-[7px] sm:text-[8px] text-slate-200/90 font-medium py-0.5 leading-normal max-w-[220px] sm:max-w-[260px] truncate mt-0.5">
              📍 {schoolAddress || 'Official School Campus Address'}
            </div>
          </div>

          {/* Contactless RFID / NFC Wave Symbol */}
          <div className="flex items-center text-white/90 shrink-0 pl-1">
            <svg
              className="w-5 h-5 sm:w-6 sm:h-6 drop-shadow-sm"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
            >
              <path d="M12 18a6 6 0 0 0 0-12" />
              <path d="M16 21a10.5 10.5 0 0 0 0-18" />
              <circle cx="8" cy="12" r="1.2" fill="currentColor" stroke="none" />
            </svg>
          </div>
        </div>
      </div>

      {/* MIDDLE ROW: EMV CHIP + ORBIT PASSPORT PHOTO FRAME */}
      <div className="relative z-10 flex items-center justify-between gap-2 my-auto">
        {/* Left Side: Metallic Gold EMV Chip */}
        <div className="pt-1">
          <AtmChip size="md" />
        </div>

        {/* Right Side: Passport Photo Frame with Circular Lime Orbit & Gold Accent Dot */}
        <div className="relative shrink-0 mr-1 sm:mr-2 top-3 sm:top-3.5">
          {/* Orbit Arc Ring SVG */}
          <svg
            className="absolute -top-3.5 -left-3.5 w-[110px] h-[134px] sm:w-[124px] sm:h-[150px] pointer-events-none"
            viewBox="0 0 100 120"
            fill="none"
          >
            <path
              d="M 12 100 A 48 48 0 0 1 88 18"
              stroke="#4ADE80"
              strokeWidth="2"
              strokeLinecap="round"
            />
            {/* Top-Right Gold Satellite Dot */}
            <circle cx="88" cy="18" r="4" fill="#FBBF24" />
            {/* Bottom-Left Gold Accent Dot */}
            <circle cx="12" cy="100" r="3" fill="#FBBF24" />
          </svg>

          {/* Vertical Passport Photo Frame (35 x 45mm ratio) - Prominently Enlarged */}
          <div className="w-[84px] h-[106px] sm:w-[96px] sm:h-[122px] rounded-2xl bg-slate-100 border-[2.5px] border-white shadow-xl overflow-hidden relative flex flex-col justify-between">
            {photo ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={photo}
                alt={formattedName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=240&auto=format&fit=crop&q=80';
                }}
              />
            ) : (
              <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center p-1">
                <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full border-2 border-slate-300 bg-slate-200/80 mb-0.5" />
                <div className="w-14 h-7 sm:w-16 sm:h-8 rounded-t-full bg-slate-200/90 border border-slate-300" />
              </div>
            )}

            {/* Passport Ratio Label */}
            <div className="absolute bottom-0 inset-x-0 bg-white/95 backdrop-blur-xs py-0.5 text-center text-[6px] sm:text-[7px] font-bold text-slate-600 tracking-wider uppercase border-t border-slate-200">
              PHOTO · 35 × 45 MM
            </div>
          </div>
        </div>
      </div>

      {/* LOWER-MIDDLE: CARD NUMBER & CARDHOLDER NAME */}
      <div className="relative z-10 -top-2.5 sm:-top-3.5 -mt-1 sm:mt-0">
        {/* Embossed Bold Card Number */}
        <div className="font-mono text-base sm:text-lg font-black tracking-[0.16em] text-white py-0.5 leading-normal overflow-visible">
          {displayNumber}
        </div>

        {/* Cardholder Full Name */}
        <div className="font-black text-xs sm:text-sm text-white tracking-wider uppercase py-0.5 leading-normal overflow-visible mt-0.5">
          {formattedName}
        </div>

        {/* Gold/Yellow Underline Accent */}
        <div className="w-10 sm:w-12 h-0.5 bg-amber-400 rounded-full mt-1" />
      </div>

      {/* BOTTOM METADATA ROW: VALID THRU, GRADE/SECTION, ROUTE & STATUS PILL */}
      <div className="relative z-10 flex items-end justify-between gap-1 pt-1 -top-2 sm:-top-2.5 text-white">
        <div className="flex items-center gap-3 sm:gap-4 text-[9px] sm:text-[10px]">
          {/* Valid Thru */}
          <div>
            <span className="block text-[6.5px] sm:text-[7px] font-bold uppercase tracking-widest text-slate-300">
              VALID THRU
            </span>
            <span className="font-mono font-black text-[11px] sm:text-xs text-white">
              {validThru}
            </span>
          </div>

          {/* Grade / Section or Role */}
          <div>
            <span className="block text-[6.5px] sm:text-[7px] font-bold uppercase tracking-widest text-slate-300">
              GRADE · SECTION
            </span>
            <span className="font-black text-[11px] sm:text-xs text-white max-w-[90px] block py-0.5 leading-normal">
              {activeGradeSection}
            </span>
          </div>

          {/* Route */}
          <div>
            <span className="block text-[6.5px] sm:text-[7px] font-bold uppercase tracking-widest text-slate-300">
              ROUTE
            </span>
            <span className="font-black text-[11px] sm:text-xs text-emerald-300">
              {activeRoute}
            </span>
          </div>
        </div>

        {/* Status Pill Badge: TRANSPORT ACTIVE */}
        <div className="shrink-0">
          <div className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-emerald-700/85 border border-emerald-400/40 text-white flex items-center gap-1.5 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse shrink-0" />
            <span className="text-[7.5px] sm:text-[8px] font-black uppercase tracking-wider">
              {transportStatus}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  // Shared Back Card JSX
  const backCardJsx = (
    <div
      className="w-full h-full rounded-3xl flex flex-col justify-between text-slate-900 shadow-2xl overflow-hidden border border-slate-200 bg-white select-none relative"
      style={{
        background: 'linear-gradient(135deg, #F8FAFC 0%, #FFFFFF 50%, #F1F5F9 100%)',
        aspectRatio: '1.586 / 1',
      }}
    >
      {/* Top: Full-Width Magnetic Stripe */}
      <div className="w-full h-7 sm:h-8 bg-slate-950 border-b border-slate-900 shadow-inner relative shrink-0">
        <div className="w-full h-full opacity-30 bg-[repeating-linear-gradient(90deg,transparent,transparent_4px,rgba(255,255,255,0.06)_4px,rgba(255,255,255,0.06)_8px)]" />
      </div>

      {/* Mid-Top Row: Signature Strip, Route Box, QR Code Box */}
      <div className="px-3 sm:px-4 pt-1 flex items-stretch justify-between gap-2">
        {/* Left: Authorised Signature Box with Security Strip */}
        <div className="flex-1 bg-white rounded-xl p-1.5 border border-slate-200 shadow-2xs flex flex-col justify-between relative overflow-hidden">
          <span className="text-[6.5px] sm:text-[7px] font-bold text-slate-400 uppercase tracking-wider block">
            AUTHORISED SIGNATURE
          </span>
          <div
            className="h-6 sm:h-7 rounded-md px-2 flex items-center border border-slate-200 shadow-inner my-0.5 overflow-hidden"
            style={{
              background:
                'repeating-linear-gradient(45deg, #F8FAFC, #F8FAFC 4px, #EDF2F7 4px, #EDF2F7 8px)',
            }}
          >
            {hasSignature ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={resolvedSignature!}
                alt="Signature"
                className="max-h-5 sm:max-h-5.5 object-contain"
                onError={() => setSigError(true)}
              />
            ) : (
              <span className="italic font-serif text-[10px] sm:text-[11px] text-slate-400 select-none tracking-wide">
                Signature
              </span>
            )}
          </div>
        </div>

        {/* Middle: Route Box */}
        <div className="w-16 sm:w-18 bg-white rounded-xl p-1.5 border border-slate-200 shadow-2xs flex flex-col justify-center items-center shrink-0">
          <span className="text-[6.5px] sm:text-[7px] font-bold text-slate-400 uppercase tracking-wider block">
            ROUTE
          </span>
          <span className="text-sm sm:text-base font-black text-emerald-600 leading-tight">
            {activeRoute}
          </span>
        </div>

        {/* Right: QR Code Box - Prominently Enlarged for Quick Gate/Escort Scanning */}
        <div className="w-18 sm:w-22 bg-white rounded-xl p-1.5 border border-slate-200 shadow-2xs flex flex-col items-center justify-center shrink-0 relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={defaultQrUrl}
            alt="QR"
            className="w-14 h-14 sm:w-16 sm:h-16 object-contain"
          />
          <span className="text-[6px] sm:text-[6.5px] font-mono font-bold text-slate-400 uppercase tracking-widest leading-none mt-0.5">
            QR
          </span>
        </div>
      </div>

      {/* Middle Section: In Case of Emergency + Verified Hologram Badge */}
      <div className="px-3 sm:px-4 py-0.5">
        <span className="text-[7px] sm:text-[7.5px] font-extrabold text-slate-400 uppercase tracking-[0.2em] block mb-1">
          IN CASE OF EMERGENCY
        </span>

        <div className="flex items-center justify-between gap-2">
          {/* 3 Columns: Guardian, Phone, Home Stop */}
          <div className="grid grid-cols-3 gap-2 flex-1 min-w-0">
            <div className="min-w-0">
              <span className="text-[6.5px] sm:text-[7px] font-bold text-slate-400 uppercase tracking-wider block">
                GUARDIAN
              </span>
              <span className="text-[10px] sm:text-[11px] font-black text-slate-900 block truncate py-0.5 leading-normal">
                {activeGuardian}
              </span>
            </div>

            <div className="min-w-0">
              <span className="text-[6.5px] sm:text-[7px] font-bold text-slate-400 uppercase tracking-wider block">
                PHONE
              </span>
              <span className="text-[10px] sm:text-[11px] font-mono font-black text-slate-900 block truncate py-0.5 leading-normal">
                {activePhone}
              </span>
            </div>

            <div className="min-w-0">
              <span className="text-[6.5px] sm:text-[7px] font-bold text-slate-400 uppercase tracking-wider block">
                HOME STOP
              </span>
              <span className="text-[10px] sm:text-[11px] font-bold text-slate-900 block truncate py-0.5 leading-normal">
                {activeHomeStop}
              </span>
            </div>
          </div>

          {/* Circular Holographic "VERIFIED" Badge */}
          <div className="shrink-0 flex flex-col items-center justify-center pl-1">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-emerald-100 via-teal-100 to-amber-100 border-2 border-emerald-300 flex flex-col items-center justify-center shadow-xs">
              <ShieldCheck size={14} className="text-emerald-700 stroke-[2.5]" />
              <span className="text-[5.5px] sm:text-[6px] font-black text-emerald-800 tracking-wider uppercase leading-none mt-0.5">
                VERIFIED
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Legal Disclaimer + BOLD BARCODE + Brand Emblem */}
      <div className="px-3 sm:px-4 pb-2.5 pt-0.5 space-y-1">
        {/* Disclaimer Notice */}
        <div className="text-[6.5px] sm:text-[7px] text-slate-500 leading-tight">
          <p>If found, please return to {activeSchool}, {schoolAddress || 'the campus gate'} or call {returnPhone}.</p>
          <p>This card is non-transferable and remains the property of {activeSchool}.</p>
        </div>

        {/* Bottom Bar: BOLD BARCODE + Brand Emblem */}
        <div className="flex items-end justify-between gap-3 pt-0.5">
          {/* BOLD BARCODE FOR QUICK CAPTURE BY GATE OFFICER & ESCORT */}
          <div className="flex-1 max-w-[240px] sm:max-w-[270px]">
            <div className="bg-white p-1 rounded-md border border-slate-200/80 shadow-2xs">
              <Barcode
                value={barcodeRaw}
                className="w-full h-7 sm:h-8"
                height={44}
                barColor="#000000"
              />
            </div>
            <div className="text-center font-mono text-[8px] sm:text-[9px] font-bold text-slate-800 tracking-[0.25em] mt-0.5">
              {displayNumber}
            </div>
          </div>

          {/* School Crest + Brand Logo */}
          <div className="flex items-center gap-2 shrink-0 pb-1">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-white p-0.5 border border-slate-200 flex items-center justify-center shrink-0 shadow-2xs overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resolvedLogo}
                alt="School Logo"
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/images/landing/school_badge_1.png';
                }}
              />
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/eduride_emblem.png"
                alt="MyEduRide"
                className="w-5 h-5 sm:w-6 sm:h-6 object-contain"
              />
              <div>
                <span className="block font-black text-[10px] sm:text-[11px] text-[#0C3B5E] leading-none">
                  MyEduRide
                </span>
                <span className="block text-[5.5px] sm:text-[6px] font-bold text-slate-500 tracking-wider uppercase leading-none mt-0.5">
                  THE STUDENT SAFETY PLATFORM
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Hidden high-resolution CR80 print source (440px x 277.4px matching on-screen proportions)
  const printSourceJsx = (
    <div
      id="atm-card-print-source"
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: '440px',
        pointerEvents: 'none',
        zIndex: -9999,
      }}
      aria-hidden="true"
    >
      <div id="atm-card-print-front" style={{ width: '440px', height: '277.4px', marginBottom: '20px' }}>
        {frontCardJsx}
      </div>
      <div id="atm-card-print-back" style={{ width: '440px', height: '277.4px' }}>
        {backCardJsx}
      </div>
    </div>
  );

  // 1. DUAL VIEW (BOTH SIDES SHOWN TOGETHER FOR SUPER ADMIN PREVIEW)
  if (viewMode === 'both') {
    return (
      <div className="w-full max-w-5xl mx-auto space-y-4">
        {printSourceJsx}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1 text-xs font-bold text-slate-300">
              <span>Card Front (Landscape ATM)</span>
              <span className="text-[10px] text-emerald-400 font-mono">Standard CR80</span>
            </div>
            <div className="w-full" id="atm-card-onscreen-front">{frontCardJsx}</div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1 text-xs font-bold text-slate-300">
              <span>Card Back (Bold Barcode &amp; Contacts)</span>
              <span className="text-[10px] text-emerald-400 font-mono">Gate &amp; Escort Scannable</span>
            </div>
            <div className="w-full" id="atm-card-onscreen-back">{backCardJsx}</div>
          </div>
        </div>
      </div>
    );
  }

  // 2. FRONT ONLY VIEW
  if (viewMode === 'front') {
    return (
      <div className="w-full max-w-[440px] mx-auto space-y-2">
        {printSourceJsx}
        <div className="flex items-center justify-between px-1 text-xs font-bold text-slate-300">
          <span>Card Front View</span>
          <span className="text-[10px] text-emerald-400 font-mono">Standard CR80</span>
        </div>
        <div className="w-full">{frontCardJsx}</div>
      </div>
    );
  }

  // 3. BACK ONLY VIEW (SHOWING BOLD BARCODE)
  if (viewMode === 'back') {
    return (
      <div className="w-full max-w-[440px] mx-auto space-y-2">
        {printSourceJsx}
        <div className="flex items-center justify-between px-1 text-xs font-bold text-slate-300">
          <span>Card Back View (Bold Barcode &amp; Emergency Contacts)</span>
          <span className="text-[10px] text-emerald-400 font-mono">High-Contrast Scan Base</span>
        </div>
        <div className="w-full">{backCardJsx}</div>
      </div>
    );
  }

  // 4. INTERACTIVE 3D FLIP PASS VIEW (DEFAULT)
  return (
    <div className="w-full max-w-[440px] mx-auto select-none font-sans">
      {printSourceJsx}
      <div
        className="w-full relative cursor-pointer group"
        style={{
          perspective: '1200px',
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
          {/* Card Front */}
          <div
            className="absolute inset-0 w-full h-full"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
            }}
          >
            {frontCardJsx}
          </div>

          {/* Card Back */}
          <div
            className="absolute inset-0 w-full h-full"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            {backCardJsx}
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
            <span>{isFlipped ? 'Flip to Front View' : 'Flip to Barcode & Emergency Contacts (Back)'}</span>
          </button>

          <span className="text-[10px] text-slate-400 font-medium">
            Tap card to flip
          </span>
        </div>
      )}
    </div>
  );
}
