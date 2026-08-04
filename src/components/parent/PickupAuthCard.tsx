'use client';

import { ShieldCheck, UserCheck, Clock, UserX, ChevronRight } from 'lucide-react';
import { photoSrc } from '@/lib/photo';

interface PickupAuthCardProps {
  personName?: string;
  relationship?: string;
  photoUrl?: string | null;
  isVerified?: boolean;
  pickupTime?: string;
  onOpenPickupManager: () => void;
}

export default function PickupAuthCard({
  personName = 'John Okafor',
  relationship = 'Uncle',
  photoUrl,
  isVerified = true,
  pickupTime = '2:45 PM',
  onOpenPickupManager,
}: PickupAuthCardProps) {
  const hasPerson = Boolean(personName && personName.trim());

  return (
    <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between h-full hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">
          Pickup Authorization
        </h2>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          Gate Protocol
        </span>
      </div>

      {/* Main Content */}
      <div className="my-3">
        {hasPerson ? (
          <div className="bg-slate-50/80 rounded-2xl p-3.5 border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-800 flex items-center justify-center font-bold text-sm overflow-hidden shrink-0">
                {photoUrl ? (
                  <img
                    src={photoSrc(photoUrl) || undefined}
                    alt={personName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  personName.charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <p className="text-xs font-extrabold text-slate-900 leading-tight">{personName}</p>
                <p className="text-[10px] font-medium text-slate-500">{relationship}</p>
              </div>
            </div>

            {isVerified && (
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                Verified
              </span>
            )}
          </div>
        ) : (
          <div className="bg-slate-50/60 rounded-2xl p-4 border border-dashed border-slate-200 text-center">
            <UserX className="w-6 h-6 text-slate-300 mx-auto mb-1" />
            <p className="text-xs font-bold text-slate-600">No Authorized Guardian Set</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Add authorized persons who can pick up your child.
            </p>
          </div>
        )}

        {/* Pickup Time */}
        <div className="flex items-center justify-between mt-3 text-xs px-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Pickup Time
          </span>
          <span className="font-extrabold text-slate-900 font-mono bg-slate-100 px-2 py-0.5 rounded-md">
            {hasPerson ? pickupTime : '--:--'}
          </span>
        </div>
      </div>

      {/* Action Button */}
      <button
        type="button"
        onClick={onOpenPickupManager}
        className="w-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-2xs hover:border-slate-300"
      >
        <span>{hasPerson ? 'Change Pickup Person' : 'Authorize Pickup Person'}</span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
      </button>
    </div>
  );
}
