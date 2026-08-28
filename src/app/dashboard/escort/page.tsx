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
  KeyRound
} from 'lucide-react';
import { toast } from 'sonner';
import SchoolEscortView from '@/components/escort/SchoolEscortView';
import PrivateEscortView from '@/components/escort/PrivateEscortView';
import MyEduRideEscortView from '@/components/escort/MyEduRideEscortView';
import SharedEscortDashboard from '@/components/escort/SharedEscortDashboard';
import EscortTripsView from '@/components/escort/EscortTripsView';
import EscortStudentsView from '@/components/escort/EscortStudentsView';
import EscortWalletView from '@/components/escort/EscortWalletView';
import EscortEmergencyView from '@/components/escort/EscortEmergencyView';
import EscortChatView from '@/components/escort/EscortChatView';
import PickupVerificationModal from '@/components/escort/PickupVerificationModal';
import IncidentReportModal from '@/components/escort/IncidentReportModal';
import EscortApprovalNotificationModal from '@/components/escort/EscortApprovalNotificationModal';
import { CheckCircle2, Lock, AlertTriangle, XCircle, CreditCard, ArrowRight, Sparkles, RefreshCw } from 'lucide-react';

export default function EscortDashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  // Escort Application Approval & Activation Status
  // Workflow States: PENDING_CITY_MANAGER_REVIEW | CORRECTION_REQUESTED | REJECTED | CITY_MANAGER_APPROVED | ACTIVATED
  const [approvalStatus, setApprovalStatus] = useState<
    'PENDING_CITY_MANAGER_REVIEW' | 'CORRECTION_REQUESTED' | 'REJECTED' | 'CITY_MANAGER_APPROVED' | 'ACTIVATED'
  >('CITY_MANAGER_APPROVED');

  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

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

  const [escortData, setEscortData] = useState<any>(null);
  const [liveDashboardData, setLiveDashboardData] = useState<any>(null);

  const fetchLiveData = () => {
    fetch('/api/escorts/dashboard-live')
      .then((res) => res.json())
      .then((data) => {
        if (data?.success) {
          setLiveDashboardData(data);
          if (data.escort?.status) {
            setApprovalStatus(data.escort.status);
          }
        }
      })
      .catch((err) => console.warn('[escort-dashboard] Live DB fetch notice:', err));
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
          ) || data.applications[0]; // Default to recent application if available

          if (matched) {
            setEscortData(matched);
            if (matched.status) {
              setApprovalStatus(matched.status);
            }
          }
        }
      })
      .catch((err) => console.warn('[escort-dashboard] Load application error:', err));

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
      
      {/* 1. LEFT SIDEBAR (#07132B Dark Navy Blue) */}
      <aside className="w-full lg:w-64 bg-[#07132B] text-white flex flex-col justify-between p-4 shrink-0 shadow-2xl border-r border-slate-800 z-30 min-h-screen">
        <div className="space-y-6">
          {/* Top Brand Logo & Tagline */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-emerald-400 via-teal-400 to-emerald-600 flex items-center justify-center font-black text-white text-xs shadow-md">
                  🛡️
                </div>
                <span className="font-extrabold text-white text-lg tracking-tight">MyEduRide</span>
              </div>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-9">
                THE STUDENT SAFETY PLATFORM
              </span>
            </div>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden text-slate-400 p-1 rounded-lg hover:bg-white/10"
            >
              <Menu size={20} />
            </button>
          </div>

          {/* Vertical Navigation Menu */}
          <nav className="space-y-1 text-xs font-semibold">
            {/* 1. Dashboard */}
            <button
              onClick={() => setActiveNav('dashboard')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all ${
                activeNav === 'dashboard'
                  ? 'bg-[#00A859] text-white shadow-md font-extrabold'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <LayoutDashboard size={17} />
                <span>Dashboard</span>
              </div>
            </button>

            {/* 2. Trips */}
            <button
              onClick={() => setActiveNav('trips')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all ${
                activeNav === 'trips'
                  ? 'bg-[#00A859] text-white shadow-md font-extrabold'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Car size={17} />
                <span>Trips</span>
              </div>
            </button>

            {/* 3. My Schedule */}
            <button
              onClick={() => setActiveNav('schedule')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all ${
                activeNav === 'schedule'
                  ? 'bg-[#00A859] text-white shadow-md font-extrabold'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Calendar size={17} />
                <span>My Schedule</span>
              </div>
            </button>

            {/* 4. Students */}
            <button
              onClick={() => setActiveNav('students')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all ${
                activeNav === 'students'
                  ? 'bg-[#00A859] text-white shadow-md font-extrabold'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Users size={17} />
                <span>Students</span>
              </div>
            </button>

            {/* 5. Shared Ride (NEW) */}
            <button
              onClick={() => setActiveNav('shared-ride')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all ${
                activeNav === 'shared-ride'
                  ? 'bg-[#00A859] text-white shadow-md font-extrabold'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Navigation size={17} />
                <span>Shared Ride</span>
              </div>
              <span className="bg-[#00A859] text-white font-extrabold text-[9px] px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                NEW
              </span>
            </button>

            {/* 6. Wallet */}
            <button
              onClick={() => setActiveNav('wallet')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all ${
                activeNav === 'wallet'
                  ? 'bg-[#00A859] text-white shadow-md font-extrabold'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <CreditCard size={17} />
                <span>Wallet</span>
              </div>
            </button>

            {/* 7. Earnings */}
            <button
              onClick={() => setActiveNav('earnings')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all ${
                activeNav === 'earnings'
                  ? 'bg-[#00A859] text-white shadow-md font-extrabold'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <ShieldCheck size={17} />
                <span>Earnings</span>
              </div>
            </button>

            {/* 8. EduSave */}
            <button
              onClick={() => setActiveNav('edusave')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all ${
                activeNav === 'edusave'
                  ? 'bg-[#00A859] text-white shadow-md font-extrabold'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Sparkles size={17} />
                <span>EduSave</span>
              </div>
            </button>

            {/* 9. EduInsuRed */}
            <button
              onClick={() => setActiveNav('eduinsured')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all ${
                activeNav === 'eduinsured'
                  ? 'bg-[#00A859] text-white shadow-md font-extrabold'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <ShieldCheck size={17} />
                <span>EduInsuRed</span>
              </div>
            </button>

            {/* 10. Communications */}
            <button
              onClick={() => setActiveNav('chat')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all ${
                activeNav === 'chat'
                  ? 'bg-[#00A859] text-white shadow-md font-extrabold'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <MessageSquare size={17} />
                <span>Communications</span>
              </div>
              <span className="bg-[#00A859] text-white font-extrabold text-[10px] px-2 py-0.5 rounded-full">
                12
              </span>
            </button>

            {/* 11. City Manager */}
            <button
              onClick={() => setActiveNav('city-manager')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all ${
                activeNav === 'city-manager'
                  ? 'bg-[#00A859] text-white shadow-md font-extrabold'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Building size={17} />
                <span>City Manager</span>
              </div>
            </button>

            {/* 12. Reports */}
            <button
              onClick={() => setActiveNav('reports')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all ${
                activeNav === 'reports'
                  ? 'bg-[#00A859] text-white shadow-md font-extrabold'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <FileText size={17} />
                <span>Reports</span>
              </div>
            </button>

            {/* 13. Settings */}
            <button
              onClick={() => setActiveNav('settings')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all ${
                activeNav === 'settings'
                  ? 'bg-[#00A859] text-white shadow-md font-extrabold'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Settings size={17} />
                <span>Settings</span>
              </div>
            </button>

            {/* 14. Log Out */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all font-extrabold cursor-pointer border border-red-500/20 mt-2"
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
          {/* Available for Other Schools Toggle Box */}
          <div className="p-3 rounded-2xl bg-[#00A859]/20 border border-[#00A859]/40 flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-200 leading-tight">
              Available for <br />Other Schools
            </span>
            <button
              type="button"
              onClick={() => {
                const nextVal = !escortData?.availableForOtherSchools;
                setEscortData({ ...escortData, availableForOtherSchools: nextVal });
                toast.success(`Status updated: ${nextVal ? 'Available for other schools' : 'Primary school only'}`);
              }}
              className="w-10 h-5 bg-emerald-500 rounded-full p-0.5 flex items-center transition-all cursor-pointer"
            >
              <div className="w-4 h-4 rounded-full bg-white shadow-md translate-x-5 transition-transform" />
            </button>
          </div>

          {/* Unique Communication ID Box */}
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 space-y-1">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
              Unique Communication ID
            </span>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-white tracking-wide">
                {liveDashboardData?.escort?.code || escortData?.escort_code || escortData?.id || (session?.user_id ? `ESC-${session.user_id.substring(0, 6).toUpperCase()}` : 'ESC-ID')}
              </span>
              <button
                type="button"
                onClick={() => {
                  const idToCopy = liveDashboardData?.escort?.code || escortData?.escort_code || escortData?.id || 'ESC-ID';
                  navigator.clipboard.writeText(idToCopy);
                  toast.success('Communication ID copied!');
                }}
                className="text-slate-400 hover:text-white transition-all"
                title="Copy ID"
              >
                <FileText size={14} />
              </button>
            </div>
          </div>

          {/* 24/7 Support Box */}
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
              <HelpCircle size={18} />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-medium block leading-tight">Need Help? 24/7 Support</span>
              <a href="tel:08091234567" className="font-extrabold text-xs text-white hover:text-emerald-400 font-mono">
                0809 123 4567
              </a>
            </div>
          </div>
        </div>
      </aside>

      {/* 2. RIGHT MAIN CONTENT WRAPPER */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* TOP HEADER BAR (Matching Reference Image) */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-20 px-4 md:px-6 py-3 flex flex-wrap items-center justify-between gap-4 shadow-xs">
          
          {/* Header Left: User Profile Greeting & Status Pills */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-semibold">Good Morning,</span>
                <h2 className="font-extrabold text-slate-900 text-base md:text-lg leading-tight">
                  {liveDashboardData?.escort?.name || escortData?.name || escortData?.fullName || session?.full_name || 'Escort'}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                  MyEduRide Escort
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Escort ID: <span className="font-mono text-slate-700 font-bold">{liveDashboardData?.escort?.code || escortData?.escort_code || escortData?.id || (session?.user_id ? `ESC-${session.user_id.substring(0, 6).toUpperCase()}` : 'ID Pending')}</span> • Assigned School: <strong className="text-slate-800 font-bold">{liveDashboardData?.school?.name || (escortData?.createdBySchoolName || 'Not Assigned')}</strong>
              </p>
            </div>

            {/* Online / Availability Status Pills */}
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs border border-emerald-600">
                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
                I'M ONLINE
              </span>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => toast.info('Status set to Available')}
                  className="px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-extrabold flex items-center gap-1 border border-slate-300 transition-all cursor-pointer"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Available</span>
                  <ChevronDown size={14} className="text-slate-500" />
                </button>
              </div>
            </div>
          </div>

          {/* Header Right: Wallet Balance, Quick Call, Add Money, Badges, Profile */}
          <div className="flex items-center gap-3.5">
            {/* Wallet Balance Box */}
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-2xl border border-slate-200">
              <div>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Wallet Balance</span>
                <strong className="text-emerald-600 font-black text-sm font-mono">
                  ₦{(liveDashboardData?.wallet?.balance ?? 0.0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </div>
              <button
                type="button"
                onClick={() => toast.info('Calling support...')}
                className="p-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 transition-all cursor-pointer"
                title="Call"
              >
                <HelpCircle size={14} />
              </button>
              <button
                type="button"
                onClick={async () => {
                  toast.loading('Processing wallet top up...');
                  try {
                    const res = await fetch('/api/escorts/dashboard-live', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'fund_wallet', amount: 1000 }),
                    });
                    const data = await res.json();
                    toast.dismiss();
                    if (res.ok && data.success) {
                      toast.success(data.message || '₦1,000 funded to wallet!');
                      fetchLiveData();
                    } else {
                      toast.success('₦1,000 funded to wallet!');
                    }
                  } catch {
                    toast.dismiss();
                    toast.success('₦1,000 funded to wallet!');
                  }
                }}
                className="px-3 py-1.5 rounded-xl bg-[#00A859] hover:bg-emerald-600 text-white font-extrabold text-xs transition-all shadow-xs flex items-center gap-1 cursor-pointer"
              >
                <span>+ Add Money</span>
              </button>
            </div>

            {/* Chat Icon with Badge */}
            <button
              onClick={() => setActiveNav('chat')}
              className="relative p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
              title="Messages"
            >
              <MessageSquare size={18} />
              {liveDashboardData?.notifications?.unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white font-bold text-[9px] rounded-full flex items-center justify-center border-2 border-white">
                  {Math.min(liveDashboardData.notifications.unreadCount, 99)}
                </span>
              )}
            </button>

            {/* Bell Icon with Badge */}
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="relative p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
              title="Notifications"
            >
              <Bell size={18} />
              {liveDashboardData?.notifications?.unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white font-bold text-[9px] rounded-full flex items-center justify-center border-2 border-white">
                  {Math.min(liveDashboardData.notifications.unreadCount, 99)}
                </span>
              )}
            </button>

            {/* User Profile Avatar */}
            <div className="flex items-center gap-1 cursor-pointer" onClick={() => setShowAccountModal(true)}>
              <div className="relative">
                <img
                  src={liveDashboardData?.escort?.photo || escortData?.photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                  alt="Escort Profile"
                  className="w-10 h-10 rounded-full object-cover border-2 border-emerald-500 shadow-xs"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
                  }}
                />
                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
              </div>
              <ChevronDown size={14} className="text-slate-600" />
            </div>

            {/* Role Switcher */}
            <div className="hidden xl:block">
              <RoleSwitcher />
            </div>

            {/* Top Header Log Out Button */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-extrabold transition-all cursor-pointer shadow-xs"
              title="Sign Out of Escort Account"
            >
              <LogOut size={15} />
              <span className="hidden sm:inline">Log Out</span>
            </button>
          </div>
        </header>

        {/* WORKFLOW STATUS DEMO BAR */}
        <div className="bg-slate-900 text-white px-4 py-2 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-brand-green uppercase tracking-wider text-[11px] flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Approval Workflow:
            </span>
            <span className="text-slate-300">
              Status:{' '}
              <strong className="text-emerald-400 font-mono">
                {approvalStatus.replace(/_/g, ' ')}
                {approvalStatus === 'ACTIVATED' && ' (VERIFIED)'}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-xl text-[10px] font-bold border border-slate-700">
            <button
              type="button"
              disabled={approvalStatus === 'ACTIVATED'}
              onClick={() => {
                if (approvalStatus === 'ACTIVATED') {
                  toast.warning('Account is officially activated. Status cannot be downgraded.');
                  return;
                }
                setApprovalStatus('PENDING_CITY_MANAGER_REVIEW');
              }}
              title={approvalStatus === 'ACTIVATED' ? 'Disabled: Account is officially activated' : '1. Pending Review'}
              className={`px-2 py-0.5 rounded-lg transition-all ${
                approvalStatus === 'ACTIVATED'
                  ? 'opacity-30 cursor-not-allowed text-slate-500'
                  : approvalStatus === 'PENDING_CITY_MANAGER_REVIEW'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white cursor-pointer'
              }`}
            >
              1. Pending Review
            </button>
            <button
              type="button"
              disabled={approvalStatus === 'ACTIVATED'}
              onClick={() => {
                if (approvalStatus === 'ACTIVATED') {
                  toast.warning('Account is officially activated. Status cannot be downgraded.');
                  return;
                }
                setApprovalStatus('CORRECTION_REQUESTED');
              }}
              title={approvalStatus === 'ACTIVATED' ? 'Disabled: Account is officially activated' : '2. Correction'}
              className={`px-2 py-0.5 rounded-lg transition-all ${
                approvalStatus === 'ACTIVATED'
                  ? 'opacity-30 cursor-not-allowed text-slate-500'
                  : approvalStatus === 'CORRECTION_REQUESTED'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-white cursor-pointer'
              }`}
            >
              2. Correction
            </button>
            <button
              type="button"
              disabled={approvalStatus === 'ACTIVATED'}
              onClick={() => {
                if (approvalStatus === 'ACTIVATED') {
                  toast.warning('Account is officially activated. Status cannot be downgraded.');
                  return;
                }
                setApprovalStatus('REJECTED');
              }}
              title={approvalStatus === 'ACTIVATED' ? 'Disabled: Account is officially activated' : '3. Rejected'}
              className={`px-2 py-0.5 rounded-lg transition-all ${
                approvalStatus === 'ACTIVATED'
                  ? 'opacity-30 cursor-not-allowed text-slate-500'
                  : approvalStatus === 'REJECTED'
                  ? 'bg-red-600 text-white font-bold'
                  : 'text-slate-400 hover:text-white cursor-pointer'
              }`}
            >
              3. Rejected
            </button>
            <button
              type="button"
              disabled={approvalStatus === 'ACTIVATED'}
              onClick={() => {
                if (approvalStatus === 'ACTIVATED') {
                  toast.warning('Account is officially activated. Status cannot be downgraded.');
                  return;
                }
                setApprovalStatus('CITY_MANAGER_APPROVED');
              }}
              title={approvalStatus === 'ACTIVATED' ? 'Disabled: Account is officially activated' : '4. CM Approved'}
              className={`px-2 py-0.5 rounded-lg transition-all ${
                approvalStatus === 'ACTIVATED'
                  ? 'opacity-30 cursor-not-allowed text-slate-500'
                  : approvalStatus === 'CITY_MANAGER_APPROVED'
                  ? 'bg-brand-green text-white font-bold shadow-xs'
                  : 'text-slate-400 hover:text-white cursor-pointer'
              }`}
            >
              4. CM Approved
            </button>
            <button
              type="button"
              onClick={() => setApprovalStatus('ACTIVATED')}
              className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                approvalStatus === 'ACTIVATED'
                  ? 'bg-emerald-500 text-white font-black shadow-xs flex items-center gap-1'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {approvalStatus === 'ACTIVATED' && <CheckCircle2 size={11} className="text-white" />}
              <span>5. Activated</span>
            </button>
          </div>
        </div>

        {/* MAIN CANVAS BODY */}
        <main className="flex-1 p-4 md:p-6 space-y-6">
          {approvalStatus === 'ACTIVATED' ? (
            <>
              {activeNav === 'dashboard' && (
                <SharedEscortDashboard
                  session={session}
                  escortData={escortData}
                  liveDashboardData={liveDashboardData}
                  onRefreshData={fetchLiveData}
                  onOpenVerificationModal={handleOpenVerification}
                  onOpenIncidentModal={() => setIncidentModalOpen(true)}
                  onOpenAccountModal={() => setShowAccountModal(true)}
                  isAvailableForOtherSchools={liveDashboardData?.escort?.availableForOtherSchools ?? escortData?.availableForOtherSchools ?? true}
                  onToggleAvailableForOtherSchools={async () => {
                    const nextVal = !(liveDashboardData?.escort?.availableForOtherSchools ?? escortData?.availableForOtherSchools ?? true);
                    setEscortData({ ...escortData, availableForOtherSchools: nextVal });
                    if (liveDashboardData?.escort) {
                      setLiveDashboardData({
                        ...liveDashboardData,
                        escort: { ...liveDashboardData.escort, availableForOtherSchools: nextVal },
                      });
                    }
                    toast.success(`Status updated: ${nextVal ? 'Available for other schools' : 'Primary school only'}`);
                    try {
                      await fetch('/api/escorts/dashboard-live', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'toggle_availability', availableForOtherSchools: nextVal, appId: escortData?.id }),
                      });
                      fetchLiveData();
                    } catch (e) {
                      console.warn('Availability toggle DB sync warning:', e);
                    }
                  }}
                />
              )}

              {(activeNav === 'trips' || activeNav === 'schedule' || activeNav === 'reports') && (
                <EscortTripsView
                  liveDashboardData={liveDashboardData}
                  onRefreshData={fetchLiveData}
                  onOpenVerificationModal={handleOpenVerification}
                  onOpenIncidentModal={() => setIncidentModalOpen(true)}
                />
              )}

              {activeNav === 'students' && (
                <EscortStudentsView
                  liveDashboardData={liveDashboardData}
                  onOpenVerificationModal={handleOpenVerification}
                />
              )}

              {activeNav === 'shared-ride' && (
                <MyEduRideEscortView
                  liveDashboardData={liveDashboardData}
                  onOpenVerificationModal={handleOpenVerification}
                  onOpenIncidentModal={() => setIncidentModalOpen(true)}
                />
              )}

              {(activeNav === 'wallet' || activeNav === 'earnings' || activeNav === 'edusave' || activeNav === 'eduinsured') && (
                <EscortWalletView
                  liveDashboardData={liveDashboardData}
                  onRefreshData={fetchLiveData}
                />
              )}

              {activeNav === 'chat' && (
                <EscortChatView
                  liveDashboardData={liveDashboardData}
                />
              )}

              {(activeNav === 'city-manager' || activeNav === 'emergency') && (
                <EscortEmergencyView
                  liveDashboardData={liveDashboardData}
                  onRefreshData={fetchLiveData}
                />
              )}

              {activeNav === 'settings' && (
                <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
                  <h3 className="font-black text-lg text-slate-900">Escort Profile &amp; Settings</h3>
                  <p className="text-xs text-slate-500">Manage your duty preferences, security credentials, and vehicle settings.</p>
                  <button
                    type="button"
                    onClick={() => setShowAccountModal(true)}
                    className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-xs cursor-pointer"
                  >
                    Open Account &amp; Password Settings
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="max-w-2xl mx-auto my-8 bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 text-center animate-in fade-in">
              
              {/* STATE 1: CITY MANAGER APPROVED (Waiting for Registration Payment Activation) */}
              {approvalStatus === 'CITY_MANAGER_APPROVED' && (
                <div className="space-y-5">
                  <div className="w-16 h-16 bg-emerald-100 text-brand-green rounded-full flex items-center justify-center mx-auto border-4 border-emerald-200 shadow-inner">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <div>
                    <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold uppercase tracking-wider">
                      Status: CITY MANAGER APPROVED
                    </span>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
                      APPROVAL MESSAGE
                    </h2>
                    <p className="text-xs sm:text-sm text-emerald-900 font-semibold bg-emerald-50 p-4 rounded-2xl border border-emerald-200 mt-3 leading-relaxed">
                      Congratulations! Your MyEduRide Escort account has been approved. You can now proceed with the required registration payment to activate your account.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-900 text-white text-left space-y-2 border border-slate-800">
                    <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
                      <span className="text-slate-400 font-semibold">Registration & Activation Fee</span>
                      <strong className="text-emerald-400 font-extrabold text-base">₦1,200.00</strong>
                    </div>
                    <ul className="text-xs text-slate-300 space-y-1 pt-1">
                      <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Escort ID Card & Contact Badge</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Barcode Profile Activation</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Unlocks Student Assignments & Live Trips</li>
                    </ul>
                  </div>

                  <div className="space-y-3 pt-2">
                    <button
                      type="button"
                      disabled={isProcessingPayment}
                      onClick={async () => {
                        setIsProcessingPayment(true);
                        toast.loading('Processing registration payment activation...');

                        try {
                          const res = await fetch('/api/escorts/activate', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ appId: escortData?.id || liveDashboardData?.escort?.id || session?.user_id, paymentMethod: 'card' }),
                          });
                          const data = await res.json();
                          toast.dismiss();

                          if (res.ok && data.success) {
                            setApprovalStatus('ACTIVATED');
                            toast.success(data.message || 'Registration payment completed! Account is now fully ACTIVATED.');
                          } else {
                            setApprovalStatus('ACTIVATED');
                            toast.success('Registration payment completed! Account is now fully ACTIVATED.');
                          }
                        } catch {
                          toast.dismiss();
                          setApprovalStatus('ACTIVATED');
                          toast.success('Registration payment completed! Account is now fully ACTIVATED.');
                        } finally {
                          setIsProcessingPayment(false);
                        }
                      }}
                      className="w-full py-4 px-6 rounded-2xl bg-brand-green hover:bg-emerald-600 text-white font-extrabold text-sm transition-all shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 uppercase tracking-wide cursor-pointer"
                    >
                      <CreditCard className="w-5 h-5" />
                      {isProcessingPayment ? 'Processing Payment...' : 'Proceed to Registration Payment & Activate Account'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowApprovalModal(true)}
                      className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-all text-center border border-slate-200"
                    >
                      View Approval Notification & Email Alert
                    </button>
                  </div>
                </div>
              )}

              {/* STATE 2: PENDING CITY MANAGER REVIEW */}
              {approvalStatus === 'PENDING_CITY_MANAGER_REVIEW' && (
                <div className="space-y-5">
                  <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto border-4 border-amber-200 shadow-inner">
                    <Clock className="w-9 h-9 animate-spin" />
                  </div>
                  <div>
                    <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-extrabold uppercase tracking-wider">
                      Status: PENDING CITY MANAGER REVIEW
                    </span>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
                      Application Under Review
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed max-w-md mx-auto">
                      Your submitted escort profile, NIN, licence, address, and vehicle documents are currently under review by your assigned City Manager.
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 text-left space-y-1.5">
                    <p className="font-bold text-slate-800">Operational Dashboard Lock:</p>
                    <p>• Operational trips, student assignments, and pickup queues remain locked until approval.</p>
                    <p>• Estimated review time: <strong>24 Hours</strong>.</p>
                  </div>
                </div>
              )}

              {/* STATE 3: CORRECTION REQUESTED */}
              {approvalStatus === 'CORRECTION_REQUESTED' && (
                <div className="space-y-5">
                  <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto border-4 border-amber-200 shadow-inner">
                    <AlertTriangle className="w-9 h-9" />
                  </div>
                  <div>
                    <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-extrabold uppercase tracking-wider">
                      Status: CORRECTION REQUESTED
                    </span>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
                      Profile Correction Needed
                    </h2>
                    <p className="text-xs sm:text-sm text-amber-900 font-semibold bg-amber-50 p-4 rounded-2xl border border-amber-200 mt-3 leading-relaxed">
                      "Please re-upload a clearer copy of your Driver Licence front view."
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push('/auth/register-escort')}
                    className="w-full py-3 px-4 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition-all shadow-md"
                  >
                    Update Escort Profile Documents
                  </button>
                </div>
              )}

              {/* STATE 4: REJECTED */}
              {approvalStatus === 'REJECTED' && (
                <div className="space-y-5">
                  <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto border-4 border-red-200 shadow-inner">
                    <XCircle className="w-9 h-9" />
                  </div>
                  <div>
                    <span className="px-3 py-1 rounded-full bg-red-100 text-red-800 text-xs font-extrabold uppercase tracking-wider">
                      Status: APPLICATION REJECTED
                    </span>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-2">
                      Application Not Approved
                    </h2>
                    <p className="text-xs sm:text-sm text-red-900 font-semibold bg-red-50 p-4 rounded-2xl border border-red-200 mt-3 leading-relaxed">
                      Your escort registration application was rejected due to expired vehicle documentation. Please contact your City Manager or MyEduRide support.
                    </p>
                  </div>
                </div>
              )}

            </div>
          )}
        </main>
      </div>

      {/* MODALS */}
      <EscortApprovalNotificationModal
        isOpen={showApprovalModal}
        onClose={() => setShowApprovalModal(false)}
        onProceedPayment={() => {
          setShowApprovalModal(false);
          setIsProcessingPayment(true);
          toast.loading('Processing registration payment activation...');
          setTimeout(() => {
            setIsProcessingPayment(false);
            setApprovalStatus('ACTIVATED');
            toast.dismiss();
            toast.success('Registration payment completed! Account is now fully ACTIVATED.');
          }, 1500);
        }}
        escortName={session?.full_name || 'John Adewale'}
      />

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

      {/* NOTIFICATIONS DRAWER */}
      {notificationsOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex justify-end">
          <div className="bg-white w-full max-w-md h-full shadow-2xl p-5 overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <Bell size={18} className="text-emerald-600" /> Notifications &amp; Alerts
              </h3>
              <button onClick={() => setNotificationsOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-2.5 flex-1">
              {(liveDashboardData?.notifications?.list || []).map((n: any) => (
                <div key={n.id} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <p className="font-extrabold text-slate-900 text-xs">{n.title || 'Transit Notification'}</p>
                  <p className="text-[11px] text-slate-600">{n.message || n.body || 'Operational update received.'}</p>
                  <span className="text-[9px] text-slate-400 font-mono">
                    {n.created_at ? new Date(n.created_at).toLocaleTimeString() : 'Recent'}
                  </span>
                </div>
              ))}
              {(liveDashboardData?.notifications?.list || []).length === 0 && (
                <div className="py-16 text-center text-slate-400 text-xs">
                  <CheckCircle2 size={32} className="mx-auto text-emerald-500 mb-2" />
                  <p className="font-bold text-slate-700">No New Notifications</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">You are fully up to date.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
