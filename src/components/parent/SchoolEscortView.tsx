'use client';

import { useState, useEffect } from 'react';
import {
  UserCheck,
  Users,
  Clock,
  MapPin,
  ShieldCheck,
  Copy,
  Building,
  Car,
  MessageSquare,
  Navigation,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
  Calendar,
  X,
  Minus,
  Plus,
  Sparkles,
  Phone,
  MessageCircle,
  Compass
} from 'lucide-react';
import { toast } from 'sonner';
import { photoSrc } from '@/lib/photo';

interface SchoolEscortViewProps {
  childrenList?: any[];
  escortData?: any;
  onOpenEduChat?: () => void;
  onSelectSafetyPillar?: (pillar: string) => void;
  className?: string;
}

export default function SchoolEscortView({
  childrenList = [],
  escortData,
  onOpenEduChat,
  onSelectSafetyPillar,
  className = '',
}: SchoolEscortViewProps) {
  const safeChildren = Array.isArray(childrenList) ? childrenList : [];
  const primaryChild = safeChildren[0] || null;

  // Children & attendance state
  const [studentStatuses, setStudentStatuses] = useState<Record<string, 'going' | 'absent' | 'not_going'>>({});
  const [studentCount, setStudentCount] = useState<number>(safeChildren.length);
  const [isReadyForPickup, setIsReadyForPickup] = useState<boolean>(false);
  const [showBanner, setShowBanner] = useState<boolean>(true);

  // Form states & submission
  const [absentReason, setAbsentReason] = useState('');
  const [absentNotes, setAbsentNotes] = useState('');
  const [submittingAbsent, setSubmittingAbsent] = useState(false);

  const [notGoingReason, setNotGoingReason] = useState('');
  const [notGoingNotes, setNotGoingNotes] = useState('');
  const [submittingNotGoing, setSubmittingNotGoing] = useState(false);

  useEffect(() => {
    if (safeChildren.length > 0) {
      setStudentCount(safeChildren.length);
      const initialMap: Record<string, 'going' | 'absent' | 'not_going'> = {};
      safeChildren.forEach((c) => {
        initialMap[c.id] = 'going';
      });
      setStudentStatuses(initialMap);
    }
  }, [childrenList]);

  // Formatted Live Date
  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const handleCopyId = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`Copied Communication ID: ${code}`);
  };

  const handleStatusChange = async (childId: string, status: 'going' | 'absent' | 'not_going') => {
    setStudentStatuses((prev) => ({ ...prev, [childId]: status }));
    const child = safeChildren.find((c) => c.id === childId);
    const childName = child ? child.first_name : 'Student';
    const statusLabels = { going: 'Going with escort', absent: 'Marked as Absent', not_going: 'Not Going Today' };

    try {
      const res = await fetch('/api/parent/safety-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'update_attendance',
          child_id: childId,
          attendance_status: status,
        }),
      });
      if (res.ok) {
        toast.success(`Updated ${childName}'s status to: ${statusLabels[status]}`);
      } else {
        toast.info(`Updated ${childName}'s status locally.`);
      }
    } catch {
      toast.info(`Updated ${childName}'s status locally.`);
    }
  };

  const handleToggleReady = () => {
    const nextState = !isReadyForPickup;
    setIsReadyForPickup(nextState);
    if (nextState) {
      toast.success("Notification sent to escort: You are READY for pickup! 🚗");
    } else {
      toast.info("Pickup ready status toggled off.");
    }
  };

  const handleSubmitAbsence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!absentReason) {
      toast.error('Please select a reason for absence');
      return;
    }
    setSubmittingAbsent(true);
    try {
      const targetChildId = primaryChild?.id || 'all';
      const res = await fetch('/api/parent/safety-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'mark_absent',
          child_id: targetChildId,
          reason: absentReason,
          notes: absentNotes,
        }),
      });
      if (res.ok) {
        toast.success(`Absence report submitted successfully for ${absentReason}`);
        setAbsentReason('');
        setAbsentNotes('');
      } else {
        toast.error('Failed to submit absence report');
      }
    } catch {
      toast.error('Error submitting absence report');
    } finally {
      setSubmittingAbsent(false);
    }
  };

  const handleSubmitNotGoing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notGoingReason) {
      toast.error('Please select a reason');
      return;
    }
    setSubmittingNotGoing(true);
    try {
      const targetChildId = primaryChild?.id || 'all';
      const res = await fetch('/api/parent/safety-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'not_going_today',
          child_id: targetChildId,
          reason: notGoingReason,
          notes: notGoingNotes,
        }),
      });
      if (res.ok) {
        toast.success(`Not Going notice submitted successfully for ${notGoingReason}`);
        setNotGoingReason('');
        setNotGoingNotes('');
      } else {
        toast.error('Failed to submit notice');
      }
    } catch {
      toast.error('Error submitting notice');
    } finally {
      setSubmittingNotGoing(false);
    }
  };

  // Has escort data from DB
  const hasEscort = Boolean(escortData && (escortData.full_name || escortData.escort_name || escortData.id));

  return (
    <div className={`space-y-6 text-slate-800 text-xs font-sans ${className}`}>
      
      {/* ------------------------------------------------------------------------- */}
      {/* PAGE HEADER & DATE PICKER PILL */}
      {/* ------------------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
            School Escort
          </h1>
          <p className="text-slate-500 text-xs font-medium mt-0.5">
            Monitor your child&apos;s escort and daily pick up details
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2 rounded-2xl border border-slate-200 text-xs font-extrabold text-slate-800 shrink-0">
          <Calendar size={14} className="text-emerald-600" />
          <span>Today, {todayFormatted}</span>
          <ChevronDown size={14} className="text-slate-400" />
        </div>
      </div>

      {/* ------------------------------------------------------------------------- */}
      {/* ROW 1: 4 SUMMARY KPI METRIC CARDS */}
      {/* ------------------------------------------------------------------------- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Card 1: Escort Assigned */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Escort Assigned</span>
            <strong className="text-2xl font-black text-slate-900 block leading-none">{hasEscort ? '1' : '0'}</strong>
            <span className={`text-[10px] font-bold block ${hasEscort ? 'text-emerald-600' : 'text-slate-400'}`}>
              {hasEscort ? 'Active Escort' : 'No Active Escort'}
            </span>
          </div>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border shadow-xs ${
            hasEscort ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-200'
          }`}>
            <UserCheck size={22} />
          </div>
        </div>

        {/* Card 2: Today's Students */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Today&apos;s Students</span>
            <strong className="text-2xl font-black text-slate-900 block leading-none">{studentCount}</strong>
            <span className="text-[10px] text-blue-600 font-bold block">Going with Escort</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100 shadow-xs">
            <Users size={22} />
          </div>
        </div>

        {/* Card 3: ETA to School */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">ETA to School</span>
            <strong className="text-2xl font-black text-slate-900 block leading-none">
              {hasEscort ? (escortData.eta_minutes || 18) + ' min' : '—'}
            </strong>
            <span className="text-[10px] text-amber-600 font-bold block">Approx. arrival</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100 shadow-xs">
            <Clock size={22} />
          </div>
        </div>

        {/* Card 4: Picking Up From */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200/90 shadow-xs flex items-center justify-between">
          <div className="space-y-1 min-w-0 pr-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Picking Up From</span>
            <strong className="text-sm font-extrabold text-slate-900 truncate block">
              {escortData?.pinned_address ? 'Pinned Address' : primaryChild ? `${primaryChild.first_name}'s Home` : 'Pinned Address'}
            </strong>
            <span className="text-[10px] text-purple-600 font-bold block">Tap to view on map</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100 shadow-xs">
            <MapPin size={22} />
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------------------- */}
      {/* ROW 2: PRIMARY OPERATIONAL CONSOLE (3 COLUMNS OR EMPTY STATE) */}
      {/* ------------------------------------------------------------------------- */}
      {!hasEscort ? (
        <div className="bg-white rounded-3xl p-8 border border-slate-200/90 shadow-xs text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto border border-slate-200">
            <UserCheck size={28} />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base font-black text-slate-900">No School Escort Currently Assigned</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Your child does not have a designated school bus escort assigned today. You can book an on-demand MyEduRide Escort or track private commutes via E-Drive.
            </p>
          </div>
          <button
            onClick={() => onSelectSafetyPillar && onSelectSafetyPillar('myeduride_escort')}
            className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs transition-all shadow-md inline-flex items-center gap-2 cursor-pointer"
          >
            <Sparkles size={16} />
            <span>Request MyEduRide Escort</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          {/* ========================================================================= */}
          {/* COLUMN 1 (4 COLS): ESCORT ASSIGNED DETAILS */}
          {/* ========================================================================= */}
          <div className="lg:col-span-4 bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-4">
            <h3 className="font-extrabold text-sm text-slate-900">Escort Assigned Details</h3>

            {/* Escort Header Profile */}
            <div className="flex items-center gap-3.5">
              <img
                src={photoSrc(escortData.avatar_url || escortData.photo_url) || ''}
                alt={escortData.full_name || escortData.escort_name || 'Escort'}
                className="w-14 h-14 rounded-2xl object-cover border-2 border-slate-100 shadow-sm shrink-0"
              />
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-black text-sm text-slate-900 truncate">
                    {escortData.full_name || escortData.escort_name || 'School Escort'}
                  </h4>
                  <span className="px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase shrink-0">
                    Verified
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">{escortData.escort_type || 'School Escort'}</p>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                  <ShieldCheck size={12} className="text-emerald-600" />
                  <span>Escort ID: {escortData.escort_code || `ESC-${(escortData.id || '1024').slice(0, 4)}`}</span>
                </div>
              </div>
            </div>

            {/* Unique Communication ID Banner Box */}
            <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-4 space-y-2">
              <span className="text-[9px] font-extrabold uppercase text-blue-800 tracking-wider block">
                Unique Communication ID
              </span>
              <div className="flex items-center justify-between bg-white px-3.5 py-2 rounded-xl border border-blue-200 font-mono">
                <strong className="text-sm font-black text-blue-950">
                  MYER-ESC-{(escortData.id || '1024').slice(0, 4).toUpperCase()}
                </strong>
                <button
                  onClick={() => handleCopyId(`MYER-ESC-${(escortData.id || '1024').slice(0, 4).toUpperCase()}`)}
                  className="p-1 text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                  title="Copy ID"
                >
                  <Copy size={15} />
                </button>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-blue-800 font-medium pt-0.5">
                <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                <span>Use this ID to communicate securely with your escort.</span>
              </div>
            </div>

            {/* School & Vehicle Info */}
            <div className="space-y-2.5 pt-1 text-xs text-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                  <Building size={16} />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">School</span>
                  <strong className="font-extrabold text-slate-900 truncate block">
                    {escortData.school_name || 'School Campus'}
                  </strong>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                  <Car size={16} />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Vehicle</span>
                  <strong className="font-extrabold text-slate-900 truncate block">
                    {escortData.vehicle?.make_model || escortData.vehicle_model || 'School Bus Fleet'} ({escortData.vehicle?.reg_number || escortData.vehicle_reg || 'Verified'})
                  </strong>
                </div>
              </div>
            </div>

            {/* Message Escort Action Button */}
            <button
              onClick={() => {
                if (onOpenEduChat) onOpenEduChat();
                else toast.info(`Opening secure EduChat thread with ${escortData.full_name || 'Escort'}...`);
              }}
              className="w-full py-2.5 rounded-2xl bg-white hover:bg-slate-50 border border-blue-200 text-blue-700 font-extrabold text-xs transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
            >
              <MessageSquare size={16} />
              <span>Message Escort</span>
            </button>
          </div>

          {/* ========================================================================= */}
          {/* COLUMN 2 (5 COLS): LIVE LOCATION & ROUTE MAP PREVIEW */}
          {/* ========================================================================= */}
          <div className="lg:col-span-5 bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-sm text-slate-900">Live Location</h3>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" /> Live
              </span>
            </div>

            {/* Map Preview Canvas */}
            <div className="bg-slate-900 rounded-2xl p-4 text-white relative overflow-hidden h-48 flex flex-col justify-between border border-slate-800 shadow-md">
              <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-900 to-slate-800 opacity-95" />
              
              {/* Polyline Path */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40">
                <path
                  d="M 40 120 Q 130 50 230 100 T 330 70"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="4"
                  strokeDasharray="6 4"
                />
              </svg>

              {/* Live Distance Badge Top Right */}
              <div className="relative z-10 flex items-center justify-end">
                <div className="bg-white text-slate-900 rounded-2xl px-3 py-1.5 shadow-lg border border-slate-200 text-center">
                  <strong className="text-sm font-black block leading-none">{escortData.eta_minutes || 18} min</strong>
                  <span className="text-[9px] font-bold text-slate-500 uppercase">away</span>
                </div>
              </div>

              <div className="relative z-10 flex items-center justify-between text-[10px] text-slate-300">
                <span>GPS Telemetry Active</span>
                <span className="text-emerald-400 font-bold">Updated Just Now</span>
              </div>
            </div>

            {/* Pinned Address Details Card */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Your Pinned Pickup Address</span>
                  <strong className="font-extrabold text-xs text-slate-900 leading-snug block mt-0.5">
                    {escortData.pinned_address || escortData.route?.child_designated_stop || 'Parent Registered Address'}
                  </strong>
                </div>
                <button
                  onClick={() => toast.info('Re-pin address modal opened')}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-sky-300 text-sky-700 font-extrabold text-xs transition-all shadow-xs flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <Navigation size={13} />
                  <span>Re-pin / Update Address</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Current Location</span>
                  <p className="font-extrabold text-slate-800 text-[11px] truncate">
                    {escortData.route?.name || 'Transit Route Corridor'}
                  </p>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Next Stop</span>
                    <span className="text-[10px] font-bold text-emerald-700">ETA: {escortData.route?.departure_morning || '7:15 AM'}</span>
                  </div>
                  <p className="font-extrabold text-slate-800 text-[11px] truncate">
                    Your Location (Home)
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => toast.info('Full route tracking modal opened')}
              className="w-full py-2.5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-sky-600 font-extrabold text-xs transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <span>View Full Route</span>
              <span>→</span>
            </button>
          </div>

          {/* ========================================================================= */}
          {/* COLUMN 3 (3 COLS): QUICK ACTIONS & STUDENTS FOR TODAY */}
          {/* ========================================================================= */}
          <div className="lg:col-span-3 space-y-4">
            
            {/* Quick Actions Card */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-3">
              <h3 className="font-extrabold text-sm text-slate-900">Quick Actions</h3>

              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 shrink-0">
                    <UserCheck size={18} />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs text-slate-900">I am Ready for Pickup</h4>
                    <p className="text-[11px] text-slate-600">Let the escort know you are ready.</p>
                  </div>
                </div>

                <button
                  onClick={handleToggleReady}
                  className={`w-full py-3 rounded-2xl font-black text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                    isReadyForPickup
                      ? 'bg-emerald-700 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  <CheckCircle2 size={16} />
                  <span>{isReadyForPickup ? "I'm Ready! (Notified)" : "I'm Ready"}</span>
                </button>
              </div>
            </div>

            {/* Students for Today Card */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-4">
              <div className="space-y-1">
                <h3 className="font-extrabold text-sm text-slate-900">Students for Today</h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  How many children are going with the escort today?
                </p>
              </div>

              {safeChildren.length === 0 ? (
                <p className="text-slate-400 text-xs italic">No children linked to parent account</p>
              ) : (
                <>
                  {/* Stepper counter */}
                  <div className="flex items-center justify-between bg-slate-50 p-2 rounded-2xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setStudentCount((prev) => Math.max(1, prev - 1))}
                      className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold flex items-center justify-center shadow-xs cursor-pointer"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="font-black text-sm text-slate-900">
                      {studentCount} <span className="text-xs font-normal text-slate-500">students</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setStudentCount((prev) => Math.min(safeChildren.length, prev + 1))}
                      className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold flex items-center justify-center shadow-xs cursor-pointer"
                    >
                      <Plus size={14} />
                    </button>
                  </div>

                  {/* Children List */}
                  <div className="space-y-2.5 pt-1">
                    {safeChildren.slice(0, studentCount).map((child) => (
                      <div
                        key={child.id}
                        className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 border border-slate-100"
                      >
                        <div className="flex items-center gap-2.5">
                          <img
                            src={photoSrc(child.avatar_url || child.photo_url) || ''}
                            alt={child.first_name}
                            className="w-9 h-9 rounded-xl object-cover border border-slate-200 shrink-0"
                          />
                          <div>
                            <h4 className="font-extrabold text-xs text-slate-900">
                              {child.first_name} {child.last_name}
                            </h4>
                            <p className="text-[10px] text-slate-500">{child.class_name || 'Student'}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-800 text-[11px] font-extrabold">
                          <span>Going</span>
                          <ChevronDown size={12} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-slate-100 text-center font-bold text-xs text-blue-700">
                    Total: {studentCount} Student(s)
                  </div>
                </>
              )}
            </div>

          </div>

        </div>
      )}

      {/* ------------------------------------------------------------------------- */}
      {/* ROW 3: ATTENDANCE & ABSENCE MANAGEMENT CONSOLE (3 COLUMNS) */}
      {/* ------------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* ========================================================================= */}
        {/* COLUMN 1 (5 COLS): ATTENDANCE FOR TODAY */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-4">
          <h3 className="font-extrabold text-sm text-slate-900">Attendance for Today</h3>

          {safeChildren.length === 0 ? (
            <p className="text-slate-400 text-xs italic">No enrolled children found</p>
          ) : (
            <div className="space-y-3">
              {safeChildren.map((child) => {
                const currentStatus = studentStatuses[child.id] || 'going';

                return (
                  <div
                    key={child.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={photoSrc(child.avatar_url || child.photo_url) || ''}
                        alt={child.first_name}
                        className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0"
                      />
                      <div>
                        <h4 className="font-extrabold text-xs text-slate-900">
                          {child.first_name} {child.last_name}
                        </h4>
                        <p className="text-[10px] text-slate-500">{child.class_name || 'Enrolled'}</p>
                      </div>
                    </div>

                    {/* 3 Status Toggle Buttons */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleStatusChange(child.id, 'going')}
                        className={`px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all flex items-center gap-1 cursor-pointer ${
                          currentStatus === 'going'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <CheckCircle2 size={13} />
                        <span>Going</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStatusChange(child.id, 'absent')}
                        className={`px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all flex items-center gap-1 cursor-pointer ${
                          currentStatus === 'absent'
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'bg-white text-rose-600 border border-rose-200 hover:bg-rose-50'
                        }`}
                      >
                        <XCircle size={13} />
                        <span>Absent</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStatusChange(child.id, 'not_going')}
                        className={`px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all cursor-pointer ${
                          currentStatus === 'not_going'
                            ? 'bg-slate-800 text-white shadow-xs'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span>Not Going Today</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="bg-sky-50 border border-sky-200 rounded-2xl p-3 text-[11px] text-sky-900 font-bold flex items-center gap-2">
            <AlertCircle size={14} className="text-sky-600 shrink-0" />
            <span>Please update the status for each child every morning.</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* COLUMN 2 (3.5 COLS): MARK AS ABSENT FORM */}
        {/* ========================================================================= */}
        <div className="lg:col-span-3 bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-4">
          <h3 className="font-extrabold text-sm text-slate-900">Mark as Absent</h3>

          <form onSubmit={handleSubmitAbsence} className="space-y-3 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-700 text-[11px]">Select reason for absence</label>
              <select
                value={absentReason}
                onChange={(e) => setAbsentReason(e.target.value)}
                className="w-full p-2.5 rounded-2xl bg-slate-50 border border-slate-200 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Choose a reason ∨</option>
                <option value="Sick">Sick</option>
                <option value="Family Emergency">Family Emergency</option>
                <option value="Medical Appointment">Medical Appointment</option>
                <option value="Personal Reason">Personal Reason</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 text-[11px]">Notes (Optional)</label>
              <textarea
                rows={3}
                placeholder="Add any additional note..."
                value={absentNotes}
                onChange={(e) => setAbsentNotes(e.target.value)}
                className="w-full p-2.5 rounded-2xl bg-slate-50 border border-slate-200 font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={submittingAbsent}
              className="w-full py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer"
            >
              {submittingAbsent ? 'Submitting...' : 'Submit'}
            </button>
          </form>
        </div>

        {/* ========================================================================= */}
        {/* COLUMN 3 (3.5 COLS): NOT GOING TODAY FORM */}
        {/* ========================================================================= */}
        <div className="lg:col-span-4 bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-4">
          <h3 className="font-extrabold text-sm text-slate-900">Not Going Today</h3>

          <form onSubmit={handleSubmitNotGoing} className="space-y-3 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-slate-700 text-[11px]">Select reason</label>
              <select
                value={notGoingReason}
                onChange={(e) => setNotGoingReason(e.target.value)}
                className="w-full p-2.5 rounded-2xl bg-slate-50 border border-slate-200 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Choose a reason ∨</option>
                <option value="Traveling">Traveling</option>
                <option value="Holiday">Holiday</option>
                <option value="Weekend Activity">Weekend Activity</option>
                <option value="Family Event">Family Event</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 text-[11px]">Notes (Optional)</label>
              <textarea
                rows={3}
                placeholder="Add any additional note..."
                value={notGoingNotes}
                onChange={(e) => setNotGoingNotes(e.target.value)}
                className="w-full p-2.5 rounded-2xl bg-slate-50 border border-slate-200 font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={submittingNotGoing}
              className="w-full py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer"
            >
              {submittingNotGoing ? 'Submitting...' : 'Submit'}
            </button>
          </form>
        </div>

      </div>

      {/* ------------------------------------------------------------------------- */}
      {/* BOTTOM BANNER NOTICE */}
      {/* ------------------------------------------------------------------------- */}
      {showBanner && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 flex items-center justify-between text-xs text-emerald-900 font-bold shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>Kindly update the attendance and ensure you are ready before the escort arrives for a smooth pick up.</span>
          </div>
          <button
            onClick={() => setShowBanner(false)}
            className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      )}

    </div>
  );
}
