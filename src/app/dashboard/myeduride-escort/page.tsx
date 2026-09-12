'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, logout } from '@/lib/api';
import { RoleSwitcher } from '@/components/shared/RoleSwitcher';
import { AccountSettingsModal } from '@/components/shared/AccountSettingsModal';
import {
  LayoutDashboard,
  Shield,
  Clock,
  LogOut,
  Menu,
  ChevronDown,
  FileText,
  HelpCircle,
  Settings,
  ShieldCheck,
  Radio,
  Car,
  DollarSign,
  AlertTriangle,
  Users,
  X,
  Navigation,
} from 'lucide-react';
import { toast } from 'sonner';
import { photoSrc } from '@/lib/photo';
import MyEduRideEscortView from '@/components/escort/MyEduRideEscortView';
import PickupVerificationModal from '@/components/escort/PickupVerificationModal';
import IncidentReportModal from '@/components/escort/IncidentReportModal';

export default function MyEduRideEscortDashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  // Active Sidebar Nav Item
  const [activeNav, setActiveNav] = useState<string>('operations');

  // Modals state
  const [verificationModal, setVerificationModal] = useState<{ open: boolean; student?: any }>({
    open: false,
    student: null,
  });
  const [incidentModalOpen, setIncidentModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);

  const [escortData, setEscortData] = useState<any>(null);
  const [liveDashboardData, setLiveDashboardData] = useState<any>(null);

  const fetchLiveData = () => {
    fetch('/api/escorts/dashboard-live')
      .then((res) => res.json())
      .then((data) => {
        if (data?.success) {
          setLiveDashboardData(data);
        }
      })
      .catch((err) => console.warn('[myeduride-escort] Live DB fetch notice:', err));
  };

  useEffect(() => {
    const s = getSession();
    setSession(s);

    // 1. Fetch live backend DB dashboard data
    fetchLiveData();

    // 2. Fetch live application status for logged-in escort user
    fetch('/api/escorts/applications')
      .then((res) => res.json())
      .then((data) => {
        if (data?.applications && Array.isArray(data.applications)) {
          const emailQuery = s?.email || s?.emailOrUsername || '';
          const matched = data.applications.find(
            (a: any) =>
              (emailQuery &&
                (a.email?.toLowerCase() === emailQuery.toLowerCase() ||
                  a.emailOrUsername?.toLowerCase() === emailQuery.toLowerCase())) ||
              (s?.id && a.user_id === s.id)
          ) || data.applications[0];

          if (matched) {
            setEscortData(matched);
          }
        }
      })
      .catch((err) => console.warn('[myeduride-escort] Load application error:', err));

    setCurrentTime(new Date());
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const clockDisplay = useMemo(() => {
    if (!currentTime) return { dateStr: 'Mon, 26 May 2026', timeStr: '07:32 AM' };

    const timeStr = currentTime.toLocaleTimeString('en-NG', {
      timeZone: 'Africa/Lagos',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    const dateStr = currentTime.toLocaleDateString('en-NG', {
      timeZone: 'Africa/Lagos',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    return { dateStr, timeStr };
  }, [currentTime]);

  const handleLogout = () => {
    logout();
  };

  const handleOpenVerification = (student?: any) => {
    setVerificationModal({ open: true, student });
  };

  const escortName =
    liveDashboardData?.escort?.name ||
    escortData?.name ||
    escortData?.fullName ||
    session?.full_name ||
    'MyEduRide Escort';

  const escortCode =
    liveDashboardData?.escort?.code ||
    escortData?.escort_code ||
    escortData?.escortIdCode ||
    'ESC-902';

  return (
    <div className="min-h-screen bg-[#F4F6F9] text-slate-800 font-sans flex flex-col lg:flex-row relative">
      
      {/* MOBILE BACKDROP OVERLAY */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-950/70 z-40 lg:hidden backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* 1. SIDEBAR (#0A1128 Dark Navy Blue) - Slide-over drawer on mobile, static on desktop */}
      <aside
        className={`fixed lg:static top-0 left-0 bottom-0 z-50 w-72 lg:w-64 bg-[#0A1128] text-white flex flex-col justify-between p-4 shrink-0 shadow-2xl border-r border-slate-800 transition-transform duration-300 ease-in-out min-h-screen ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="space-y-5">
          {/* Top Brand Logo & Mobile Close Button */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-emerald-700 flex items-center justify-center font-black text-white text-sm shadow-md">
                  🛡️
                </div>
                <span className="font-extrabold text-white text-base md:text-lg tracking-tight">MyEduRide Escort</span>
              </div>
              <span className="text-[9px] font-bold text-emerald-300 uppercase tracking-widest pl-10">
                On-Demand Safety Fleet
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Close navigation menu"
            >
              <X size={20} />
            </button>
          </div>

          {/* Quick Escort Profile Card on Mobile */}
          <div className="lg:hidden p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
            <img
              src={liveDashboardData?.escort?.photo || escortData?.photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
              alt="MyEduRide Escort"
              className="w-10 h-10 rounded-xl object-cover border-2 border-emerald-500 shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
              }}
            />
            <div className="min-w-0 flex-1">
              <h3 className="font-extrabold text-white text-xs truncate">{escortName}</h3>
              <p className="text-[10px] text-emerald-300 font-mono font-bold mt-0.5">ID: {escortCode}</p>
            </div>
          </div>

          {/* Vertical Navigation Menu */}
          <nav className="space-y-1 text-xs font-semibold">
            {/* 1. Operations Hub */}
            <button
              type="button"
              onClick={() => { setActiveNav('operations'); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                activeNav === 'operations'
                  ? 'bg-emerald-600 text-white shadow-md font-extrabold'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <LayoutDashboard size={17} />
                <span>Command Operations</span>
              </div>
            </button>

            {/* 2. Dispatch Requests */}
            <button
              type="button"
              onClick={() => { setActiveNav('dispatch'); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                activeNav === 'dispatch'
                  ? 'bg-emerald-600 text-white shadow-md font-extrabold'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Radio size={17} />
                <span>Live Dispatch Queue</span>
              </div>
            </button>

            {/* 3. Duty Roster */}
            <button
              type="button"
              onClick={() => { setActiveNav('roster'); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                activeNav === 'roster' || activeNav === 'assignments'
                  ? 'bg-emerald-600 text-white shadow-md font-extrabold'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Users size={17} />
                <span>Passenger Roster</span>
              </div>
              {(liveDashboardData?.students?.manifest?.length || 0) > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black text-[10px]">
                  {liveDashboardData?.students?.manifest?.length}
                </span>
              )}
            </button>

            {/* 4. Earnings & Wallet */}
            <button
              type="button"
              onClick={() => { setActiveNav('earnings'); setSidebarOpen(false); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all cursor-pointer ${
                activeNav === 'earnings'
                  ? 'bg-emerald-600 text-white shadow-md font-extrabold'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <DollarSign size={17} />
                <span>Earnings & Wallet</span>
              </div>
            </button>

            {/* 5. Incidents */}
            <button
              type="button"
              onClick={() => { setIncidentModalOpen(true); setSidebarOpen(false); }}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-amber-300 hover:bg-amber-500/20 transition-all font-bold cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle size={17} />
                <span>Safety SOS & Incident</span>
              </div>
              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-400 text-slate-950">
                SOS
              </span>
            </button>

            {/* 6. Settings */}
            <button
              type="button"
              onClick={() => { setShowAccountModal(true); setSidebarOpen(false); }}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-slate-300 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Settings size={17} />
                <span>Escort Settings</span>
              </div>
            </button>

            {/* 7. Log Out */}
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all font-extrabold cursor-pointer border border-red-500/20 mt-4"
            >
              <div className="flex items-center gap-3">
                <LogOut size={17} />
                <span>Log Out</span>
              </div>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer Cards */}
        <div className="pt-4 border-t border-white/10 space-y-3">
          {/* City Manager Approval Status */}
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
            <span className="text-[9px] font-bold text-emerald-300 uppercase tracking-wider block">
              City Manager Operations
            </span>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white truncate max-w-[150px]">
                APPROVED OPERATOR
              </span>
              <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
            </div>
          </div>

          {/* Unique Escort Code Box */}
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
              MyEduRide Escort Badge ID
            </span>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-white tracking-wide">
                {escortCode}
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(escortCode);
                  toast.success('Escort Badge ID copied!');
                }}
                className="text-slate-400 hover:text-white transition-all cursor-pointer"
                title="Copy Badge ID"
              >
                <FileText size={14} />
              </button>
            </div>
          </div>

          {/* City Dispatch Support */}
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <HelpCircle size={18} />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-medium block">City Manager Support</span>
              <a href="tel:08001234567" className="font-extrabold text-xs text-white hover:text-emerald-300 font-mono">
                0800 123 4567
              </a>
            </div>
          </div>
        </div>
      </aside>

      {/* 2. RIGHT MAIN CONTENT WRAPPER */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* TOP HEADER BAR - Mobile-First & Responsive */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-3.5 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-3 shadow-xs">
          
          {/* Header Left: Hamburger Toggle + Greeting/Badge */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors shrink-0"
              aria-label="Open Navigation Menu"
            >
              <Menu size={20} />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-black text-slate-900 text-sm sm:text-base md:text-lg leading-tight truncate">
                  {escortName}
                </h2>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold border border-emerald-200 shrink-0">
                  {escortCode}
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate">
                Unit #{escortCode} • <span className="text-emerald-700 font-bold">DISC Active Escort</span>
              </p>
            </div>
          </div>

          {/* Header Right: Status, SOS Trigger, Clock, Profile, Logout */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Online / Active Dispatch Pill */}
            <span className="hidden md:inline-flex px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-bold items-center gap-1.5 shadow-xs border border-emerald-500">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span>ON DUTY</span>
            </span>

            {/* Quick Emergency SOS Incident Modal Trigger */}
            <button
              type="button"
              onClick={() => setIncidentModalOpen(true)}
              className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-black flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
              title="Report Incident / Safety SOS"
            >
              <AlertTriangle size={14} className="text-amber-600" />
              <span className="hidden xs:inline">SOS</span>
            </button>

            {/* Live Clock Display (Hidden on very small screens) */}
            <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200">
              <Clock size={13} className="text-emerald-600" />
              <div className="text-right leading-tight">
                <span className="text-[11px] font-black text-slate-800 font-mono block">{clockDisplay.timeStr}</span>
                <span className="text-[9px] font-bold text-slate-400 block">{clockDisplay.dateStr}</span>
              </div>
            </div>

            {/* User Profile Avatar with Click for Account Settings */}
            <div
              className="flex items-center gap-1 cursor-pointer"
              onClick={() => setShowAccountModal(true)}
              title="Escort Account Settings"
            >
              <div className="relative">
                <img
                  src={photoSrc(session?.avatar_url) || photoSrc(liveDashboardData?.escort?.photo) || photoSrc(escortData?.photo) || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                  alt="MyEduRide Escort"
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-emerald-500 shadow-xs"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
                  }}
                />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" />
              </div>
              <ChevronDown size={14} className="text-slate-600 hidden sm:block" />
            </div>

            {/* Role Switcher */}
            <div className="hidden xl:block">
              <RoleSwitcher />
            </div>

            {/* Log Out Button */}
            <button
              type="button"
              onClick={handleLogout}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-extrabold transition-all cursor-pointer shadow-xs"
              title="Sign Out of MyEduRide Escort Account"
            >
              <LogOut size={14} />
              <span>Log Out</span>
            </button>
          </div>
        </header>

        {/* MAIN CANVAS BODY - Padded for mobile bottom bar */}
        <main className="flex-1 p-3.5 sm:p-5 md:p-6 space-y-5 pb-24 lg:pb-8 max-w-7xl w-full mx-auto">
          <MyEduRideEscortView
            liveDashboardData={liveDashboardData}
            onOpenVerificationModal={handleOpenVerification}
            onOpenIncidentModal={() => setIncidentModalOpen(true)}
            activeNav={activeNav}
            onNavChange={setActiveNav}
          />
        </main>
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR - Fixed, thumb-friendly app-like navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0A1128]/95 backdrop-blur-md border-t border-slate-800/80 px-2 py-1.5 flex items-center justify-around shadow-2xl safe-area-inset-bottom">
        {/* 1. Command Operations */}
        <button
          type="button"
          onClick={() => { setActiveNav('operations'); setSidebarOpen(false); }}
          className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
            activeNav === 'operations' ? 'text-emerald-400 font-black' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutDashboard size={19} className={activeNav === 'operations' ? 'stroke-[2.5]' : 'stroke-2'} />
          <span className="text-[10px]">Command</span>
        </button>

        {/* 2. Passenger Manifest */}
        <button
          type="button"
          onClick={() => { setActiveNav('assignments'); setSidebarOpen(false); }}
          className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition-all cursor-pointer relative ${
            activeNav === 'assignments' || activeNav === 'roster' ? 'text-emerald-400 font-black' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users size={19} className={activeNav === 'assignments' || activeNav === 'roster' ? 'stroke-[2.5]' : 'stroke-2'} />
          <span className="text-[10px]">Roster</span>
          {(liveDashboardData?.students?.manifest?.length || 0) > 0 && (
            <span className="absolute -top-0.5 right-1.5 w-4 h-4 rounded-full bg-emerald-500 text-[9px] font-black text-slate-950 flex items-center justify-center shadow-xs">
              {liveDashboardData?.students?.manifest?.length}
            </span>
          )}
        </button>

        {/* 3. Route Navigation */}
        <button
          type="button"
          onClick={() => { setActiveNav('optimisation'); setSidebarOpen(false); }}
          className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
            activeNav === 'optimisation' ? 'text-emerald-400 font-black' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Navigation size={19} className={activeNav === 'optimisation' ? 'stroke-[2.5]' : 'stroke-2'} />
          <span className="text-[10px]">Navigate</span>
        </button>

        {/* 4. Daily Earnings */}
        <button
          type="button"
          onClick={() => { setActiveNav('earnings'); setSidebarOpen(false); }}
          className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
            activeNav === 'earnings' ? 'text-emerald-400 font-black' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <DollarSign size={19} className={activeNav === 'earnings' ? 'stroke-[2.5]' : 'stroke-2'} />
          <span className="text-[10px]">Earnings</span>
        </button>

        {/* 5. More / Sidebar Toggle */}
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
        >
          <Menu size={19} />
          <span className="text-[10px]">Menu</span>
        </button>
      </nav>

      {/* MODALS */}
      <PickupVerificationModal
        isOpen={verificationModal.open}
        student={verificationModal.student}
        onClose={() => setVerificationModal({ open: false, student: null })}
        onVerificationComplete={() => {
          fetchLiveData();
          setVerificationModal({ open: false, student: null });
        }}
      />

      <IncidentReportModal
        isOpen={incidentModalOpen}
        onClose={() => setIncidentModalOpen(false)}
        onReportSubmitted={() => {
          fetchLiveData();
          setIncidentModalOpen(false);
        }}
      />

      {showAccountModal && (
        <AccountSettingsModal
          onClose={() => setShowAccountModal(false)}
        />
      )}
    </div>
  );
}
