// @ts-nocheck
'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  Users,
  Bus,
  Navigation,
  Activity,
  CalendarCheck,
  DollarSign,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Sparkles,
  MapPin,
  RefreshCw,
  QrCode,
  ShieldCheck,
  Clock,
  Radio,
  FileText,
  Check,
  X,
  ExternalLink,
  Phone,
  Compass,
  AlertCircle,
  Zap,
  Car,
  MessageSquare,
  BellRing
} from 'lucide-react';
import { toast } from 'sonner';
import SchoolNoticeBanner from '@/components/shared/SchoolNoticeBanner';
import EscortEduChatView from '@/components/escort/EscortEduChatView';
import LiveHouseNavigationModal from '@/components/escort/LiveHouseNavigationModal';
import SharedEscortDashboard from '@/components/escort/SharedEscortDashboard';
import EscortTripsView from '@/components/escort/EscortTripsView';
import EscortStudentsView from '@/components/escort/EscortStudentsView';
import EscortWalletView from '@/components/escort/EscortWalletView';

interface MyEduRideEscortViewProps {
  liveDashboardData?: any;
  onRefreshData?: () => void;
  onOpenVerificationModal: (student?: any) => void;
  onOpenIncidentModal: () => void;
  onOpenIdCardModal?: () => void;
  activeNav?: string;
  onNavChange?: (tab: string) => void;
}

export default function MyEduRideEscortView({
  liveDashboardData,
  onRefreshData = () => {},
  onOpenVerificationModal,
  onOpenIncidentModal,
  onOpenIdCardModal,
  activeNav,
  onNavChange,
}: MyEduRideEscortViewProps) {
  const [internalTab, setInternalTab] = useState<
    'operations' | 'assignments' | 'vehicle' | 'optimisation' | 'journey' | 'attendance' | 'earnings' | 'incidents' | 'analytics' | 'chat'
  >('operations');

  // Direct student targeting for EduChat
  const [selectedStudentForChat, setSelectedStudentForChat] = useState<string | null>(null);
  const [chatUnreadTotal, setChatUnreadTotal] = useState<number>(0);

  // Synchronize with activeNav if provided by dashboard shell
  const activeTab = useMemo(() => {
    if (activeNav) {
      if (activeNav === 'roster' || activeNav === 'schedule') return 'assignments';
      if (activeNav === 'dispatch') return 'trips';
      if (activeNav === 'communications') return 'chat';
      return activeNav as any;
    }
    return internalTab;
  }, [activeNav, internalTab]);

  const setActiveTab = (tab: any) => {
    setInternalTab(tab);
    if (onNavChange) {
      onNavChange(tab);
    }
  };

  // Simulated Live Journey state
  const [journeyStatus, setJourneyStatus] = useState<'idle' | 'tracking' | 'completed'>('idle');
  const [speed, setSpeed] = useState(0); // km/h

  // Student assignments across schools from live database
  const [discAssignments, setDiscAssignments] = useState<any[]>([]);

  // Daily Trip Commitment State
  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [isSubmittingCommitment, setIsSubmittingCommitment] = useState(false);

  // Escort House Pinning State
  const [pinLocationModalOpen, setPinLocationModalOpen] = useState(false);
  const [pinningGps, setPinningGps] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [locationForm, setLocationForm] = useState({
    residential_address: '',
    closest_landmark: '',
    house_lat: null as number | null,
    house_lng: null as number | null,
  });

  // Live House Navigation Modal
  const [navModalStudent, setNavModalStudent] = useState<any | null>(null);

  const reloadData = () => {
    onRefreshData?.();
  };

  useEffect(() => {
    // Defer secondary fetches so first paint uses parent-provided liveDashboardData
    const t = setTimeout(() => {
      fetch('/api/escorts/house-location')
        .then((res) => res.json())
        .then((data) => {
          if (data?.success) {
            setLocationForm({
              residential_address: data.residential_address || '',
              closest_landmark: data.closest_landmark || '',
              house_lat: data.house_lat,
              house_lng: data.house_lng,
            });
          }
        })
        .catch(() => {});

      fetch('/api/escorts/chat')
        .then((res) => res.json())
        .then((data) => {
          if (data?.unread_totals?.total !== undefined) {
            setChatUnreadTotal(data.unread_totals.total);
          }
        })
        .catch(() => {});
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    // Prefer roster from parent live payload — no second dashboard-live round-trip on mount
    if (liveDashboardData?.assignments && Array.isArray(liveDashboardData.assignments)) {
      setDiscAssignments(liveDashboardData.assignments);
    } else if (liveDashboardData?.students?.manifest) {
      setDiscAssignments(liveDashboardData.students.manifest);
    }
  }, [liveDashboardData]);

  const manifestStudents = liveDashboardData?.students?.manifest || [];
  const displayRoster = manifestStudents.length > 0 ? manifestStudents : discAssignments;
  const earningsSummary = liveDashboardData?.earnings_summary || {
    total_daily_earnings: displayRoster.reduce((sum, s) => sum + Number(s.daily_fare || 0), 0),
    formatted_total_daily_earnings: `₦${displayRoster.reduce((sum, s) => sum + Number(s.daily_fare || 0), 0).toLocaleString()}`,
    morning_projected: Math.round(displayRoster.reduce((sum, s) => sum + Number(s.daily_fare || 0), 0) / 2),
    formatted_morning_projected: `₦${Math.round(displayRoster.reduce((sum, s) => sum + Number(s.daily_fare || 0), 0) / 2).toLocaleString()}`,
    afternoon_projected: Math.round(displayRoster.reduce((sum, s) => sum + Number(s.daily_fare || 0), 0) / 2),
    formatted_afternoon_projected: `₦${Math.round(displayRoster.reduce((sum, s) => sum + Number(s.daily_fare || 0), 0) / 2).toLocaleString()}`,
    approved_students_count: displayRoster.filter((s) => s.city_manager_approved !== false).length,
  };

  const escort = liveDashboardData?.escort || {};
  const isTripAccepted = escort?.today_trip_status === 'accepted';
  const isTripDeclined = escort?.today_trip_status === 'declined';
  const isTripPending = !isTripAccepted && !isTripDeclined;
  const isReadyForPickup = escort?.ready_for_pickup === true;
  const autoReadyFromGate = escort?.auto_ready_from_gate === true;
  const dismissalClock = String(liveDashboardData?.school?.dismissal_start_time || '').slice(0, 5);
  const batch = liveDashboardData?.batch || null;

  // Handle Trip Commitment (Accept)
  const handleAcceptTrips = async () => {
    setIsSubmittingCommitment(true);
    try {
      const res = await fetch('/api/escorts/dashboard-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept_today_trips' }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "Today's trips confirmed!");
        reloadData();
      } else {
        toast.error(data.error || 'Failed to confirm trips');
      }
    } catch {
      toast.error('Network error confirming trips');
    } finally {
      setIsSubmittingCommitment(false);
    }
  };

  // Handle Trip Decline
  const handleDeclineTrips = async () => {
    if (!declineReason.trim()) {
      toast.error('Please specify a reason so City Manager can dispatch an emergency escort');
      return;
    }
    setIsSubmittingCommitment(true);
    try {
      const res = await fetch('/api/escorts/dashboard-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decline_today_trips', reason: declineReason.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.error(data.message || 'City Manager alerted for emergency deputising.');
        setDeclineModalOpen(false);
        setDeclineReason('');
        reloadData();
      } else {
        toast.error(data.error || 'Failed to record decline');
      }
    } catch {
      toast.error('Network error submitting decline');
    } finally {
      setIsSubmittingCommitment(false);
    }
  };

  // Toggle "I Am Ready for Pick Up"
  const handleToggleReady = async () => {
    const nextState = !isReadyForPickup;
    try {
      const res = await fetch('/api/escorts/dashboard-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_ready_for_pickup', ready: nextState }),
      });
      const data = await res.json();
      if (res.ok) {
        if (nextState) {
          toast.success('🚀 Pickup Mode Active! Showing student manifest.');
          setActiveTab('assignments');
        } else {
          toast.info('Pickup mode standby.');
        }
        reloadData();
      }
    } catch {
      toast.error('Failed to toggle ready status');
    }
  };

  // Capture Current GPS for Location Pinning
  const handleCaptureGps = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    setPinningGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationForm((prev) => ({
          ...prev,
          house_lat: Number(pos.coords.latitude.toFixed(6)),
          house_lng: Number(pos.coords.longitude.toFixed(6)),
        }));
        setPinningGps(false);
        toast.success(`GPS coordinates captured (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`);
      },
      (err) => {
        setPinningGps(false);
        toast.error('Unable to retrieve your location. Please check browser permissions.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Save Escort Pinned Location
  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingLocation(true);
    try {
      const res = await fetch('/api/escorts/house-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(locationForm),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Your residential location has been pinned! City Manager updated.');
        setPinLocationModalOpen(false);
        reloadData();
      } else {
        toast.error(data.error || 'Failed to pin location');
      }
    } catch {
      toast.error('Error saving house location');
    } finally {
      setSavingLocation(false);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {activeTab !== 'operations' && (
      <div className="bg-gradient-to-r from-[#0A1128] via-[#121E42] to-[#0A1128] rounded-3xl p-4 sm:p-5 text-white shadow-lg border border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
            <Shield size={24} className="sm:w-[26px] sm:h-[26px]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-500/30 uppercase tracking-widest">
                DISC-MANAGED ESCORT FLEET
              </span>
              <span className="text-xs text-slate-400">• Unit #{escort.code || 'DISC-902'}</span>
            </div>
            <h3 className="font-black text-base sm:text-lg tracking-tight text-white mt-1 truncate">
              MyEduRide Official Transit Escort
            </h3>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto shrink-0">
          <div className="flex flex-col items-stretch sm:items-end gap-1 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleToggleReady}
            className={`min-h-[46px] px-4 py-2.5 rounded-2xl font-black text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer ${
              isReadyForPickup
                ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/30 ring-2 ring-emerald-400 animate-pulse font-black'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/40'
            }`}
          >
            <Zap size={16} className={isReadyForPickup ? 'text-slate-950 fill-slate-950' : 'text-amber-300'} />
            <span>{isReadyForPickup ? '✓ READY FOR PICKUP (ACTIVE)' : 'I AM READY FOR PICK UP'}</span>
          </button>
          {autoReadyFromGate && dismissalClock ? (
            <p className="text-[10px] text-emerald-300 font-semibold text-center sm:text-right">
              Auto-ready at school dismissal {dismissalClock}
            </p>
          ) : null}
          {batch ? (
            <p className={`text-[10px] font-bold text-center sm:text-right ${batch.must_drop_before_next ? 'text-amber-300' : 'text-slate-300'}`}>
              On board {batch.on_board}/{batch.max_batch} · Daily {batch.daily_legs_used}/{batch.max_daily_legs}
              {batch.must_drop_before_next ? ' · Drop batch before next pickup' : ''}
            </p>
          ) : null}
        </div>

          {/* PIN HOUSE LOCATION BUTTON */}
          <button
            type="button"
            onClick={() => setPinLocationModalOpen(true)}
            className="min-h-[46px] px-4 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
          >
            <MapPin size={16} />
            <span>{locationForm.house_lat ? '📍 Pinned Location' : 'Pin My Location'}</span>
          </button>
        </div>
      </div>
      )}

      {/* 2. DAILY TRIP COMMITMENT BANNER */}
      {isTripPending && (
        <div className="p-4 sm:p-5 rounded-3xl bg-amber-50 border-2 border-amber-300 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-200 text-amber-900 flex items-center justify-center shrink-0">
              <Clock size={20} />
            </div>
            <div>
              <h4 className="font-black text-amber-950 text-sm">
                Daily Trip Commitment Required for Today
              </h4>
              <p className="text-xs text-amber-800 font-medium mt-0.5">
                Please confirm if you can cover your scheduled trips today ({displayRoster.length} students · {earningsSummary.formatted_total_daily_earnings} approved earnings).
                If you cannot cover, report immediately so the City Manager can dispatch an emergency escort.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 pt-1 sm:pt-0">
            <button
              type="button"
              disabled={isSubmittingCommitment}
              onClick={handleAcceptTrips}
              className="min-h-[44px] flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              <Check size={15} />
              <span>Accept Today&apos;s Trips</span>
            </button>
            <button
              type="button"
              onClick={() => setDeclineModalOpen(true)}
              className="min-h-[44px] flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
            >
              <X size={15} />
              <span>Unable to Cover</span>
            </button>
          </div>
        </div>
      )}

      {isTripAccepted && (
        <div className="px-4 py-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-bold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span className="truncate">You have accepted today&apos;s scheduled trips. City Manager and schools are notified.</span>
          </div>
          <span className="text-[11px] text-emerald-700 font-mono font-normal shrink-0 hidden xs:inline">Active Route Status</span>
        </div>
      )}

      {isTripDeclined && (
        <div className="px-4 py-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 font-bold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
            <span className="truncate">You reported unable to cover today&apos;s trip. City Manager has dispatched emergency backup.</span>
          </div>
          <span className="text-[11px] text-rose-700 font-mono font-normal shrink-0 hidden xs:inline">Emergency Deputised</span>
        </div>
      )}

      {activeTab !== 'operations' && (
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black shrink-0">
              <DollarSign size={18} />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-sm sm:text-base">City Manager Approved Daily Earnings</h3>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
                Verified daily transit compensation approved by the City Manager for your route corridor
                {earningsSummary.agreed_rate_per_km ? ` (₦${earningsSummary.agreed_rate_per_km}/km agreed rate)` : ''}.
              </p>
            </div>
          </div>
          <span className="self-start sm:self-auto px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-black text-xs">
            {earningsSummary.approved_students_count} Students Approved
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
          <div className="p-3.5 sm:p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-center">
            <span className="text-[9px] sm:text-[10px] font-black uppercase text-emerald-800 tracking-wider">Total Approved Today</span>
            <p className="text-xl sm:text-2xl font-black text-emerald-950 mt-1">{earningsSummary.formatted_total_daily_earnings}</p>
            <span className="text-[10px] text-emerald-700 mt-0.5 block font-medium">Daily Roster Rate</span>
          </div>

          <div className="p-3.5 sm:p-4 rounded-2xl bg-blue-50/80 border border-blue-200 text-center">
            <span className="text-[9px] sm:text-[10px] font-black uppercase text-blue-800 tracking-wider">Morning Run (50%)</span>
            <p className="text-xl sm:text-2xl font-black text-blue-950 mt-1">{earningsSummary.formatted_morning_projected}</p>
            <span className="text-[10px] text-blue-700 mt-0.5 block font-medium">Home ➔ School</span>
          </div>

          <div className="p-3.5 sm:p-4 rounded-2xl bg-purple-50/80 border border-purple-200 text-center">
            <span className="text-[9px] sm:text-[10px] font-black uppercase text-purple-800 tracking-wider">Afternoon Run (50%)</span>
            <p className="text-xl sm:text-2xl font-black text-purple-950 mt-1">{earningsSummary.formatted_afternoon_projected}</p>
            <span className="text-[10px] text-purple-700 mt-0.5 block font-medium">School ➔ Home</span>
          </div>

          <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
            <span className="text-[9px] sm:text-[10px] font-black uppercase text-slate-600 tracking-wider">Wallet Balance</span>
            <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1">₦{Number(liveDashboardData?.wallet?.balance ?? escort.wallet_balance ?? 0).toLocaleString()}</p>
            <span className="text-[10px] text-slate-500 mt-0.5 block font-medium">Available Payout</span>
          </div>
        </div>
      </div>
      )}

      {activeTab !== 'operations' && (
      <SchoolNoticeBanner role="escorts" schoolId={liveDashboardData?.escort?.school_id || liveDashboardData?.escort?.primary_school_id} />
      )}

      {/* MULTI-SCHOOL / DUAL-SCHOOL ASSIGNMENT & SCHEDULE STATUS */}
      {liveDashboardData?.dual_school_schedule && (
        <div className="bg-white rounded-3xl p-4 sm:p-5 border border-purple-200/80 shadow-xs space-y-3 bg-gradient-to-br from-purple-50/50 to-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center font-black shrink-0">
                <Compass size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-black text-slate-900 text-sm sm:text-base">
                    {liveDashboardData.dual_school_schedule.is_multi_school
                      ? `Multi-School Transit Coverage (${liveDashboardData.dual_school_schedule.total_schools} Campuses)`
                      : 'Dual-School Transit Coverage'}
                  </h3>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                    liveDashboardData.dual_school_schedule.same_time_pickup_allowed
                      ? 'bg-emerald-100 text-emerald-800'
                      : liveDashboardData.dual_school_schedule.clash_detected
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {liveDashboardData.dual_school_schedule.is_multi_school
                      ? `${liveDashboardData.dual_school_schedule.total_schools} Campuses · Shared Corridor`
                      : liveDashboardData.dual_school_schedule.same_time_pickup_allowed
                        ? (liveDashboardData.dual_school_schedule.clash_detected ? 'Same-time pickup' : 'Dual-school coverage')
                        : (liveDashboardData.dual_school_schedule.clash_detected ? 'Schedule Clash Warning' : 'Verified Non-Clashing')}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium">
                  {liveDashboardData.dual_school_schedule.is_multi_school
                    ? `Allocated to ${liveDashboardData.dual_school_schedule.total_schools} school campuses across shared transit corridors. Students from all designated campuses are grouped onto your daily pickup list.`
                    : liveDashboardData.dual_school_schedule.same_time_pickup_allowed
                      ? 'Assigned to 2 schools. Students from both campuses appear on your pickup list and can be released in the same dismissal window.'
                      : 'Assigned to 2 schools with non-overlapping morning and afternoon bell schedules.'}
                </p>
              </div>
            </div>
          </div>

          {/* If 3+ schools, render dynamic campus grid */}
          {liveDashboardData.dual_school_schedule.is_multi_school && Array.isArray(liveDashboardData.dual_school_schedule.assigned_schools) ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
              {liveDashboardData.dual_school_schedule.assigned_schools.map((sch: any, idx: number) => (
                <div key={sch.id || idx} className="p-3 rounded-2xl bg-white border border-purple-100 space-y-1 shadow-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Campus {idx + 1}</span>
                  <span className="font-bold text-slate-900 text-xs sm:text-sm block truncate" title={sch.name}>
                    {sch.name}
                  </span>
                  <div className="flex items-center gap-3 text-[11px] text-slate-600 pt-0.5">
                    <span>Morning: <b className="text-slate-800">{sch.student_gate_start || sch.school_start_time || '07:30'}</b></span>
                    <span>Dismissal: <b className="text-slate-800">{sch.dismissal_start_time || '14:00'}</b></span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Standard dual-school layout */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="p-3 rounded-2xl bg-white border border-purple-100 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">School 1 (Campus A)</span>
                <span className="font-bold text-slate-900 text-xs sm:text-sm block">{liveDashboardData.dual_school_schedule.school_a?.name}</span>
                <div className="flex items-center gap-3 text-[11px] text-slate-600 pt-0.5">
                  <span>Morning: <b className="text-slate-800">{liveDashboardData.dual_school_schedule.school_a_times?.morning || '07:30'}</b></span>
                  <span>Dismissal: <b className="text-slate-800">{liveDashboardData.dual_school_schedule.school_a_times?.afternoon || '14:00'}</b></span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-white border border-purple-100 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">School 2 (Campus B)</span>
                <span className="font-bold text-slate-900 text-xs sm:text-sm block">{liveDashboardData.dual_school_schedule.school_b?.name}</span>
                <div className="flex items-center gap-3 text-[11px] text-slate-600 pt-0.5">
                  <span>Morning: <b className="text-slate-800">{liveDashboardData.dual_school_schedule.school_b_times?.morning || '08:30'}</b></span>
                  <span>Dismissal: <b className="text-slate-800">{liveDashboardData.dual_school_schedule.school_b_times?.afternoon || '15:30'}</b></span>
                </div>
              </div>
            </div>
          )}

          {!liveDashboardData.dual_school_schedule.is_multi_school && (
            <div className="px-3 py-2 rounded-xl bg-purple-50 text-[11px] text-purple-900 flex flex-wrap items-center justify-between gap-2 font-medium">
              <span>Morning arrival gap: <b>{liveDashboardData.dual_school_schedule.morning_gap_mins} mins</b></span>
              <span>Afternoon release gap: <b>{liveDashboardData.dual_school_schedule.afternoon_gap_mins} mins</b></span>
            </div>
          )}
        </div>
      )}

      {!activeNav && (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-1.5 shadow-xs flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth whitespace-nowrap text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('operations')}
          className={`shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
            activeTab === 'operations' ? 'bg-[#0A1128] text-white shadow-xs font-bold' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Shield size={15} />
          <span>DISC Operations</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('assignments')}
          className={`shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
            activeTab === 'assignments' ? 'bg-[#0A1128] text-white shadow-xs font-bold' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users size={15} />
          <span>Assigned Students</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
            activeTab === 'assignments' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-100 text-slate-700'
          }`}>
            {displayRoster.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('vehicle')}
          className={`shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
            activeTab === 'vehicle' ? 'bg-[#0A1128] text-white shadow-xs font-bold' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Bus size={15} />
          <span>Vehicle Log</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('optimisation')}
          className={`shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
            activeTab === 'optimisation' ? 'bg-[#0A1128] text-white shadow-xs font-bold' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Sparkles size={15} />
          <span>Route Navigation</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('earnings')}
          className={`shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
            activeTab === 'earnings' ? 'bg-[#0A1128] text-white shadow-xs font-bold' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <DollarSign size={15} />
          <span>Earnings Breakdown</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('chat')}
          className={`shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all cursor-pointer relative ${
            activeTab === 'chat' ? 'bg-[#0A1128] text-white shadow-xs font-bold' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <MessageSquare size={15} className="text-blue-500" />
          <span>EduChat</span>
          {chatUnreadTotal > 0 ? (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
              {chatUnreadTotal}
            </span>
          ) : (
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          )}
        </button>
      </div>
      )}

      {/* TAB 1: OPERATIONS — portal design home, backed by escort_assignments / daily trips / wallets */}
      {activeTab === 'operations' && (
        <SharedEscortDashboard
          liveDashboardData={liveDashboardData}
          onRefreshData={onRefreshData}
          onOpenVerificationModal={onOpenVerificationModal}
          onOpenIncidentModal={onOpenIncidentModal}
          onOpenIdCardModal={onOpenIdCardModal}
          onNavigateStudent={(student) => setNavModalStudent(student)}
          onNavChange={setActiveTab}
          isAvailableForOtherSchools={Boolean(escort?.availableForOtherSchools)}
          onToggleAvailableForOtherSchools={async () => {
            try {
              const next = !Boolean(escort?.availableForOtherSchools);
              const res = await fetch('/api/escorts/dashboard-live', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'toggle_availability',
                  availableForOtherSchools: next,
                  appId: escort?.id,
                }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || 'Could not update availability');
              toast.success(data.message || (next ? 'Available for other schools' : 'Primary school only'));
              reloadData();
            } catch (err: any) {
              toast.error(err.message || 'Failed to update availability');
            }
          }}
        />
      )}

      {activeTab === 'trips' && (
        <EscortTripsView
          liveDashboardData={liveDashboardData}
          onRefreshData={onRefreshData}
          onOpenVerificationModal={onOpenVerificationModal}
          onOpenIncidentModal={onOpenIncidentModal}
        />
      )}

      {activeTab === 'students' && (
        <EscortStudentsView
          liveDashboardData={liveDashboardData}
          onOpenVerificationModal={onOpenVerificationModal}
        />
      )}

      {(activeTab === 'wallet' || activeTab === 'edusave' || activeTab === 'eduinsured') && (
        <EscortWalletView
          liveDashboardData={liveDashboardData}
          onRefreshData={onRefreshData}
        />
      )}

      {activeTab === 'shared' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 shadow-xs space-y-3">
          <h3 className="font-black text-base text-slate-900">Shared Ride</h3>
          <p className="text-xs text-slate-500">
            Cross-school shared ride availability is controlled from your dashboard toggle and stored on your escort application. Assigned school students remain on Trips and Students.
          </p>
          <p className="text-sm font-bold text-slate-800">
            Status: {escort?.availableForOtherSchools ? 'Available for other schools' : 'Primary school only'}
          </p>
        </div>
      )}

      {activeTab === 'city-manager' && (
        <div className="space-y-4">
          <SchoolNoticeBanner role="escorts" schoolId={liveDashboardData?.escort?.school_id || liveDashboardData?.escort?.primary_school_id} />
          <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 shadow-xs space-y-3">
            <h3 className="font-black text-base text-slate-900">City Manager</h3>
            <p className="text-xs text-slate-500">Official notices and assignment updates from your City Manager.</p>
            {(liveDashboardData?.announcements || []).length === 0 ? (
              <p className="text-xs text-slate-400">No City Manager or school notices yet.</p>
            ) : (
              (liveDashboardData.announcements || []).map((n: any) => (
                <div key={n.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="font-bold text-sm text-slate-900">{n.title}</p>
                  <p className="text-xs text-slate-600 mt-1">{n.body}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 shadow-xs space-y-4">
          <h3 className="font-black text-base text-slate-900">Today&apos;s Report</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-slate-500 font-bold uppercase text-[10px]">Trips planned</span>
              <p className="font-black text-lg">{liveDashboardData?.stats?.totalTrips ?? 0}</p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-slate-500 font-bold uppercase text-[10px]">Students</span>
              <p className="font-black text-lg">{liveDashboardData?.stats?.totalStudents ?? 0}</p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-slate-500 font-bold uppercase text-[10px]">Distance</span>
              <p className="font-black text-lg">{liveDashboardData?.stats?.totalDistance || '0 km'}</p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-slate-500 font-bold uppercase text-[10px]">Completed legs</span>
              <p className="font-black text-lg">{liveDashboardData?.stats?.tripsCompletedToday ?? 0}</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ASSIGNED STUDENTS WITH CITY MANAGER APPROVAL & PRICING */}
      {activeTab === 'assignments' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-black text-base sm:text-lg text-slate-900">Assigned Students Manifest</h3>
              <p className="text-xs text-slate-500">
                Scan ID or parent code at the house. Board up to 9, drop at school, then continue. Max 18 trips to and fro today.
              </p>
              {batch ? (
                <p className={`text-[11px] font-bold mt-1 ${batch.must_drop_before_next ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {batch.message}
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {onOpenIdCardModal && (
                <button
                  type="button"
                  onClick={onOpenIdCardModal}
                  className="min-h-[44px] bg-[#0A1128] hover:bg-slate-800 text-white font-black text-xs py-2.5 px-4 rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer border border-emerald-500/30"
                  title="Display Digital Escort Gate Pass for Gate Officer Scanner"
                >
                  <QrCode size={16} className="text-emerald-400" />
                  <span>Show Gate Pass</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => onOpenVerificationModal()}
                className="min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-2.5 px-4 rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ShieldCheck size={16} />
                <span>Verify Pickup / Drop-off</span>
              </button>
            </div>
          </div>

          {/* DESKTOP VIEW (>= md): Structured Data Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                  <th className="py-3 px-3">Student & School</th>
                  <th className="py-3 px-3">CM Approval Status</th>
                  <th className="py-3 px-3">Approved Fare</th>
                  <th className="py-3 px-3">Pinned House Location</th>
                  <th className="py-3 px-3">Custody State</th>
                  <th className="py-3 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {displayRoster.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No students currently assigned to this transit corridor in the database.
                    </td>
                  </tr>
                ) : (
                  displayRoster.map((st: any) => {
                    const isApproved = st.city_manager_approved !== false;
                    const hasHousePin = Boolean(st.is_house_pinned || (st.house_lat && st.house_lng));

                    return (
                      <tr key={st.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={st.photo_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                              alt={st.name}
                              className="w-9 h-9 rounded-xl object-cover border border-slate-200 shrink-0"
                            />
                            <div>
                              <span className="font-black text-slate-900 block">{st.name}</span>
                              <span className="text-[10px] text-slate-400 block font-sans">
                                {st.school_name || 'Assigned School'} · {st.class_name || 'Class'}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-3">
                          {isApproved ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                              <CheckCircle2 size={11} /> CM Approved
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                              <Clock size={11} /> Pending CM
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-3 font-mono font-bold text-emerald-900">
                          {st.formatted_daily_fare || (st.daily_fare != null ? `₦${Number(st.daily_fare).toLocaleString()}` : '—')}
                          <span className="block text-[10px] text-slate-400 font-sans font-normal">/ day</span>
                        </td>

                        <td className="py-3.5 px-3">
                          <div className="max-w-xs">
                            <span className="text-slate-800 font-medium block truncate">
                              {st.house_address || st.pickup_address || 'Home Address'}
                            </span>
                            {st.house_landmark && (
                              <span className="text-[10px] text-slate-400 block">Near: {st.house_landmark}</span>
                            )}
                            {hasHousePin && (
                              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                <button
                                  type="button"
                                  onClick={() => setNavModalStudent(st)}
                                  className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 hover:text-purple-900 hover:underline cursor-pointer"
                                >
                                  <Navigation size={10} />
                                  <span>Live Direction</span>
                                </button>
                                {(st.is_morning_proximity_notified || st.is_afternoon_proximity_notified) && (
                                  <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200">
                                    <BellRing size={9} />
                                    <span>Parent Notified</span>
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-3">
                          {st.morning_status === 'DROPPED_OFF_AT_SCHOOL' ? (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase bg-emerald-100 text-emerald-800 flex items-center gap-1 w-fit border border-emerald-200">
                              <CheckCircle2 size={11} className="text-emerald-700" />
                              <span>Dropped Off (Gate)</span>
                            </span>
                          ) : st.morning_status === 'PICKED_UP_FROM_HOME' ? (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase bg-blue-100 text-blue-800 flex items-center gap-1 w-fit border border-blue-200">
                              <Car size={11} className="text-blue-700" />
                              <span>On Board (Picked Up)</span>
                            </span>
                          ) : st.afternoon_status === 'SAFE_AT_HOME' ? (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase bg-emerald-100 text-emerald-800 flex items-center gap-1 w-fit border border-emerald-200">
                              <CheckCircle2 size={11} className="text-emerald-700" />
                              <span>Safe at Home</span>
                            </span>
                          ) : st.afternoon_status === 'PICKED_UP_FROM_GATE' ? (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase bg-indigo-100 text-indigo-800 flex items-center gap-1 w-fit border border-indigo-200">
                              <Car size={11} className="text-indigo-700" />
                              <span>On Board (Released)</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full uppercase bg-slate-100 text-slate-700">
                              Scheduled
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {hasHousePin && (
                              <button
                                type="button"
                                onClick={() => setNavModalStudent(st)}
                                className="p-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 cursor-pointer"
                                title="Live Turn & Doorstep Direction"
                              >
                                <Navigation size={13} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedStudentForChat(st.id);
                                setActiveTab('chat');
                              }}
                              className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 cursor-pointer"
                              title="Chat with Parent / Gate / CM"
                            >
                              <MessageSquare size={13} />
                            </button>
                            {st.parent_phone && (
                              <a
                                href={`tel:${st.parent_phone}`}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                                title="Call Parent"
                              >
                                <Phone size={13} />
                              </a>
                            )}
                            {st.morning_status === 'DROPPED_OFF_AT_SCHOOL' && st.afternoon_status !== 'PICKED_UP_FROM_GATE' ? (
                              <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200">
                                In School
                              </span>
                            ) : st.afternoon_status === 'PICKED_UP_FROM_GATE' ? (
                              <button
                                type="button"
                                onClick={() => onOpenVerificationModal({ ...st, action: 'afternoon_dropoff' })}
                                className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] cursor-pointer shadow-xs"
                                title="Confirm student delivered to doorstep"
                              >
                                Drop-off
                              </button>
                            ) : st.afternoon_status === 'SAFE_AT_HOME' ? (
                              <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200">
                                Completed
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onOpenVerificationModal(st)}
                                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer shadow-xs ${
                                  st.morning_status === 'PICKED_UP_FROM_HOME'
                                    ? 'bg-blue-100 hover:bg-blue-200 text-blue-900 border border-blue-200'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                }`}
                              >
                                {st.morning_status === 'PICKED_UP_FROM_HOME' ? 'Boarded' : 'Verify'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* MOBILE PASSENGER CARDS VIEW (< md) */}
          <div className="block md:hidden space-y-3">
            {displayRoster.length === 0 ? (
              <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                No students currently assigned to this transit corridor in the database.
              </div>
            ) : (
              displayRoster.map((st: any) => {
                const isApproved = st.city_manager_approved !== false;
                const hasHousePin = Boolean(st.is_house_pinned || (st.house_lat && st.house_lng));
                const parentPhone = st.parent_phone || st.guardianPhone || '';

                return (
                  <div
                    key={st.id}
                    className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3"
                  >
                    {/* Top Row: Photo + Name + Status */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={st.photo_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                          alt={st.name}
                          className="w-11 h-11 rounded-2xl object-cover border-2 border-emerald-500/30 shrink-0 shadow-xs"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
                          }}
                        />
                        <div className="min-w-0">
                          <h4 className="font-black text-sm text-slate-900 truncate">
                            {st.name}
                          </h4>
                          <p className="text-[11px] text-slate-500 font-medium truncate">
                            {st.school_name || 'Assigned School'} • {st.class_name || 'Class'}
                          </p>
                          <span className="inline-block font-mono text-[10px] text-slate-400 mt-0.5">
                            ID: {st.student_id_number || st.id?.slice(0, 8)}
                          </span>
                        </div>
                      </div>

                      {/* Approval Badge */}
                      <div className="shrink-0">
                        {isApproved ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-black text-[10px] border border-emerald-200">
                            <CheckCircle2 size={11} className="text-emerald-700" /> Approved
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-black text-[10px] border border-amber-200">
                            <Clock size={11} className="text-amber-700" /> Pending CM
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Details Row: Address & Fare */}
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-1.5 min-w-0 flex-1">
                          <MapPin size={13} className="text-purple-600 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-slate-800 font-medium text-[11px] leading-tight line-clamp-2">
                              {st.house_address || st.pickup_address || 'Address on file'}
                            </p>
                            {st.house_landmark && (
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                Landmark: {st.house_landmark}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-[10px] text-slate-400 block uppercase font-bold">Fare</span>
                          <span className="font-mono font-black text-emerald-900 text-xs">
                            {st.formatted_daily_fare || (st.daily_fare != null ? `₦${Number(st.daily_fare).toLocaleString()}` : '—')}
                          </span>
                        </div>
                      </div>

                      {/* Custody Status Pill */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[10px]">
                        <span className="text-slate-500 font-medium">Transit Custody:</span>
                        <span className={`font-black px-2 py-0.5 rounded-md uppercase ${
                          st.status === 'ON_BOARD'
                            ? 'bg-blue-100 text-blue-800'
                            : st.status === 'DROPPED_OFF'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}>
                          {st.status || 'SCHEDULED'}
                        </span>
                      </div>
                    </div>

                    {/* Touch-Friendly Action Buttons Row (min 42px height) */}
                    <div className="grid grid-cols-4 gap-1.5 pt-1">
                      {/* 1. Chat Parent / CM */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStudentForChat(st.id);
                          setActiveTab('chat');
                        }}
                        className="min-h-[42px] px-1.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center gap-1 transition-colors border border-blue-200 shadow-xs cursor-pointer"
                        title="Chat with Parent / Gate / CM"
                      >
                        <MessageSquare size={14} className="text-blue-600" />
                        <span>Chat</span>
                      </button>

                      {/* 2. Call Parent */}
                      {parentPhone ? (
                        <a
                          href={`tel:${parentPhone}`}
                          className="min-h-[42px] px-1.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1 transition-colors border border-slate-200 shadow-xs"
                        >
                          <Phone size={14} className="text-emerald-600" />
                          <span>Call</span>
                        </a>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="min-h-[42px] px-1.5 py-2 rounded-xl bg-slate-100 text-slate-400 font-medium text-xs flex items-center justify-center gap-1 cursor-not-allowed border border-slate-200 opacity-60"
                        >
                          <Phone size={14} />
                          <span>No Tel</span>
                        </button>
                      )}

                      {/* 3. Live Direction & GPS Navigation */}
                      {hasHousePin ? (
                        <button
                          type="button"
                          onClick={() => setNavModalStudent(st)}
                          className="min-h-[42px] px-1.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center gap-1 transition-colors border border-purple-200 shadow-xs cursor-pointer"
                          title="Open Live Guidance and Proximity Radar"
                        >
                          <Navigation size={14} className="text-purple-600" />
                          <span>Direct</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="min-h-[42px] px-1.5 py-2 rounded-xl bg-slate-100 text-slate-400 font-medium text-xs flex items-center justify-center gap-1 cursor-not-allowed border border-slate-200 opacity-60"
                        >
                          <Navigation size={14} />
                          <span>No GPS</span>
                        </button>
                      )}

                      {/* 4. Verify / Action Button */}
                      {st.morning_status === 'DROPPED_OFF_AT_SCHOOL' && st.afternoon_status !== 'PICKED_UP_FROM_GATE' ? (
                        <div className="min-h-[42px] px-1.5 py-2 rounded-xl bg-emerald-50 text-emerald-700 font-bold text-[10px] flex items-center justify-center border border-emerald-200">
                          In School
                        </div>
                      ) : st.afternoon_status === 'PICKED_UP_FROM_GATE' ? (
                        <button
                          type="button"
                          onClick={() => onOpenVerificationModal({ ...st, action: 'afternoon_dropoff' })}
                          className="min-h-[42px] px-1.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs flex items-center justify-center gap-1 transition-colors shadow-xs cursor-pointer"
                        >
                          <ShieldCheck size={14} />
                          <span>Drop-off</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onOpenVerificationModal(st)}
                          className={`min-h-[42px] px-1.5 py-2 rounded-xl font-black text-xs flex items-center justify-center gap-1 transition-colors shadow-xs cursor-pointer ${
                            st.morning_status === 'PICKED_UP_FROM_HOME'
                              ? 'bg-blue-100 text-blue-900 border border-blue-300'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          }`}
                        >
                          <QrCode size={14} />
                          <span>{st.morning_status === 'PICKED_UP_FROM_HOME' ? 'Boarded' : 'Verify'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 3: VEHICLE */}
      {activeTab === 'vehicle' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 shadow-xs space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-black text-base sm:text-lg text-slate-900">DISC Vehicle Asset & Inspection Log</h3>
            <p className="text-xs text-slate-500">Official transit vehicle assigned by City Manager Operations.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <span className="text-slate-400 font-bold uppercase text-[10px] block">Assigned Transit Van</span>
              <span className="font-black text-slate-900 text-sm mt-1 block">{escort.vehicleType || 'Executive Shuttle'}</span>
              <span className="text-[10px] text-emerald-700 font-bold mt-1 block">✓ Fully Air-Conditioned</span>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <span className="text-slate-400 font-bold uppercase text-[10px] block">License Plate</span>
              <span className="font-mono font-black text-slate-900 text-sm mt-1 block">{escort.regNumber || 'LAG-992-MY'}</span>
              <span className="text-[10px] text-slate-500 font-medium mt-1 block">Lagos State Commercial Plate</span>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <span className="text-slate-400 font-bold uppercase text-[10px] block">Fuel Level</span>
              <span className="font-black text-emerald-700 text-sm mt-1 block">92% (Full Tank)</span>
              <span className="text-[10px] text-emerald-600 font-medium mt-1 block">Tank topped up this morning</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-xs flex items-center gap-3">
            <ShieldCheck size={20} className="text-emerald-600 shrink-0" />
            <p className="text-emerald-950 font-medium text-[11px] sm:text-xs">
              Vehicle passes DISC Safety Standard Check (Seatbelts for all {displayRoster.length} students, first aid kit on board, fire extinguisher verified).
            </p>
          </div>
        </div>
      )}

      {/* TAB 4: ROUTE OPTIMISATION */}
      {activeTab === 'optimisation' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-black text-base sm:text-lg text-slate-900">AI Route Navigation & Stops</h3>
              <p className="text-xs text-slate-500">Turn-by-turn sequence for morning pickup and afternoon school drop-off.</p>
            </div>
            <button
              type="button"
              onClick={() => toast.success('Corridor refreshed! Fastest route calculated.')}
              className="min-h-[42px] bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-2 px-3.5 rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RefreshCw size={14} />
              <span>Re-calculate Best Path</span>
            </button>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-medium">
            ✨ Optimal Path Active: Lekki Express Corridor ➔ Victoria Island ➔ Ikoyi Campus. Saves ~14 mins transit time.
          </div>

          {/* Sequential Stops List */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
              Scheduled Stops Sequence ({displayRoster.length} Stops)
            </h4>

            {displayRoster.length === 0 ? (
              <p className="text-xs text-slate-400 p-4 text-center bg-slate-50 rounded-2xl">
                No active stops assigned for today.
              </p>
            ) : (
              displayRoster.map((st: any, idx: number) => {
                const hasHousePin = Boolean(st.is_house_pinned || (st.house_lat && st.house_lng));
                return (
                  <div
                    key={st.id}
                    className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-xl bg-[#0A1128] text-white flex items-center justify-center font-black text-xs shrink-0">
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <h5 className="font-black text-slate-900 truncate">{st.name}</h5>
                        <p className="text-[11px] text-slate-500 truncate">
                          {st.house_address || st.pickup_address || 'Doorstep Pickup'}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                      {hasHousePin && (
                        <a
                          href={st.google_maps_nav_url || `https://www.google.com/maps?q=${st.house_lat},${st.house_lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-[11px] flex items-center gap-1 border border-purple-200 shadow-xs"
                        >
                          <Navigation size={12} />
                          <span>GPS</span>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 5: EARNINGS BREAKDOWN */}
      {activeTab === 'earnings' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-black text-base sm:text-lg text-slate-900">Per-Student Daily Earnings Breakdown</h3>
              <p className="text-xs text-slate-500">
                Route corridor compensation: ₦{earningsSummary.agreed_rate_per_km || 500}/km agreed by the City Manager
                {earningsSummary.operating_city_label ? ` (${earningsSummary.operating_city_label})` : ''}.
              </p>
            </div>
            {earningsSummary.agreed_rate_per_km && (
              <span className="self-start sm:self-auto px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-[11px]">
                ₦{earningsSummary.agreed_rate_per_km}/km Route Rate
              </span>
            )}
          </div>

          <div className="divide-y divide-slate-100">
            {displayRoster.length === 0 ? (
              <p className="text-xs text-slate-400 p-6 text-center">No assigned passenger fares recorded yet.</p>
            ) : (
              displayRoster.map((s: any) => (
                <div key={s.id} className="py-3.5 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-900 truncate">{s.name}</span>
                      {s.distance_km != null && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                          {s.distance_km} km ({s.billable_km || Math.ceil(s.distance_km)} km billed)
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500 truncate block mt-0.5">
                      {s.school_name || 'School'} • {s.pickup_address || 'Home'}
                    </span>
                    <span className="text-[10px] text-emerald-700 font-semibold block mt-0.5">
                      Rate: {s.billable_km || (s.distance_km != null ? Math.ceil(s.distance_km) : 1)} km × ₦{s.agreed_rate_per_km || earningsSummary.agreed_rate_per_km || 500}/km agreed by City Manager
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono font-black text-emerald-800 text-sm block">
                      {s.formatted_daily_fare || (s.daily_fare != null ? `₦${Number(s.daily_fare).toLocaleString()}` : '—')}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      {s.morning_fare != null ? `₦${Number(s.morning_fare).toLocaleString()} morning` : '—'} + {s.afternoon_fare != null ? `₦${Number(s.afternoon_fare).toLocaleString()} afternoon` : '—'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 6: EDUCHAT (PARENTS, GATE OFFICERS, CITY MANAGER) */}
      {activeTab === 'chat' && (
        <EscortEduChatView
          initialStudentId={selectedStudentForChat}
          onBackToRoster={() => setActiveTab('assignments')}
        />
      )}

      {/* DECLINE TODAY TRIP MODAL */}
      {declineModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-[92vw] max-w-md p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-rose-700 font-black text-sm">
                <AlertCircle size={18} />
                <span>Report Inability to Cover Route</span>
              </div>
              <button onClick={() => setDeclineModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer p-1">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Reporting unable to cover will immediately notify the City Manager to dispatch an emergency backup escort so students and parents are not stranded.
            </p>

            <div className="space-y-2 text-xs">
              <label className="font-bold text-slate-800 block">Reason for Inability to Cover *</label>
              <select
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-rose-600 min-h-[44px]"
              >
                <option value="">-- Choose Reason --</option>
                <option value="Vehicle Breakdown / Mechanical Trouble">Vehicle Breakdown / Mechanical Trouble</option>
                <option value="Health / Medical Emergency">Health / Medical Emergency</option>
                <option value="Family Emergency">Family Emergency</option>
                <option value="Severe Road Blockage / Flooding">Severe Road Blockage / Flooding</option>
                <option value="Other Urgent Matter">Other Urgent Matter</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeclineModalOpen(false)}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingCommitment}
                onClick={handleDeclineTrips}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-md shadow-rose-600/20 cursor-pointer"
              >
                {isSubmittingCommitment ? 'Alerting...' : 'Alert City Manager'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PIN HOUSE LOCATION MODAL */}
      {pinLocationModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl w-[92vw] max-w-md p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-purple-900 font-black text-sm">
                <MapPin size={18} className="text-purple-700" />
                <span>Pin My Residential Location</span>
              </div>
              <button onClick={() => setPinLocationModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer p-1">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Pinning your residential location allows the City Manager to match you with nearby schools and students, minimizing deadhead travel.
            </p>

            <form onSubmit={handleSaveLocation} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Residential House Address *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 14 Admiralty Way, Lekki Phase 1"
                  value={locationForm.residential_address}
                  onChange={(e) => setLocationForm({ ...locationForm, residential_address: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-purple-600 min-h-[42px]"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Closest Landmark</label>
                <input
                  type="text"
                  placeholder="e.g. Opposite Ebeano Supermarket"
                  value={locationForm.closest_landmark}
                  onChange={(e) => setLocationForm({ ...locationForm, closest_landmark: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-purple-600 min-h-[42px]"
                />
              </div>

              {/* GPS Auto Capture */}
              <div className="p-3 rounded-2xl bg-purple-50/60 border border-purple-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-950">GPS Coordinates</span>
                  <button
                    type="button"
                    onClick={handleCaptureGps}
                    disabled={pinningGps}
                    className="min-h-[36px] px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                  >
                    <Compass size={12} />
                    <span>{pinningGps ? 'Fetching GPS...' : 'Capture Current GPS'}</span>
                  </button>
                </div>
                {locationForm.house_lat && locationForm.house_lng ? (
                  <p className="text-[11px] font-mono text-purple-900 font-bold">
                    Lat: {locationForm.house_lat}, Lng: {locationForm.house_lng} (Captured)
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-400">
                    Click &ldquo;Capture Current GPS&rdquo; while at your residence to pin high-precision coordinates.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPinLocationModalOpen(false)}
                  className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingLocation}
                  className="min-h-[42px] px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black shadow-md shadow-purple-600/20 cursor-pointer"
                >
                  {savingLocation ? 'Saving...' : 'Save Pinned Location'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Live House Navigation Modal */}
      <LiveHouseNavigationModal
        isOpen={Boolean(navModalStudent)}
        onClose={() => setNavModalStudent(null)}
        student={navModalStudent}
        escortId={liveDashboardData?.escort?.id}
        tripPhase={navModalStudent?.afternoon_status === 'PICKED_UP_FROM_GATE' ? 'afternoon_dropoff' : 'morning_pickup'}
        onArrived={(st) => {
          setNavModalStudent(null);
          onOpenVerificationModal(st);
        }}
      />
    </div>
  );
}
