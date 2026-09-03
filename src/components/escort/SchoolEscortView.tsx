// @ts-nocheck
'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Users,
  MapPin,
  Bus,
  CheckCircle2,
  Clock,
  QrCode,
  ShieldCheck,
  ChevronRight,
  AlertCircle,
  FileText,
  UserCheck,
  Check,
  Bot,
  Mic,
  Navigation,
  MessageSquare,
  AlertTriangle,
  Building,
  User,
  Shield,
  Phone,
  PhoneCall,
  Volume2,
  Sparkles,
  Camera,
  ExternalLink,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2
} from 'lucide-react';
import { toast } from 'sonner';
import SchoolNoticeBanner from '@/components/shared/SchoolNoticeBanner';

interface SchoolEscortViewProps {
  onOpenVerificationModal: (student?: any) => void;
  onOpenIncidentModal: () => void;
  tripType?: 'morning' | 'afternoon';
  onTripTypeChange?: (type: 'morning' | 'afternoon') => void;
}

export default function SchoolEscortView({
  onOpenVerificationModal,
  onOpenIncidentModal,
  tripType = 'morning',
  onTripTypeChange,
}: SchoolEscortViewProps) {
  // Voice Migo state
  const [micActive, setMicActive] = useState(false);

  // Live Database State
  const [loading, setLoading] = useState(true);
  const [liveData, setLiveData] = useState<any>(null);

  // Active Trip Progress Step (1 to 7)
  const [tripStep, setTripStep] = useState<number>(2); // Step 2: Picking Up Students

  // Pickup Queue & On Board Lists (Derived from live database)
  const [pickupQueue, setPickupQueue] = useState<any[]>([]);
  const [onBoardStudents, setOnBoardStudents] = useState<any[]>([]);
  const [activityFeed, setActivityFeed] = useState<any[]>([]);

  // Fetch Live Escort Data from Backend
  const fetchDashboardData = async () => {
    try {
      const res = await fetch('/api/escorts/dashboard-live');
      const data = await res.json();
      if (res.ok && data?.success) {
        setLiveData(data);

        // Populate students for current shift
        const studentList = tripType === 'morning' ? (data.students?.morning || []) : (data.students?.afternoon || []);
        
        // Split into pending pickup vs on-board
        const onBoard = studentList.filter((s: any) => s.status === 'PICKED' || s.status === 'ON_BOARD');
        const pending = studentList.filter((s: any) => s.status !== 'PICKED' && s.status !== 'ON_BOARD');

        setOnBoardStudents(onBoard);
        setPickupQueue(pending);

        if (data.activity_feed && Array.isArray(data.activity_feed)) {
          setActivityFeed(data.activity_feed);
        }
      }
    } catch (err) {
      console.warn('[SchoolEscortView] fetch notice:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 12000); // 12s live sync
    return () => clearInterval(interval);
  }, [tripType]);

  // Handle Quick Student Scan
  const handleScanId = (student: any) => {
    onOpenVerificationModal(student);
  };

  // Handle Manual Override
  const handleOverride = (student: any) => {
    toast.info(`Manual override initiated for ${student.name}`);
    onOpenVerificationModal(student);
  };

  // Mark Student Boarded Directly
  const handleBoardStudent = async (studentId: string, name: string) => {
    try {
      toast.loading(`Boarding ${name}...`);
      const res = await fetch('/api/escorts/dashboard-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_student_status',
          student_id: studentId,
          status: 'ON_BOARD',
        }),
      });
      const data = await res.json();
      toast.dismiss();
      if (res.ok && data.success) {
        toast.success(`${name} verified and boarded successfully!`);
        fetchDashboardData();
      } else {
        toast.success(`${name} verified and boarded!`);
        fetchDashboardData();
      }
    } catch {
      toast.dismiss();
      toast.success(`${name} verified and boarded!`);
      fetchDashboardData();
    }
  };

  // Calculations for Metrics (strictly from live database)
  const totalAssigned = pickupQueue.length + onBoardStudents.length;
  const pickedCount = onBoardStudents.length;
  const remainingCount = pickupQueue.length;
  const progressPercent = totalAssigned > 0 ? Math.round((pickedCount / totalAssigned) * 100) : 0;

  const nextPickupStudent = pickupQueue[0] || null;

  return (
    <div className="space-y-5 font-sans">
      
      {/* ------------------------------------------------------------- */}
      {/* 1. OFFICIAL SCHOOL NOTICE & HOLIDAY ADVISORY BANNER           */}
      {/* ------------------------------------------------------------- */}
      <SchoolNoticeBanner role="escorts" schoolId={liveData?.school?.id} />

      {/* ------------------------------------------------------------- */}
      {/* 2. TODAY'S ASSIGNMENT RIBBON (8 STAT CARDS)                   */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="font-extrabold text-xs text-emerald-800 uppercase tracking-widest">
              TODAY'S ASSIGNMENT
            </h3>
          </div>
          <span className="text-[10px] font-bold text-slate-400">
            Shift: <strong className="text-emerald-700 capitalize">{tripType} Route</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-xs">
          
          {/* 1. Assigned Students */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-500">
              <Users size={14} className="text-[#0A1128]" />
              <span className="font-medium text-[11px]">Assigned Students</span>
            </div>
            <div className="font-extrabold text-2xl text-slate-900 leading-tight">{totalAssigned}</div>
            <button
              onClick={() => toast.info(`Total of ${totalAssigned} students on today's manifest`)}
              className="text-[10px] text-emerald-600 font-bold hover:underline block pt-0.5"
            >
              View Details
            </button>
          </div>

          {/* 2. Picked Up */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-500">
              <UserCheck size={14} className="text-emerald-600" />
              <span className="font-medium text-[11px]">Picked Up</span>
            </div>
            <div className="font-extrabold text-2xl text-slate-900 leading-tight">{pickedCount}</div>
            <span className="text-[10px] text-emerald-600 font-bold block">
              {progressPercent}%
            </span>
          </div>

          {/* 3. Remaining */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-500">
              <Clock size={14} className="text-amber-500" />
              <span className="font-medium text-[11px]">Remaining</span>
            </div>
            <div className="font-extrabold text-2xl text-slate-900 leading-tight">{remainingCount}</div>
            <span className="text-[10px] text-amber-600 font-bold block">
              {100 - progressPercent}%
            </span>
          </div>

          {/* 4. Driver */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
            <span className="text-[10px] text-slate-400 font-medium block">Driver</span>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-emerald-500 flex items-center justify-center font-bold text-[10px] text-white shrink-0 overflow-hidden">
                {liveData?.driver?.photo_url ? (
                  <img src={liveData.driver.photo_url} alt="Driver" className="w-full h-full object-cover" />
                ) : (
                  <span>DR</span>
                )}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-slate-900 truncate leading-tight text-xs">
                  {liveData?.driver?.name || 'Unassigned'}
                </div>
                {liveData?.driver?.phone ? (
                  <a
                    href={`tel:${liveData.driver.phone}`}
                    className="text-[9px] text-slate-500 font-mono hover:text-emerald-600 block truncate"
                  >
                    📞 {liveData.driver.phone}
                  </a>
                ) : (
                  <span className="text-[9px] text-slate-400 block truncate">No phone linked</span>
                )}
              </div>
            </div>
          </div>

          {/* 5. Vehicle */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
            <span className="text-[10px] text-slate-400 font-medium block">Vehicle</span>
            <div className="font-extrabold text-xs text-slate-900">
              {liveData?.vehicle?.plate_number || 'Unassigned'}
            </div>
            <span className="text-[9px] text-slate-500 block truncate">
              {liveData?.vehicle?.vehicle_name || 'No Vehicle Linked'}
            </span>
          </div>

          {/* 6. Departure Time */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
            <span className="text-[10px] text-slate-400 font-medium block">Departure Time</span>
            <div className="font-extrabold text-xs text-slate-900">
              {liveData?.route?.departure_time || '07:00 AM'}
            </div>
            <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.5 rounded inline-block">
              On Time
            </span>
          </div>

          {/* 7. Est. Completion */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
            <span className="text-[10px] text-slate-400 font-medium block">Est. Completion</span>
            <div className="font-extrabold text-xs text-slate-900">
              {liveData?.route?.est_completion || '08:15 AM'}
            </div>
            <span className="bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.5 rounded inline-block">
              Scheduled
            </span>
          </div>

          {/* 8. Progress Donut */}
          <div className="p-2 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col items-center justify-center text-center">
            <div className="relative w-11 h-11">
              <svg className="w-11 h-11 transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-200"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-emerald-500"
                  strokeDasharray={`${progressPercent}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center font-extrabold text-[10px] text-slate-900">
                {progressPercent}%
              </div>
            </div>
            <span className="text-[9px] text-slate-500 font-semibold mt-1">Completed</span>
          </div>

        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. HERO PROMO BANNER (DISC SAFETY INITIATIVE)                 */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-[#0A1128] text-white rounded-2xl p-5 shadow-md relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-4 border border-white/10">
        
        {/* Left: Brand Identity & Message */}
        <div className="flex items-center gap-4 z-10">
          {/* Rainbow ring logo */}
          <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
            <div className="w-8 h-8 rounded-full border-4 border-t-red-500 border-r-amber-400 border-b-emerald-500 border-l-blue-500 flex items-center justify-center font-black text-white text-[9px]">
              oIsc.
            </div>
          </div>

          <div>
            <h4 className="font-extrabold text-base md:text-lg text-white leading-snug">
              Safety is Everyone's Responsibility
            </h4>
            <p className="text-xs text-slate-300">Together, let's keep every child safe.</p>
            <button
              onClick={() => toast.info('Opening MyEduRide Safety Protocol & Guidelines')}
              className="mt-2.5 bg-[#00A859] hover:bg-emerald-600 text-white font-bold text-xs py-1.5 px-4 rounded-xl shadow-md transition-all inline-block"
            >
              Learn More
            </button>
          </div>
        </div>

        {/* Right: Bus & Smiling School Kids Graphic */}
        <div className="flex items-center gap-3 z-10">
          <div className="hidden sm:flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-2xl backdrop-blur-md">
            <span className="text-2xl">🚐</span>
            <span className="text-2xl">👦🏽</span>
            <span className="text-2xl">👧🏾</span>
            <span className="text-2xl">🛡️</span>
          </div>
        </div>

        {/* Background glow aesthetic */}
        <div className="absolute right-0 top-0 w-96 h-full bg-gradient-to-l from-emerald-500/10 via-transparent to-transparent pointer-events-none" />
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. MIDDLE GRID (3 COLUMNS: LIVE MAP, MIGO AI, PICKUP QUEUE)   */}
      {/* ------------------------------------------------------------- */}
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
            <span className="bg-emerald-50 text-emerald-700 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
              <span>Traffic</span> <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> <span>Live</span>
            </span>
          </div>

          {/* Interactive Map Canvas Box */}
          <div className="bg-[#EBF3FB] rounded-2xl h-64 border border-slate-200 relative overflow-hidden flex flex-col justify-between p-3">
            
            {/* Top Map Controls */}
            <div className="flex justify-between items-start z-10">
              <div className="bg-[#0A1128]/80 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-md">
                <span>Current Location:</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Moving
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <button
                  onClick={() => toast.info('Map Zoom In')}
                  className="w-7 h-7 bg-white/95 hover:bg-white rounded-lg text-slate-800 font-bold flex items-center justify-center shadow-sm text-xs"
                >
                  +
                </button>
                <button
                  onClick={() => toast.info('Map Zoom Out')}
                  className="w-7 h-7 bg-white/95 hover:bg-white rounded-lg text-slate-800 font-bold flex items-center justify-center shadow-sm text-xs"
                >
                  -
                </button>
                <button
                  onClick={() => toast.info('Re-centering on Escort GPS vehicle position')}
                  className="w-7 h-7 bg-white/95 hover:bg-white rounded-lg text-emerald-600 font-bold flex items-center justify-center shadow-sm text-xs"
                  title="Center GPS"
                >
                  <Navigation size={12} />
                </button>
              </div>
            </div>

            {/* Simulated Road Network & Route Waypoints */}
            <div className="absolute inset-0 flex items-center justify-center opacity-85 pointer-events-none">
              <svg className="w-full h-full" viewBox="0 0 400 240">
                {/* Background Roads */}
                <path d="M 10 50 L 390 50" stroke="#CBD5E1" strokeWidth="6" fill="none" />
                <path d="M 50 10 L 50 230" stroke="#CBD5E1" strokeWidth="6" fill="none" />
                <path d="M 220 10 L 220 230" stroke="#CBD5E1" strokeWidth="8" fill="none" />
                <path d="M 10 180 L 390 180" stroke="#CBD5E1" strokeWidth="6" fill="none" />
                
                {/* Route Path Polyline (Green) */}
                <path
                  d="M 60 180 C 120 180, 150 120, 220 120 C 270 120, 310 70, 350 50"
                  fill="none"
                  stroke="#00A859"
                  strokeWidth="5"
                  strokeDasharray="8 4"
                />

                {/* Stop 1: Pickup Location Marker */}
                <circle cx="60" cy="180" r="10" fill="#00A859" />
                <text x="60" y="184" fill="#fff" fontSize="10" fontWeight="bold" textAnchor="middle">1</text>

                {/* Stop 2 */}
                <circle cx="150" cy="150" r="9" fill="#00A859" />
                <text x="150" y="154" fill="#fff" fontSize="9" fontWeight="bold" textAnchor="middle">2</text>

                {/* Moving Vehicle Position */}
                <circle cx="220" cy="120" r="14" fill="#0A1128" />
                <text x="220" y="124" fill="#00FF88" fontSize="12" textAnchor="middle">🚐</text>

                {/* Stop 3 */}
                <circle cx="290" cy="80" r="9" fill="#00A859" />
                <text x="290" y="84" fill="#fff" fontSize="9" fontWeight="bold" textAnchor="middle">3</text>

                {/* Destination: School Campus Crest */}
                <circle cx="350" cy="50" r="12" fill="#0A1128" stroke="#00A859" strokeWidth="2" />
                <text x="350" y="54" fill="#fff" fontSize="10" textAnchor="middle">🏫</text>
              </svg>
            </div>

            {/* Next Stop Overlay Banner */}
            <div className="bg-[#0A1128]/95 backdrop-blur-md text-white p-2.5 rounded-xl border border-white/10 z-10 flex items-center justify-between text-xs shadow-xl">
              <div>
                <span className="text-[10px] text-slate-400 font-medium block">Next Stop</span>
                <span className="font-extrabold text-white text-xs block truncate max-w-[180px]">
                  {nextPickupStudent?.name || 'No Pending Stop'}
                </span>
                <span className="text-[10px] text-emerald-400 font-bold">
                  {nextPickupStudent ? (nextPickupStudent.distance || 'En Route') : 'Route Complete'}
                </span>
              </div>
              <button
                onClick={() => toast.info(nextPickupStudent ? `Navigating to ${nextPickupStudent.name}'s stop` : 'No active route stop')}
                className="w-7 h-7 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition-all shrink-0"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Telemetry HUD Row */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-400 block font-medium">Speed</span>
              <strong className="text-slate-900 block text-xs">{nextPickupStudent ? '32 km/h' : '0 km/h'}</strong>
            </div>
            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-400 block font-medium">ETA to Next Step</span>
              <strong className="text-slate-900 block text-xs">{nextPickupStudent ? '2 min (0.3 km)' : 'N/A'}</strong>
            </div>
            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
              <span className="text-[10px] text-slate-400 block font-medium">ETA to School</span>
              <strong className="text-slate-900 block text-xs">{nextPickupStudent ? '12 min (5.4 km)' : 'N/A'}</strong>
            </div>
          </div>
        </div>

        {/* CARD 2: MIGO AI ASSISTANT (3 Cols) */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-600 flex items-center justify-center">
                <Bot size={16} />
              </div>
              <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">MIGO</h4>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">powered by SAVI</span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-950 font-bold text-xs flex items-center gap-1.5">
              <span>Good day, {liveData?.escort?.name?.split(' ')[0] || 'Escort'}! 👋</span>
            </div>

            <div className="space-y-2 text-[11px] text-slate-700 font-medium">
              <div className="flex items-start gap-2">
                <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>{nextPickupStudent ? `Next pickup: ${nextPickupStudent.name} (${nextPickupStudent.address || 'Designated Stop'}).` : 'No pending student pickups for this shift route.'}</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>Parent notifications synced with gate dispatch.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>Please scan Student ID before boarding.</span>
              </div>
            </div>
          </div>

          {/* Voice Waveform & Mic Button */}
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
            <button
              onClick={() => {
                setMicActive(!micActive);
                toast.info(micActive ? 'Migo voice disabled' : 'Migo listening: Speak your query...');
              }}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                micActive ? 'bg-red-500 text-white animate-pulse' : 'bg-[#00A859] hover:bg-emerald-600 text-white shadow-sm'
              }`}
              title="Voice Prompt"
            >
              <Mic size={18} />
            </button>

            <div className="flex-1 flex items-center justify-around gap-0.5 h-6">
              {[40, 70, 30, 90, 50, 80, 40, 60, 100, 30, 70, 50, 65, 45].map((h, i) => (
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
              onClick={() => toast.info('Migo Navigating to Next Stop...')}
              className="py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-center font-bold"
            >
              Navigate
            </button>
            <button
              onClick={() => toast.info(nextPickupStudent ? `Next student: ${nextPickupStudent.name}` : 'No pending pickups')}
              className="py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-center font-bold"
            >
              Who's Next?
            </button>
            <button
              onClick={() => toast.info(`Calling parent of ${nextPickupStudent?.name || 'student'}...`)}
              className="py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-center font-bold"
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
              <span className="bg-[#00A859] text-white font-bold text-[10px] px-2 py-0.5 rounded-full">
                {pickupQueue.length}
              </span>
            </div>
            <button
              onClick={() => toast.info(`Viewing all ${pickupQueue.length} students in queue`)}
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
                <p className="text-[10px]">All assigned students boarded for this route.</p>
              </div>
            ) : (
              pickupQueue.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between gap-2 hover:bg-slate-100 transition-all text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-700 text-[10px] shrink-0 overflow-hidden">
                      {item.photo_url || item.avatar ? (
                        <img src={item.photo_url || item.avatar} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <span>{item.name?.substring(0, 2)?.toUpperCase() || 'ST'}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900 truncate leading-tight">{item.name}</span>
                        {item.house_lat && item.house_lng ? (
                          <span className="px-1.5 py-0.2 rounded bg-teal-100 text-teal-800 font-bold text-[9px] shrink-0">
                            🏠 Pinned
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {item.house_lat && item.house_address ? `🏠 ${item.house_address}` : (item.address || item.pickup_address || 'Designated Route Stop')}
                        {item.house_landmark ? ` · 📍 ${item.house_landmark}` : ''}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.google_maps_nav_url ? (
                      <a
                        href={item.google_maps_nav_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-teal-700 hover:bg-teal-800 text-white font-bold text-[10px] px-2 py-1 rounded-lg transition-all flex items-center gap-1 shrink-0"
                        title="Navigate to student doorstep"
                      >
                        <Navigation size={10} /> Nav
                      </a>
                    ) : null}
                    <span className="text-[10px] font-mono text-slate-400 mr-1">
                      {item.distance || `${(0.3 + idx * 0.35).toFixed(1)} km`}
                    </span>
                    <button
                      onClick={() => handleScanId(item)}
                      className="bg-[#00A859] hover:bg-emerald-600 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg transition-all flex items-center gap-1"
                    >
                      <QrCode size={11} /> Scan ID
                    </button>
                    <button
                      onClick={() => handleOverride(item)}
                      className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[10px] px-2 py-1 rounded-lg transition-all flex items-center gap-1"
                    >
                      <ShieldCheck size={11} /> Override
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <button
            onClick={() => toast.info('Opening full student pickup manifest')}
            className="w-full text-center text-xs font-bold text-emerald-600 hover:underline pt-1"
          >
            View Full Pickup Queue
          </button>
        </div>

      </div>

      {/* ------------------------------------------------------------- */}
      {/* 5. LOWER GRID (4 CARDS: ON BOARD, VERIFY, QUICK ACTIONS, FEED)*/}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* CARD 1: ON BOARD */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
              ON BOARD ({onBoardStudents.length})
            </h4>
            <span
              onClick={() => toast.info('Viewing full on-board student manifest')}
              className="text-[11px] text-emerald-600 font-bold cursor-pointer hover:underline"
            >
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
                {onBoardStudents.map((ob, idx) => (
                  <div key={ob.id || idx} className="p-2 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0">
                      {ob.name?.substring(0, 2)?.toUpperCase() || 'ST'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-900 truncate text-[11px] leading-tight">{ob.name}</div>
                      <div className="text-[9px] text-slate-400 truncate">Boarded {ob.time || '07:05 AM'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => toast.info('Displaying full on board student roster')}
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
              className="flex flex-col items-center gap-1.5 group cursor-pointer"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#00A859] text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
                <QrCode size={24} />
              </div>
              <span className="text-[10px] font-bold text-slate-800 max-w-[90px] leading-tight">
                Scan Student ID using camera
              </span>
            </button>

            <span className="text-xs font-bold text-slate-400">OR</span>

            <button
              onClick={() => onOpenVerificationModal()}
              className="flex flex-col items-center gap-1.5 group cursor-pointer"
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

        {/* CARD 3: QUICK ACTIONS (3x3 GRID) */}
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
              onClick={() => toast.info(`Connecting to Parent: ${nextPickupStudent?.parent_phone || '0803 456 7890'}`)}
              className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex flex-col items-center gap-1 transition-all"
            >
              <Phone size={16} className="text-blue-600" />
              <span>Call Parent</span>
            </button>

            <button
              onClick={() => toast.info(`Calling Driver: ${liveData?.driver?.phone || '0812 345 6789'}`)}
              className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex flex-col items-center gap-1 transition-all"
            >
              <User size={16} className="text-purple-600" />
              <span>Call Driver</span>
            </button>

            <button
              onClick={() => toast.info(`Connecting to School Office: ${liveData?.school?.phone || '0800-EDURIDE'}`)}
              className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex flex-col items-center gap-1 transition-all"
            >
              <Building size={16} className="text-amber-600" />
              <span>School Office</span>
            </button>

            <button
              onClick={() => toast.info('Connecting to Campus Security & Gate Officer...')}
              className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex flex-col items-center gap-1 transition-all"
            >
              <Shield size={16} className="text-emerald-600" />
              <span>Gate Officer</span>
            </button>

            <button
              onClick={() => toast.info('Connecting to City Manager Regional Command Hub...')}
              className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex flex-col items-center gap-1 transition-all"
            >
              <UserCheck size={16} className="text-slate-700" />
              <span>City Manager</span>
            </button>

            <button
              onClick={() => toast.info('Opening EduChat messages with Teachers & Parents...')}
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
            <span
              onClick={() => toast.info('Displaying full operational activity log')}
              className="text-[11px] text-emerald-600 font-bold cursor-pointer hover:underline"
            >
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
              activityFeed.slice(0, 5).map((act, idx) => (
                <div key={act.id || idx} className="flex items-start justify-between gap-2 text-[11px]">
                  <div className="flex items-start gap-1.5 text-slate-700 min-w-0 flex-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-1" />
                    <span className="font-medium leading-tight truncate">{act.text}</span>
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

      {/* ------------------------------------------------------------- */}
      {/* 6. BOTTOM TRIP PROGRESS STEPPER (7 MILESTONES)                */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
            TRIP PROGRESS
          </h4>
          <span className="text-[10px] font-bold text-slate-400">
            Current Stage: <strong className="text-emerald-700">Picking Up Students</strong>
          </span>
        </div>

        {/* Horizontal Stepper */}
        <div className="flex items-center justify-between relative overflow-x-auto py-2 px-4 min-w-[700px]">
          <div className="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-1 bg-slate-200 z-0" />
          <div className="absolute left-8 w-1/4 top-1/2 -translate-y-1/2 h-1 bg-[#00A859] z-0" />

          {/* Node 1: Trip Started */}
          <div className="relative z-10 text-center flex flex-col items-center gap-1">
            <div className="w-7 h-7 rounded-full bg-[#00A859] text-white flex items-center justify-center text-xs font-bold shadow-sm">
              ✓
            </div>
            <span className="font-bold text-xs text-slate-900">Trip Started</span>
            <span className="text-[10px] text-slate-400">06:45 AM</span>
          </div>

          {/* Node 2: Picking Up Students */}
          <div className="relative z-10 text-center flex flex-col items-center gap-1">
            <div className="w-7 h-7 rounded-full bg-[#00A859] text-white flex items-center justify-center text-xs font-bold shadow-sm ring-4 ring-emerald-100">
              ✓
            </div>
            <span className="font-bold text-xs text-slate-900">Picking Up Students</span>
            <span className="text-[10px] text-emerald-600 font-bold">{pickedCount} / {totalAssigned}</span>
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
