'use client';

import { CheckCircle2, XCircle, ArrowRight, UserX, Clock } from 'lucide-react';
import StudentAvatar from '@/components/shared/StudentAvatar';

export interface ChildStudent {
  id: string;
  first_name: string;
  last_name: string;
  photo_url?: string | null;
  present_today?: boolean;
  arrival_status?: string | null;
  arrival_time?: string | null;
  ready_for_pickup?: boolean;
  dismissal_status?: string | null;
  in_extra_lesson?: boolean;
  extra_lesson_end_time?: string | null;
  extra_lesson_reason?: string | null;
  is_safe_at_home?: boolean;
  afternoon_dropped_off?: boolean;
  on_afternoon_transit?: boolean;
  afternoon_picked_up?: boolean;
  safe_at_home_time?: string | null;
  today_status_label?: string | null;
  school?: { name?: string; primary_color?: string };
  class?: { name?: string; grade?: string };
  escort_name?: string;
  route_name?: string;
  vehicle_model?: string;
  house_address?: string | null;
  house_lat?: number | null;
  house_lng?: number | null;
  house_landmark?: string | null;
  house_notes?: string | null;
  is_canceled_today?: boolean;
  cancellation_reason?: string | null;
  canceled_at?: string | null;
}

interface ChildrenGridCardProps {
  childrenList: ChildStudent[];
  onOpenChildProfile: (childId: string) => void;
  onPinHouseLocation?: (child: ChildStudent) => void;
  onCancelTrip?: (child: ChildStudent) => void;
}

export default function ChildrenGridCard({
  childrenList = [],
  onOpenChildProfile,
  onPinHouseLocation,
  onCancelTrip,
}: ChildrenGridCardProps) {
  const displayKids: ChildStudent[] = childrenList && childrenList.length > 0 ? childrenList : [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">My Children</h2>
        <span className="text-xs font-bold text-slate-400">{displayKids.length} Registered</span>
      </div>

      {displayKids.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm text-center">
          <div className="w-14 h-14 bg-slate-50 border border-slate-200 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <UserX className="w-7 h-7" />
          </div>
          <h3 className="font-extrabold text-slate-800 text-sm">No Children Registered</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            You do not have any active children linked to your parent account yet. Contact your school administrator to link your ward.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {displayKids.map((child) => {
            const isSafeAtHome = Boolean(child.is_safe_at_home || child.afternoon_dropped_off);
            const isOnAfternoonTransit = Boolean(child.on_afternoon_transit);
            const isPresent = child.present_today || (child as any).attendance_status === 'present';
            const isReady = child.ready_for_pickup && !isSafeAtHome && !isOnAfternoonTransit;
            const isDelayed = child.in_extra_lesson && !isSafeAtHome && !isOnAfternoonTransit;
            const fullName = `${child.first_name || ''} ${child.last_name || ''}`.trim() || 'Student';
            const classNameStr = child.class?.name || (child as any).class_name || 'Standard';
            const escort = child.escort_name || 'Assigned Driver';
            const route = child.route_name || 'Main Route';
            const vehicle = child.vehicle_model || 'School Bus';

            return (
              <div
                key={child.id}
                className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all group"
              >
                {/* Header row: Avatar + Identity + Status Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <StudentAvatar
                      photoUrl={child.photo_url}
                      firstName={child.first_name}
                      lastName={child.last_name}
                      size="md"
                      accentColor={child.school?.primary_color || '#059669'}
                    />
                    <div className="min-w-0 flex-1">
                      <h3
                        className="text-sm font-extrabold text-slate-900 leading-tight truncate"
                        title={`Student: ${fullName}`}
                      >
                        {fullName}
                      </h3>
                      <p
                        className="text-xs font-semibold text-slate-400 mt-0.5 truncate"
                        title={`Class Grade: ${classNameStr}`}
                      >
                        {classNameStr}
                      </p>
                    </div>
                  </div>

                  {/* Status Badge - Accurate Lifecycle (Safe at Home -> Transit -> Ready -> At School -> Canceled) */}
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    {child.is_canceled_today ? (
                      <span
                        title={`Trip canceled by parent today: ${child.cancellation_reason || 'Absent'}`}
                        className="text-[10px] font-extrabold bg-rose-50 text-rose-800 border border-rose-300 px-2.5 py-1 rounded-full flex items-center gap-1.5 whitespace-nowrap shadow-xs"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-600 shrink-0" />
                        🚫 Not Going Today
                      </span>
                    ) : isSafeAtHome ? (
                      <span
                        title="Child has safely arrived and been dropped off at home"
                        className="text-[10px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded-full flex items-center gap-1.5 whitespace-nowrap shadow-xs"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                        🏡 Safe at Home
                      </span>
                    ) : isOnAfternoonTransit ? (
                      <span
                        title="Child has departed school with escort and is en-route home"
                        className="text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-300 px-2.5 py-1 rounded-full flex items-center gap-1.5 whitespace-nowrap animate-pulse shadow-xs"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0" />
                        🚐 En Route Home
                      </span>
                    ) : isReady ? (
                      <span
                        title="Child has been marked ready for pickup by teacher and is waiting at gate"
                        className="text-[10px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded-full flex items-center gap-1.5 whitespace-nowrap animate-pulse"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                        🚗 Ready for Pickup
                      </span>
                    ) : isDelayed ? (
                      <span
                        title={`Release time extended ${child.extra_lesson_end_time ? `until ${child.extra_lesson_end_time}` : ''}. Reason: ${child.extra_lesson_reason || 'Teacher notice'}`}
                        className="text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-300 px-2.5 py-1 rounded-full flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-600 shrink-0" />
                        ⏳ Extended {child.extra_lesson_end_time ? `until ${child.extra_lesson_end_time}` : ''}
                      </span>
                    ) : isPresent ? (
                      <span
                        title="Child has safely checked in at school today"
                        className="text-[10px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                        At School
                      </span>
                    ) : (
                      <span
                        title="Child has not checked in at school yet today"
                        className="text-[10px] font-extrabold bg-slate-50 text-slate-600 border border-slate-200 px-2.5 py-1 rounded-full flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                        Not Checked In
                      </span>
                    )}
                    {child.is_canceled_today && child.cancellation_reason && (
                      <span className="text-[9px] font-bold text-rose-700 max-w-[140px] truncate text-right">
                        Reason: {child.cancellation_reason}
                      </span>
                    )}
                    {isDelayed && child.extra_lesson_reason && !child.is_canceled_today && (
                      <span className="text-[9px] font-semibold text-amber-700 max-w-[140px] truncate text-right">
                        Reason: {child.extra_lesson_reason}
                      </span>
                    )}
                  </div>
                </div>

                {/* Clean 4-Metric Responsive Sub-Grid with Hover Tooltip Titles */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-4 bg-slate-50/80 p-3 rounded-2xl border border-slate-100 text-left text-[11px]">
                  <div className="min-w-0" title={`Current Status: ${isSafeAtHome ? 'Safe at Home' : isOnAfternoonTransit ? 'En Route Home' : isPresent ? 'At School' : 'Absent'}`}>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block truncate">
                      Status
                    </span>
                    <p
                      className={`font-extrabold mt-0.5 flex items-center gap-1 truncate ${
                        isSafeAtHome
                          ? 'text-emerald-700'
                          : isOnAfternoonTransit
                            ? 'text-amber-700'
                            : isPresent
                              ? 'text-blue-700'
                              : 'text-slate-600'
                      }`}
                    >
                      {isSafeAtHome ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : isPresent ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      )}
                      <span>
                        {isSafeAtHome
                          ? 'Safe at Home'
                          : isOnAfternoonTransit
                            ? 'In Transit'
                            : isPresent
                              ? 'At School'
                              : 'Absent'}
                      </span>
                    </p>
                  </div>

                  <div className="min-w-0" title={`Assigned Escort: ${escort}`}>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block truncate">
                      Escort
                    </span>
                    <p className="font-bold text-slate-800 truncate mt-0.5">{escort}</p>
                  </div>

                <div className="min-w-0" title={`Assigned Bus Route: ${route}`}>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block truncate">
                    Route
                  </span>
                  <p className="font-bold text-slate-800 truncate mt-0.5">{route}</p>
                </div>

                <div className="min-w-0" title={`Assigned Shuttle Vehicle: ${vehicle}`}>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block truncate">
                    Vehicle
                  </span>
                  <p className="font-bold text-slate-800 truncate mt-0.5">{vehicle}</p>
                </div>
              </div>

              {/* House Location Pinning Status & Direct Action */}
              <div className="mb-3 p-2.5 rounded-2xl border flex items-center justify-between gap-2 text-xs transition-all bg-slate-50 border-slate-200">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                    child.house_lat && child.house_lng ? 'bg-teal-100 text-teal-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    📍
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900 truncate text-[11px]">
                      {child.house_lat && child.house_lng ? (
                        <span>Home: {child.house_address || 'GPS Coordinates Pinned'}</span>
                      ) : (
                        <span className="text-amber-800">No House Pin Set</span>
                      )}
                    </p>
                    <span className="text-[10px] text-slate-500 block truncate">
                      {child.house_lat && child.house_lng
                        ? `${child.house_landmark ? `Landmark: ${child.house_landmark} · ` : ''}Visible to Bus & Escort`
                        : 'Pin to show doorstep on school escort route'}
                    </span>
                  </div>
                </div>

                {onPinHouseLocation && (
                  <button
                    type="button"
                    onClick={() => onPinHouseLocation(child)}
                    className={`px-3 py-1.5 rounded-xl font-bold text-[11px] shrink-0 transition-all cursor-pointer ${
                      child.house_lat && child.house_lng
                        ? 'bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100'
                        : 'bg-teal-700 text-white hover:bg-teal-800 shadow-xs'
                    }`}
                  >
                    {child.house_lat && child.house_lng ? 'Edit Pin' : 'Pin House'}
                  </button>
                )}
              </div>

              {/* Action Buttons: Cancel Trip + View Profile */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={child.is_canceled_today}
                  onClick={() => onCancelTrip?.(child)}
                  title={child.is_canceled_today ? 'Trip is already marked as canceled today' : `Click if ${fullName} is not going to school today`}
                  className={`w-full text-xs font-extrabold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    child.is_canceled_today
                      ? 'bg-rose-50 text-rose-800 border border-rose-200 opacity-80 cursor-not-allowed'
                      : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 shadow-2xs hover:border-rose-300'
                  }`}
                >
                  <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span>{child.is_canceled_today ? 'Trip Canceled Today' : '🚫 Not Going Today'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenChildProfile(child.id)}
                  title={`Click to view complete profile and attendance record of ${fullName}`}
                  className="w-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-2xs hover:border-slate-300 cursor-pointer"
                >
                  <span>View Full Profile</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
