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
  BadgePercent,
} from 'lucide-react';
import { toast } from 'sonner';
import { photoSrc } from '@/lib/photo';
import MyEduRideEscortView from '@/components/escort/MyEduRideEscortView';
import PickupVerificationModal from '@/components/escort/PickupVerificationModal';
import IncidentReportModal from '@/components/escort/IncidentReportModal';
import EscortIdCardModal from '@/components/escort/EscortIdCardModal';
import { CityPricingReadOnlyPanel } from '@/components/shared/CityPricingPanel';
import {
  findEscortApplicationForSession,
  resolveEscortCategory,
} from '@/lib/escort/escort-category';

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
    fetch('/api/escorts/dashboard-live', { credentials: 'include', cache: 'no-store' })
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
    const appQuery = s?.user_id ? `?appId=${encodeURIComponent(s.user_id)}` : '';
    fetch(`/api/escorts/applications${appQuery}`, { credentials: 'include', cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        const apps =
          data?.applications && Array.isArray(data.applications)
            ? data.applications
            : data?.application
              ? [data.application]
              : [];
        if (apps.length > 0) {
          const matched = findEscortApplicationForSession(apps, s) || apps[0];
          if (matched && resolveEscortCategory(matched) === 'school_escort') {
            router.replace('/dashboard/escort');
            return;
          }
          if (matched) {
            setEscortData(matched);
          }
        } else if (s?.user_id) {
          // Broader fallback when targeted lookup misses (username-only escorts)
          return fetch('/api/escorts/applications', { credentials: 'include', cache: 'no-store' })
            .then((r) => r.json())
            .then((fallback) => {
              if (!fallback?.applications?.length) return;
              const matched = findEscortApplicationForSession(fallback.applications, s);
              if (matched && resolveEscortCategory(matched) === 'school_escort') {
                router.replace('/dashboard/escort');
                return;
              }
              if (matched) setEscortData(matched);
            });
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
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Lagos',
        hour: '2-digit',
        hour12: false,
      }).format(currentTime)
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
    liveDashboardData?.escort?.code || escortData?.escort_code || escortData?.escortIdCode || null;

  const assignedSchoolNames = Array.from(
    new Set((liveDashboardData?.assigned_schools || []).map((s: any) => s?.name).filter(Boolean))
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
    { id: 'pricing', label: 'Pricing', icon: BadgePercent, badge: 'NEW' },
    { id: 'earnings', label: 'Earnings', icon: DollarSign },
    { id: 'edusave', label: 'EduSave', icon: PiggyBank },
    { id: 'eduinsured', label: 'EduInsuRed', icon: ShieldCheck },
    { id: 'chat', label: 'Communications', icon: MessageSquare, count: chatUnreadTotal },
    { id: 'city-manager', label: 'City Manager', icon: Building2 },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
  ];

  return (
    <div className="relative flex min-h-screen flex-col bg-[#F4F6F9] font-sans text-slate-800 lg:flex-row">
      {/* MOBILE BACKDROP OVERLAY */}
      {sidebarOpen && (
        <div
          className="backdrop-blur-xs animate-in fade-in fixed inset-0 z-40 bg-slate-950/70 transition-opacity duration-200 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* 1. SIDEBAR (#0A1128 Dark Navy Blue) - Slide-over drawer on mobile, static on desktop */}
      <aside
        className={`fixed bottom-0 left-0 top-0 z-50 flex min-h-screen w-72 shrink-0 flex-col justify-between border-r border-slate-800 bg-[#0A1128] p-4 text-white shadow-2xl transition-transform duration-300 ease-in-out lg:static lg:w-64 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="space-y-5">
          {/* Top Brand Logo & Mobile Close Button */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-emerald-700 text-sm font-black text-white shadow-md">
                  🛡️
                </div>
                <span className="text-base font-extrabold tracking-tight text-white md:text-lg">
                  MyEduRide
                </span>
              </div>
              <span className="pl-10 text-[9px] font-bold uppercase tracking-widest text-emerald-300">
                The Student Safety Platform
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="cursor-pointer rounded-xl p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
              aria-label="Close navigation menu"
            >
              <X size={20} />
            </button>
          </div>

          {/* Quick Escort Profile Card on Mobile */}
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 lg:hidden">
            {liveDashboardData?.escort?.photo || escortData?.photo ? (
              <img
                src={liveDashboardData?.escort?.photo || escortData?.photo}
                alt="MyEduRide Escort"
                className="h-10 w-10 shrink-0 rounded-xl border-2 border-emerald-500 object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 font-black text-white">
                {escortName
                  .split(' ')
                  .map((n: string) => n[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-xs font-extrabold text-white">{escortName}</h3>
              <p className="mt-0.5 font-mono text-[10px] font-bold text-emerald-300">
                ID: {escortCode}
              </p>
            </div>
          </div>

          {/* Vertical Navigation Menu */}
          <nav className="space-y-0.5 text-xs font-semibold">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active =
                activeNav === item.id ||
                (item.id === 'schedule' && (activeNav === 'roster' || activeNav === 'assignments'));
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveNav(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`flex w-full cursor-pointer items-center justify-between rounded-xl px-3.5 py-2 transition-all ${
                    active
                      ? 'bg-emerald-600 font-extrabold text-white shadow-md'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge ? (
                    <span className="rounded-md bg-emerald-400 px-1.5 py-0.5 text-[9px] font-black text-slate-950">
                      {item.badge}
                    </span>
                  ) : null}
                  {item.count ? (
                    <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black text-white">
                      {item.count}
                    </span>
                  ) : null}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => {
                setShowAccountModal(true);
                setSidebarOpen(false);
              }}
              className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3.5 py-2 text-slate-300 transition-all hover:bg-white/10 hover:text-white"
            >
              <Settings size={16} />
              <span>Settings</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="mt-2 flex w-full cursor-pointer items-center gap-3 rounded-xl border border-red-500/20 px-3.5 py-2.5 font-extrabold text-red-400 transition-all hover:bg-red-500/20 hover:text-red-300 lg:hidden"
            >
              <LogOut size={16} />
              <span>Log Out</span>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer Cards */}
        <div className="space-y-3 border-t border-white/10 pt-3">
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/5 p-3">
            <span className="text-[11px] font-bold leading-tight text-white">
              Available for Other Schools
            </span>
            <button
              type="button"
              onClick={handleToggleAvailability}
              className={`relative h-6 w-11 shrink-0 rounded-full p-0.5 transition-all ${isAvailable ? 'bg-emerald-500' : 'bg-slate-600'}`}
              aria-pressed={isAvailable}
            >
              <span
                className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-all ${isAvailable ? 'translate-x-5' : 'translate-x-0'}`}
              />
            </button>
          </div>

          <div className="space-y-1 rounded-2xl border border-white/10 bg-white/5 p-3">
            <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
              Unique Communication ID
            </span>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold tracking-wide text-white">
                {escortCode || '—'}
              </span>
              {escortCode && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(escortCode);
                    toast.success('Communication ID copied');
                  }}
                  className="cursor-pointer text-slate-400 transition-all hover:text-white"
                  title="Copy ID"
                >
                  <FileText size={14} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setShowIdCardModal(true);
                setSidebarOpen(false);
              }}
              className="shadow-xs mt-2 flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/20 px-2.5 py-1.5 text-[10px] font-extrabold text-emerald-300 transition-all hover:bg-emerald-500/30 hover:text-white"
            >
              <QrCode size={13} className="text-emerald-400" />
              <span>Show Gate QR Pass</span>
            </button>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
              <Headphones size={18} />
            </div>
            <div>
              <span className="block text-[10px] font-medium text-slate-400">
                Need Help? 24/7 Support
              </span>
              <a
                href="tel:08091234567"
                className="font-mono text-xs font-extrabold text-white hover:text-emerald-300"
              >
                0809 123 4567
              </a>
            </div>
          </div>
        </div>
      </aside>

      {/* 2. RIGHT MAIN CONTENT WRAPPER */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* TOP HEADER BAR */}
        <header className="shadow-xs sticky top-0 z-30 border-b border-slate-200 bg-white">
          {/* Mobile: identity row, then labeled actions */}
          <div className="space-y-2.5 px-3.5 pb-2.5 pt-2.5 lg:hidden">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="shrink-0 rounded-xl bg-slate-100 p-2.5 text-slate-700 transition-colors hover:bg-slate-200"
                aria-label="Open Navigation Menu"
              >
                <Menu size={20} />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold leading-none text-slate-400">
                  {clockDisplay.greeting}
                </p>
                <h2
                  className="mt-0.5 truncate text-base font-black leading-tight text-slate-900"
                  title={escortName}
                >
                  {escortName}
                </h2>
                <p className="mt-0.5 truncate text-[10px] font-medium text-slate-500">
                  {escortCode ? `ID ${escortCode}` : 'Escort ID pending'}
                  {schoolName ? ` · ${schoolName}` : null}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAccountModal(true)}
                className="relative shrink-0"
                title="Escort Account Settings"
                aria-label="Account settings"
              >
                {photoSrc(session?.avatar_url) ||
                photoSrc(liveDashboardData?.escort?.photo) ||
                photoSrc(escortData?.photo) ? (
                  <img
                    src={
                      (photoSrc(session?.avatar_url) ||
                        photoSrc(liveDashboardData?.escort?.photo) ||
                        photoSrc(escortData?.photo)) as string
                    }
                    alt=""
                    className="h-10 w-10 rounded-full border-2 border-emerald-500 object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-emerald-500 bg-emerald-600 text-xs font-black text-white">
                    {escortName
                      .split(' ')
                      .map((n: string) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                )}
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="shrink-0 rounded-xl border border-red-200 bg-red-50 p-2.5 text-red-600 hover:bg-red-100"
                title="Log Out"
                aria-label="Log Out"
              >
                <LogOut size={16} />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                onClick={() => setShowIdCardModal(true)}
                className="flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl bg-[#0A1128] text-white"
              >
                <QrCode size={16} className="text-emerald-400" />
                <span className="text-[10px] font-bold">Pass</span>
              </button>
              <button
                type="button"
                onClick={() => setIncidentModalOpen(true)}
                className="flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-800"
              >
                <AlertTriangle size={16} />
                <span className="text-[10px] font-bold">SOS</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveNav('chat')}
                className={`relative flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl border ${
                  activeNav === 'chat'
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-700'
                }`}
              >
                <MessageSquare size={16} />
                <span className="text-[10px] font-bold">Chat</span>
                {chatUnreadTotal > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-0.5 text-[9px] font-black text-white">
                    {chatUnreadTotal}
                  </span>
                )}
              </button>
              <button
                type="button"
                className="relative flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700"
              >
                <Bell size={16} />
                <span className="text-[10px] font-bold">Alerts</span>
                {unreadNotifs > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-0.5 text-[9px] font-black text-white">
                    {Math.min(unreadNotifs, 99)}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Desktop header: identity + account on top, compact actions below */}
          <div className="hidden px-6 py-3 lg:block">
            <div className="flex items-center gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold text-slate-400">{clockDisplay.greeting},</p>
                <div className="flex min-w-0 items-center gap-2">
                  <h2
                    className="truncate text-lg font-black leading-tight text-slate-900"
                    title={escortName}
                  >
                    {escortName}
                  </h2>
                  <span className="inline-flex shrink-0 rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800">
                    MyEduRide Escort
                  </span>
                </div>
                <p
                  className="truncate text-[11px] font-medium text-slate-500"
                  title={[
                    escortCode ? `Escort ID: ${escortCode}` : 'Escort ID pending',
                    schoolName
                      ? `Assigned School${assignedSchoolNames.length > 1 ? 's' : ''}: ${schoolName}`
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                >
                  {escortCode ? <>Escort ID: {escortCode}</> : 'Escort ID pending'}
                  {schoolName ? (
                    <>
                      {' '}
                      · {assignedSchoolNames.length > 1 ? 'Schools' : 'School'}: {schoolName}
                    </>
                  ) : null}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500 bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                  I&apos;M ONLINE
                </span>
                <button
                  type="button"
                  onClick={handleToggleAvailability}
                  className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                    isAvailable
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-slate-200 bg-slate-50 text-slate-600'
                  }`}
                >
                  {isAvailable ? 'Available' : 'Primary only'}
                </button>
                <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1">
                  <Clock size={13} className="text-emerald-600" />
                  <div className="leading-tight">
                    <span className="block font-mono text-[11px] font-black text-slate-800">
                      {clockDisplay.timeStr}
                    </span>
                    <span className="block text-[9px] font-bold text-slate-400">
                      {clockDisplay.dateStr}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="flex items-center gap-1"
                  onClick={() => setShowAccountModal(true)}
                  title="Escort Account Settings"
                >
                  <div className="relative">
                    {photoSrc(session?.avatar_url) ||
                    photoSrc(liveDashboardData?.escort?.photo) ||
                    photoSrc(escortData?.photo) ? (
                      <img
                        src={
                          (photoSrc(session?.avatar_url) ||
                            photoSrc(liveDashboardData?.escort?.photo) ||
                            photoSrc(escortData?.photo)) as string
                        }
                        alt="MyEduRide Escort"
                        className="h-9 w-9 rounded-full border-2 border-emerald-500 object-cover"
                      />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-emerald-500 bg-emerald-600 text-xs font-black text-white">
                        {escortName
                          .split(' ')
                          .map((n: string) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                    )}
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
                  </div>
                  <ChevronDown size={14} className="text-slate-600" />
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-extrabold text-red-600 hover:bg-red-100"
                  title="Sign Out of MyEduRide Escort Account"
                >
                  <LogOut size={14} />
                  <span>Log Out</span>
                </button>
              </div>
            </div>

            <div className="mt-2.5 flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1">
                <Wallet size={13} className="shrink-0 text-emerald-600" />
                <div className="leading-tight">
                  <span className="block text-[9px] font-bold text-slate-400">Wallet</span>
                  <span className="block font-mono text-[11px] font-black text-slate-800">
                    ₦{walletBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveNav('wallet')}
                className="shadow-xs inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-emerald-600 px-2.5 py-1.5 text-xs font-black text-white transition-colors hover:bg-emerald-500"
                title="View Escort Wallet & Request Bank Payout"
              >
                <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="7" y1="17" x2="17" y2="7" />
                  <polyline points="7 7 17 7 17 17" />
                </svg>
                Payout
              </button>
              <button
                type="button"
                onClick={() => setShowIdCardModal(true)}
                className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-[#0A1128] px-2.5 py-1.5 text-xs font-black text-white hover:bg-slate-800"
                title="Display Digital Escort Gate Pass with Scannable QR"
              >
                <QrCode size={14} className="text-emerald-400" />
                Gate Pass
              </button>
              <button
                type="button"
                onClick={() => setIncidentModalOpen(true)}
                className="flex items-center gap-1 rounded-xl border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-black text-amber-800 hover:bg-amber-100"
                title="Report Incident / Safety SOS"
              >
                <AlertTriangle size={14} className="text-amber-600" />
                SOS
              </button>
              <button
                type="button"
                onClick={() => setActiveNav('chat')}
                className={`relative rounded-xl border p-2 ${
                  activeNav === 'chat'
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
                title="Open Communications"
              >
                <MessageSquare size={16} />
                {chatUnreadTotal > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-0.5 text-[9px] font-black text-white">
                    {chatUnreadTotal}
                  </span>
                )}
              </button>
              <button
                type="button"
                className="relative rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-700 hover:bg-slate-100"
                title="Notifications"
              >
                <Bell size={16} />
                {unreadNotifs > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-0.5 text-[9px] font-black text-white">
                    {Math.min(unreadNotifs, 99)}
                  </span>
                )}
              </button>
              <RoleSwitcher showLogout={false} />
            </div>
          </div>
        </header>

        {/* MAIN CANVAS BODY - Padded for mobile bottom bar */}
        <main className="mx-auto w-full max-w-7xl flex-1 space-y-5 p-3.5 pb-24 sm:p-5 md:p-6 lg:pb-8">
          {activeNav === 'pricing' ? (
            <CityPricingReadOnlyPanel title="City Transport Pricing" />
          ) : (
            <MyEduRideEscortView
              liveDashboardData={liveDashboardData}
              onRefreshData={fetchLiveData}
              onOpenVerificationModal={handleOpenVerification}
              onOpenIncidentModal={() => setIncidentModalOpen(true)}
              onOpenIdCardModal={() => setShowIdCardModal(true)}
              activeNav={activeNav}
              onNavChange={setActiveNav}
            />
          )}
        </main>
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR - Fixed, thumb-friendly app-like navigation */}
      <nav className="safe-area-inset-bottom fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-slate-800/80 bg-[#0A1128]/95 px-2 py-1.5 shadow-2xl backdrop-blur-md lg:hidden">
        <button
          type="button"
          onClick={() => {
            setActiveNav('operations');
            setSidebarOpen(false);
          }}
          className={`flex cursor-pointer flex-col items-center gap-0.5 rounded-xl px-2.5 py-1 transition-all ${
            activeNav === 'operations'
              ? 'font-black text-emerald-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutDashboard
            size={19}
            className={activeNav === 'operations' ? 'stroke-[2.5]' : 'stroke-2'}
          />
          <span className="text-[10px]">Home</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveNav('trips');
            setSidebarOpen(false);
          }}
          className={`flex cursor-pointer flex-col items-center gap-0.5 rounded-xl px-2.5 py-1 transition-all ${
            activeNav === 'trips'
              ? 'font-black text-emerald-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Navigation size={19} className={activeNav === 'trips' ? 'stroke-[2.5]' : 'stroke-2'} />
          <span className="text-[10px]">Trips</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveNav('students');
            setSidebarOpen(false);
          }}
          className={`relative flex cursor-pointer flex-col items-center gap-0.5 rounded-xl px-2.5 py-1 transition-all ${
            activeNav === 'students' ||
            activeNav === 'assignments' ||
            activeNav === 'roster' ||
            activeNav === 'schedule'
              ? 'font-black text-emerald-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users size={19} />
          <span className="text-[10px]">Students</span>
        </button>

        {/* 3. EduChat */}
        <button
          type="button"
          onClick={() => {
            setActiveNav('chat');
            setSidebarOpen(false);
          }}
          className={`relative flex cursor-pointer flex-col items-center gap-0.5 rounded-xl px-2.5 py-1 transition-all ${
            activeNav === 'chat'
              ? 'font-black text-emerald-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MessageSquare size={19} className={activeNav === 'chat' ? 'stroke-[2.5]' : 'stroke-2'} />
          <span className="text-[10px]">Chat</span>
          {chatUnreadTotal > 0 && (
            <span className="shadow-xs absolute -top-0.5 right-1.5 flex h-4 w-4 animate-pulse items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white">
              {chatUnreadTotal}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveNav('wallet');
            setSidebarOpen(false);
          }}
          className={`flex cursor-pointer flex-col items-center gap-0.5 rounded-xl px-2.5 py-1 transition-all ${
            activeNav === 'wallet' || activeNav === 'earnings'
              ? 'font-black text-emerald-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Wallet size={19} />
          <span className="text-[10px]">Wallet</span>
        </button>

        {/* 5. More / Sidebar Toggle */}
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="flex cursor-pointer flex-col items-center gap-0.5 rounded-xl px-2.5 py-1 text-slate-400 transition-all hover:text-slate-200"
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

      {showAccountModal && <AccountSettingsModal onClose={() => setShowAccountModal(false)} />}

      {/* DIGITAL ON-SCREEN ESCORT GATE PASS MODAL */}
      <EscortIdCardModal
        isOpen={showIdCardModal}
        onClose={() => setShowIdCardModal(false)}
        escortData={{
          id: liveDashboardData?.escort?.id || escortData?.id || session?.user_id,
          escort_code: escortCode,
          name: escortName,
          photo: liveDashboardData?.escort?.photo || escortData?.photo || session?.avatar_url,
          vehicle_plate:
            liveDashboardData?.escort?.vehicle_plate ||
            escortData?.regNumber ||
            escortData?.vehicle?.regNumber,
          vehicle_name:
            liveDashboardData?.escort?.vehicle_name ||
            escortData?.vehicleType ||
            escortData?.vehicle?.type,
          operating_area:
            liveDashboardData?.escort?.operating_area ||
            escortData?.operating_area ||
            escortData?.city,
        }}
      />
    </div>
  );
}
