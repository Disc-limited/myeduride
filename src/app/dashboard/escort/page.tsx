'use client';

import { useState, useEffect, useMemo } from 'react';
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
  KeyRound
} from 'lucide-react';
import SchoolEscortView from '@/components/escort/SchoolEscortView';
import PrivateEscortView from '@/components/escort/PrivateEscortView';
import MyEduRideEscortView from '@/components/escort/MyEduRideEscortView';
import PickupVerificationModal from '@/components/escort/PickupVerificationModal';
import IncidentReportModal from '@/components/escort/IncidentReportModal';

export default function EscortDashboardPage() {
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
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);

  useEffect(() => {
    const s = getSession();
    setSession(s);

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

  return (
    <div className="min-h-screen bg-[#F4F6F9] text-slate-800 font-sans flex flex-col lg:flex-row">
      
      {/* 1. LEFT SIDEBAR (#0A1128 Dark Navy Blue) */}
      <aside className="w-full lg:w-64 bg-[#0A1128] text-white flex flex-col justify-between p-4 shrink-0 shadow-xl border-r border-slate-800 z-30">
        <div className="space-y-6">
          {/* Top Logo & Slogan */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img
                src="/images/eduride_logo.png"
                alt="MyEduRide Logo"
                className="h-9 w-auto object-contain"
              />
            </div>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden text-slate-400 p-1 rounded-lg hover:bg-white/10"
            >
              <Menu size={20} />
            </button>
          </div>

          {/* Vertical Menu Navigation */}
          <nav className="space-y-1 text-xs font-semibold">
            {/* 1. Dashboard */}
            <button
              onClick={() => setActiveNav('dashboard')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition-all ${
                activeNav === 'dashboard'
                  ? 'bg-[#00A859] text-white shadow-md font-bold'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <LayoutDashboard size={18} />
                <span>Dashboard</span>
              </div>
            </button>

            {/* 2. Today's Trip */}
            <button
              onClick={() => setActiveNav('trips')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition-all ${
                activeNav === 'trips'
                  ? 'bg-[#00A859] text-white shadow-md font-bold'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Calendar size={18} />
                <span>Today's Trip</span>
              </div>
            </button>

            {/* 3. Pickup Queue */}
            <button
              onClick={() => setActiveNav('queue')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition-all ${
                activeNav === 'queue'
                  ? 'bg-[#00A859] text-white shadow-md font-bold'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Users size={18} />
                <span>Pickup Queue</span>
              </div>
              <span className="bg-[#00A859] text-white font-bold text-[10px] px-2 py-0.5 rounded-full">
                6
              </span>
            </button>

            {/* 4. On Board */}
            <button
              onClick={() => setActiveNav('onboard')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition-all ${
                activeNav === 'onboard'
                  ? 'bg-[#00A859] text-white shadow-md font-bold'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <UserCheck size={18} />
                <span>On Board</span>
              </div>
              <span className="bg-blue-600 text-white font-bold text-[10px] px-2 py-0.5 rounded-full">
                12
              </span>
            </button>

            {/* 5. Live Tracking */}
            <button
              onClick={() => setActiveNav('tracking')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition-all ${
                activeNav === 'tracking'
                  ? 'bg-[#00A859] text-white shadow-md font-bold'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Navigation size={18} />
                <span>Live Tracking</span>
              </div>
            </button>

            {/* 6. Messages (EduChat) */}
            <button
              onClick={() => setActiveNav('chat')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition-all ${
                activeNav === 'chat'
                  ? 'bg-[#00A859] text-white shadow-md font-bold'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <MessageSquare size={18} />
                <span>Messages (EduChat)</span>
              </div>
              <span className="bg-red-500 text-white font-bold text-[10px] px-2 py-0.5 rounded-full">
                3
              </span>
            </button>

            {/* 7. Notifications */}
            <button
              onClick={() => setActiveNav('notifications')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition-all ${
                activeNav === 'notifications'
                  ? 'bg-[#00A859] text-white shadow-md font-bold'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Bell size={18} />
                <span>Notifications</span>
              </div>
              <span className="bg-red-500 text-white font-bold text-[10px] px-2 py-0.5 rounded-full">
                9
              </span>
            </button>

            {/* 8. Reports */}
            <button
              onClick={() => setActiveNav('reports')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition-all ${
                activeNav === 'reports'
                  ? 'bg-[#00A859] text-white shadow-md font-bold'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <FileText size={18} />
                <span>Reports</span>
              </div>
            </button>

            {/* 9. Help Centre */}
            <button
              onClick={() => setActiveNav('help')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition-all ${
                activeNav === 'help'
                  ? 'bg-[#00A859] text-white shadow-md font-bold'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <HelpCircle size={18} />
                <span>Help Centre</span>
              </div>
            </button>

            {/* 10. Settings */}
            <button
              onClick={() => setActiveNav('settings')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition-all ${
                activeNav === 'settings'
                  ? 'bg-[#00A859] text-white shadow-md font-bold'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Settings size={18} />
                <span>Settings</span>
              </div>
            </button>
          </nav>
        </div>

        {/* Bottom DISC Branding Footer */}
        <div className="pt-6 border-t border-white/10 space-y-2 text-[11px]">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-amber-400 via-emerald-400 to-blue-500 flex items-center justify-center font-bold text-white text-[9px] shadow-sm">
              D
            </div>
            <span className="font-extrabold text-white text-xs tracking-wide">DISC.</span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium leading-tight">
            DAISAF INDUSTRIAL SERVICES COMPANY LIMITED
          </p>
          <p className="text-[9px] text-emerald-400 font-medium">Innovate • Build • Deliver</p>
          <p className="text-[9px] text-slate-500 font-mono pt-1">
            © 2026 MyEduRide. All rights reserved.
          </p>
        </div>
      </aside>

      {/* 2. RIGHT MAIN CONTENT WRAPPER */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* TOP HEADER BAR */}
        <header className="bg-white border-b border-slate-200/80 sticky top-0 z-20 px-4 md:px-6 py-3 flex flex-wrap items-center justify-between gap-4 shadow-xs">
          {/* Left Details: School Crest & Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xs shadow-sm overflow-hidden shrink-0 border border-slate-200">
              <Building size={20} className="text-amber-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 leading-tight">
                Greenfield International School
              </h3>
              <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                <MapPin size={12} className="text-emerald-600" /> Lekki, Lagos State
              </p>
            </div>
          </div>

          {/* Middle Details: Escort Profile & Role Switcher */}
          <div className="flex items-center gap-3 bg-slate-50 px-3.5 py-1.5 rounded-2xl border border-slate-200/80">
            <RoleSwitcher />
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="font-extrabold text-xs text-slate-900 leading-tight">
                  {session?.full_name || 'John Adebayo'}
                </h4>
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                <span className="text-[10px] text-emerald-700 font-bold">Online</span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium">
                School Escort • <span className="font-mono text-slate-700">ESC-230081</span>
              </p>
            </div>
          </div>

          {/* Right Details: Active Trip Toggle, Bell, Live Clock, Account Settings */}
          <div className="flex items-center gap-3">
            {/* Active Trip Toggle */}
            <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 text-xs font-bold">
              <button
                onClick={() => setTripMode('morning')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  tripMode === 'morning'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sun size={14} className="text-amber-300 fill-amber-300" />
                <span>Morning Trip</span>
              </button>

              <button
                onClick={() => setTripMode('afternoon')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                  tripMode === 'afternoon'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sun size={14} className="text-orange-400" />
                <span>Afternoon Trip</span>
              </button>
            </div>

            {/* Notification Bell */}
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="relative p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all"
            >
              <Bell size={18} />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white font-bold text-[10px] rounded-full flex items-center justify-center border-2 border-white">
                6
              </span>
            </button>

            {/* Live Clock */}
            <div className="bg-slate-50 border border-slate-200/80 px-3 py-1 rounded-xl text-right hidden sm:block">
              <div className="font-extrabold text-xs text-slate-900 leading-tight">
                {clockDisplay.timeStr}
              </div>
              <div className="text-[9px] font-semibold text-slate-400">
                {clockDisplay.dateStr}
              </div>
            </div>

            {/* Account Settings Trigger */}
            <button
              onClick={() => setShowAccountModal(true)}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all flex items-center gap-1.5 text-xs font-bold"
              title="Account Settings"
            >
              <KeyRound size={16} className="text-slate-600" />
              <span className="hidden xl:inline">Account Settings</span>
            </button>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-all"
              title="Sign Out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {/* MAIN CANVAS BODY */}
        <main className="flex-1 p-4 md:p-6 space-y-6">
          <SchoolEscortView
            onOpenVerificationModal={handleOpenVerification}
            onOpenIncidentModal={() => setIncidentModalOpen(true)}
          />
        </main>
      </div>

      {/* MODALS */}
      <PickupVerificationModal
        isOpen={verificationModal.open}
        onClose={() => setVerificationModal({ open: false, student: null })}
        student={verificationModal.student}
      />

      <IncidentReportModal
        isOpen={incidentModalOpen}
        onClose={() => setIncidentModalOpen(false)}
        escortType="SCHOOL"
      />

      {showAccountModal && (
        <AccountSettingsModal onClose={() => setShowAccountModal(false)} />
      )}
    </div>
  );
}
