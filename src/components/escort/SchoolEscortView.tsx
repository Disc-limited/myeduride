// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import {
  Users,
  MapPin,
  Bus,
  CalendarCheck,
  CheckCircle2,
  Clock,
  QrCode,
  History,
  TrendingUp,
  Phone,
  ShieldCheck,
  ArrowRight,
  ChevronRight,
  AlertCircle,
  FileText,
  UserCheck,
  Search,
  Check,
  Play,
  RotateCcw,
  Sparkles,
  Smartphone,
  LayoutGrid,
  Bot,
  Mic,
  Navigation,
  MessageSquare,
  AlertTriangle,
  Building,
  User,
  Shield,
  PhoneCall,
  ExternalLink,
  ChevronDown,
  Volume2
} from 'lucide-react';
import { toast } from 'sonner';
import SchoolNoticeBanner from '@/components/shared/SchoolNoticeBanner';

interface SchoolEscortViewProps {
  onOpenVerificationModal: (student?: any) => void;
  onOpenIncidentModal: () => void;
}

export default function SchoolEscortView({
  onOpenVerificationModal,
  onOpenIncidentModal,
}: SchoolEscortViewProps) {
  // Voice Migo state
  const [micActive, setMicActive] = useState(false);

  // Trip Progress State
  const [tripStep, setTripStep] = useState<number>(3); // 1: Trip Started, 2: Picking Up, 3: All On Board, 4: Arrived School, 5: Afternoon Pickup, 6: Home Dropoff, 7: Trip Completed

  // Student Pickup Queue Data
  const [pickupQueue, setPickupQueue] = useState<any[]>([]);

  // On Board Students Data
  const [onBoardStudents, setOnBoardStudents] = useState<any[]>([]);

  // Activity Feed
  const [activityFeed, setActivityFeed] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/escorts/dashboard-live')
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && data?.students?.morning) {
          setPickupQueue(data.students.morning);
          setOnBoardStudents(data.students.morning.filter((s: any) => s.status === 'PICKED'));
        }
      })
      .catch((err) => console.warn('[SchoolEscortView] fetch notice:', err));
  }, []);

  const handleScanId = (student: any) => {
    onOpenVerificationModal(student);
  };

  const handleOverride = (student: any) => {
    toast.info(`Manual override initiated for ${student.name}`);
    onOpenVerificationModal(student);
  };

  return (
    <div className="space-y-5">
      {/* OFFICIAL SCHOOL NOTICES & PUBLIC HOLIDAY ADVISORIES */}
      <SchoolNoticeBanner role="escorts" schoolId={liveDashboardData?.escort?.school_id || liveDashboardData?.escort?.primary_school_id} />

      {/* 1. TODAY'S ASSIGNMENT BAR */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="font-extrabold text-xs text-emerald-800 uppercase tracking-widest">
              TODAY'S ASSIGNMENT
            </h3>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-xs">
          {/* Stat 1: Assigned Students */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
            <div className="flex items-center gap-1 text-slate-500">
              <Users size={14} className="text-[#0A1128]" />
              <span className="font-medium text-[11px]">Assigned Students</span>
            </div>
            <div className="font-extrabold text-xl text-slate-900 leading-tight">{pickupQueue.length}</div>
            <button
              onClick={() => toast.info(`Displaying ${pickupQueue.length} assigned students list`)}
              className="text-[10px] text-emerald-600 font-bold hover:underline"
            >
              View Details
            </button>
          </div>

          {/* Stat 2: Picked Up */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
            <div className="flex items-center gap-1 text-slate-500">
              <UserCheck size={14} className="text-emerald-600" />
              <span className="font-medium text-[11px]">Picked Up</span>
            </div>
            <div className="font-extrabold text-xl text-slate-900 leading-tight">{onBoardStudents.length}</div>
            <span className="text-[10px] text-emerald-600 font-bold block">
              {pickupQueue.length > 0 ? `${Math.round((onBoardStudents.length / pickupQueue.length) * 100)}%` : '0%'}
            </span>
          </div>

          {/* Stat 3: Remaining */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
            <div className="flex items-center gap-1 text-slate-500">
              <Clock size={14} className="text-amber-500" />
              <span className="font-medium text-[11px]">Remaining</span>
            </div>
            <div className="font-extrabold text-xl text-slate-900 leading-tight">{Math.max(0, pickupQueue.length - onBoardStudents.length)}</div>
            <span className="text-[10px] text-amber-600 font-bold block">
              {pickupQueue.length > 0 ? `${Math.round(((pickupQueue.length - onBoardStudents.length) / pickupQueue.length) * 100)}%` : '0%'}
            </span>
          </div>

          {/* Stat 4: Driver */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
            <span className="text-[10px] text-slate-400 font-medium block">Driver</span>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-slate-800 border border-emerald-500 flex items-center justify-center font-bold text-[10px] text-white shrink-0">
                DR
              </div>
              <div className="min-w-0">
                <div className="font-bold text-slate-900 truncate leading-tight text-xs">
                  Assigned Driver
                </div>
                <span className="text-[9px] text-slate-500 font-mono block">Active Shift</span>
              </div>
            </div>
          </div>

          {/* Stat 5: Vehicle */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
            <span className="text-[10px] text-slate-400 font-medium block">Vehicle</span>
            <div className="font-extrabold text-xs text-slate-900">Standard Vehicle</div>
            <span className="text-[9px] text-slate-500 block truncate">Operational</span>
          </div>

          {/* Stat 6: Departure Time */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
            <span className="text-[10px] text-slate-400 font-medium block">Departure Time</span>
            <div className="font-extrabold text-xs text-slate-900">Scheduled</div>
            <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.5 rounded">
              On Time
            </span>
          </div>

          {/* Stat 7: Est. Completion */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
            <span className="text-[10px] text-slate-400 font-medium block">Est. Completion</span>
            <div className="font-extrabold text-xs text-slate-900">Scheduled</div>
            <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.5 rounded">
              On Time
            </span>
          </div>

          {/* Stat 8: Progress Donut */}
          <div className="p-2 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col items-center justify-center text-center">
            <div className="w-11 h-11 rounded-full border-4 border-emerald-500 border-t-emerald-200 flex items-center justify-center font-extrabold text-xs text-slate-900">
              {pickupQueue.length > 0 ? `${Math.round((onBoardStudents.length / pickupQueue.length) * 100)}%` : '0%'}
            </div>
            <span className="text-[9px] text-slate-500 font-semibold mt-1">Completed</span>
          </div>
        </div>
      </div>

      {/* 2. DISC SAFETY PROMO BANNER */}
      <div className="bg-[#0A1128] text-white rounded-2xl p-5 shadow-md relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-4 border border-white/10">
        <div className="flex items-center gap-4 z-10">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
            <ShieldCheck size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xs uppercase tracking-widest text-emerald-400">
                DISC SAFETY INITIATIVE
              </span>
            </div>
            <h4 className="font-extrabold text-base md:text-lg text-white mt-0.5">
              Safety is Everyone's Responsibility
            </h4>
            <p className="text-xs text-slate-300">Together, let's keep every child safe.</p>
          </div>
        </div>

        <div className="flex items-center gap-3 z-10">
          <button
            onClick={() => toast.info('Opening DISC Safety Guidelines')}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-md transition-all"
          >
            Learn More
          </button>
        </div>
      </div>

      {/* 3. MIDDLE GRID (3 COLUMNS: LIVE TRACKING, MIGO AI, PICKUP QUEUE) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* CARD 1: LIVE TRACKING MAP (5 Cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
                LIVE TRACKING
              </h4>
            </div>
            <span className="bg-emerald-50 text-emerald-700 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-200">
              Traffic: ● Live
            </span>
          </div>

          {/* Map Graphic Box */}
          <div className="bg-slate-100 rounded-2xl h-56 border border-slate-200 relative overflow-hidden flex flex-col justify-between p-3">
            <div className="flex justify-between items-center z-10">
              <div className="bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-lg">
                Current Location: <span className="text-emerald-400">Moving</span>
              </div>
              <div className="flex gap-1">
                <button className="w-7 h-7 bg-white/90 rounded-lg text-slate-800 font-bold flex items-center justify-center shadow-sm">
                  +
                </button>
                <button className="w-7 h-7 bg-white/90 rounded-lg text-slate-800 font-bold flex items-center justify-center shadow-sm">
                  -
                </button>
              </div>
            </div>

            {/* Sim Map Route Graphic */}
            <div className="absolute inset-0 flex items-center justify-center opacity-75">
              <svg className="w-full h-full" viewBox="0 0 300 200">
                <path
                  d="M 20 160 Q 120 120 180 80 T 280 40"
                  fill="none"
                  stroke="#00A859"
                  strokeWidth="5"
                  strokeDasharray="6 3"
                />
                <circle cx="20" cy="160" r="8" fill="#0A1128" />
                <circle cx="180" cy="80" r="8" fill="#00A859" />
                <circle cx="280" cy="40" r="10" fill="#0A1128" />
              </svg>
            </div>

            {/* Next Stop Overlay Box */}
            <div className="bg-[#0A1128] text-white p-2.5 rounded-xl border border-white/10 z-10 flex items-center justify-between text-xs shadow-lg">
              <div>
                <span className="text-[10px] text-slate-400 font-medium block">Next Stop</span>
                <span className="font-extrabold text-white text-xs block">David James</span>
                <span className="text-[10px] text-emerald-400 font-semibold">300 m ahead</span>
              </div>
              <ChevronRight size={18} className="text-slate-400" />
            </div>
          </div>

          {/* Telemetry Row */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-400 block font-medium">Speed</span>
              <strong className="text-slate-900 block text-xs">32 km/h</strong>
            </div>
            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-400 block font-medium">ETA to Next Step</span>
              <strong className="text-slate-900 block text-xs">2 min (0.3 km)</strong>
            </div>
            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-400 block font-medium">ETA to School</span>
              <strong className="text-slate-900 block text-xs">12 min (5.4 km)</strong>
            </div>
          </div>
        </div>

        {/* CARD 2: MIGO AI ASSISTANT (3 Cols) */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <Bot size={18} className="text-emerald-600" />
              <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">MIGO</h4>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">powered by SAVI</span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-950 font-semibold text-xs">
              Good morning, John! 🖐️
            </div>

            <div className="space-y-1.5 text-[11px] text-slate-700 font-medium">
              <div className="flex items-start gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>Next pickup: David James 300m ahead on your left.</span>
              </div>
              <div className="flex items-start gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>Parent has confirmed student is ready.</span>
              </div>
              <div className="flex items-start gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>Light traffic ahead. You'll arrive on time.</span>
              </div>
              <div className="flex items-start gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>Please scan Student ID before boarding.</span>
              </div>
            </div>
          </div>

          {/* Voice Waveform & Mic */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
            <button
              onClick={() => {
                setMicActive(!micActive);
                toast.info(micActive ? 'Migo voice disabled' : 'Migo listening...');
              }}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                micActive ? 'bg-red-500 text-white animate-pulse' : 'bg-emerald-500 text-white shadow-sm'
              }`}
            >
              <Mic size={18} />
            </button>

            <div className="flex-1 flex items-center gap-0.5 h-6">
              {[40, 70, 30, 90, 50, 80, 40, 60, 100, 30, 70, 50].map((h, i) => (
                <span
                  key={i}
                  className={`w-1 rounded-full ${micActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>

          {/* Quick Action Pills */}
          <div className="grid grid-cols-3 gap-1.5 text-[10px] font-bold">
            <button
              onClick={() => toast.info('Migo Navigating...')}
              className="py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-center"
            >
              Navigate
            </button>
            <button
              onClick={() => toast.info('Next student: David James')}
              className="py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-center"
            >
              Who's Next?
            </button>
            <button
              onClick={() => toast.info('Calling parent...')}
              className="py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-center"
            >
              Call Parent
            </button>
          </div>
        </div>

        {/* CARD 3: PICKUP QUEUE (4 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
                PICKUP QUEUE
              </h4>
              <span className="bg-emerald-500 text-white font-bold text-[10px] px-2 py-0.5 rounded-full">
                6
              </span>
            </div>
            <button
              onClick={() => toast.info('Viewing full pickup queue')}
              className="text-[11px] text-emerald-600 font-bold hover:underline"
            >
              View All
            </button>
          </div>

          {/* Queue Items */}
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {pickupQueue.length === 0 ? (
              <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
                <Users size={20} className="mx-auto mb-1 text-slate-300" />
                <p className="font-semibold text-slate-600 text-xs">Queue Empty</p>
                <p className="text-[10px]">No assigned students in pickup queue.</p>
              </div>
            ) : (
              pickupQueue.map((item) => (
                <div
                  key={item.id}
                  className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between gap-2 hover:bg-slate-100 transition-all text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-900 truncate">{item.name}</div>
                    <div className="text-[10px] text-slate-500 truncate">{item.address}</div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-mono text-slate-400 mr-1">{item.dist || ''}</span>
                    <button
                      onClick={() => handleScanId(item)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg transition-all"
                    >
                      Scan ID
                    </button>
                    <button
                      onClick={() => handleOverride(item)}
                      className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[10px] px-2 py-1 rounded-lg transition-all"
                    >
                      Override
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <button
            onClick={() => toast.info('Opening full pickup queue modal')}
            className="w-full text-center text-xs font-bold text-emerald-600 hover:underline pt-1"
          >
            View Full Pickup Queue
          </button>
        </div>

      </div>

      {/* 4. LOWER GRID (4 COLUMNS: ON BOARD, VERIFICATION, QUICK ACTIONS, ACTIVITY FEED) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* CARD 1: ON BOARD */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
              ON BOARD ({onBoardStudents.length})
            </h4>
            <span className="text-[11px] text-emerald-600 font-bold cursor-pointer hover:underline">
              View All
            </span>
          </div>

          <div className="space-y-2 text-xs">
            {onBoardStudents.length === 0 ? (
              <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
                <UserCheck size={20} className="mx-auto mb-1 text-slate-300" />
                <p className="font-semibold text-slate-600 text-xs">No Students On Board</p>
                <p className="text-[10px]">Verified boarded students will list here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {onBoardStudents.map((ob) => (
                  <div key={ob.id} className="p-2 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-[10px]">
                      {ob.name?.substring(0, 2)?.toUpperCase() || 'ST'}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 truncate text-[11px]">{ob.name}</div>
                      <div className="text-[9px] text-slate-400 truncate">{ob.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => toast.info('Viewing full on board list')}
            className="w-full text-center text-xs font-bold text-emerald-600 hover:underline pt-1"
          >
            View All On Board
          </button>
        </div>

        {/* CARD 2: STUDENT VERIFICATION */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col justify-between space-y-3">
          <div className="border-b border-slate-100 pb-2">
            <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
              STUDENT VERIFICATION
            </h4>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-around gap-2 text-center">
            <button
              onClick={() => onOpenVerificationModal()}
              className="flex flex-col items-center gap-1 group"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                <QrCode size={24} />
              </div>
              <span className="text-[10px] font-bold text-slate-800 max-w-[90px] leading-tight">
                Scan Student ID using camera
              </span>
            </button>

            <span className="text-xs font-bold text-slate-400">OR</span>

            <button
              onClick={() => onOpenVerificationModal()}
              className="flex flex-col items-center gap-1 group"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#0A1128] text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                <ShieldCheck size={24} />
              </div>
              <span className="text-[10px] font-bold text-slate-800 max-w-[90px] leading-tight">
                Manual verification with reason
              </span>
            </button>
          </div>

          <p className="text-[10px] text-slate-400 font-medium text-center leading-tight">
            All students must be verified before boarding. This ensures the safety and security of every child.
          </p>
        </div>

        {/* CARD 3: QUICK ACTIONS */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col justify-between space-y-3">
          <div className="border-b border-slate-100 pb-2">
            <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
              QUICK ACTIONS
            </h4>
          </div>

          <div className="grid grid-cols-3 gap-2 text-[10px] font-bold text-center">
            <button
              onClick={() => onOpenVerificationModal()}
              className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex flex-col items-center gap-1 transition-all"
            >
              <QrCode size={16} className="text-emerald-600" />
              <span>Scan Student ID</span>
            </button>

            <button
              onClick={() => toast.info('Calling Parent...')}
              className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex flex-col items-center gap-1 transition-all"
            >
              <Phone size={16} className="text-blue-600" />
              <span>Call Parent</span>
            </button>

            <button
              onClick={() => toast.info('Calling Driver...')}
              className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex flex-col items-center gap-1 transition-all"
            >
              <User size={16} className="text-purple-600" />
              <span>Call Driver</span>
            </button>

            <button
              onClick={() => toast.info('Connecting School Office...')}
              className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex flex-col items-center gap-1 transition-all"
            >
              <Building size={16} className="text-amber-600" />
              <span>School Office</span>
            </button>

            <button
              onClick={() => toast.info('Connecting Gate Officer...')}
              className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex flex-col items-center gap-1 transition-all"
            >
              <Shield size={16} className="text-emerald-600" />
              <span>Gate Officer</span>
            </button>

            <button
              onClick={() => toast.info('Connecting City Manager...')}
              className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex flex-col items-center gap-1 transition-all"
            >
              <UserCheck size={16} className="text-slate-700" />
              <span>City Manager</span>
            </button>

            <button
              onClick={() => toast.info('Opening EduChat...')}
              className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex flex-col items-center gap-1 transition-all"
            >
              <MessageSquare size={16} className="text-teal-600" />
              <span>EduChat</span>
            </button>

            <button
              onClick={onOpenIncidentModal}
              className="p-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-xl flex flex-col items-center gap-1 transition-all"
            >
              <AlertTriangle size={16} className="text-red-600" />
              <span>Emergency (SOS)</span>
            </button>

            <button
              onClick={onOpenIncidentModal}
              className="p-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-xl flex flex-col items-center gap-1 transition-all"
            >
              <FileText size={16} className="text-amber-600" />
              <span>Report Issue</span>
            </button>
          </div>
        </div>

        {/* CARD 4: LIVE ACTIVITY FEED */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
              LIVE ACTIVITY FEED
            </h4>
            <span className="text-[11px] text-emerald-600 font-bold cursor-pointer hover:underline">
              View All
            </span>
          </div>

          <div className="space-y-2 text-xs">
            {activityFeed.length === 0 ? (
              <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
                <Clock size={20} className="mx-auto mb-1 text-slate-300" />
                <p className="font-semibold text-slate-600 text-xs">No Recent Activity</p>
                <p className="text-[10px]">Real-time operational events will appear here.</p>
              </div>
            ) : (
              activityFeed.map((act) => (
                <div key={act.id} className="flex items-start justify-between gap-2 text-[11px]">
                  <div className="flex items-start gap-1.5 text-slate-700">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-1" />
                    <span className="font-medium leading-tight">{act.text}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono shrink-0">{act.time}</span>
                </div>
              ))
            )}
          </div>

          <button
            onClick={() => toast.info('Viewing full activity history')}
            className="w-full text-center text-xs font-bold text-emerald-600 hover:underline pt-1"
          >
            View Full Feed
          </button>
        </div>

      </div>

      {/* 5. BOTTOM TRIP PROGRESS STEPPER BAR */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
            TRIP PROGRESS
          </h4>
        </div>

        {/* Horizontal Progress Stepper */}
        <div className="flex items-center justify-between relative overflow-x-auto py-2 px-4 min-w-[600px]">
          <div className="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-1 bg-slate-200 z-0" />
          <div className="absolute left-8 w-1/3 top-1/2 -translate-y-1/2 h-1 bg-emerald-500 z-0" />

          {/* Node 1: Trip Started */}
          <div className="relative z-10 text-center flex flex-col items-center gap-1">
            <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shadow-sm">
              ✓
            </div>
            <span className="font-bold text-xs text-slate-900">Trip Started</span>
            <span className="text-[10px] text-slate-400">06:45 AM</span>
          </div>

          {/* Node 2: Picking Up Students */}
          <div className="relative z-10 text-center flex flex-col items-center gap-1">
            <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shadow-sm">
              ✓
            </div>
            <span className="font-bold text-xs text-slate-900">Picking Up Students</span>
            <span className="text-[10px] text-emerald-600 font-bold">6 / 18</span>
          </div>

          {/* Node 3: All On Board */}
          <div className="relative z-10 text-center flex flex-col items-center gap-1">
            <div className="w-7 h-7 rounded-full bg-[#0A1128] text-white flex items-center justify-center text-xs font-bold ring-4 ring-blue-100 shadow-md">
              ●
            </div>
            <span className="font-bold text-xs text-[#0A1128]">All On Board</span>
            <span className="text-[10px] text-blue-600 font-semibold">In Progress</span>
          </div>

          {/* Node 4: Arrived at School */}
          <div className="relative z-10 text-center flex flex-col items-center gap-1">
            <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-xs font-bold">
              ○
            </div>
            <span className="font-medium text-xs text-slate-400">Arrived at School</span>
            <span className="text-[10px] text-slate-400">Pending</span>
          </div>

          {/* Node 5: Afternoon Pickup */}
          <div className="relative z-10 text-center flex flex-col items-center gap-1">
            <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-xs font-bold">
              ○
            </div>
            <span className="font-medium text-xs text-slate-400">Afternoon Pickup</span>
            <span className="text-[10px] text-slate-400">Pending</span>
          </div>

          {/* Node 6: Home Drop-off */}
          <div className="relative z-10 text-center flex flex-col items-center gap-1">
            <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-xs font-bold">
              ○
            </div>
            <span className="font-medium text-xs text-slate-400">Home Drop-off</span>
            <span className="text-[10px] text-slate-400">Pending</span>
          </div>

          {/* Node 7: Trip Completed */}
          <div className="relative z-10 text-center flex flex-col items-center gap-1">
            <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-xs font-bold">
              ○
            </div>
            <span className="font-medium text-xs text-slate-400">Trip Completed</span>
            <span className="text-[10px] text-slate-400">Pending</span>
          </div>
        </div>
      </div>
    </div>
  );
}
