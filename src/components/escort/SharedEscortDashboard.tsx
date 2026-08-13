// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
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
  PhoneCall,
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
  ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';

interface SharedEscortDashboardProps {
  session?: any;
  escortData?: any;
  onOpenVerificationModal?: (student?: any) => void;
  onOpenIncidentModal?: () => void;
  onOpenAccountModal?: () => void;
}

export default function SharedEscortDashboard({
  session,
  escortData,
  onOpenVerificationModal,
  onOpenIncidentModal,
  onOpenAccountModal,
}: SharedEscortDashboardProps) {
  const [showWalletBalance, setShowWalletBalance] = useState(true);
  const [activeRideStep, setActiveRideStep] = useState(2); // 2: Picking Up Students

  // Dynamic live profile resolution
  const displayName = escortData?.name || escortData?.fullName || session?.full_name || session?.name || 'John Adebayo';
  const escortIdCode = escortData?.escort_code || escortData?.escortCode || escortData?.id || 'ESC-230081';
  const displayPhoto = escortData?.photo || escortData?.uploadedDocDetails?.selfie?.fileUrl || escortData?.uploadedDocDetails?.live_face?.fileUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
  const regNumber = escortData?.vehicle?.regNumber || escortData?.regNumber || 'KJA 123 XY';
  const vehicleType = escortData?.vehicle?.type || escortData?.vehicleType || 'Hiace Bus (18 Seater)';
  const operatingCity = escortData?.city || escortData?.state || 'Lagos';

  // Mock Students On Board
  const [onBoardStudents] = useState([
    { id: '1', name: 'David James', school: 'Greenfield Intl. School', time: '06:50 AM', photo: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=150&auto=format&fit=crop&q=80' },
    { id: '2', name: 'Esther Paul', school: 'Greenfield Intl. School', time: '06:52 AM', photo: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80' },
    { id: '3', name: 'Michael Obi', school: 'Greenfield Intl. School', time: '06:55 AM', photo: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80' },
    { id: '4', name: 'Sarah Yusuf', school: 'Greenfield Intl. School', time: '06:57 AM', photo: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80' },
  ]);

  return (
    <div className="space-y-5 font-poppins text-slate-800">
      
      {/* ========================================================================= */}
      {/* 1. TOP HEADER STATUS WIDGET BAR */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-center">
        
        {/* User Profile Info Badge (3.5 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-3 shadow-sm border border-slate-200/90 flex items-center gap-3">
          <div className="relative shrink-0">
            <img
              src={displayPhoto}
              alt={displayName}
              className="w-12 h-12 rounded-xl object-cover border-2 border-emerald-500 shadow-sm"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
              }}
            />
            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-medium">Good morning,</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Online
              </span>
            </div>
            <h3 className="font-extrabold text-slate-900 text-sm truncate">{displayName}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] font-mono text-slate-500">Escort ID: {escortIdCode}</span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 text-[9px] font-black border border-emerald-200">
                ✓ Verified Escort
              </span>
            </div>
          </div>
        </div>

        {/* Vehicle Badge (2.5 Cols) */}
        <div className="lg:col-span-3 bg-white rounded-2xl p-3 shadow-sm border border-slate-200/90 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
            <Car className="w-6 h-6 text-brand-green" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">Vehicle</span>
            <h4 className="font-extrabold text-slate-900 text-xs font-mono">{regNumber}</h4>
            <p className="text-[11px] text-slate-500 font-medium truncate">{vehicleType}</p>
          </div>
        </div>

        {/* Current Status Badge (2.5 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-3 shadow-sm border border-slate-200/90 flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider block">Current Status</span>
            <h4 className="font-black text-emerald-600 text-xs flex items-center gap-1">
              On a Trip
            </h4>
            <p className="text-[11px] text-slate-600 font-semibold mt-0.5 flex items-center gap-1">
              <span>8/18 Seats Occupied</span>
              <Users className="w-3 h-3 text-slate-400" />
            </p>
          </div>
        </div>

        {/* Wallet Balance Card (3 Cols) */}
        <div className="lg:col-span-3 bg-white rounded-2xl p-3 shadow-sm border border-slate-200/90 flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium uppercase tracking-wider">
              <span>Wallet Balance</span>
              <button
                type="button"
                onClick={() => setShowWalletBalance(!showWalletBalance)}
                className="text-slate-400 hover:text-slate-600"
              >
                {showWalletBalance ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              </button>
            </div>
            <h4 className="font-black text-emerald-600 text-base font-mono mt-0.5">
              {showWalletBalance ? '₦28,450.00' : '••••••••'}
            </h4>
          </div>
          <button
            type="button"
            onClick={() => toast.info('Navigating to Wallet Top Up...')}
            className="px-3 py-1.5 rounded-xl bg-brand-green hover:bg-emerald-600 text-white font-bold text-xs transition-all shadow-sm"
          >
            Top Up
          </button>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 2. HERO SAFETY & EARN MORE BANNER */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-r from-[#06182e] via-[#0b284c] to-[#041224] rounded-3xl p-4 sm:p-5 text-white shadow-xl border border-slate-800 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center relative overflow-hidden">
        {/* Left Safety Section (6 Cols) */}
        <div className="lg:col-span-6 space-y-2 z-10">
          <div className="flex items-center gap-2">
            {/* DISC Logo */}
            <div className="flex items-center gap-1">
              <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-red-500 via-amber-400 to-emerald-400 flex items-center justify-center font-black text-slate-950 text-[10px]">
                D
              </div>
              <span className="font-black text-white text-sm tracking-wider">disc.</span>
            </div>
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">• THE STUDENT SAFETY PLATFORM</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            SAFETY FIRST, ALWAYS!
          </h2>
          <p className="text-xs text-slate-300 font-medium max-w-sm leading-relaxed">
            Let's keep every child safe on every route, every day.
          </p>

          <button
            type="button"
            onClick={() => toast.info('Opening DISC Safety Guidelines')}
            className="mt-2 px-4 py-2 rounded-xl bg-brand-green hover:bg-emerald-600 text-white text-xs font-bold transition-all shadow-md inline-flex items-center gap-1.5"
          >
            Learn More
          </button>
        </div>

        {/* Center Bus & Children Graphic (3 Cols) */}
        <div className="lg:col-span-3 hidden lg:flex items-center justify-center relative">
          <div className="relative">
            <img
              src="https://images.unsplash.com/photo-1544717305-2782549b5136?w=300&auto=format&fit=crop&q=80"
              alt="School Children"
              className="w-44 h-24 rounded-2xl object-cover border-2 border-emerald-400 shadow-2xl"
            />
            <div className="absolute -bottom-2 -left-3 bg-brand-green text-white p-1.5 rounded-xl shadow-lg border border-emerald-300">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Right Earn More SAVI Intelligence Box (3 Cols) */}
        <div className="lg:col-span-3 bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 space-y-2 z-10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-emerald-400 uppercase tracking-wider">EARN MORE</span>
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-[10px] text-slate-400 font-mono">POWERED BY SAVI INTELLIGENCE</p>
          <p className="text-xs text-slate-200 font-medium leading-snug">
            More trips. More impact. More earnings.
          </p>
          <div className="flex items-center gap-2 pt-1">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="text-[11px] text-emerald-300 font-bold">Migo AI Route Optimizer Active</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. MAIN DASHBOARD CONTENT GRID (3 COLUMNS) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* ========================================================================= */}
        {/* LEFT COLUMN: LIVE TRACKING & RIDE QUEUE & MIGO AI (4.5 COLS) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* 1. LIVE TRACKING PANEL */}
          <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200/90 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Navigation className="w-4 h-4 text-brand-green" /> LIVE TRACKING
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
              </span>
            </div>

            {/* Simulated Live Map Canvas */}
            <div className="relative w-full h-56 rounded-2xl bg-sky-50 border border-slate-200 overflow-hidden shadow-inner flex flex-col justify-between p-3">
              {/* Map SVG Background & Route Line */}
              <svg className="absolute inset-0 w-full h-full text-sky-200 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
                <line x1="10%" y1="70%" x2="45%" y2="40%" stroke="#00A859" strokeWidth="4" strokeDasharray="6,4" />
                <line x1="45%" y1="40%" x2="85%" y2="25%" stroke="#00A859" strokeWidth="4" />
                <circle cx="85%" cy="25%" r="8" fill="#00A859" opacity="0.3" />
                <circle cx="85%" cy="25%" r="4" fill="#00A859" />
              </svg>

              {/* Map Controls Overlay (Top Left) */}
              <div className="relative z-10 flex flex-col gap-1 w-7 bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden text-slate-700 text-xs font-bold">
                <button type="button" onClick={() => toast.info('Map Zoom In')} className="p-1.5 hover:bg-slate-100 text-center">+</button>
                <button type="button" onClick={() => toast.info('Map Zoom Out')} className="p-1.5 hover:bg-slate-100 border-t border-slate-200 text-center">-</button>
                <button type="button" onClick={() => toast.info('Recenter Map')} className="p-1.5 hover:bg-slate-100 border-t border-slate-200 flex items-center justify-center">
                  <Navigation className="w-3 h-3 text-brand-green" />
                </button>
              </div>

              {/* Map Road Labels */}
              <div className="relative z-10 flex justify-between text-[10px] font-bold text-slate-500 font-mono px-2">
                <span>Chevron Drive</span>
                <span>Admiralty Way</span>
              </div>

              {/* Moving Van Marker Icon */}
              <div className="absolute top-[35%] left-[42%] z-10 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-brand-green text-white flex items-center justify-center shadow-lg border-2 border-white animate-bounce">
                  <Car className="w-4 h-4" />
                </div>
                <span className="px-1.5 py-0.5 rounded bg-slate-900 text-white text-[9px] font-mono font-bold mt-1 shadow-md">
                  KJA 123 XY
                </span>
              </div>

              {/* Floating Bottom Trip Summary Bar */}
              <div className="relative z-10 bg-white/95 backdrop-blur-md rounded-xl p-2.5 shadow-lg border border-slate-200/90 grid grid-cols-4 gap-2 text-center text-xs">
                <div>
                  <span className="text-[9px] text-slate-400 block font-medium">Next Stop</span>
                  <strong className="text-slate-900 font-bold text-[11px] truncate block">Royal Crest</strong>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 block font-medium">ETA</span>
                  <strong className="text-emerald-600 font-extrabold text-xs">5 min</strong>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 block font-medium">Distance</span>
                  <strong className="text-slate-900 font-bold text-xs">1.2 km</strong>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 block font-medium">Arrival</span>
                  <strong className="text-slate-900 font-bold text-xs font-mono">07:37 AM</strong>
                </div>
              </div>
            </div>
          </div>

          {/* 2. RIDE QUEUE (3) PANEL */}
          <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200/90 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-brand-green" /> RIDE QUEUE (3)
              </h3>
              <button
                type="button"
                onClick={() => toast.info('Viewing Full Schedule')}
                className="text-[11px] font-bold text-brand-green hover:underline"
              >
                View Full Schedule
              </button>
            </div>

            <div className="space-y-2.5">
              {/* Queue Item 1 */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="px-2 py-1 rounded-lg bg-emerald-500 text-white font-mono font-bold text-[10px] shrink-0">
                    06:45 AM
                  </span>
                  <div className="min-w-0">
                    <h4 className="font-bold text-slate-900 text-[11px] truncate">Greenfield Intl. School</h4>
                    <p className="text-[10px] text-slate-500 truncate">→ Royal Crest School</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-bold text-slate-900 text-xs block">8/18</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-extrabold uppercase">
                    In Progress
                  </span>
                </div>
              </div>

              {/* Queue Item 2 */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="px-2 py-1 rounded-lg bg-amber-400 text-slate-950 font-mono font-bold text-[10px] shrink-0">
                    08:15 AM
                  </span>
                  <div className="min-w-0">
                    <h4 className="font-bold text-slate-900 text-[11px] truncate">Royal Crest School</h4>
                    <p className="text-[10px] text-slate-500 truncate">→ Lakeside Academy</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-bold text-slate-900 text-xs block">12/18</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[9px] font-extrabold uppercase">
                    Upcoming
                  </span>
                </div>
              </div>

              {/* Queue Item 3 */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="px-2 py-1 rounded-lg bg-sky-500 text-white font-mono font-bold text-[10px] shrink-0">
                    09:15 AM
                  </span>
                  <div className="min-w-0">
                    <h4 className="font-bold text-slate-900 text-[11px] truncate">Lakeside Academy</h4>
                    <p className="text-[10px] text-slate-500 truncate">→ Sunshine Kids School</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-bold text-slate-900 text-xs block">10/18</span>
                  <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 text-[9px] font-extrabold uppercase">
                    Scheduled
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. MIGO AI ASSISTANT CARD */}
          <div className="bg-gradient-to-br from-emerald-50 via-teal-50 to-sky-50 rounded-3xl p-4 shadow-sm border border-emerald-200/80 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md border border-white shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                  MIGO <span className="text-[10px] text-slate-400 font-mono">powered by SAVI</span>
                </h4>
                <p className="text-[11px] text-slate-600 font-medium">Hi John! 👋 You're on track for a smooth trip.</p>
              </div>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed bg-white/80 p-3 rounded-2xl border border-emerald-200/60 shadow-xs">
              Next stop: <strong className="text-slate-900">Royal Crest School (1.2 km)</strong>. Heavy traffic reported on Admiralty Way. Faster route saved 3 minutes. 8 students on board. Drive safely!
            </p>

            <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[11px]">
              <button type="button" onClick={() => toast.info('Asking Migo AI')} className="px-3 py-1 rounded-xl bg-white border border-emerald-300 text-slate-700 font-bold hover:bg-emerald-100/60 shadow-xs">Ask Migo</button>
              <button type="button" onClick={() => toast.info('Rerouting...')} className="px-3 py-1 rounded-xl bg-white border border-emerald-300 text-slate-700 font-bold hover:bg-emerald-100/60 shadow-xs">Navigate</button>
              <button type="button" onClick={() => toast.info('Checking Traffic')} className="px-3 py-1 rounded-xl bg-white border border-emerald-300 text-slate-700 font-bold hover:bg-emerald-100/60 shadow-xs">Traffic Update</button>
              <button type="button" onClick={() => toast.info('Calling Parent')} className="px-3 py-1 rounded-xl bg-white border border-emerald-300 text-slate-700 font-bold hover:bg-emerald-100/60 shadow-xs">Call Parent</button>
            </div>
          </div>

        </div>

        {/* ========================================================================= */}
        {/* MIDDLE COLUMN: TODAY'S ASSIGNMENTS & ON BOARD & RIDE PROGRESS & EDUCHAT (4.5 COLS) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-4 space-y-5">
          
          {/* 1. TODAY'S ASSIGNMENTS */}
          <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200/90 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Award className="w-4 h-4 text-brand-green" /> TODAY'S ASSIGNMENTS
              </h3>
              <button type="button" onClick={() => toast.info('Viewing All Assignments')} className="text-[11px] font-bold text-brand-green hover:underline">View All</button>
            </div>

            <div className="space-y-2.5">
              {/* Assignment Card 1 */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-extrabold uppercase">In Progress</span>
                  <span className="font-bold text-slate-700 flex items-center gap-1 text-[11px]">
                    <Users className="w-3.5 h-3.5 text-brand-green" /> 8/18 Students
                  </span>
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-xs">Greenfield International School</h4>
                  <p className="text-[11px] text-slate-600 font-medium">→ Royal Crest School</p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">06:45 AM – 07:45 AM</p>
                </div>
                <button type="button" onClick={() => toast.info('Opening Assignment Details')} className="text-[11px] font-bold text-brand-green hover:underline flex items-center gap-1 pt-1">
                  View Details <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              {/* Assignment Card 2 */}
              <div className="p-3.5 rounded-2xl bg-amber-50/60 border border-amber-200 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[9px] font-extrabold uppercase">Upcoming</span>
                  <span className="font-bold text-slate-700 flex items-center gap-1 text-[11px]">
                    <Users className="w-3.5 h-3.5 text-amber-600" /> 12/18 Students
                  </span>
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-xs">Royal Crest School</h4>
                  <p className="text-[11px] text-slate-600 font-medium">→ Lakeside Academy</p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">08:15 AM – 08:45 AM</p>
                </div>
                <button type="button" onClick={() => toast.info('Opening Assignment Details')} className="text-[11px] font-bold text-brand-green hover:underline flex items-center gap-1 pt-1">
                  View Details <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {/* 2. ON BOARD (8/18) */}
          <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200/90 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4 text-brand-green" /> ON BOARD (8/18)
              </h3>
              <button type="button" onClick={() => toast.info('Viewing All On Board')} className="text-[11px] font-bold text-brand-green hover:underline">View All</button>
            </div>

            <div className="space-y-2">
              {onBoardStudents.map((stu) => (
                <div key={stu.id} className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img src={stu.photo} alt={stu.name} className="w-8 h-8 rounded-xl object-cover border border-slate-300 shrink-0" />
                    <div className="min-w-0">
                      <h4 className="font-bold text-slate-900 text-[11px] truncate">{stu.name}</h4>
                      <p className="text-[10px] text-slate-500 truncate">{stu.school}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-emerald-700 font-bold block">Picked Up</span>
                    <span className="text-[9px] text-slate-400 font-mono">{stu.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. RIDE PROGRESS */}
          <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200/90 space-y-3">
            <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-brand-green" /> RIDE PROGRESS
            </h3>

            <div className="space-y-3 relative pl-4 border-l-2 border-slate-200 text-xs">
              <div className="relative">
                <span className="absolute -left-[21px] top-0.5 w-3.5 h-3.5 rounded-full bg-brand-green text-white flex items-center justify-center text-[9px] font-black">✓</span>
                <h4 className="font-bold text-slate-900 text-xs">Trip Started</h4>
                <p className="text-[10px] text-slate-400">06:45 AM</p>
              </div>

              <div className="relative">
                <span className="absolute -left-[21px] top-0.5 w-3.5 h-3.5 rounded-full bg-brand-green text-white flex items-center justify-center text-[9px] font-black">✓</span>
                <h4 className="font-extrabold text-emerald-700 text-xs">Picking Up Students</h4>
                <p className="text-[10px] text-emerald-600 font-medium">8 / 18 Picked (In Progress)</p>
              </div>

              <div className="relative">
                <span className="absolute -left-[21px] top-0.5 w-3.5 h-3.5 rounded-full bg-sky-500 border-2 border-white ring-2 ring-sky-200" />
                <h4 className="font-bold text-slate-700 text-xs">On the Way</h4>
                <p className="text-[10px] text-slate-400">In Progress</p>
              </div>

              <div className="relative">
                <span className="absolute -left-[21px] top-0.5 w-3.5 h-3.5 rounded-full bg-slate-300" />
                <h4 className="font-medium text-slate-400 text-xs">Arriving at School</h4>
                <p className="text-[10px] text-slate-400">Pending</p>
              </div>

              <div className="relative">
                <span className="absolute -left-[21px] top-0.5 w-3.5 h-3.5 rounded-full bg-slate-300" />
                <h4 className="font-medium text-slate-400 text-xs">Trip Completed</h4>
                <p className="text-[10px] text-slate-400">Pending</p>
              </div>
            </div>
          </div>

          {/* 4. EDUCHAT WIDGET */}
          <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200/90 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-brand-green" /> EDUCHAT
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-[9px] font-black">5 New Messages</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-[11px]">City Manager</h4>
                  <p className="text-[10px] text-slate-500 truncate max-w-[180px]">Please adhere to speed limits.</p>
                </div>
                <span className="text-[9px] text-slate-400 font-mono">07:28 AM</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-[11px]">Mrs. Bello (Parent)</h4>
                  <p className="text-[10px] text-slate-500 truncate max-w-[180px]">Thank you for the update.</p>
                </div>
                <span className="text-[9px] text-slate-400 font-mono">07:30 AM</span>
              </div>
            </div>

            <button type="button" onClick={() => toast.info('Opening EduChat')} className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-all text-center border border-slate-200">
              Open EduChat
            </button>
          </div>

        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: EARNINGS & QUICK ACTIONS & FINANCIALS & EDUSAVE & EDUINSURED (3 COLS) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-3 space-y-5">
          
          {/* 1. TODAY'S EARNINGS */}
          <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200/90 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-brand-green" /> TODAY'S EARNINGS
              </h3>
              <button type="button" onClick={() => toast.info('Viewing Statement')} className="text-[11px] font-bold text-brand-green hover:underline">View Statement</button>
            </div>

            <div>
              <h2 className="text-2xl font-black text-emerald-600 font-mono">₦14,600.00</h2>
              <p className="text-[10px] text-slate-400 font-medium">Earnings Today</p>
            </div>

            <div className="grid grid-cols-3 gap-1 p-2 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs">
              <div>
                <strong className="text-slate-900 font-bold text-xs block">3</strong>
                <span className="text-[9px] text-slate-400">Trips</span>
              </div>
              <div className="border-x border-slate-200">
                <strong className="text-slate-900 font-bold text-xs block">30.2 km</strong>
                <span className="text-[9px] text-slate-400">Distance</span>
              </div>
              <div>
                <strong className="text-slate-900 font-bold text-xs block">2h 45m</strong>
                <span className="text-[9px] text-slate-400">Online</span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-500 font-medium block">WEEKLY SUMMARY</span>
                <strong className="text-emerald-700 font-extrabold text-sm font-mono">₦78,450.00</strong>
              </div>
              <div className="text-right text-[10px] text-slate-600">
                <p className="font-bold">12 Trips</p>
                <p className="font-mono">126.4 km</p>
              </div>
            </div>
          </div>

          {/* 2. QUICK ACTIONS (8 BUTTONS GRID) */}
          <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200/90 space-y-3">
            <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-brand-green" /> QUICK ACTIONS
            </h3>

            <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
              <button type="button" onClick={() => toast.info('Available Rides')} className="p-2 rounded-2xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 flex flex-col items-center gap-1 transition-all">
                <Car className="w-4 h-4 text-brand-green" />
                <span className="font-bold text-slate-800 leading-tight">Rides</span>
              </button>

              <button type="button" onClick={() => toast.info('Route Finder')} className="p-2 rounded-2xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 flex flex-col items-center gap-1 transition-all">
                <Navigation className="w-4 h-4 text-brand-green" />
                <span className="font-bold text-slate-800 leading-tight">Route</span>
              </button>

              <button type="button" onClick={() => toast.info('Scan Student Barcode')} className="p-2 rounded-2xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 flex flex-col items-center gap-1 transition-all">
                <QrCode className="w-4 h-4 text-brand-green" />
                <span className="font-bold text-slate-800 leading-tight">Scan ID</span>
              </button>

              <button type="button" onClick={() => toast.info('EduChat')} className="p-2 rounded-2xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 flex flex-col items-center gap-1 transition-all">
                <MessageSquare className="w-4 h-4 text-brand-green" />
                <span className="font-bold text-slate-800 leading-tight">EduChat</span>
              </button>

              <button type="button" onClick={() => toast.info('Calling Parent')} className="p-2 rounded-2xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 flex flex-col items-center gap-1 transition-all">
                <PhoneCall className="w-4 h-4 text-brand-green" />
                <span className="font-bold text-slate-800 leading-tight">Call Parent</span>
              </button>

              <button type="button" onClick={() => toast.error('Emergency SOS Activated')} className="p-2 rounded-2xl bg-red-50 hover:bg-red-100 border border-red-200 flex flex-col items-center gap-1 transition-all">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span className="font-bold text-red-700 leading-tight">SOS</span>
              </button>

              <button type="button" onClick={() => toast.info('Vehicle Check')} className="p-2 rounded-2xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 flex flex-col items-center gap-1 transition-all">
                <ShieldCheck className="w-4 h-4 text-brand-green" />
                <span className="font-bold text-slate-800 leading-tight">Check</span>
              </button>

              <button type="button" onClick={() => toast.info('Contact City Manager')} className="p-2 rounded-2xl bg-slate-50 hover:bg-emerald-50 border border-slate-200 flex flex-col items-center gap-1 transition-all">
                <Shield className="w-4 h-4 text-brand-green" />
                <span className="font-bold text-slate-800 leading-tight">City Mgr</span>
              </button>
            </div>
          </div>

          {/* 3. WALLET & FINANCIAL SUMMARY */}
          <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200/90 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-brand-green" /> FINANCIAL SUMMARY
              </h3>
              <button type="button" onClick={() => toast.info('Viewing Financial Details')} className="text-[11px] font-bold text-brand-green hover:underline">View More</button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-medium">Wallet Balance</span>
                <strong className="text-emerald-600 font-bold font-mono text-sm">₦28,450.00</strong>
              </div>

              <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-medium">Pending Payout</span>
                <strong className="text-amber-600 font-bold font-mono text-sm">₦18,200.00</strong>
              </div>

              <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-medium">Total Earnings (May)</span>
                <strong className="text-slate-900 font-bold font-mono text-xs">₦214,500.00</strong>
              </div>

              <div className="p-2.5 rounded-2xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-medium">Withdrawn (May)</span>
                <strong className="text-slate-900 font-bold font-mono text-xs">₦196,050.00</strong>
              </div>
            </div>
          </div>

          {/* 4. EDUSAVE & EDUINSURED CARDS */}
          <div className="grid grid-cols-1 gap-3">
            {/* EduSave Card */}
            <div className="p-3.5 rounded-3xl bg-purple-50/80 border border-purple-200 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-purple-900 uppercase tracking-wider text-[11px]">EDUSAVE</span>
                <PiggyBank className="w-5 h-5 text-purple-600" />
              </div>
              <p className="text-[11px] text-purple-800 font-medium leading-snug">Automate your savings for your goals and vehicle needs.</p>
              <div>
                <span className="text-[10px] text-purple-700 block">Total Savings</span>
                <strong className="text-purple-950 font-black text-base font-mono">₦56,200.00</strong>
              </div>
              <button type="button" onClick={() => toast.info('EduSave Portal')} className="w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-all shadow-sm">Save Now</button>
            </div>

            {/* EduInsuRed Card */}
            <div className="p-3.5 rounded-3xl bg-sky-50/80 border border-sky-200 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-sky-900 uppercase tracking-wider text-[11px]">EDUINSURED</span>
                <ShieldCheck className="w-5 h-5 text-sky-600" />
              </div>
              <p className="text-[11px] text-sky-800 font-medium leading-snug">You're covered. Drive with confidence and peace of mind.</p>
              <div>
                <span className="text-[10px] text-sky-700 block">Active Cover</span>
                <strong className="text-sky-950 font-bold text-xs">Comprehensive Plan</strong>
              </div>
              <button type="button" onClick={() => toast.info('EduInsuRed Portal')} className="w-full py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs transition-all shadow-sm">View Policy</button>
            </div>
          </div>

          {/* 5. PERFORMANCE OVERVIEW */}
          <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200/90 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-brand-green" /> PERFORMANCE OVERVIEW
              </h3>
              <span className="text-[10px] text-slate-400 font-medium">This Month</span>
            </div>

            <div className="grid grid-cols-3 gap-1 text-center text-xs">
              <div>
                <strong className="text-slate-900 font-extrabold text-sm block">23</strong>
                <span className="text-[9px] text-emerald-600 font-bold">+15%</span>
              </div>

              <div className="border-x border-slate-200">
                <strong className="text-slate-900 font-extrabold text-sm block">96%</strong>
                <span className="text-[9px] text-emerald-600 font-bold">Excellent</span>
              </div>

              <div>
                <strong className="text-slate-900 font-extrabold text-sm block flex items-center justify-center gap-0.5">
                  4.8 <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                </strong>
                <span className="text-[9px] text-emerald-600 font-bold">Excellent</span>
              </div>
            </div>

            <button type="button" onClick={() => toast.info('Viewing Detailed Performance Report')} className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-all text-center border border-slate-200">
              View Detailed Report
            </button>
          </div>

        </div>

      </div>

    </div>
  );
}
