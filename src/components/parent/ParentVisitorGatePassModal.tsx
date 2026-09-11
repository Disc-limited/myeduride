'use client';

import {
  X,
  ShieldCheck,
  CreditCard,
  Lock,
  Phone,
  User,
  Users,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Car,
  AlertTriangle,
  QrCode,
  Sparkles,
} from 'lucide-react';
import StudentAvatar from '@/components/shared/StudentAvatar';

export interface LinkedChildInfo {
  id: string;
  first_name: string;
  last_name: string;
  student_id?: string;
  photo_url?: string | null;
  class_name?: string;
  class?: { name?: string };
  present_today?: boolean;
  ready_for_pickup?: boolean;
  in_extra_lesson?: boolean;
  extra_lesson_end_time?: string | null;
}

interface ParentVisitorGatePassModalProps {
  isOpen: boolean;
  onClose: () => void;
  parent: {
    id: string;
    full_name: string;
    phone?: string;
    photo_url?: string | null;
  };
  schoolName?: string;
  childrenList: LinkedChildInfo[];
}

export default function ParentVisitorGatePassModal({
  isOpen,
  onClose,
  parent,
  schoolName = 'MyEduRide Partner Campus',
  childrenList = [],
}: ParentVisitorGatePassModalProps) {
  if (!isOpen) return null;

  const parentId = parent?.id || '';
  const idNumber = `PAR-${parentId.slice(0, 8).toUpperCase()}`;
  const qrData = `MYEDURIDE:PARENT:${parentId}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[95vh]">
        {/* Header with Title and Close */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-900 via-[#0d3326] to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-md">
              <ShieldCheck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black tracking-tight text-white">
                  Parent Digital Visitor &amp; Gate Pass
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[9px] font-black uppercase tracking-wider">
                  Live Mobile Pass
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-medium">
                Official Campus Identity &amp; Child Release Token
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Technical Restriction Banner: Non-Printable & Mobile Use Only */}
        <div className="bg-amber-500/10 border-b border-amber-200/80 p-3 sm:px-5 flex items-start gap-2.5 text-left">
          <Lock size={16} className="text-amber-700 shrink-0 mt-0.5" />
          <div className="text-[11px] leading-tight text-amber-950">
            <span className="font-black text-amber-800 uppercase tracking-wide block mb-0.5">
              ⚠️ Non-Printable Digital Pass — On-Screen Verification Only
            </span>
            <span className="text-slate-600 font-medium">
              This pass cannot be exported or printed. Present this mobile screen to the gate officer upon arrival at school to sign in or out for child drop-off, pickup, or campus visitation.
            </span>
          </div>
        </div>

        {/* Scrollable Pass Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {/* Main Card View */}
          <div className="rounded-3xl border-2 border-emerald-800/20 bg-gradient-to-b from-emerald-50/50 via-white to-slate-50 p-4 sm:p-5 shadow-sm space-y-4">
            {/* School Campus & Identification Row */}
            <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-emerald-800" />
                <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  {schoolName}
                </span>
              </div>
              <span className="text-[10px] font-mono font-black text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-lg">
                {idNumber}
              </span>
            </div>

            {/* Parent Identity Profile */}
            <div className="flex items-center gap-3.5">
              <StudentAvatar
                photoUrl={parent?.photo_url}
                firstName={parent?.full_name?.split(' ')[0] || 'Parent'}
                lastName={parent?.full_name?.split(' ')[1] || 'Guardian'}
                size="lg"
                accentColor="#047857"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h4 className="text-base font-black text-slate-900 truncate">
                    {parent?.full_name || 'Authorized Parent'}
                  </h4>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-extrabold text-[10px] flex items-center gap-1">
                    <CheckCircle2 size={10} />
                    Verified Parent
                  </span>
                </div>
                {parent?.phone && (
                  <p className="text-xs text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
                    <Phone size={11} className="text-slate-400" />
                    <span>{parent.phone}</span>
                  </p>
                )}
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">
                  DISCL Safety Clearance: Level 1 Guardian
                </p>
              </div>
            </div>

            {/* Approved Gate Actions Badges */}
            <div className="bg-white rounded-2xl p-3 border border-slate-200/80 space-y-1.5">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                Authorized Gate Permissions
              </span>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900">
                  <span className="text-[11px] font-black block">🎒 Drop-off</span>
                  <span className="text-[9px] text-emerald-700 font-medium">Morning Check-in</span>
                </div>
                <div className="p-2 rounded-xl bg-teal-50 border border-teal-200 text-teal-900">
                  <span className="text-[11px] font-black block">🚗 Pickup</span>
                  <span className="text-[9px] text-teal-700 font-medium">Afternoon Release</span>
                </div>
                <div className="p-2 rounded-xl bg-purple-50 border border-purple-200 text-purple-900">
                  <span className="text-[11px] font-black block">🏛️ Visit</span>
                  <span className="text-[9px] text-purple-700 font-medium">Staff Consultation</span>
                </div>
              </div>
            </div>

            {/* High Contrast Scannable Gate QR Code */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 text-center flex flex-col items-center justify-center space-y-2">
              <div className="p-2 bg-white rounded-2xl border-2 border-emerald-500/40 shadow-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrUrl}
                  alt="Parent Digital Gate Pass QR"
                  className="w-36 h-36 sm:w-40 sm:h-40 object-contain rounded-xl"
                />
              </div>
              <div>
                <p className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Gate Officer Scan Token
                </p>
                <p className="text-[11px] font-mono text-emerald-800 font-bold mt-0.5">
                  {idNumber}
                </p>
                <p className="text-[10px] text-slate-400 mt-1 max-w-xs">
                  Scan with the gate terminal camera to instantly record arrivals, process child release, or log official school visit purpose.
                </p>
              </div>
            </div>

            {/* Linked Children Section */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
                  <Users size={14} className="text-emerald-700" />
                  Attached Children ({childrenList.length})
                </span>
                <span className="text-[10px] text-slate-500 font-bold">
                  All Students Linked to this Pass
                </span>
              </div>

              {childrenList.length === 0 ? (
                <div className="p-3 bg-slate-100 rounded-2xl text-center text-xs text-slate-500 font-medium">
                  No children currently linked to this parent profile
                </div>
              ) : (
                <div className="space-y-2">
                  {childrenList.map((c) => {
                    const fullName = `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Child';
                    const className = c.class?.name || c.class_name || 'Class Grade';
                    return (
                      <div
                        key={c.id}
                        className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <StudentAvatar
                            photoUrl={c.photo_url}
                            firstName={c.first_name}
                            lastName={c.last_name}
                            size="sm"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-black text-slate-900 truncate">
                              {fullName}
                            </p>
                            <p className="text-[10px] text-slate-500 font-medium truncate">
                              {className} {c.student_id ? `• ${c.student_id}` : ''}
                            </p>
                          </div>
                        </div>

                        {/* Live Status Pill */}
                        <div className="shrink-0">
                          {c.ready_for_pickup ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black flex items-center gap-1 animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                              Ready for Pickup
                            </span>
                          ) : c.in_extra_lesson ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-black flex items-center gap-1">
                              <Clock size={10} />
                              Extended {c.extra_lesson_end_time || ''}
                            </span>
                          ) : c.present_today ? (
                            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                              At School
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                              Not Checked In
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <p className="text-[10px] text-slate-400 font-medium">
            🔒 MyEduRide Secure Gate Custody Network
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs transition-all shadow-xs cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
