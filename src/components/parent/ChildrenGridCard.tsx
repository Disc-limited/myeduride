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
}

interface ChildrenGridCardProps {
  childrenList: ChildStudent[];
  onOpenChildProfile: (childId: string) => void;
  onPinHouseLocation?: (child: ChildStudent) => void;
}

export default function ChildrenGridCard({
  childrenList = [],
  onOpenChildProfile,
  onPinHouseLocation,
}: ChildrenGridCardProps) {
  const displayKids: ChildStudent[] =
    childrenList && childrenList.length > 0
      ? childrenList
      : [
          {
            id: 'demo-david',
            first_name: 'David',
            last_name: 'James',
            present_today: true,
            class: { name: 'Primary 4' },
            escort_name: 'John Okafor',
            route_name: 'Route A',
            vehicle_model: 'Toyota Hiace',
          },
          {
            id: 'demo-esther',
            first_name: 'Esther',
            last_name: 'James',
            present_today: true,
            class: { name: 'Primary 2' },
            escort_name: 'Grace Bello',
            route_name: 'Route B',
            vehicle_model: 'Honda Pilot',
          },
        ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">My Children</h2>
        <span className="text-xs font-bold text-slate-400">{displayKids.length} Registered</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {displayKids.map((child) => {
          const fullName = `${child.first_name || 'Child'} ${child.last_name || ''}`.trim();
          const classNameStr = child.class?.name || 'Class not set';
          const isPresent = Boolean(child.present_today);
          const isReady = Boolean(child.ready_for_pickup);
          const isDelayed = Boolean(child.in_extra_lesson);
          const escort = child.escort_name || 'John Okafor';
          const route = child.route_name || 'Route A';
          const vehicle = child.vehicle_model || 'Toyota Hiace';

          return (
            <div
              key={child.id}
              className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
            >
              {/* Top Row: Avatar, Name, Class & Clean Status Pill */}
              <div className="flex items-start justify-between gap-2.5">
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

                {/* Status Badge - Pickup state & Attendance */}
                <div className="shrink-0 flex flex-col items-end gap-1">
                  {isReady ? (
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
                  {isDelayed && child.extra_lesson_reason && (
                    <span className="text-[9px] font-semibold text-amber-700 max-w-[140px] truncate text-right">
                      Reason: {child.extra_lesson_reason}
                    </span>
                  )}
                </div>
              </div>

              {/* Clean 4-Metric Responsive Sub-Grid with Hover Tooltip Titles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-4 bg-slate-50/80 p-3 rounded-2xl border border-slate-100 text-left text-[11px]">
                <div className="min-w-0" title={`Attendance Status: ${isPresent ? 'Present' : 'Absent'}`}>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block truncate">
                    Attendance
                  </span>
                  <p
                    className={`font-extrabold mt-0.5 flex items-center gap-1 truncate ${
                      isPresent ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {isPresent ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    )}
                    <span>{isPresent ? 'Present' : 'Absent'}</span>
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

              {/* Action Link Button */}
              <button
                type="button"
                onClick={() => onOpenChildProfile(child.id)}
                title={`Click to view complete profile and attendance record of ${fullName}`}
                className="w-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-2xs hover:border-slate-300"
              >
                <span>View Full Profile</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
