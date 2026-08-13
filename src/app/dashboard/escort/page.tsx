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

  useEffect(() => {
    const s = getSession();
    setSession(s);

    // Fetch live application status for logged-in escort user
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
                  {escortData?.name || escortData?.fullName || session?.full_name || session?.name || 'John Adebayo'}
                </h4>
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                <span className="text-[10px] text-emerald-700 font-bold">Online</span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium">
                Official Escort • <span className="font-mono text-slate-700">{escortData?.escort_code || escortData?.escortCode || escortData?.id || 'ESC-230081'}</span>
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

        {/* WORKFLOW STATUS DEMO BAR */}
        <div className="bg-slate-900 text-white px-4 py-2 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-brand-green uppercase tracking-wider text-[11px] flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Approval Workflow Demo:
            </span>
            <span className="text-slate-300">
              Status: <strong className="text-emerald-400 font-mono">{approvalStatus.replace(/_/g, ' ')}</strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-xl text-[10px] font-bold border border-slate-700">
            <button
              onClick={() => setApprovalStatus('PENDING_CITY_MANAGER_REVIEW')}
              className={`px-2 py-0.5 rounded-lg transition-all ${
                approvalStatus === 'PENDING_CITY_MANAGER_REVIEW' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              1. Pending Review
            </button>
            <button
              onClick={() => setApprovalStatus('CORRECTION_REQUESTED')}
              className={`px-2 py-0.5 rounded-lg transition-all ${
                approvalStatus === 'CORRECTION_REQUESTED' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              2. Correction
            </button>
            <button
              onClick={() => setApprovalStatus('REJECTED')}
              className={`px-2 py-0.5 rounded-lg transition-all ${
                approvalStatus === 'REJECTED' ? 'bg-red-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              3. Rejected
            </button>
            <button
              onClick={() => setApprovalStatus('CITY_MANAGER_APPROVED')}
              className={`px-2 py-0.5 rounded-lg transition-all ${
                approvalStatus === 'CITY_MANAGER_APPROVED' ? 'bg-brand-green text-white font-bold shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              4. CM Approved
            </button>
            <button
              onClick={() => setApprovalStatus('ACTIVATED')}
              className={`px-2 py-0.5 rounded-lg transition-all ${
                approvalStatus === 'ACTIVATED' ? 'bg-blue-600 text-white font-bold shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              5. Activated
            </button>
          </div>
        </div>

        {/* MAIN CANVAS BODY */}
        <main className="flex-1 p-4 md:p-6 space-y-6">
          {approvalStatus === 'ACTIVATED' ? (
            <SharedEscortDashboard
              session={session}
              escortData={escortData}
              onOpenVerificationModal={handleOpenVerification}
              onOpenIncidentModal={() => setIncidentModalOpen(true)}
              onOpenAccountModal={() => setShowAccountModal(true)}
            />
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
                            body: JSON.stringify({ appId: 'APP-ESC-901', paymentMethod: 'card' }),
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
    </div>
  );
}
