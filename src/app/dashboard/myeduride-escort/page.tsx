'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, logout } from '@/lib/api';
import { RoleSwitcher } from '@/components/shared/RoleSwitcher';
import { AccountSettingsModal } from '@/components/shared/AccountSettingsModal';
import {
  LayoutDashboard,
  Clock,
  LogOut,
  Menu,
  ChevronDown,
  FileText,
  Settings,
  ShieldCheck,
  DollarSign,
  AlertTriangle,
  Users,
  X,
  Navigation,
  MessageSquare,
  QrCode,
  Wallet,
  PiggyBank,
  Share2,
  CalendarDays,
  Headphones,
  Bell,
  Plus,
  Building2,
  BarChart3,
} from 'lucide-react';
import { toast } from 'sonner';
import { photoSrc } from '@/lib/photo';
import MyEduRideEscortView from '@/components/escort/MyEduRideEscortView';
import PickupVerificationModal from '@/components/escort/PickupVerificationModal';
import IncidentReportModal from '@/components/escort/IncidentReportModal';
import EscortIdCardModal from '@/components/escort/EscortIdCardModal';
import { findEscortApplicationForSession, resolveEscortCategory } from '@/lib/escort/escort-category';

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
  const [showIdCardModal, setShowIdCardModal] = useState(false);

  const [escortData, setEscortData] = useState<any>(null);
  const [liveDashboardData, setLiveDashboardData] = useState<any>(null);
  const [chatUnreadTotal, setChatUnreadTotal] = useState<number>(0);

  const fetchChatUnread = () => {
    fetch('/api/escorts/chat')
      .then((res) => res.json())
      .then((data) => {
        if (data?.unread_totals?.total !== undefined) {
          setChatUnreadTotal(data.unread_totals.total);
        }
      })
      .catch((err) => console.warn('[myeduride-escort] Chat unread fetch notice:', err));
  };

  const fetchLiveData = () => {
    fetch('/api/escorts/dashboard-live')
      .then((res) => res.json())
      .then((data) => {
        if (data?.success) {
          setLiveDashboardData(data);
        }
      })
      .catch((err) => console.warn('[myeduride-escort] Live DB fetch notice:', err));
    fetchChatUnread();
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
          const matched = findEscortApplicationForSession(data.applications, s);
          if (matched && resolveEscortCategory(matched) === 'school_escort') {
            router.replace('/dashboard/escort');
            return;
          }
          if (matched) {
            setEscortData(matched);
          }
        }
      })
      .catch((err) => console.warn('[myeduride-escort] Load application error:', err));

    // Check if deep linked to #chat or ?tab=chat
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('tab') === 'chat' || window.location.hash === '#chat') {
        setActiveNav('chat');
      }
    }

    setCurrentTime(new Date());
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Poll chat unread count every 15 seconds
    const chatTimer = setInterval(fetchChatUnread, 15000);

    return () => {
      clearInterval(timer);
      clearInterval(chatTimer);
    };
  }, []);

  const clockDisplay = useMemo(() => {
    if (!currentTime) return { dateStr: '', timeStr: '', greeting: 'Good Morning' };

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

    const hour = Number(
      new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', hour12: false }).format(currentTime)
    );
    const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

    return { dateStr, timeStr, greeting };
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
    null;

  const assignedSchoolNames = Array.from(
    new Set(
      (liveDashboardData?.assigned_schools || [])
        .map((s: any) => s?.name)
        .filter(Boolean)
    )
  );
  const schoolName =
    assignedSchoolNames.length > 0
      ? assignedSchoolNames.join(' · ')
      : liveDashboardData?.school?.name || escortData?.createdBySchoolName || null;
  const walletBalance = Number(liveDashboardData?.wallet?.balance ?? 0);
  const isAvailable = Boolean(liveDashboardData?.escort?.availableForOtherSchools);
  const unreadNotifs = liveDashboardData?.notifications?.unreadCount || 0;

  const handleToggleAvailability = async () => {
    try {
      const res = await fetch('/api/escorts/dashboard-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_availability',
          availableForOtherSchools: !isAvailable,
          appId: liveDashboardData?.escort?.id || escortData?.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update availability');
      toast.success(data.message);
      fetchLiveData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update availability');
    }
  };

  const navItems = [
    { id: 'operations', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'trips', label: 'Trips', icon: Navigation },
    { id: 'schedule', label: 'My Schedule', icon: CalendarDays },
    { id: 'students', label: 'Students', icon: Users },
    { id: 'shared', label: 'Shared Ride', icon: Share2, badge: 'NEW' },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    { id: 'earnings', label: 'Earnings', icon: DollarSign },
    { id: 'edusave', label: 'EduSave', icon: PiggyBank },
    { id: 'eduinsured', label: 'EduInsuRed', icon: ShieldCheck },
    { id: 'chat', label: 'Communications', icon: MessageSquare, count: chatUnreadTotal },
    { id: 'city-manager', label: 'City Manager', icon: Building2 },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
  ];

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
                <span className="font-extrabold text-white text-base md:text-lg tracking-tight">MyEduRide</span>
              </div>
              <span className="text-[9px] font-bold text-emerald-300 uppercase tracking-widest pl-10">
                The Student Safety Platform
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
            {(liveDashboardData?.escort?.photo || escortData?.photo) ? (
            <img
              src={liveDashboardData?.escort?.photo || escortData?.photo}
              alt="MyEduRide Escort"
              className="w-10 h-10 rounded-xl object-cover border-2 border-emerald-500 shrink-0"
            />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-black flex items-center justify-center shrink-0">
                {escortName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="font-extrabold text-white text-xs truncate">{escortName}</h3>
              <p className="text-[10px] text-emerald-300 font-mono font-bold mt-0.5">ID: {escortCode}</p>
            </div>
          </div>

          {/* Vertical Navigation Menu */}
          <nav className="space-y-0.5 text-xs font-semibold">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeNav === item.id || (item.id === 'schedule' && (activeNav === 'roster' || activeNav === 'assignments'));
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { setActiveNav(item.id); setSidebarOpen(false); }}
                  className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
                    active ? 'bg-emerald-600 text-white shadow-md font-extrabold' : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge ? (
                    <span className="px-1.5 py-0.5 rounded-md bg-emerald-400 text-slate-950 font-black text-[9px]">{item.badge}</span>
                  ) : null}
                  {item.count ? (
                    <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white font-black text-[10px]">{item.count}</span>
                  ) : null}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => { setShowAccountModal(true); setSidebarOpen(false); }}
              className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-slate-300 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
            >
              <Settings size={16} />
              <span>Settings</span>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer Cards */}
        <div className="pt-3 border-t border-white/10 space-y-3">
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-white leading-tight">Available for Other Schools</span>
            <button
              type="button"
              onClick={handleToggleAvailability}
              className={`w-11 h-6 rounded-full transition-all relative p-0.5 shrink-0 ${isAvailable ? 'bg-emerald-500' : 'bg-slate-600'}`}
              aria-pressed={isAvailable}
            >
              <span className={`block w-5 h-5 rounded-full bg-white shadow-sm transition-all ${isAvailable ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
              Unique Communication ID
            </span>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-white tracking-wide">
                {escortCode || '—'}
              </span>
              {escortCode && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(escortCode);
                    toast.success('Communication ID copied');
                  }}
                  className="text-slate-400 hover:text-white transition-all cursor-pointer"
                  title="Copy ID"
                >
                  <FileText size={14} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => { setShowIdCardModal(true); setSidebarOpen(false); }}
              className="w-full mt-2 py-1.5 px-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-300 hover:text-white text-[10px] font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
            >
              <QrCode size={13} className="text-emerald-400" />
              <span>Show Gate QR Pass</span>
            </button>
          </div>

          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Headphones size={18} />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-medium block">Need Help? 24/7 Support</span>
              <a href="tel:08091234567" className="font-extrabold text-xs text-white hover:text-emerald-300 font-mono">
                0809 123 4567
              </a>
            </div>
          </div>
        </div>
      </aside>

      {/* 2. RIGHT MAIN CONTENT WRAPPER */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* TOP HEADER BAR - Mobile-First & Responsive */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-3.5 sm:px-6 py-2.5 sm:py-3 flex flex-wrap items-center gap-x-4 gap-y-2 shadow-xs">
          
          {/* Header Left: Hamburger Toggle + Greeting/Badge */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1 basis-[16rem] lg:flex-none lg:min-w-[22rem] lg:max-w-[34rem]">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors shrink-0"
              aria-label="Open Navigation Menu"
            >
              <Menu size={20} />
            </button>

            <div className="min-w-0 lg:overflow-visible">
              <p className="text-[10px] text-slate-400 font-semibold">
                {clockDisplay.greeting},
              </p>
              <div className="flex items-center gap-2 min-w-0">
                <h2
                  className="font-black text-slate-900 text-sm sm:text-base md:text-lg leading-tight truncate lg:overflow-visible lg:whitespace-nowrap"
                  title={escortName}
                >
                  {escortName}
                </h2>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold border border-emerald-200 shrink-0">
                  MyEduRide Escort
                </span>
              </div>
              <p
                className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate lg:overflow-visible lg:whitespace-normal"
                title={[escortCode ? `Escort ID: ${escortCode}` : 'Escort ID pending', schoolName ? `Assigned School${assignedSchoolNames.length > 1 ? 's' : ''}: ${schoolName}` : null].filter(Boolean).join(' · ')}
              >
                {escortCode ? <>Escort ID: {escortCode}</> : 'Escort ID pending'}
                {schoolName ? <> · Assigned School{assignedSchoolNames.length > 1 ? 's' : ''}: {schoolName}</> : null}
              </p>
            </div>
          </div>

          {/* Header Right: Status, SOS Trigger, Clock, Profile, Logout */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end ml-auto">
            <span className="hidden md:inline-flex px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-bold items-center gap-1.5 shadow-xs border border-emerald-500">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span>I&apos;M ONLINE</span>
            </span>
            <button
              type="button"
              onClick={handleToggleAvailability}
              className={`hidden lg:inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold items-center gap-1.5 border ${
                isAvailable ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              {isAvailable ? 'Available' : 'Primary only'}
            </button>

            <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200">
              <Wallet size={13} className="text-emerald-600" />
              <div className="text-right leading-tight">
                <span className="text-[9px] font-bold text-slate-400 block">Wallet Balance</span>
                <span className="text-[11px] font-black text-slate-800 font-mono block">₦{walletBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveNav('wallet')}
              className="hidden sm:inline-flex px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black items-center gap-1.5"
            >
              <Plus size={14} />
              Add Money
            </button>

            {/* Digital Escort Gate Pass Modal Trigger */}
            <button
              type="button"
              onClick={() => setShowIdCardModal(true)}
              className="px-2.5 py-1.5 rounded-xl bg-[#0A1128] hover:bg-slate-800 text-white border border-emerald-500/30 text-xs font-black flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
              title="Display Digital Escort Gate Pass with Scannable QR"
            >
              <QrCode size={14} className="text-emerald-400" />
              <span className="hidden xs:inline">Gate Pass</span>
            </button>

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

            <button
              type="button"
              onClick={() => setActiveNav('chat')}
              className={`p-2 rounded-xl border relative transition-all cursor-pointer ${
                activeNav === 'chat'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
              title="Open Communications"
            >
              <MessageSquare size={16} />
              {chatUnreadTotal > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-0.5 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center">
                  {chatUnreadTotal}
                </span>
              )}
            </button>
            <button
              type="button"
              className="p-2 rounded-xl border bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200 relative"
              title="Notifications"
            >
              <Bell size={16} />
              {unreadNotifs > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-0.5 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center">
                  {Math.min(unreadNotifs, 99)}
                </span>
              )}
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
                {photoSrc(session?.avatar_url) || photoSrc(liveDashboardData?.escort?.photo) || photoSrc(escortData?.photo) ? (
                <img
                  src={(photoSrc(session?.avatar_url) || photoSrc(liveDashboardData?.escort?.photo) || photoSrc(escortData?.photo)) as string}
                  alt="MyEduRide Escort"
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-emerald-500 shadow-xs"
                />
                ) : (
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-emerald-600 text-white font-black flex items-center justify-center border-2 border-emerald-500 shadow-xs text-xs">
                    {escortName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                )}
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
            onOpenIdCardModal={() => setShowIdCardModal(true)}
            activeNav={activeNav}
            onNavChange={setActiveNav}
          />
        </main>
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR - Fixed, thumb-friendly app-like navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0A1128]/95 backdrop-blur-md border-t border-slate-800/80 px-2 py-1.5 flex items-center justify-around shadow-2xl safe-area-inset-bottom">
        <button
          type="button"
          onClick={() => { setActiveNav('operations'); setSidebarOpen(false); }}
          className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
            activeNav === 'operations' ? 'text-emerald-400 font-black' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutDashboard size={19} className={activeNav === 'operations' ? 'stroke-[2.5]' : 'stroke-2'} />
          <span className="text-[10px]">Home</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveNav('trips'); setSidebarOpen(false); }}
          className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
            activeNav === 'trips' ? 'text-emerald-400 font-black' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Navigation size={19} className={activeNav === 'trips' ? 'stroke-[2.5]' : 'stroke-2'} />
          <span className="text-[10px]">Trips</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveNav('students'); setSidebarOpen(false); }}
          className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition-all cursor-pointer relative ${
            activeNav === 'students' || activeNav === 'assignments' || activeNav === 'roster' || activeNav === 'schedule' ? 'text-emerald-400 font-black' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users size={19} />
          <span className="text-[10px]">Students</span>
        </button>

        {/* 3. EduChat */}
        <button
          type="button"
          onClick={() => { setActiveNav('chat'); setSidebarOpen(false); }}
          className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition-all cursor-pointer relative ${
            activeNav === 'chat' ? 'text-emerald-400 font-black' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MessageSquare size={19} className={activeNav === 'chat' ? 'stroke-[2.5]' : 'stroke-2'} />
          <span className="text-[10px]">Chat</span>
          {chatUnreadTotal > 0 && (
            <span className="absolute -top-0.5 right-1.5 w-4 h-4 rounded-full bg-rose-500 text-[9px] font-black text-white flex items-center justify-center animate-pulse shadow-xs">
              {chatUnreadTotal}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => { setActiveNav('wallet'); setSidebarOpen(false); }}
          className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
            activeNav === 'wallet' || activeNav === 'earnings' ? 'text-emerald-400 font-black' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Wallet size={19} />
          <span className="text-[10px]">Wallet</span>
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

      {/* DIGITAL ON-SCREEN ESCORT GATE PASS MODAL */}
      <EscortIdCardModal
        isOpen={showIdCardModal}
        onClose={() => setShowIdCardModal(false)}
        escortData={{
          id: liveDashboardData?.escort?.id || escortData?.id || session?.user_id,
          escort_code: escortCode,
          name: escortName,
          photo: liveDashboardData?.escort?.photo || escortData?.photo || session?.avatar_url,
          vehicle_plate: liveDashboardData?.escort?.vehicle_plate || escortData?.regNumber || escortData?.vehicle?.regNumber,
          vehicle_name: liveDashboardData?.escort?.vehicle_name || escortData?.vehicleType || escortData?.vehicle?.type,
          operating_area: liveDashboardData?.escort?.operating_area || escortData?.operating_area || escortData?.city,
        }}
      />
    </div>
  );
}
