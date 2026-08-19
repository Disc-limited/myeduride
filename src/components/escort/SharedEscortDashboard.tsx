// @ts-nocheck
'use client';

import { useState } from 'react';
import {
  ShieldCheck,
  Navigation,
  MessageSquare,
  Bell,
  CheckCircle2,
  Clock,
  MapPin,
  Users,
  Car,
  Eye,
  EyeOff,
  Phone,
  AlertTriangle,
  Sparkles,
  ChevronRight,
  TrendingUp,
  CreditCard,
  QrCode,
  Shield,
  Search,
  Plus,
  Minus,
  Check,
  Send,
  ExternalLink,
  Award,
  DollarSign,
  Wallet,
  PiggyBank,
  Star,
  Activity,
  ArrowRight,
  Headphones,
  Copy,
  Info,
  Building,
  CheckSquare,
  Square,
  RotateCcw,
  Compass,
  Trophy,
  Wifi,
  Radio
} from 'lucide-react';
import { toast } from 'sonner';

interface SharedEscortDashboardProps {
  session?: any;
  escortData?: any;
  liveDashboardData?: any;
  onRefreshData?: () => void;
  onOpenVerificationModal?: (student?: any) => void;
  onOpenIncidentModal?: () => void;
  onOpenAccountModal?: () => void;
  isAvailableForOtherSchools?: boolean;
  onToggleAvailableForOtherSchools?: () => void;
}

export default function SharedEscortDashboard({
  session,
  escortData,
  liveDashboardData,
  onRefreshData,
  onOpenVerificationModal,
  onOpenIncidentModal,
  onOpenAccountModal,
  isAvailableForOtherSchools = true,
  onToggleAvailableForOtherSchools,
}: SharedEscortDashboardProps) {
  const [showWalletBalance, setShowWalletBalance] = useState(true);
  
  // Interactive State Management for Dashboard
  const [commTab, setCommTab] = useState<'all' | 'parents' | 'school' | 'cityManager'>('all');
  const [morningTripStarted, setMorningTripStarted] = useState(false);
  const [afternoonTripStarted, setAfternoonTripStarted] = useState(false);
  const [checklist, setChecklist] = useState({
    seatStudents: false,
    ensureSeatbelts: false,
    checkBelongings: false,
  });

  // Dynamic Live Database Bindings
  const escortName = liveDashboardData?.escort?.name || escortData?.name || escortData?.fullName || session?.full_name || 'Emeka Johnson';
  const escortCode = liveDashboardData?.escort?.code || escortData?.escort_code || escortData?.id || 'EMR-2031';
  const schoolName = liveDashboardData?.school?.name || 'St. Mary\'s School';
  const walletBal = liveDashboardData?.wallet?.balance ?? 500.0;
  const totalTrips = liveDashboardData?.stats?.totalTrips ?? 2;
  const totalStudents = liveDashboardData?.stats?.totalStudents ?? 12;
  const totalDistance = liveDashboardData?.stats?.totalDistance ?? '28.4 km';

  // Live Pickup List Data from Supabase DB
  const morningList = liveDashboardData?.students?.morning || [
    { id: '1', name: 'Grace Adekunle', address: '12 Education Drive, Benin City', status: 'PICKED', time: '7:52 AM', avatar: 'GA', initials: 'GA', color: 'bg-purple-600' },
    { id: '2', name: 'Tunde Ibrahim', address: '45 Greenfield Road, Benin City', status: 'NEXT', time: '8:15 AM', avatar: 'TI', initials: 'TI', color: 'bg-amber-500' },
  ];

  const afternoonList = liveDashboardData?.students?.afternoon || [
    { id: '1', name: 'Grace Adekunle', note: `Pick from ${schoolName} Gate`, avatar: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=150&auto=format&fit=crop&q=80' },
    { id: '2', name: 'Tunde Ibrahim', note: `Pick from ${schoolName} Gate`, avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80' },
  ];

  // Handle Morning Trip Start Action
  const handleStartMorningTrip = () => {
    setMorningTripStarted(true);
    toast.success('Morning trip to school started! Live navigation active.');
    // Move picked students to dropped off simulation if needed
  };

  // Handle Afternoon Trip Checklist Toggle
  const toggleChecklist = (key: keyof typeof checklist) => {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Handle Afternoon Trip Start
  const handleStartAfternoonTrip = () => {
    if (!checklist.seatStudents || !checklist.ensureSeatbelts || !checklist.checkBelongings) {
      toast.error('Please complete all safety checks before starting the trip.');
      return;
    }
    setAfternoonTripStarted(true);
    toast.success('Afternoon trip started safely!');
  };

  return (
    <div className="space-y-6 font-sans text-slate-800 text-xs">

      {/* ========================================================================= */}
      {/* 1. HERO ROW: GIGO/MIGO AI BANNER + TODAY'S TRIP SUMMARY */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left: GIGO/MIGO AI Greeting Banner (8 Cols) */}
        <div className="lg:col-span-8 bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start md:items-center gap-3.5 min-w-0">
            {/* Robot Mascot Icon */}
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-md shrink-0 border border-emerald-300">
              <div className="relative">
                <Sparkles className="w-6 h-6" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-300 animate-ping" />
              </div>
            </div>

            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-extrabold text-[10px] uppercase tracking-wider">
                  MIGO AI
                </span>
                <h3 className="font-extrabold text-slate-900 text-sm md:text-base tracking-tight truncate">
                  GIGO morning, {escortName.split(' ')[0]}! 👋
                </h3>
              </div>
              <p className="text-slate-600 text-xs font-medium truncate">
                You have <strong className="text-slate-900 font-bold">{totalTrips} trips today</strong>. Your first pickup is in <span className="text-emerald-600 font-bold font-mono">{morningList[0]?.time ? morningList[0].time : '12 mins'}</span>.
              </p>

              {/* Action Chips */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => toast.info('Safety Rules: Maintain 40km/h limit & ensure seatbelts.')}
                  className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-200/80 flex items-center gap-1.5 transition-all"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Follow safety rules</span>
                </button>

                <button
                  type="button"
                  onClick={() => toast.info('Updating Trip Status with Migo AI...')}
                  className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 text-[11px] font-bold border border-blue-200/80 flex items-center gap-1.5 transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>Update trip status</span>
                </button>

                <button
                  type="button"
                  onClick={() => toast.info('Communication guideline: Be polite and keep parents informed.')}
                  className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 text-[11px] font-bold border border-amber-200/80 flex items-center gap-1.5 transition-all"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
                  <span>Keep communication professional</span>
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => toast.info('Migo AI Details active')}
            className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 border border-slate-200 transition-all shrink-0 hidden md:block"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Right: TODAY'S TRIP SUMMARY Card (4 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
              TODAY'S TRIP SUMMARY
            </h4>
            <button
              type="button"
              onClick={() => toast.info('Viewing all scheduled trips')}
              className="text-[11px] font-bold text-emerald-600 hover:underline"
            >
              View All
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center divide-x divide-slate-100 pt-1">
            <div>
              <span className="text-2xl font-black text-slate-900 leading-tight block">{totalTrips}</span>
              <span className="text-[10px] text-slate-500 font-semibold block uppercase tracking-wider">Total Trips</span>
            </div>
            <div>
              <span className="text-2xl font-black text-slate-900 leading-tight block">{totalStudents}</span>
              <span className="text-[10px] text-slate-500 font-semibold block uppercase tracking-wider">Students</span>
            </div>
            <div>
              <span className="text-2xl font-black text-slate-900 leading-tight block">{totalDistance}</span>
              <span className="text-[10px] text-slate-500 font-semibold block uppercase tracking-wider">Total Distance</span>
            </div>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 2. ROW 1: NEXT PICKUP + LIVE MAP & ROUTE + TRIP PROGRESS */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5">
        
        {/* Card 1: NEXT PICKUP (3.5 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
              NEXT PICKUP
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-extrabold">
              {morningList[0]?.time ? `At ${morningList[0].time}` : 'In 12 mins (8:15 AM)'}
            </span>
          </div>

          <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
            <div className="w-10 h-10 rounded-full bg-purple-600 text-white font-extrabold flex items-center justify-center text-sm shadow-sm shrink-0">
              {morningList[0]?.avatar || morningList[0]?.name?.substring(0, 2)?.toUpperCase() || 'GA'}
            </div>
            <div className="min-w-0 space-y-0.5">
              <span className="text-[10px] font-medium text-slate-400 block uppercase">First Pickup</span>
              <h4 className="font-extrabold text-slate-900 text-sm truncate">{morningList[0]?.name || 'Grace Adekunle'}</h4>
              <p className="text-[11px] text-slate-600 font-medium flex items-center gap-1 leading-snug">
                <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">{morningList[0]?.address || '12 Education Drive, Benin City'}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => toast.success(`Starting navigation to ${morningList[0]?.name || 'Student'}...`)}
            className="w-full py-2.5 px-4 rounded-xl bg-[#00A859] hover:bg-emerald-600 text-white font-extrabold text-xs transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Navigate</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Card 2: LIVE MAP & ROUTE (4.5 Cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-emerald-600" /> LIVE MAP & ROUTE
            </h4>
            <span className="text-[10px] text-slate-400 font-medium">Real-time Route</span>
          </div>

          {/* Interactive Simulated Route Graphic */}
          <div className="relative w-full h-36 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shadow-inner flex flex-col justify-between p-3">
            {/* Map Road Path SVG */}
            <svg className="absolute inset-0 w-full h-full text-slate-300 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
              <path d="M 30 100 Q 120 20 220 80 T 360 30" fill="none" stroke="#CBD5E1" strokeWidth="12" strokeLinecap="round" />
              <path d="M 30 100 Q 120 20 220 80 T 360 30" fill="none" stroke="#00A859" strokeWidth="4" strokeDasharray="6,4" strokeLinecap="round" />
            </svg>

            {/* Map Town Labels */}
            <div className="relative z-10 flex justify-between text-[9px] font-bold text-slate-400 uppercase tracking-wider pointer-events-none">
              <span>Route 1</span>
              <span>Pickup</span>
              <span>En-route</span>
              <span>Arrival</span>
              <span>School</span>
            </div>

            {/* Route Pins */}
            <div className="relative z-10 flex items-center justify-between px-6 pointer-events-none">
              {/* Pin 1: Grace */}
              <div className="w-6 h-6 rounded-full bg-purple-600 text-white font-extrabold text-[10px] flex items-center justify-center shadow-lg ring-4 ring-purple-100">
                1
              </div>

              {/* Pin 2: Tunde */}
              <div className="w-6 h-6 rounded-full bg-amber-500 text-white font-extrabold text-[10px] flex items-center justify-center shadow-lg ring-4 ring-amber-100">
                2
              </div>

              {/* Pin School */}
              <div className="w-7 h-7 rounded-full bg-emerald-600 text-white font-extrabold text-xs flex items-center justify-center shadow-lg ring-4 ring-emerald-100">
                🏫
              </div>
            </div>
          </div>

          {/* Map Legend Pills */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10px] font-semibold text-slate-600 pt-1">
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-purple-600 text-white text-[9px] font-extrabold flex items-center justify-center">1</span>
              <span>{morningList[0]?.name || 'Grace Adekunle'} (1st)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-extrabold flex items-center justify-center">2</span>
              <span>{morningList[1]?.name || 'Tunde Ibrahim'} (2nd)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[9px] font-extrabold flex items-center justify-center">🎒</span>
              <span>{schoolName} (Drop-off)</span>
            </span>
          </div>
        </div>

        {/* Card 3: TRIP PROGRESS (3 Cols) */}
        <div className="lg:col-span-3 bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 space-y-3 flex flex-col justify-between">
          <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
            TRIP PROGRESS
          </h4>

          <div className="space-y-3 relative pl-4 border-l-2 border-slate-200 text-xs">
            {/* Step 1 */}
            <div className="relative">
              <span className="absolute -left-[21px] top-0.5 w-3.5 h-3.5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[8px] font-bold">1</span>
              <h5 className="font-extrabold text-blue-900 text-xs">Pickup in Progress</h5>
              <p className="text-[10px] text-blue-700 font-medium">
                {morningList.filter((s: any) => s.status === 'PICKED').length} of {morningList.length} Completed
              </p>
            </div>

            {/* Step 2 */}
            <div className="relative">
              <span className="absolute -left-[21px] top-0.5 w-3.5 h-3.5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[8px] font-bold">2</span>
              <h5 className="font-bold text-slate-700 text-xs">Drop-off to School</h5>
              <p className="text-[10px] text-slate-400">Pending</p>
            </div>

            {/* Step 3 */}
            <div className="relative">
              <span className="absolute -left-[21px] top-0.5 w-3.5 h-3.5 rounded-full bg-purple-600 text-white flex items-center justify-center text-[8px] font-bold">3</span>
              <h5 className="font-bold text-slate-700 text-xs">Afternoon Pickup</h5>
              <p className="text-[10px] text-slate-400">Pending</p>
            </div>

            {/* Step 4 */}
            <div className="relative">
              <span className="absolute -left-[21px] top-0.5 w-3.5 h-3.5 rounded-full bg-slate-300 text-slate-600 flex items-center justify-center text-[8px] font-bold">4</span>
              <h5 className="font-medium text-slate-400 text-xs">Return Trip</h5>
              <p className="text-[10px] text-slate-400">Pending</p>
            </div>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 3. ROW 2: PICKUP LISTS (MORNING, DROPPED OFF, AFTERNOON AT SCHOOL) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5">
        
        {/* Card 1: MORNING PICKUP LIST (4 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
              MORNING PICKUP LIST
            </h4>
            <span className="text-[10px] text-emerald-700 font-bold">
              {morningList.filter((s: any) => s.status === 'PICKED').length} of {morningList.length} Picked
            </span>
          </div>

          <div className="space-y-2.5">
            {morningList.map((stu: any, index: number) => (
              <div key={stu.id || index} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`w-5 h-5 rounded-full ${index === 0 ? 'bg-purple-600' : 'bg-amber-500'} text-white font-extrabold text-[10px] flex items-center justify-center shrink-0`}>
                    {index + 1}
                  </span>
                  <div className={`w-7 h-7 rounded-full ${index === 0 ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-800'} font-bold flex items-center justify-center text-xs shrink-0`}>
                    {stu.avatar || stu.name?.substring(0, 2)?.toUpperCase() || 'ST'}
                  </div>
                  <div className="min-w-0">
                    <h5 className="font-extrabold text-slate-900 text-xs truncate">{stu.name}</h5>
                    <p className="text-[10px] text-slate-500 truncate">{stu.address}</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded ${stu.status === 'PICKED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'} font-extrabold text-[9px] shrink-0 flex items-center gap-1`}>
                  {stu.status === 'PICKED' ? `PICKED ${stu.time || '7:52 AM'} ✓` : `NEXT ${stu.time || '8:15 AM'}`}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-slate-100 space-y-2">
            <p className="text-[10px] text-slate-500 font-medium text-center">
              All picked up? Start trip to school
            </p>
            <button
              type="button"
              onClick={handleStartMorningTrip}
              className="w-full py-2.5 px-4 rounded-xl bg-[#00A859] hover:bg-emerald-600 text-white font-extrabold text-xs transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>▶ Start Trip to School</span>
            </button>
          </div>
        </div>

        {/* Card 2: DROPPED OFF LIST (4 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
              DROPPED OFF LIST
            </h4>
            <span className="text-[10px] text-slate-400 font-medium">0 of {morningList.length} Dropped</span>
          </div>

          {/* Empty State Illustration */}
          <div className="py-6 px-4 text-center space-y-2 flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-50 text-slate-300 flex items-center justify-center border border-slate-100">
              <Building className="w-9 h-9" />
            </div>
            <p className="text-xs text-slate-600 font-semibold max-w-[200px] leading-snug">
              No students dropped off yet. Once you drop off at school, this list will appear.
            </p>
          </div>
        </div>

        {/* Card 3: AFTERNOON PICKUP LIST (AT SCHOOL) (4 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
              AFTERNOON PICKUP LIST <span className="text-[10px] text-slate-400 font-normal">(At {schoolName})</span>
            </h4>
            <span className="text-[10px] text-emerald-700 font-bold">Starts at 2:30 PM</span>
          </div>

          <div className="space-y-2">
            {afternoonList.map((stu: any, index: number) => (
              <div key={stu.id || index} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-purple-600 text-white font-extrabold text-[10px] flex items-center justify-center shrink-0">
                  {index + 1}
                </span>
                <img src={stu.avatar} alt={stu.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
                <div className="min-w-0">
                  <h5 className="font-extrabold text-slate-900 text-xs truncate">{stu.name}</h5>
                  <p className="text-[10px] text-slate-500 truncate">{stu.note || `Pick from ${schoolName} Gate`}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-200/80 text-blue-900 text-center text-xs font-semibold">
            Gate Officer will scan & release students to you.
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 4. ROW 3: GATE OFFICER RELEASE + TRIP CONTROL + TRIP JOURNEY */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5">
        
        {/* Card 1: GATE OFFICER RELEASE (Afternoon) (4 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
              GATE OFFICER RELEASE <span className="text-[10px] text-purple-700 font-bold">(Afternoon)</span>
            </h4>
          </div>

          <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
            <div className="w-14 h-14 rounded-xl bg-indigo-100 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <p className="text-xs text-slate-700 font-medium leading-snug">
              Gate Officer scans your Escort ID and releases students to you.
            </p>
          </div>

          <div className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-extrabold text-xs">
            <span>⏳ Pending release</span>
          </div>
        </div>

        {/* Card 2: TRIP CONTROL (4 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 space-y-3 flex flex-col justify-between">
          <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
            TRIP CONTROL
          </h4>

          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2 text-slate-600 font-semibold p-1">
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Waiting for students to board...</span>
            </div>

            <button
              type="button"
              onClick={() => toggleChecklist('seatStudents')}
              className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 transition-all text-left text-xs font-semibold text-slate-800"
            >
              {checklist.seatStudents ? (
                <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <Square className="w-4 h-4 text-slate-400 shrink-0" />
              )}
              <span>Seat all students</span>
            </button>

            <button
              type="button"
              onClick={() => toggleChecklist('ensureSeatbelts')}
              className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 transition-all text-left text-xs font-semibold text-slate-800"
            >
              {checklist.ensureSeatbelts ? (
                <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <Square className="w-4 h-4 text-slate-400 shrink-0" />
              )}
              <span>Ensure seatbelts</span>
            </button>

            <button
              type="button"
              onClick={() => toggleChecklist('checkBelongings')}
              className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 transition-all text-left text-xs font-semibold text-slate-800"
            >
              {checklist.checkBelongings ? (
                <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <Square className="w-4 h-4 text-slate-400 shrink-0" />
              )}
              <span>Check belongings</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleStartAfternoonTrip}
            className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs transition-all shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>▶ Start Trip</span>
          </button>
        </div>

        {/* Card 3: TRIP JOURNEY (Afternoon) (4 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 space-y-3 flex flex-col justify-between">
          <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
            TRIP JOURNEY <span className="text-[10px] text-purple-700 font-bold">(Afternoon)</span>
          </h4>

          <div className="space-y-2.5 relative pl-4 border-l-2 border-emerald-500 text-xs">
            {/* Journey Stop 1 */}
            <div className="relative flex items-center justify-between">
              <span className="absolute -left-[21px] w-4 h-4 rounded-full bg-emerald-600 text-white font-extrabold text-[10px] flex items-center justify-center">1</span>
              <div>
                <h5 className="font-extrabold text-slate-900 text-xs">{schoolName} <span className="text-[10px] font-normal text-slate-500">(Pickup)</span></h5>
              </div>
              <span className="font-mono text-slate-500 text-[11px] font-semibold">2:35 PM</span>
            </div>

            {/* Journey Stop 2 */}
            <div className="relative flex items-center justify-between">
              <span className="absolute -left-[21px] w-4 h-4 rounded-full bg-emerald-600 text-white font-extrabold text-[10px] flex items-center justify-center">2</span>
              <div>
                <h5 className="font-extrabold text-slate-900 text-xs">{afternoonList[0]?.name || morningList[0]?.name || 'Student 1'} <span className="text-[10px] font-normal text-slate-500">(Drop-off)</span></h5>
              </div>
              <span className="font-mono text-slate-500 text-[11px] font-semibold">2:48 PM</span>
            </div>

            {/* Journey Stop 3 */}
            <div className="relative flex items-center justify-between">
              <span className="absolute -left-[21px] w-4 h-4 rounded-full bg-emerald-600 text-white font-extrabold text-[10px] flex items-center justify-center">3</span>
              <div>
                <h5 className="font-extrabold text-slate-900 text-xs">{afternoonList[1]?.name || morningList[1]?.name || 'Student 2'} <span className="text-[10px] font-normal text-slate-500">(Drop-off)</span></h5>
              </div>
              <span className="font-mono text-slate-500 text-[11px] font-semibold">3:05 PM</span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700 text-center text-xs font-semibold">
            Est. arrival last stop: 3:15 PM ⌛
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 5. ROW 4: WALLET OVERVIEW + SAVINGS & PROTECTION + QUICK STATISTICS */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5">
        
        {/* Card 1: WALLET OVERVIEW (4 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
              WALLET OVERVIEW
            </h4>
            <button
              type="button"
              onClick={() => toast.info('Navigating to full Wallet...')}
              className="text-[11px] font-bold text-emerald-600 hover:underline"
            >
              View All
            </button>
          </div>

          {/* Dark Blue Inner Wallet Box */}
          <div className="bg-[#0A1633] text-white p-4 rounded-2xl space-y-3 shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-300 font-medium uppercase tracking-wider block">Available Balance</span>
                <h3 className="text-2xl font-black font-mono text-white mt-0.5">
                  {showWalletBalance ? `₦${walletBal.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '••••••'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => toast.info('Opening Fund Wallet Modal')}
                className="px-3.5 py-1.5 rounded-full bg-white text-slate-900 font-extrabold text-xs hover:bg-slate-100 transition-all shadow-sm cursor-pointer"
              >
                Fund Wallet
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">Today's Earnings</span>
                <strong className="text-white font-extrabold font-mono text-sm">
                  ₦{(liveDashboardData?.wallet?.todayEarnings ?? 2650).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">This Month</span>
                <strong className="text-white font-extrabold font-mono text-sm">
                  ₦{(liveDashboardData?.wallet?.monthEarnings ?? 18740).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </div>
            </div>
          </div>

          {/* Quick Action Icons Grid */}
          <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-semibold text-slate-700 pt-1">
            <button
              type="button"
              onClick={() => toast.info('Viewing Wallet Transactions')}
              className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex flex-col items-center gap-1 transition-all"
            >
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span>Transactions</span>
            </button>

            <button
              type="button"
              onClick={() => toast.info('Withdraw Earnings')}
              className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex flex-col items-center gap-1 transition-all"
            >
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <span>Withdraw</span>
            </button>

            <button
              type="button"
              onClick={() => toast.info('Transfer Funds')}
              className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex flex-col items-center gap-1 transition-all"
            >
              <RotateCcw className="w-4 h-4 text-emerald-600" />
              <span>Transfer</span>
            </button>

            <button
              type="button"
              onClick={() => toast.info('Download Statements')}
              className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex flex-col items-center gap-1 transition-all"
            >
              <Wallet className="w-4 h-4 text-emerald-600" />
              <span>Statements</span>
            </button>
          </div>
        </div>

        {/* Card 2: SAVINGS & PROTECTION (4 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 space-y-3 flex flex-col justify-between">
          <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
            SAVINGS & PROTECTION
          </h4>

          <div className="space-y-2.5">
            {/* EduSave */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <PiggyBank className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="font-extrabold text-slate-900 text-xs">EduSave</h5>
                  <p className="text-[10px] text-slate-500">You have saved <strong className="text-slate-900 font-bold font-mono">₦12,400.00</strong></p>
                </div>
              </div>
              <button type="button" onClick={() => toast.info('Opening EduSave')} className="text-[11px] font-bold text-emerald-600 hover:underline">View</button>
            </div>

            {/* EduInsuRed */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="font-extrabold text-slate-900 text-xs">EduInsuRed</h5>
                  <p className="text-[10px] text-slate-500">Active Plan</p>
                </div>
              </div>
              <button type="button" onClick={() => toast.info('Opening EduInsuRed Policy')} className="text-[11px] font-bold text-emerald-600 hover:underline">View</button>
            </div>

            {/* SafetyConnect */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="font-extrabold text-slate-900 text-xs">SafetyConnect</h5>
                  <p className="text-[10px] text-slate-500">Emergency support for you</p>
                </div>
              </div>
              <button type="button" onClick={() => toast.info('SafetyConnect Emergency Active')} className="text-[11px] font-bold text-emerald-600 hover:underline">View</button>
            </div>
          </div>
        </div>

        {/* Card 3: QUICK STATISTICS (4 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
              QUICK STATISTICS
            </h4>
            <button type="button" onClick={() => toast.info('Viewing Full Stats')} className="text-[11px] font-bold text-emerald-600 hover:underline">View All</button>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600 flex items-center gap-1.5"><Car className="w-3.5 h-3.5 text-emerald-600" /> Trips Completed <span className="text-[10px] text-slate-400">(Today)</span></span>
              <strong className="font-black text-slate-900 text-xs">{totalTrips}</strong>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600 flex items-center gap-1.5"><Compass className="w-3.5 h-3.5 text-emerald-600" /> Total Distance <span className="text-[10px] text-slate-400">(Today)</span></span>
              <strong className="font-black text-slate-900 text-xs">{totalDistance}</strong>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600 flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-emerald-600" /> Total Students <span className="text-[10px] text-slate-400">(Served)</span></span>
              <strong className="font-black text-slate-900 text-xs">{totalStudents}</strong>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600 flex items-center gap-1.5"><Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" /> Average Rating</span>
              <strong className="font-black text-amber-600 text-xs">⭐ {liveDashboardData?.stats?.averageRating ?? 4.8}</strong>
            </div>

            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-semibold">On-Time Performance</span>
                <strong className="font-extrabold text-emerald-600 text-xs">{liveDashboardData?.stats?.onTimePerformance ?? 96}%</strong>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${liveDashboardData?.stats?.onTimePerformance ?? 96}%` }} />
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 6. ROW 5: COMMUNICATIONS + ANNOUNCEMENTS + TODAY'S DESTINATIONS */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5">
        
        {/* Card 1: COMMUNICATIONS (4 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
              COMMUNICATIONS
            </h4>
            <button type="button" onClick={() => toast.info('Viewing all chats')} className="text-[11px] font-bold text-emerald-600 hover:underline">View All</button>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-[10px] font-bold">
            {(['all', 'parents', 'school', 'cityManager'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setCommTab(tab)}
                className={`px-2 py-1 rounded-lg capitalize transition-all ${
                  commTab === tab ? 'bg-white text-slate-900 shadow-xs font-extrabold' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {tab === 'cityManager' ? 'City Manager' : tab}
              </button>
            ))}
          </div>

          {/* Chat Messages List */}
          <div className="space-y-2 text-xs">
            {/* Msg 1 */}
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center shrink-0">
                  🏫
                </div>
                <div className="min-w-0">
                  <h5 className="font-extrabold text-slate-900 text-xs truncate">{schoolName}</h5>
                  <p className="text-[10px] text-slate-500 truncate">New message from school admin</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[9px] text-slate-400 font-mono block">10:20 AM</span>
                <span className="w-4 h-4 rounded-full bg-emerald-600 text-white font-bold text-[9px] inline-flex items-center justify-center">2</span>
              </div>
            </div>

            {/* Msg 2 */}
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 font-bold flex items-center justify-center shrink-0">
                  👩
                </div>
                <div className="min-w-0">
                  <h5 className="font-extrabold text-slate-900 text-xs truncate">Parent of {morningList[0]?.name || 'Student'}</h5>
                  <p className="text-[10px] text-slate-500 truncate">Trip update acknowledged</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[9px] text-slate-400 font-mono block">9:58 AM</span>
                <span className="w-4 h-4 rounded-full bg-emerald-600 text-white font-bold text-[9px] inline-flex items-center justify-center">1</span>
              </div>
            </div>

            {/* Msg 3 */}
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center shrink-0">
                  👔
                </div>
                <div className="min-w-0">
                  <h5 className="font-extrabold text-slate-900 text-xs truncate">City Manager</h5>
                  <p className="text-[10px] text-slate-500 truncate">Safety meeting tomorrow 10AM</p>
                </div>
              </div>
              <span className="text-[9px] text-slate-400 font-mono shrink-0">9:30 AM</span>
            </div>
          </div>
        </div>

        {/* Card 2: ANNOUNCEMENTS (4 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
              ANNOUNCEMENTS
            </h4>
            <button type="button" onClick={() => toast.info('Viewing all announcements')} className="text-[11px] font-bold text-emerald-600 hover:underline">View All</button>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h5 className="font-extrabold text-slate-900 text-xs">Safety First</h5>
                  <span className="text-[9px] text-slate-400 font-mono">2h ago</span>
                </div>
                <p className="text-[10px] text-slate-500">Always follow safety protocols and speed limits.</p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h5 className="font-extrabold text-slate-900 text-xs">Platform Update</h5>
                  <span className="text-[9px] text-slate-400 font-mono">1d ago</span>
                </div>
                <p className="text-[10px] text-slate-500">New features added to improve your experience.</p>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-md bg-red-100 text-red-700 flex items-center justify-center shrink-0 mt-0.5">
                <Bell className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h5 className="font-extrabold text-slate-900 text-xs">Meeting Reminder</h5>
                  <span className="text-[9px] text-slate-400 font-mono">2d ago</span>
                </div>
                <p className="text-[10px] text-slate-500">City Escort meeting on Friday at 10:00 AM.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: TODAY'S DESTINATIONS (4 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
              TODAY'S DESTINATIONS
            </h4>
            <button type="button" onClick={() => toast.info('Viewing complete route map')} className="text-[11px] font-bold text-emerald-600 hover:underline">View Route</button>
          </div>

          <div className="space-y-2.5 relative pl-4 border-l-2 border-emerald-500 text-xs">
            <div className="relative flex items-center justify-between">
              <span className="absolute -left-[21px] w-4 h-4 rounded-full bg-purple-600 text-white font-extrabold text-[10px] flex items-center justify-center">1</span>
              <div>
                <h5 className="font-extrabold text-slate-900 text-xs">{morningList[0]?.name || 'Grace Adekunle'}</h5>
                <p className="text-[10px] text-slate-500 truncate max-w-[150px]">{morningList[0]?.address || '12 Education Drive, Benin City'}</p>
              </div>
              <span className="font-mono text-slate-500 text-[10px] font-semibold">{morningList[0]?.time || '8:15 AM'}</span>
            </div>

            <div className="relative flex items-center justify-between">
              <span className="absolute -left-[21px] w-4 h-4 rounded-full bg-amber-500 text-white font-extrabold text-[10px] flex items-center justify-center">2</span>
              <div>
                <h5 className="font-extrabold text-slate-900 text-xs">{morningList[1]?.name || 'Tunde Ibrahim'}</h5>
                <p className="text-[10px] text-slate-500 truncate max-w-[150px]">{morningList[1]?.address || '45 Greenfield Road, Benin City'}</p>
              </div>
              <span className="font-mono text-slate-500 text-[10px] font-semibold">{morningList[1]?.time || '8:35 AM'}</span>
            </div>

            <div className="relative flex items-center justify-between">
              <span className="absolute -left-[21px] w-4 h-4 rounded-full bg-emerald-600 text-white font-extrabold text-[10px] flex items-center justify-center">🎒</span>
              <div>
                <h5 className="font-extrabold text-slate-900 text-xs">School Drop-off</h5>
                <p className="text-[10px] text-slate-500">{schoolName}</p>
              </div>
              <span className="font-mono text-slate-500 text-[10px] font-semibold">9:00 AM</span>
            </div>

            <div className="relative flex items-center justify-between">
              <span className="absolute -left-[21px] w-4 h-4 rounded-full bg-emerald-600 text-white font-extrabold text-[10px] flex items-center justify-center">🎒</span>
              <div>
                <h5 className="font-extrabold text-slate-900 text-xs">Afternoon Pickup (From School)</h5>
                <p className="text-[10px] text-slate-500">{schoolName} Gate</p>
              </div>
              <span className="font-mono text-slate-500 text-[10px] font-semibold">2:30 PM</span>
            </div>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 7. BOTTOM CALL-TO-ACTION BANNER */}
      {/* ========================================================================= */}
      <div className="bg-[#081530] rounded-2xl p-4 sm:p-5 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/40 text-amber-300 flex items-center justify-center text-xl shrink-0">
            🏆
          </div>
          <div>
            <h4 className="font-extrabold text-white text-sm sm:text-base flex items-center gap-2">
              <span>Well done, {escortName.split(' ')[0]}! 🎉</span>
            </h4>
            <p className="text-slate-300 text-xs font-medium">
              You have completed all trips for today.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold">
          <span className="text-slate-300 text-center md:text-right">
            Want to accept more trips? <br className="hidden sm:block" /> Go available for other schools and earn more.
          </span>

          <button
            type="button"
            onClick={onToggleAvailableForOtherSchools}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 border shadow-md cursor-pointer ${
              isAvailableForOtherSchools
                ? 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-700'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <span>Available for Other Schools</span>
            <div className={`w-8 h-4 rounded-full transition-all relative p-0.5 ${isAvailableForOtherSchools ? 'bg-emerald-300' : 'bg-slate-600'}`}>
              <div className={`w-3 h-3 rounded-full bg-white transition-all shadow-sm ${isAvailableForOtherSchools ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 8. SYSTEM STATUS FOOTER */}
      {/* ========================================================================= */}
      <footer className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center justify-between text-[11px] font-semibold text-slate-500 gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span>System Status</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <strong className="text-slate-800 font-bold">Operational</strong>
          </span>

          <span className="flex items-center gap-1.5">
            <span>GPS</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <strong className="text-slate-800 font-bold">Connected</strong>
          </span>

          <span className="flex items-center gap-1.5">
            <span>Internet</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <strong className="text-slate-800 font-bold">Connected</strong>
          </span>

          <span className="text-slate-400">
            Last Sync: <strong className="text-slate-700 font-mono">10:24:35 AM</strong>
          </span>
        </div>

        <div className="font-mono text-slate-400 font-bold">
          MyEduRide v2.5.0
        </div>
      </footer>

    </div>
  );
}
