'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, RotateCw } from 'lucide-react';
import AtmChip from './AtmChip';
import Barcode from './Barcode';
import { photoSrc } from '@/lib/photo';
import QRCode from 'qrcode';

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
  const [sigFallback, setSigFallback] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [logoFallback, setLogoFallback] = useState(false);
  const [photoError, setPhotoError] = useState(false);
  const [photoFallback, setPhotoFallback] = useState(false);
  const [localQr, setLocalQr] = useState<string>('');

  useEffect(() => {
    setSigError(false);
    setSigFallback(false);
  }, [signatureUrl]);

  useEffect(() => {
    setLogoError(false);
    setLogoFallback(false);
  }, [logoUrl]);

  useEffect(() => {
    setPhotoError(false);
    setPhotoFallback(false);
  }, [photoUrl]);

  useEffect(() => {
    if (forcedSide) {
      setIsFlipped(forcedSide === 'back');
    }
  }, [forcedSide]);

  const formattedName = (cardholderName || 'CARDHOLDER NAME').toUpperCase();
  const cleanId = (idNumber || 'ID-0000').toUpperCase().trim();

  // Generate local crisp QR data URL if not passed from parent
  useEffect(() => {
    if (!qrUrl) {
      const payload = qrPayload || `MYEDURIDE:${cardType.toUpperCase()}:${cleanId.replace(/\s+/g, '')}`;
      QRCode.toDataURL(payload, {
        width: 400,
        margin: 1,
        errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#ffffff' },
      })
        .then(setLocalQr)
        .catch(() => {});
    }
  }, [qrUrl, qrPayload, cardType, cleanId]);

  const activeQrUrl = qrUrl || localQr || '';

  const handleToggleFlip = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsFlipped((prev) => !prev);
    if (onCardClick) onCardClick();
  };

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

  const photo = photoFallback && photoUrl
    ? `/api/photo?path=${encodeURIComponent(photoUrl)}`
    : photoSrc(photoUrl);

  // Default Fallbacks matching verified database records
  const activeSchool = schoolName || 'MYEDURIDE PARTNER SCHOOL';
  const isStudent = cardType === 'student';
  const activeGradeSection = isStudent
    ? ''
    : gradeSection || classNameOrRole || (cardType === 'escort' ? 'FLEET DRIVER' : 'STAFF MEMBER');
  const activeRoute = routeCode || (vehiclePlate ? `RT-${vehiclePlate.slice(0, 4)}` : 'R-CAMPUS');
  const activeGuardian = guardianName || (cardType === 'student' ? 'Not Assigned' : 'Official Emergency Contact');
  const activePhone = guardianPhone || 'Not Available';
  const activeHomeStop = homeStop || operatingArea || 'Campus Gate';
  const returnPhone = '09155034698';

  // MyEduRide Rich Brand Colors
  const activePrimary = primaryColor || '#0C3B5E';
  const activeAccent = accentColor || '#10B981';

  // Resolved School Logo (null if not available, so placeholder can indicate "Add School Logo")
  const rawLogo = logoUrl
    ? logoFallback
      ? `/api/photo?path=${encodeURIComponent(logoUrl)}`
      : photoSrc(logoUrl)
    : null;
  const resolvedLogo = rawLogo;
  const hasLogo = Boolean(rawLogo && !logoError);

  // Resolved Authorized Signature
  const resolvedSignature = signatureUrl
    ? sigFallback
      ? `/api/photo?path=${encodeURIComponent(signatureUrl)}`
      : photoSrc(signatureUrl)
    : null;
  const hasSignature = !!resolvedSignature && !sigError;

  const handleLogoImgError = () => {
    if (!logoFallback && logoUrl && !logoUrl.startsWith('/api/photo')) {
      setLogoFallback(true);
    } else {
      setLogoError(true);
    }
  };

  const handleSigImgError = () => {
    if (!sigFallback && signatureUrl && !signatureUrl.startsWith('/api/photo')) {
      setSigFallback(true);
    } else {
      setSigError(true);
    }
  };

  const handlePhotoImgError = () => {
    if (!photoFallback && photoUrl && !photoUrl.startsWith('/api/photo')) {
      setPhotoFallback(true);
    } else {
      setPhotoError(true);
    }
  };

  // Shared Front Card JSX
  const frontCardJsx = (
    <div
      className="w-full h-full rounded-3xl px-6 py-4 sm:px-7 sm:py-5 flex flex-col justify-between text-white shadow-2xl overflow-hidden border border-white/20 select-none relative"
      style={{
        background: `radial-gradient(ellipse at 78% 55%, #0B4F6C 0%, ${activePrimary} 48%, #051F33 100%)`,
        aspectRatio: '1.586 / 1',
      }}
    >
      {/* Subtle Left Ambient Contour Accent */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none opacity-15"
        viewBox="0 0 440 277"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="70" cy="138" r="115" stroke="white" strokeWidth="0.8" opacity="0.35" />
      </svg>

      {/* TOP HEADER ROW: MYEDURIDE LOGO (LEFT) & LARGER SCHOOL LOGO, NAME, ADDRESS (RIGHT) */}
      <div className="relative z-10 flex items-center justify-between gap-3 shrink-0">
        {/* Left: Clean UI/UX Brand Pill Badge */}
        <div className="bg-white/95 rounded-xl pl-2 pr-3 py-1.5 inline-flex items-center gap-2 shadow-md border border-white/80 shrink-0">
          <div
            className="rounded-lg bg-slate-50 border border-slate-200/80 p-0.5 flex items-center justify-center shrink-0 shadow-2xs overflow-hidden"
            style={{ width: '26px', height: '26px', minWidth: '26px', maxWidth: '26px', minHeight: '26px', maxHeight: '26px' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/eduride_emblem.png"
              crossOrigin="anonymous"
              alt="MyEduRide"
              className="w-full h-full object-contain"
              style={{ width: '100%', height: '100%', maxWidth: '22px', maxHeight: '22px' }}
            />
          </div>
          <div className="flex flex-col justify-center" style={{ whiteSpace: 'nowrap' }}>
            <span className="block font-black text-xs text-[#0C3B5E] tracking-tight leading-none whitespace-nowrap">
              MyEdu<span className="text-emerald-600">Ride</span>
            </span>
            <span className="block text-[6px] font-extrabold text-slate-500 tracking-wider uppercase leading-none mt-1 whitespace-nowrap">
              THE STUDENT SAFETY PLATFORM
            </span>
          </div>
        </div>

        {/* Right: Enlarged School Crest + Left-Aligned School Name & Address + NFC Wave */}
        <div className="flex items-center gap-2.5 min-w-0 justify-end flex-1">
          {hasLogo ? (
            <div
              className="rounded-xl bg-white p-1 shadow-lg border-2 border-white/80 shrink-0 flex items-center justify-center overflow-hidden"
              style={{ width: '42px', height: '42px', minWidth: '42px', maxWidth: '42px', minHeight: '42px', maxHeight: '42px' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={rawLogo!}
                crossOrigin="anonymous"
                alt={activeSchool}
                className="w-full h-full object-contain"
                style={{ width: '100%', height: '100%', maxWidth: '34px', maxHeight: '34px', objectFit: 'contain' }}
                onError={handleLogoImgError}
              />
            </div>
          ) : (
            <div
              className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-dashed border-amber-300/80 text-amber-200 shrink-0 flex items-center gap-1.5 shadow-sm backdrop-blur-xs transition-colors"
              title="No school logo available - Add school logo in School Settings"
            >
              <div className="w-4 h-4 rounded-md bg-amber-400/25 flex items-center justify-center shrink-0">
                <svg className="w-2.5 h-2.5 text-amber-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                  <circle cx="9" cy="9" r="2"/>
                  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                </svg>
              </div>
              <span className="text-[7px] sm:text-[7.5px] font-black uppercase tracking-wider text-amber-200 leading-tight whitespace-nowrap">
                Add School Logo
              </span>
            </div>
          )}

          <div className="min-w-0 text-left flex-1 max-w-[180px] sm:max-w-[220px]">
            <div className="text-[9.5px] sm:text-[11px] font-black text-white tracking-wide uppercase leading-tight break-words drop-shadow-xs">
              {activeSchool}
            </div>
            <div className="text-[7px] sm:text-[8px] text-sky-100/90 font-semibold leading-tight truncate mt-0.5">
              📍 {schoolAddress || 'Official School Campus Address'}
            </div>
          </div>

          {/* Contactless RFID / NFC Wave Symbol */}
          <div className="flex items-center text-white/90 shrink-0 pl-0.5">
            <svg
              className="w-5 h-5 drop-shadow-sm"
              style={{ width: '20px', height: '20px' }}
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

      {/* MAIN INNER BODY: SPREAD EVENLY ACROSS SAFE AREA WITH PHOTO SEATED DEAD-CENTER INSIDE CONCENTRIC CIRCLE */}
      <div className="relative z-10 flex-1 flex items-stretch justify-between gap-3 mt-2.5 sm:mt-3 pl-1 pr-3 sm:pr-5">
        {/* Left Column: Evenly Spread EMV Chip (Top), Card ID & Name (Middle), and Valid Thru (Bottom) */}
        <div className="flex flex-col justify-between min-w-0 flex-1 py-0.5">
          {/* Top: Metallic Gold EMV Chip */}
          <div>
            <AtmChip size="lg" />
          </div>

          {/* Middle: Embossed Card Number, Cardholder Full Name & Accent Line */}
          <div className="min-w-0 my-auto py-1">
            <div className="font-mono text-sm sm:text-base font-black tracking-[0.13em] text-white leading-snug overflow-visible truncate drop-shadow-xs">
              {displayNumber}
            </div>

            <div className="font-black text-xs sm:text-sm text-white tracking-wider uppercase leading-snug overflow-visible mt-1 truncate">
              {formattedName}
            </div>

            {/* Gold/Emerald Underline Accent */}
            <div className="w-12 sm:w-14 h-0.5 bg-amber-400 rounded-full mt-1.5" />
          </div>

          {/* Bottom: Valid Thru & Role/Dept (Aligned on Same Baseline as Transport Active Pill) */}
          <div className="flex items-end gap-4 sm:gap-5 text-[9px] sm:text-[10px]">
            <div>
              <span className="block text-[6.5px] sm:text-[7px] font-bold uppercase tracking-widest text-slate-300 leading-none">
                VALID THRU
              </span>
              <span className="font-mono font-black text-xs sm:text-sm text-white leading-none mt-1 block">
                {validThru}
              </span>
            </div>

            {!isStudent && activeGradeSection && (
              <div>
                <span className="block text-[6.5px] sm:text-[7px] font-bold uppercase tracking-widest text-slate-300 leading-none">
                  ROLE / DEPT
                </span>
                <span className="font-black text-[11px] sm:text-xs text-white max-w-[125px] sm:max-w-[150px] block leading-none mt-1 truncate">
                  {activeGradeSection}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Student Photo Seated Perfectly Inside Concentric Circle + Transport Active Pill */}
        <div className="flex flex-col items-center justify-between py-0.5 shrink-0" style={{ marginRight: '10px' }}>
          {/* Photo + Concentric Circular Orbit Halo Centered Exactly on the Photo */}
          <div className="relative flex items-center justify-center my-auto">
            {/* Concentric Radar Circles & Emerald Orbit Ring Centered at (50%, 50%) of Photo */}
            <svg
              className="pointer-events-none overflow-visible"
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '268px',
                height: '268px',
              }}
              viewBox="0 0 280 280"
              fill="none"
            >
              {/* Outer Ambient Concentric Radar Rings */}
              <circle cx="140" cy="140" r="132" stroke="white" strokeWidth="0.9" opacity="0.14" />
              <circle cx="140" cy="140" r="106" stroke="#34D399" strokeWidth="1" opacity="0.22" />
              <circle
                cx="140"
                cy="140"
                r="84"
                stroke="white"
                strokeWidth="1"
                strokeDasharray="3.5 3.5"
                opacity="0.32"
              />

              {/* Inner Circular Orbit Ring Framing the Photo (Radius 74 > Photo Corner 70) */}
              <circle cx="140" cy="140" r="74" stroke="white" strokeWidth="1" opacity="0.22" />

              {/* Glowing Emerald Orbit Arc Along Top-Right & Bottom-Left of the Circle */}
              <path
                d="M 88 88 A 74 74 0 0 1 211 119"
                stroke="#4ADE80"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              <path
                d="M 69 161 A 74 74 0 0 0 182 201"
                stroke="#4ADE80"
                strokeWidth="1.8"
                strokeLinecap="round"
                opacity="0.7"
              />

              {/* Gold Satellite Dots Seated on the r=74 Orbit Circle */}
              <circle cx="195" cy="91" r="4.2" fill="#FBBF24" />
              <circle cx="69" cy="161" r="3.2" fill="#FBBF24" />
            </svg>

            {/* Student Portrait Frame Seated Inside the r=74 Circle */}
            <div
              className="rounded-2xl bg-slate-100 border-2 border-white shadow-xl overflow-hidden relative z-10"
              style={{
                width: '100px',
                height: '112px',
                minWidth: '100px',
                maxWidth: '100px',
                minHeight: '112px',
                maxHeight: '112px',
              }}
            >
              {photo && !photoError ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={photo}
                  crossOrigin="anonymous"
                  alt={formattedName}
                  className="w-full h-full object-cover object-top"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }}
                  onError={handlePhotoImgError}
                />
              ) : (
                <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center p-1">
                  <div className="w-10 h-10 rounded-full border-2 border-slate-300 bg-slate-200/80 mb-0.5" />
                  <div className="w-14 h-7 rounded-t-full bg-slate-200/90 border border-slate-300" />
                </div>
              )}
            </div>
          </div>

          {/* Status Pill Badge: TRANSPORT ACTIVE (Aligned with VALID THRU Baseline) */}
          <div className="shrink-0 relative z-10 mt-1.5">
            <div className="px-3 py-0.5 sm:py-1 rounded-full bg-emerald-700/90 border border-emerald-400/50 text-white flex items-center gap-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse shrink-0" />
              <span className="text-[7px] sm:text-[7.5px] font-black uppercase tracking-wider whitespace-nowrap">
                {transportStatus}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Shared Back Card JSX
  const backCardJsx = (
    <div
      className="w-full h-full rounded-3xl flex flex-col justify-start text-slate-900 shadow-2xl overflow-hidden border border-slate-200 bg-white select-none relative"
      style={{
        background: 'linear-gradient(135deg, #F8FAFC 0%, #FFFFFF 50%, #F1F5F9 100%)',
        aspectRatio: '1.586 / 1',
      }}
    >
      {/* Top: Sleek Full-Width Magnetic Stripe */}
      <div
        className="w-full bg-slate-950 border-b border-slate-900 shadow-inner relative shrink-0"
        style={{ height: '18px', minHeight: '18px' }}
      >
        <div className="w-full h-full opacity-30 bg-[repeating-linear-gradient(90deg,transparent,transparent_4px,rgba(255,255,255,0.06)_4px,rgba(255,255,255,0.06)_8px)]" />
      </div>

      {/* Main Content Area: Pushed Down Slightly from Top Stripe & Balanced Away from Bottom Edge */}
      <div className="px-5 sm:px-6 pt-4 sm:pt-5 pb-4 flex items-start justify-between gap-3 sm:gap-4 min-h-0 overflow-hidden">
        {/* Left Side: Signature, Emergency Contacts, Disclaimer, Card Number & Logos */}
        <div className="flex-1 flex flex-col justify-start min-w-0">
          {/* 1. Authorised Signature Box (Without "Valid with official school stamp") */}
          <div className="bg-white rounded-xl p-2 border border-slate-200/90 shadow-2xs">
            <span className="text-[6px] sm:text-[6.5px] font-bold text-slate-400 uppercase tracking-wider block leading-none mb-1.5">
              AUTHORISED SIGNATURE
            </span>
            <div
              className="h-6 sm:h-7 rounded-md px-2 flex items-center border border-slate-200 shadow-inner overflow-hidden"
              style={{
                height: '26px',
                background:
                  'repeating-linear-gradient(45deg, #F8FAFC, #F8FAFC 4px, #EDF2F7 4px, #EDF2F7 8px)',
              }}
            >
              {hasSignature ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={resolvedSignature!}
                  crossOrigin="anonymous"
                  alt="Principal Signature"
                  className="max-h-5 sm:max-h-6 object-contain"
                  style={{ maxHeight: '22px', width: 'auto', objectFit: 'contain' }}
                  onError={handleSigImgError}
                />
              ) : (
                <div className="w-full flex items-center justify-between px-0.5">
                  <span className="italic font-serif text-[9px] sm:text-[10px] text-slate-500 select-none tracking-wide">
                    Principal Signature
                  </span>
                  <span className="text-[5.5px] font-mono uppercase text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-200/80">
                    Required
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 2. Emergency Contacts (Close to Principal Signature Section) */}
          <div className="mt-2.5 sm:mt-3">
            <span className="text-[7px] sm:text-[7.5px] font-black text-emerald-700 uppercase tracking-[0.15em] block mb-0.5 leading-none">
              IN CASE OF EMERGENCY
            </span>
            <div className="grid grid-cols-3 gap-1.5 mt-1">
              <div className="min-w-0">
                <span className="text-[6px] sm:text-[6.5px] font-extrabold text-slate-600 uppercase tracking-wider block leading-none">
                  GUARDIAN
                </span>
                <span className="text-[9px] sm:text-[10px] font-black text-slate-900 block truncate leading-tight mt-0.5">
                  {activeGuardian}
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-[6px] sm:text-[6.5px] font-extrabold text-slate-600 uppercase tracking-wider block leading-none">
                  PHONE
                </span>
                <span className="text-[9px] sm:text-[10px] font-mono font-black text-slate-900 block truncate leading-tight mt-0.5">
                  {activePhone}
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-[6px] sm:text-[6.5px] font-extrabold text-slate-600 uppercase tracking-wider block leading-none">
                  HOME STOP
                </span>
                <span className="text-[9px] sm:text-[10px] font-bold text-slate-900 block truncate leading-tight mt-0.5">
                  {activeHomeStop}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Legal Disclaimer ("If found..." Close to Emergency Contacts) */}
          <div className="mt-2 sm:mt-2.5 text-[6.5px] sm:text-[7px] font-bold text-slate-800 leading-tight space-y-0.5">
            <p className="truncate">
              If found, please return or call this number{' '}
              <span className="font-mono font-black text-slate-900">{returnPhone}</span>.
            </p>
            <p className="break-words leading-tight">
              This card is non-transferable and remains the property of {activeSchool}.
            </p>
          </div>

          {/* 4. Card ID Number + School & MyEduRide Logos (Close to "If found" Section) */}
          <div className="mt-2.5 pt-2 border-t border-slate-200/80 flex items-center justify-between gap-2">
            <div>
              <span className="text-[6px] sm:text-[6.5px] font-extrabold text-slate-600 uppercase tracking-wider block leading-none">
                CARD ID NUMBER
              </span>
              <span className="font-mono text-[9.5px] sm:text-[10.5px] font-black text-slate-900 tracking-[0.13em] block leading-none mt-1">
                {displayNumber}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {hasLogo ? (
                <div
                  className="rounded-lg bg-white p-0.5 border border-slate-200 flex items-center justify-center shrink-0 shadow-2xs overflow-hidden"
                  style={{ width: '26px', height: '26px', minWidth: '26px', maxWidth: '26px', minHeight: '26px', maxHeight: '26px' }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={rawLogo!}
                    crossOrigin="anonymous"
                    alt="School Logo"
                    className="w-full h-full object-contain"
                    style={{ width: '100%', height: '100%', maxWidth: '22px', maxHeight: '22px', objectFit: 'contain' }}
                    onError={handleLogoImgError}
                  />
                </div>
              ) : (
                <div className="px-1.5 py-0.5 rounded bg-amber-50 border border-dashed border-amber-300 text-[5.5px] sm:text-[6px] font-bold text-amber-700 tracking-wider uppercase">
                  Add Logo
                </div>
              )}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/eduride_emblem.png"
                  crossOrigin="anonymous"
                  alt="MyEduRide"
                  className="w-4 h-4 sm:w-5 sm:h-5 object-contain shrink-0"
                  style={{ width: '18px', height: '18px' }}
                />
                <div className="min-w-max">
                  <span className="block font-black text-[9px] sm:text-[10px] text-[#0C3B5E] leading-none whitespace-nowrap">
                    MyEdu<span className="text-emerald-600">Ride</span>
                  </span>
                  <span className="block text-[4.5px] sm:text-[5px] font-bold text-slate-500 tracking-wider uppercase leading-none mt-0.5 whitespace-nowrap">
                    STUDENT SAFETY
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: QR Code Shifted Up Close to Principal Signature + Scan to Verify Pulled Up */}
        <div
          className="bg-white rounded-2xl p-1.5 sm:p-2 border border-slate-200/90 shadow-sm flex flex-col items-center justify-start shrink-0 relative overflow-hidden"
          style={{ width: '126px', minWidth: '126px', maxWidth: '126px' }}
        >
          <div className="flex items-center justify-between w-full px-0.5">
            <span className="text-[5.5px] sm:text-[6px] font-mono font-bold text-slate-500 uppercase tracking-wider leading-none">
              GATE SCAN QR
            </span>
            <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <ShieldCheck size={10} className="text-emerald-700 stroke-[2.5]" />
            </div>
          </div>

          {/* QR Code Shifted Up Directly Below Header (Aligned Next to Principal Signature & Emergency Info) */}
          <div
            className="flex items-center justify-center mt-0.5"
            style={{ width: '104px', height: '104px', minWidth: '104px', minHeight: '104px' }}
          >
            {activeQrUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={activeQrUrl}
                crossOrigin="anonymous"
                alt="Gate Scan QR Code"
                className="w-full h-full object-contain"
                style={{ width: '100%', height: '100%', maxWidth: '104px', maxHeight: '104px', objectFit: 'contain' }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Scan to Verify Pill Pulled Up Directly Below QR Code */}
          <div className="w-full text-center mt-1">
            <span className="block text-[5.5px] sm:text-[6px] font-black text-emerald-800 tracking-widest uppercase bg-emerald-50 border border-emerald-200 rounded py-0.5 leading-none">
              SCAN TO VERIFY
            </span>
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
      <div id="atm-card-print-front" className="id-card-export-front" style={{ width: '440px', height: '277.4px', marginBottom: '20px' }}>
        {frontCardJsx}
      </div>
      <div id="atm-card-print-back" className="id-card-export-back" style={{ width: '440px', height: '277.4px' }}>
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
            <div className="w-full id-card-export-front" id="atm-card-onscreen-front">{frontCardJsx}</div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1 text-xs font-bold text-slate-300">
              <span>Card Back (Enlarged QR &amp; Contacts)</span>
              <span className="text-[10px] text-emerald-400 font-mono">Gate &amp; Escort Scannable</span>
            </div>
            <div className="w-full id-card-export-back" id="atm-card-onscreen-back">{backCardJsx}</div>
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

  // 3. BACK ONLY VIEW (SHOWING ENLARGED QR)
  if (viewMode === 'back') {
    return (
      <div className="w-full max-w-[440px] mx-auto space-y-2">
        {printSourceJsx}
        <div className="flex items-center justify-between px-1 text-xs font-bold text-slate-300">
          <span>Card Back View (Enlarged QR &amp; Emergency Contacts)</span>
          <span className="text-[10px] text-emerald-400 font-mono">High-Speed Scan Target</span>
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
