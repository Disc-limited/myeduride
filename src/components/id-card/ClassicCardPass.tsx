'use client';

import React, { useState, useEffect } from 'react';
import { ShieldCheck, RotateCw } from 'lucide-react';
import StudentAvatar from '@/components/shared/StudentAvatar';
import Barcode from './Barcode';
import { photoSrc } from '@/lib/photo';

export interface ClassicCardPassProps {
  cardType?: 'student' | 'staff' | 'parent';
  cardholderName: string;
  idNumber: string;
  photoUrl?: string | null;
  qrUrl?: string | null;
  qrPayload?: string;
  schoolName?: string;
  schoolAddress?: string;
  schoolLandmark?: string;
  schoolPhone?: string;
  logoUrl?: string | null;
  classNameOrRole?: string;
  gradeSection?: string;
  routeCode?: string;
  signatureUrl?: string | null;
  primaryColor?: string;
  accentColor?: string;
  viewMode?: '3d' | 'front' | 'back' | 'both';
  showFlipButton?: boolean;
}

export default function ClassicCardPass({
  cardType = 'student',
  cardholderName,
  idNumber,
  photoUrl,
  qrUrl,
  qrPayload,
  schoolName = 'MYEDURIDE PARTNER SCHOOL',
  schoolAddress,
  schoolLandmark,
  schoolPhone = '+234 800 000 0001',
  logoUrl,
  classNameOrRole,
  gradeSection,
  routeCode,
  signatureUrl,
  primaryColor = '#0C2340',
  accentColor = '#28A745',
  viewMode = 'both',
  showFlipButton = true,
}: ClassicCardPassProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [sigError, setSigError] = useState(false);
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    setSigError(false);
  }, [signatureUrl]);

  useEffect(() => {
    setLogoError(false);
  }, [logoUrl]);

  const resolvedSignature = signatureUrl ? photoSrc(signatureUrl) : null;
  const hasSignature = !!resolvedSignature && !sigError;

  const displayRoleOrClass = gradeSection || classNameOrRole || (cardType === 'staff' ? 'STAFF MEMBER' : 'Class Assigned');
  const roleBadge = cardType === 'staff' ? (classNameOrRole || 'STAFF ID').toUpperCase() : 'STUDENT ID';
  const resolvedAddress = schoolAddress || 'Student Safety Platform Campus';

  // Format ID with spaces
  const cleanId = (idNumber || '260482130010').replace(/\s+/g, '');
  const formattedId = cleanId.match(/.{1,4}/g)?.join(' ') || idNumber;

  // Resolved School Logo (null if not available, so placeholder can indicate "Add School Logo")
  const rawLogo = logoUrl ? photoSrc(logoUrl) : null;
  const resolvedLogo = rawLogo;
  const hasLogo = Boolean(rawLogo && !logoError);

  /* ========================================================================= */
  /* FRONT CARD JSX (CLASSIC CR80 PRINT LAYOUT)                                */
  /* ========================================================================= */
  const frontCardJsx = (
    <div
      className="w-full h-full rounded-2xl p-4 text-white flex flex-col justify-between shadow-xl relative overflow-hidden select-none border border-white/20"
      style={{
        backgroundColor: primaryColor,
        aspectRatio: '1.586 / 1',
      }}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-white/20 pb-2.5 gap-2">
        <div className="flex items-center gap-2.5 max-w-[74%] min-w-0">
          {hasLogo ? (
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white p-1 shadow-md border border-white/40 shrink-0 flex items-center justify-center overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={rawLogo!}
                alt={schoolName}
                className="w-full h-full object-contain"
                onError={() => setLogoError(true)}
              />
            </div>
          ) : (
            <div
              className="px-2 py-1 rounded-xl bg-white/15 border border-dashed border-amber-300/80 text-amber-200 shrink-0 flex items-center gap-1.5 shadow-xs"
              title="No school logo available - Add school logo in School Settings"
            >
              <span className="text-[7.5px] font-bold uppercase tracking-wider text-amber-200 whitespace-nowrap">
                Add School Logo
              </span>
            </div>
          )}
          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-black tracking-wide uppercase truncate text-white leading-tight">
              {schoolName}
            </h4>
            <p className="text-[8.5px] sm:text-[9.5px] text-slate-200/90 truncate font-medium leading-tight mt-0.5">
              📍 {resolvedAddress}
            </p>
          </div>
        </div>

        <div className="bg-white text-slate-900 px-2.5 py-1 rounded-md font-bold text-[9px] sm:text-[10px] uppercase tracking-wider shrink-0 shadow-xs">
          {roleBadge}
        </div>
      </div>

      {/* Main Row: Photo, Details, QR */}
      <div className="flex items-center justify-between gap-2.5 my-auto py-1">
        {/* Photo Box - Sized cleanly and prominently */}
        <div className="w-[76px] h-[96px] sm:w-[86px] sm:h-[110px] bg-white rounded-2xl p-1 shadow-lg shrink-0 border border-white/40 overflow-hidden flex items-center justify-center">
          {photoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={photoSrc(photoUrl) || ''}
              alt={cardholderName}
              className="w-full h-full object-cover rounded-xl"
            />
          ) : (
            <StudentAvatar
              photoUrl={photoUrl}
              firstName={cardholderName.split(' ')[0] || 'User'}
              lastName={cardholderName.split(' ')[1] || ''}
              size="lg"
              accentColor={primaryColor}
              className="!w-full !h-full !rounded-xl object-cover"
            />
          )}
        </div>

        {/* Details Column */}
        <div className="flex-1 min-w-0 space-y-1 sm:space-y-1.5 text-left px-1">
          <div>
            <span className="text-[7.5px] sm:text-[8px] font-bold text-sky-200 uppercase tracking-wider block">
              FULL NAME
            </span>
            <p className="text-xs sm:text-sm font-black text-white uppercase tracking-tight truncate leading-normal py-0.5">
              {cardholderName}
            </p>
          </div>

          <div>
            <span className="text-[7.5px] sm:text-[8px] font-bold text-sky-200 uppercase tracking-wider block">
              ID NUMBER
            </span>
            <p className="text-xs sm:text-sm font-mono font-black text-emerald-300 tracking-wider leading-normal py-0.5">
              {formattedId}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <span className="text-[7.5px] sm:text-[8px] font-bold text-sky-200 uppercase tracking-wider block">
                {cardType === 'staff' ? 'ROLE / POSITION' : 'CLASS'}
              </span>
              <p className="text-[10px] sm:text-xs font-bold text-slate-100 uppercase truncate leading-normal py-0.5">
                {displayRoleOrClass}
              </p>
            </div>
          </div>
        </div>

        {/* QR Code - Enlarged Gate Scannable QR */}
        <div className="flex flex-col items-center shrink-0">
          <div className="w-[84px] h-[84px] sm:w-[98px] sm:h-[98px] bg-white rounded-2xl p-1.5 shadow-lg flex items-center justify-center border border-white/40 overflow-hidden shrink-0">
            {qrUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={qrUrl} alt="Gate QR" className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full bg-slate-900 rounded-xl flex items-center justify-center text-white text-[9px] font-mono">
                QR CODE
              </div>
            )}
          </div>
          <span className="text-[7.5px] sm:text-[8.5px] font-bold text-slate-200 mt-1 tracking-wider">
            Gate Scannable
          </span>
        </div>
      </div>

      {/* Footer Verification Bar */}
      <div className="flex items-center justify-between border-t border-white/20 pt-1 text-[8px] font-mono text-sky-200">
        <span>DISCL Gate Verified</span>
        <span>MyEduRide Protection Network</span>
      </div>
    </div>
  );

  /* ========================================================================= */
  /* BACK CARD JSX (CLASSIC CR80 PRINT LAYOUT)                                 */
  /* ========================================================================= */
  const backCardJsx = (
    <div
      className="w-full h-full rounded-2xl bg-white text-slate-900 p-3 sm:p-4 flex flex-col justify-between shadow-xl relative overflow-hidden select-none border border-slate-200"
      style={{
        aspectRatio: '1.586 / 1',
      }}
    >
      {/* Top Banner */}
      <div
        className="px-3 py-1.5 -mx-3 -mt-3 sm:-mx-4 sm:-mt-4 rounded-t-xl text-white flex items-center justify-between"
        style={{ backgroundColor: primaryColor }}
      >
        <div className="flex items-center gap-2 max-w-[75%] min-w-0">
          {hasLogo ? (
            <div className="w-5 h-5 rounded-md bg-white p-0.5 shrink-0 flex items-center justify-center overflow-hidden shadow-2xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={rawLogo!}
                alt="School Logo"
                className="w-full h-full object-contain"
                onError={() => setLogoError(true)}
              />
            </div>
          ) : (
            <span className="text-[7px] font-bold text-amber-200 bg-black/25 px-1.5 py-0.5 rounded border border-dashed border-amber-300/60 uppercase shrink-0">
              Add School Logo
            </span>
          )}
          <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider truncate">
            {schoolName}
          </span>
        </div>
        <span className="text-[9px] font-semibold text-emerald-300 shrink-0">
          Classic Print Pass
        </span>
      </div>

      {/* Campus Address & Landmark */}
      <div className="text-left mt-2 space-y-0.5">
        <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 block">
          CAMPUS ADDRESS &amp; LOCATION
        </span>
        <p className="text-[10px] sm:text-[11px] font-bold text-slate-800 leading-normal py-0.5">
          {resolvedAddress}
        </p>
        {schoolLandmark && (
          <p className="text-[9px] text-emerald-700 font-semibold truncate leading-normal py-0.5">
            📍 Landmark: {schoolLandmark}
          </p>
        )}
      </div>

      {/* Dual Signature & Return Box */}
      <div className="grid grid-cols-2 gap-2 my-auto">
        {/* Signature Box */}
        <div className="border border-slate-200 rounded-xl p-2 bg-slate-50 flex flex-col justify-between min-h-[46px]">
          <span className="text-[7.5px] font-bold uppercase tracking-wider text-slate-500 block">
            AUTHORISED SIGNATURE
          </span>
          <div className="flex items-center justify-center py-0.5">
            {hasSignature ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={resolvedSignature!}
                alt="Principal Signature"
                className="max-h-7 object-contain"
                onError={() => setSigError(true)}
              />
            ) : (
              <div className="w-full flex items-center justify-between px-1">
                <span className="font-serif italic text-xs text-slate-500 select-none">
                  Principal Signature
                </span>
                <span className="text-[6.5px] font-mono text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">
                  Required
                </span>
              </div>
            )}
          </div>
          <span className="text-[7px] text-slate-400 text-center block">Official Stamp</span>
        </div>

        {/* If Found Box */}
        <div className="border border-slate-200 rounded-xl p-2 bg-slate-50 flex flex-col justify-between min-h-[46px]">
          <span className="text-[7.5px] font-bold uppercase tracking-wider text-slate-500 block">
            IF FOUND
          </span>
          <p className="text-[8px] text-slate-600 leading-tight">
            Please return to the campus address or call the safety hotline.
          </p>
          <span className="text-[7.5px] font-mono font-bold text-emerald-700 truncate">
            {schoolPhone}
          </span>
        </div>
      </div>

      {/* Bold Barcode for Gate & Escort Quick Scan */}
      <div className="border-t border-slate-100 pt-1 flex items-center justify-between gap-3">
        <div className="flex-1 max-w-[62%]">
          <Barcode value={cleanId} height={32} className="w-full h-7" />
          <p className="text-[8px] font-mono font-bold text-slate-700 tracking-wider text-center mt-0.5 leading-normal py-0.5">
            {formattedId}
          </p>
        </div>
        <div className="text-right space-y-0.5">
          <span className="text-[8px] font-bold text-slate-600 font-mono block">
            HOTLINE: 0814 521 7045
          </span>
          <span className="text-[7px] text-slate-400 block font-medium">
            Property of the school
          </span>
        </div>
      </div>
    </div>
  );

  // Hidden high-resolution CR80 print source (440px x 277.4px)
  const printSourceJsx = (
    <div
      id="classic-card-print-source"
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
      <div id="classic-card-print-front" style={{ width: '440px', height: '277.4px', marginBottom: '20px' }}>
        {frontCardJsx}
      </div>
      <div id="classic-card-print-back" style={{ width: '440px', height: '277.4px' }}>
        {backCardJsx}
      </div>
    </div>
  );

  /* ========================================================================= */
  /* VIEW MODES                                                                */
  /* ========================================================================= */

  // 1. DUAL VIEW (FRONT & BACK SIDE-BY-SIDE)
  if (viewMode === 'both') {
    return (
      <div className="w-full max-w-4xl mx-auto space-y-4">
        {printSourceJsx}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 items-center justify-center">
          {/* Front Card */}
          <div className="w-full space-y-1.5">
            <div className="flex items-center justify-between px-1 text-xs font-bold text-slate-300">
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={13} className="text-emerald-400" />
                <span>Classic Print Front</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">CR80 (85.6 × 54mm)</span>
            </div>
            <div className="w-full" id="classic-card-onscreen-front">{frontCardJsx}</div>
          </div>

          {/* Back Card */}
          <div className="w-full space-y-1.5">
            <div className="flex items-center justify-between px-1 text-xs font-bold text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span>Classic Print Back (Bold Barcode)</span>
              </span>
              <span className="text-[10px] text-emerald-400 font-mono font-bold">Quick Scan</span>
            </div>
            <div className="w-full" id="classic-card-onscreen-back">{backCardJsx}</div>
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
          <span>Classic Front View</span>
          <span className="text-[10px] text-slate-400 font-mono">Standard CR80</span>
        </div>
        <div className="w-full">{frontCardJsx}</div>
      </div>
    );
  }

  // 3. BACK ONLY VIEW
  if (viewMode === 'back') {
    return (
      <div className="w-full max-w-[440px] mx-auto space-y-2">
        {printSourceJsx}
        <div className="flex items-center justify-between px-1 text-xs font-bold text-slate-300">
          <span>Classic Back View (Bold Barcode)</span>
          <span className="text-[10px] text-emerald-400 font-mono">High-Contrast Scan Base</span>
        </div>
        <div className="w-full">{backCardJsx}</div>
      </div>
    );
  }

  // 4. INTERACTIVE 3D FLIP PASS VIEW
  return (
    <div className="w-full max-w-[440px] mx-auto select-none font-sans">
      {printSourceJsx}
      <div
        className="w-full relative cursor-pointer group"
        style={{
          perspective: '1200px',
          aspectRatio: '1.586 / 1',
        }}
        onClick={() => setIsFlipped((prev) => !prev)}
      >
        <div
          className="w-full h-full relative transition-transform duration-700 ease-out"
          style={{
            transformStyle: 'preserve-3d',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}
        >
          <div
            className="absolute inset-0 w-full h-full"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
            }}
          >
            {frontCardJsx}
          </div>

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

      {showFlipButton && (
        <div className="mt-3 flex items-center justify-between px-1 text-xs">
          <button
            type="button"
            onClick={() => setIsFlipped((prev) => !prev)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-all cursor-pointer shadow-2xs text-[11px]"
          >
            <RotateCw size={13} className="text-slate-600" />
            <span>{isFlipped ? 'Flip to Front View' : 'Flip to Barcode (Back)'}</span>
          </button>
          <span className="text-[10px] text-slate-400 font-medium">Tap card to flip</span>
        </div>
      )}
    </div>
  );
}
