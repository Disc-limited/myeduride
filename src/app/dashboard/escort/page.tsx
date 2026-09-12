'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, logout } from '@/lib/api';
import { RoleSwitcher } from '@/components/shared/RoleSwitcher';
import { AccountSettingsModal } from '@/components/shared/AccountSettingsModal';
import {
  LayoutDashboard,
  Calendar,
  Users,
  UserCheck,
  MapPin,
  MessageSquare,
  Bell,
  FileText,
  HelpCircle,
  Settings,
  ShieldCheck,
  Sun,
  Clock,
  LogOut,
  X,
  Menu,
  ChevronDown,
  Building,
  Car,
  Navigation,
  KeyRound,
  Bus,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { photoSrc } from '@/lib/photo';
import SchoolEscortView from '@/components/escort/SchoolEscortView';
import EscortTripsView from '@/components/escort/EscortTripsView';
import EscortStudentsView from '@/components/escort/EscortStudentsView';
import EscortChatView from '@/components/escort/EscortChatView';
import PickupVerificationModal from '@/components/escort/PickupVerificationModal';
import IncidentReportModal from '@/components/escort/IncidentReportModal';
import SchoolNoticeBanner from '@/components/shared/SchoolNoticeBanner';
import SchoolNoticesInboxView from '@/components/shared/SchoolNoticesInboxView';

export default function SchoolEscortDashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  // Active Sidebar Nav Item
  const [activeNav, setActiveNav] = useState<string>('dashboard');

  // Trip Mode (Morning vs Afternoon)
  const [tripMode, setTripMode] = useState<'morning' | 'afternoon'>('morning');

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
      .catch((err) => console.warn('[school-escort] Live DB fetch notice:', err));
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
      .catch((err) => console.warn('[school-escort] Load application error:', err));

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

  const schoolName =
    liveDashboardData?.school?.name ||
    escortData?.createdBySchoolName ||
    session?.primary_school?.name ||
    'Myeduride Academy School';

  const escortName =
    liveDashboardData?.escort?.name ||
    escortData?.name ||
    escortData?.fullName ||
    session?.full_name ||
    'Kingsley (School Escort)';

  const escortCode =
    liveDashboardData?.escort?.code ||
    escortData?.escort_code ||
    escortData?.escortIdCode ||
    'ESC-5065';

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

      {/* 1. LEFT SIDEBAR (#07132B Dark Navy Blue) */}
      <aside
        className={`fixed lg:static top-0 left-0 bottom-0 z-50 w-72 lg:w-64 bg-[#07132B] text-white flex flex-col justify-between p-4 shrink-0 shadow-2xl border-r border-slate-800 transition-transform duration-300 ease-in-out min-h-screen ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="space-y-5">
          {/* Top Brand Logo & Mobile Close Button */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-500 via-indigo-500 to-blue-700 flex items-center justify-center font-black text-white text-xs shadow-md">
                  🚌
                </div>
                <span className="font-extrabold text-white text-base md:text-lg tracking-tight">School Escort</span>
              </div>
              <span className="text-[9px] font-bold text-blue-300 uppercase tracking-widest pl-10 truncate max-w-[180px]">
                {schoolName}
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

          {/* Vertical Navigation Menu */}
          <nav className="space-y-1 text-xs font-semibold">
            {/* 1. Dashboard */}
            <button
              onClick={() => setActiveNav('dashboard')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all ${
                activeNav === 'dashboard'
                  ? 'bg-blue-600 text-white shadow-md font-extrabold'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <LayoutDashboard size={17} />
                <span>School Transit Hub</span>
              </div>
            </button>

            {/* 2. Trips */}
            <button
              onClick={() => setActiveNav('trips')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all ${
                activeNav === 'trips'
                  ? 'bg-blue-600 text-white shadow-md font-extrabold'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Bus size={17} />
                <span>Bus Routes & Trips</span>
              </div>
            </button>

            {/* 3. My Schedule */}
            <button
              onClick={() => setActiveNav('schedule')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all ${
                activeNav === 'schedule'
                  ? 'bg-blue-600 text-white shadow-md font-extrabold'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Calendar size={17} />
                <span>Pickup Schedule</span>
              </div>
            </button>

            {/* 4. Students Manifest */}
            <button
              onClick={() => setActiveNav('students')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all ${
                activeNav === 'students'
                  ? 'bg-blue-600 text-white shadow-md font-extrabold'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Users size={17} />
                <span>Assigned Students</span>
              </div>
            </button>

            {/* 5. School Communications */}
            <button
              onClick={() => setActiveNav('chat')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all ${
                activeNav === 'chat'
                  ? 'bg-blue-600 text-white shadow-md font-extrabold'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <MessageSquare size={17} />
                <span>School Admin & Parents</span>
              </div>
            </button>

            {/* 6. Reports */}
            <button
              onClick={() => setActiveNav('reports')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all ${
                activeNav === 'reports'
                  ? 'bg-blue-600 text-white shadow-md font-extrabold'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <FileText size={17} />
                <span>Gate & Trip Reports</span>
              </div>
            </button>

            {/* 7. Settings */}
            <button
              onClick={() => setActiveNav('settings')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all ${
                activeNav === 'settings'
                  ? 'bg-blue-600 text-white shadow-md font-extrabold'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Settings size={17} />
                <span>Settings</span>
              </div>
            </button>

            {/* 8. Log Out */}
            <button
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
          {/* School Affiliation Badge */}
          <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 space-y-1">
            <span className="text-[9px] font-bold text-blue-300 uppercase tracking-wider block">
              Official School Staff
            </span>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white truncate max-w-[150px]">
                {schoolName}
              </span>
              <ShieldCheck size={16} className="text-blue-400 shrink-0" />
            </div>
          </div>

          {/* Unique Communication ID Box */}
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
              Escort Staff ID
            </span>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-white tracking-wide">
                {escortCode}
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(escortCode);
                  toast.success('Escort ID copied!');
                }}
                className="text-slate-400 hover:text-white transition-all cursor-pointer"
                title="Copy ID"
              >
                <FileText size={14} />
              </button>
            </div>
          </div>

          {/* School Help Desk */}
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
              <HelpCircle size={18} />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-medium block leading-tight">School Admin Hotline</span>
              <a href="tel:08091234567" className="font-extrabold text-xs text-white hover:text-blue-300 font-mono">
                0809 123 4567
              </a>
            </div>
          </div>
        </div>
      </aside>

      {/* 2. RIGHT MAIN CONTENT WRAPPER */}
      <div className="flex-1 flex flex-col min-w-0">
              {/* TOP HEADER BAR */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-3.5 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-3 shadow-xs">
          
          {/* Header Left: Mobile Drawer Button + Greeting & School Badge */}
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
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-extrabold border border-blue-200 shrink-0">
                  {escortCode}
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate">
                Staff ID: <span className="font-mono text-slate-700 font-bold">{escortCode}</span> • <span className="text-blue-700 font-bold">{schoolName}</span>
              </p>
            </div>
          </div>

          {/* Header Right: Clock, Profile, Role Switcher, Logout */}
          <div className="flex items-center gap-2 sm:gap-3.5 shrink-0">
            {/* Online / Duty Status Pill */}
            <span className="hidden md:inline-flex px-2.5 py-1 rounded-full bg-blue-700 text-white text-[11px] font-bold items-center gap-1.5 shadow-xs border border-blue-600">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
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

            {/* Live Clock Display */}
            <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200">
              <Clock size={13} className="text-blue-600" />
              <div className="text-right leading-tight">
                <span className="text-[11px] font-black text-slate-800 font-mono block">{clockDisplay.timeStr}</span>
                <span className="text-[9px] font-bold text-slate-400 block">{clockDisplay.dateStr}</span>
              </div>
            </div>

            {/* User Profile Avatar */}
            <div className="flex items-center gap-1 cursor-pointer" onClick={() => setShowAccountModal(true)}>
              <div className="relative">
                <img
                  src={photoSrc(session?.avatar_url) || photoSrc(liveDashboardData?.escort?.photo) || photoSrc(escortData?.photo) || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                  alt="School Escort"
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-blue-500 shadow-xs"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
                  }}
                />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white" />
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
              title="Sign Out of School Escort Account"
            >
              <LogOut size={14} />
              <span>Log Out</span>
            </button>
          </div>
        </header>

        {/* MAIN CANVAS BODY */}
        <main className="flex-1 p-3.5 sm:p-5 md:p-6 space-y-5 pb-24 lg:pb-8 max-w-7xl w-full mx-auto">
          {/* OFFICIAL SCHOOL NOTICES BANNER */}
          <SchoolNoticeBanner role="escorts" schoolId={liveDashboardData?.escort?.school_id || liveDashboardData?.escort?.primary_school_id || escortData?.school_id || escortData?.primary_school_id} className="mb-4" />

          {/* 1. School Transit Hub (Default Dashboard) */}
          {activeNav === 'dashboard' && (
            <SchoolEscortView
              onOpenVerificationModal={handleOpenVerification}
              onOpenIncidentModal={() => setIncidentModalOpen(true)}
              tripType={tripMode}
              onTripTypeChange={setTripMode}
            />
          )}

          {/* 2. Bus Routes & Trips */}
          {activeNav === 'trips' && (
            <EscortTripsView
              liveDashboardData={liveDashboardData}
              onRefreshData={fetchLiveData}
              onOpenVerificationModal={handleOpenVerification}
              onOpenIncidentModal={() => setIncidentModalOpen(true)}
            />
          )}

          {/* 3. Daily Schedule */}
          {activeNav === 'schedule' && (
            <EscortTripsView
              liveDashboardData={liveDashboardData}
              onRefreshData={fetchLiveData}
              onOpenVerificationModal={handleOpenVerification}
              onOpenIncidentModal={() => setIncidentModalOpen(true)}
            />
          )}

          {/* 4. Students Manifest */}
          {activeNav === 'students' && (
            <EscortStudentsView
              liveDashboardData={liveDashboardData}
              onOpenVerificationModal={handleOpenVerification}
            />
          )}

          {/* 5. School Admin & Parent Chat */}
          {activeNav === 'chat' && (
            <EscortChatView
              liveDashboardData={liveDashboardData}
            />
          )}

          {/* 6. Reports & Logs */}
          {activeNav === 'reports' && (
            <EscortTripsView
              liveDashboardData={liveDashboardData}
              onRefreshData={fetchLiveData}
              onOpenVerificationModal={handleOpenVerification}
              onOpenIncidentModal={() => setIncidentModalOpen(true)}
            />
          )}

          {/* 7. Escort Account Settings */}
          {activeNav === 'settings' && (
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h3 className="font-extrabold text-lg text-slate-900">Escort Profile & Device Preferences</h3>
              <p className="text-xs text-slate-500">
                Manage your credentials, vehicle pairing, notification alerts, and active duty schedule.
              </p>
              <button
                onClick={() => setShowAccountModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-blue-700 cursor-pointer"
              >
                Edit Escort Profile
              </button>
            </div>
          )}
        </main>

        {/* MOBILE BOTTOM NAVIGATION BAR */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#07132B]/95 backdrop-blur-md border-t border-slate-800/80 px-2 py-1.5 flex items-center justify-around shadow-2xl safe-area-inset-bottom">
          <button
            type="button"
            onClick={() => { setActiveNav('dashboard'); setSidebarOpen(false); }}
            className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
              activeNav === 'dashboard' ? 'text-blue-400 font-black' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutDashboard size={19} className={activeNav === 'dashboard' ? 'stroke-[2.5]' : 'stroke-2'} />
            <span className="text-[10px]">Hub</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveNav('trips'); setSidebarOpen(false); }}
            className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
              activeNav === 'trips' ? 'text-blue-400 font-black' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bus size={19} className={activeNav === 'trips' ? 'stroke-[2.5]' : 'stroke-2'} />
            <span className="text-[10px]">Trips</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveNav('students'); setSidebarOpen(false); }}
            className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
              activeNav === 'students' ? 'text-blue-400 font-black' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users size={19} className={activeNav === 'students' ? 'stroke-[2.5]' : 'stroke-2'} />
            <span className="text-[10px]">Manifest</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveNav('chat'); setSidebarOpen(false); }}
            className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
              activeNav === 'chat' ? 'text-blue-400 font-black' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare size={19} className={activeNav === 'chat' ? 'stroke-[2.5]' : 'stroke-2'} />
            <span className="text-[10px]">Chat</span>
          </button>

          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
          >
            <Menu size={19} />
            <span className="text-[10px]">Menu</span>
          </button>
        </nav>
      </div>

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
