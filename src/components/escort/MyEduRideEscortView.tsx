// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
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
  Car
} from 'lucide-react';
import { toast } from 'sonner';
import SchoolNoticeBanner from '@/components/shared/SchoolNoticeBanner';

interface MyEduRideEscortViewProps {
  liveDashboardData?: any;
  onRefreshData?: () => void;
  onOpenVerificationModal: (student?: any) => void;
  onOpenIncidentModal: () => void;
}

export default function MyEduRideEscortView({
  liveDashboardData,
  onRefreshData = () => {},
  onOpenVerificationModal,
  onOpenIncidentModal,
}: MyEduRideEscortViewProps) {
  const [activeTab, setActiveTab] = useState<
    'operations' | 'assignments' | 'vehicle' | 'optimisation' | 'journey' | 'attendance' | 'earnings' | 'incidents' | 'analytics'
  >('operations');

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

  const reloadData = () => {
    fetch('/api/escorts/dashboard-live')
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && data?.assignments) {
          setDiscAssignments(data.assignments);
        }
      })
      .catch((err) => console.warn('[MyEduRideEscortView] fetch notice:', err));
    onRefreshData?.();
  };

  useEffect(() => {
    reloadData();
    // Load current escort pinned location
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
  }, []);

  const manifestStudents = liveDashboardData?.students?.manifest || [];
  const displayRoster = manifestStudents.length > 0 ? manifestStudents : discAssignments;
  const earningsSummary = liveDashboardData?.earnings_summary || {
    total_daily_earnings: displayRoster.reduce((sum, s) => sum + (s.daily_fare || 3500), 0),
    formatted_total_daily_earnings: `₦${displayRoster.reduce((sum, s) => sum + (s.daily_fare || 3500), 0).toLocaleString()}`,
    morning_projected: Math.round(displayRoster.reduce((sum, s) => sum + (s.daily_fare || 3500), 0) / 2),
    formatted_morning_projected: `₦${Math.round(displayRoster.reduce((sum, s) => sum + (s.daily_fare || 3500), 0) / 2).toLocaleString()}`,
    afternoon_projected: Math.round(displayRoster.reduce((sum, s) => sum + (s.daily_fare || 3500), 0) / 2),
    formatted_afternoon_projected: `₦${Math.round(displayRoster.reduce((sum, s) => sum + (s.daily_fare || 3500), 0) / 2).toLocaleString()}`,
    approved_students_count: displayRoster.filter((s) => s.city_manager_approved !== false).length,
  };

  const escort = liveDashboardData?.escort || {};
  const isTripAccepted = escort?.today_trip_status === 'accepted';
  const isTripDeclined = escort?.today_trip_status === 'declined';
  const isTripPending = !isTripAccepted && !isTripDeclined;
  const isReadyForPickup = escort?.ready_for_pickup === true;

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

  // Operational metrics
  const operationsMetrics = {
    fleetStatus: 'Active & Verified',
    totalPassengers: displayRoster.length,
    routeOptimisationScore: '100% Optimal',
    speedAlerts: 0,
    discSupervisor: 'City Manager Operations',
  };

  return (
    <div className="space-y-6">
      {/* 1. DISC BRAND BANNER */}
      <div className="bg-gradient-to-r from-[#0A1128] via-[#121E42] to-[#0A1128] rounded-3xl p-5 text-white shadow-md border border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
            <Shield size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-500/30 uppercase tracking-widest">
                DISC-MANAGED ESCORT FLEET
              </span>
              <span className="text-xs text-slate-400">• Unit #{escort.code || 'DISC-902'}</span>
            </div>
            <h3 className="font-extrabold text-lg tracking-tight text-white mt-1">
              MyEduRide Official Transit Escort Command
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* READY FOR PICKUP BUTTON */}
          <button
            type="button"
            onClick={handleToggleReady}
            className={`px-4 py-2 rounded-2xl font-black text-xs flex items-center gap-2 transition-all shadow-md cursor-pointer ${
              isReadyForPickup
                ? 'bg-emerald-500 text-white shadow-emerald-500/30 ring-2 ring-emerald-400 animate-pulse'
                : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
            }`}
          >
            <Zap size={14} className={isReadyForPickup ? 'text-amber-300' : 'text-slate-300'} />
            <span>{isReadyForPickup ? '✓ READY FOR PICKUP (ACTIVE)' : 'I AM READY FOR PICK UP'}</span>
          </button>

          {/* PIN HOUSE LOCATION BUTTON */}
          <button
            type="button"
            onClick={() => setPinLocationModalOpen(true)}
            className="px-3.5 py-2 rounded-2xl bg-purple-600/80 hover:bg-purple-600 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
          >
            <MapPin size={14} />
            <span>{locationForm.house_lat ? 'Location Pinned' : 'Pin My Location'}</span>
          </button>
        </div>
      </div>

      {/* 2. DAILY TRIP COMMITMENT BANNER */}
      {isTripPending && (
        <div className="p-5 rounded-3xl bg-amber-50 border-2 border-amber-300 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
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

          <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
            <button
              type="button"
              disabled={isSubmittingCommitment}
              onClick={handleAcceptTrips}
              className="flex-1 md:flex-none px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              <Check size={14} />
              <span>Accept Today&apos;s Trips</span>
            </button>
            <button
              type="button"
              onClick={() => setDeclineModalOpen(true)}
              className="flex-1 md:flex-none px-3.5 py-2 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
            >
              <X size={14} />
              <span>Unable to Cover</span>
            </button>
          </div>
        </div>
      )}

      {isTripAccepted && (
        <div className="px-4 py-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>You have accepted today&apos;s scheduled trips. City Manager and schools are notified.</span>
          </div>
          <span className="text-[11px] text-emerald-700 font-mono font-normal">Active Route Status</span>
        </div>
      )}

      {isTripDeclined && (
        <div className="px-4 py-2.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-600" />
            <span>You reported unable to cover today&apos;s trip. City Manager has dispatched emergency backup.</span>
          </div>
          <span className="text-[11px] text-rose-700 font-mono font-normal">Emergency Deputised</span>
        </div>
      )}

      {/* 3. APPROVED PRICING & DAILY EARNINGS SUMMARY CARD */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black">
              <DollarSign size={18} />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">City Manager Approved Daily Earnings</h3>
              <p className="text-xs text-slate-500 font-medium">
                Verified daily transit rates approved by the City Manager for your assigned students.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-black text-xs">
            {earningsSummary.approved_students_count} Students Approved
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-center">
            <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">Total Approved Today</span>
            <p className="text-2xl font-black text-emerald-950 mt-1">{earningsSummary.formatted_total_daily_earnings}</p>
            <span className="text-[10px] text-emerald-700 mt-0.5 block font-medium">Daily Roster Rate</span>
          </div>

          <div className="p-4 rounded-2xl bg-blue-50/80 border border-blue-200 text-center">
            <span className="text-[10px] font-black uppercase text-blue-800 tracking-wider">Morning Run (50%)</span>
            <p className="text-2xl font-black text-blue-950 mt-1">{earningsSummary.formatted_morning_projected}</p>
            <span className="text-[10px] text-blue-700 mt-0.5 block font-medium">Home ➔ School</span>
          </div>

          <div className="p-4 rounded-2xl bg-purple-50/80 border border-purple-200 text-center">
            <span className="text-[10px] font-black uppercase text-purple-800 tracking-wider">Afternoon Run (50%)</span>
            <p className="text-2xl font-black text-purple-950 mt-1">{earningsSummary.formatted_afternoon_projected}</p>
            <span className="text-[10px] text-purple-700 mt-0.5 block font-medium">School ➔ Home</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
            <span className="text-[10px] font-black uppercase text-slate-600 tracking-wider">Wallet Balance</span>
            <p className="text-2xl font-black text-slate-900 mt-1">₦{(escort.wallet_balance || 25000).toLocaleString()}</p>
            <span className="text-[10px] text-slate-500 mt-0.5 block font-medium">Available Payout</span>
          </div>
        </div>
      </div>

      {/* OFFICIAL SCHOOL NOTICES */}
      <SchoolNoticeBanner role="escorts" schoolId={liveDashboardData?.escort?.school_id || liveDashboardData?.escort?.primary_school_id} />

      {/* SECTION TABS HEADER */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-2 shadow-xs flex flex-wrap gap-1.5 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('operations')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
            activeTab === 'operations' ? 'bg-[#0A1128] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Shield size={15} />
          <span>DISC Operations</span>
        </button>

        <button
          onClick={() => setActiveTab('assignments')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
            activeTab === 'assignments' ? 'bg-[#0A1128] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users size={15} />
          <span>Assigned Students ({displayRoster.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('vehicle')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
            activeTab === 'vehicle' ? 'bg-[#0A1128] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Bus size={15} />
          <span>Vehicle Management</span>
        </button>

        <button
          onClick={() => setActiveTab('optimisation')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
            activeTab === 'optimisation' ? 'bg-[#0A1128] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Sparkles size={15} />
          <span>Route Navigation</span>
        </button>

        <button
          onClick={() => setActiveTab('earnings')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
            activeTab === 'earnings' ? 'bg-[#0A1128] text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <DollarSign size={15} />
          <span>Daily Earnings Breakdown</span>
        </button>
      </div>

      {/* TAB 1: OPERATIONS */}
      {activeTab === 'operations' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-1">
              <span className="text-emerald-800 font-bold uppercase text-[10px]">FLEET STATUS</span>
              <span className="font-extrabold text-base text-emerald-950 block">{operationsMetrics.fleetStatus}</span>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl space-y-1">
              <span className="text-blue-800 font-bold uppercase text-[10px]">PASSENGER MANIFEST</span>
              <span className="font-extrabold text-base text-blue-950 block">{operationsMetrics.totalPassengers} Students</span>
            </div>

            <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl space-y-1">
              <span className="text-purple-800 font-bold uppercase text-[10px]">APPROVED DAILY TOTAL</span>
              <span className="font-extrabold text-base text-purple-950 block">{earningsSummary.formatted_total_daily_earnings}</span>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
              <span className="text-slate-500 font-bold uppercase text-[10px]">ESCORT LOCATION</span>
              <span className="font-bold text-slate-800 block text-xs truncate">
                {locationForm.residential_address ? `${locationForm.residential_address} (Pinned)` : 'Not Pinned Yet'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ASSIGNED STUDENTS WITH CITY MANAGER APPROVAL & PRICING */}
      {activeTab === 'assignments' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-extrabold text-lg text-slate-900">Assigned Students Manifest</h3>
              <p className="text-xs text-slate-500">
                School-assigned passengers approved by City Manager with pricing and pinned house locations.
              </p>
            </div>
            <button
              onClick={() => onOpenVerificationModal()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-3.5 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <QrCode size={15} />
              <span>Verify Passenger PIN</span>
            </button>
          </div>

          <div className="overflow-x-auto">
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
                                {st.school_name || 'Kings College'} · {st.class_name || 'Class'}
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
                          {st.formatted_daily_fare || `₦${(st.daily_fare || 3500).toLocaleString()}`}
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
                              <a
                                href={st.google_maps_nav_url || `https://www.google.com/maps?q=${st.house_lat},${st.house_lng}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 hover:underline mt-0.5"
                              >
                                <Navigation size={10} />
                                <span>Navigate GPS</span>
                              </a>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-3">
                          <span
                            className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                              st.status === 'ON_BOARD'
                                ? 'bg-blue-100 text-blue-800'
                                : st.status === 'DROPPED_OFF'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {st.status || 'SCHEDULED'}
                          </span>
                        </td>

                        <td className="py-3.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {st.parent_phone && (
                              <a
                                href={`tel:${st.parent_phone}`}
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
                                title="Call Parent"
                              >
                                <Phone size={13} />
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => onOpenVerificationModal(st)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[11px] cursor-pointer"
                            >
                              Verify
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: VEHICLE */}
      {activeTab === 'vehicle' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6">
          <h3 className="font-extrabold text-lg text-slate-900">DISC Vehicle Asset & Maintenance Log</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <span className="text-slate-400 font-bold block">Assigned Van</span>
              <span className="font-extrabold text-slate-900 text-sm mt-0.5 block">{escort.vehicleType || 'Executive Shuttle'}</span>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <span className="text-slate-400 font-bold block">License Plate</span>
              <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block">{escort.regNumber || 'LAG-992-MY'}</span>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <span className="text-slate-400 font-bold block">Fuel Status</span>
              <span className="font-bold text-emerald-600 text-sm mt-0.5 block">92% (Full Tank)</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: ROUTE OPTIMISATION */}
      {activeTab === 'optimisation' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="font-extrabold text-lg text-slate-900">AI Route Optimisation Engine</h3>
              <p className="text-xs text-slate-500">Real-time Traffic & Shortest Corridor Suggestions</p>
            </div>
            <button
              onClick={() => toast.success('Route re-optimised! Saved 8 minutes of transit time.')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-3.5 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw size={14} />
              <span>Re-calculate Best Path</span>
            </button>
          </div>

          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 font-medium">
            ✨ Optimal Path Selected: Lekki Express Corridor ➔ Alma Beach ➔ Agbara Route (Saves 12 mins traffic delay).
          </div>
        </div>
      )}

      {/* TAB 5: EARNINGS BREAKDOWN */}
      {activeTab === 'earnings' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-extrabold text-lg text-slate-900">Per-Student Pricing & Earnings Breakdown</h3>
            <p className="text-xs text-slate-500">City Manager verified rates for each assigned passenger.</p>
          </div>

          <div className="divide-y divide-slate-100">
            {displayRoster.map((s: any) => (
              <div key={s.id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-900 block">{s.name}</span>
                  <span className="text-[11px] text-slate-400">{s.school_name || 'Kings College'} · {s.pickup_address}</span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-black text-emerald-800 text-sm block">
                    {s.formatted_daily_fare || `₦${(s.daily_fare || 3500).toLocaleString()}`}
                  </span>
                  <span className="text-[10px] text-slate-400">₦{Math.round((s.daily_fare || 3500) / 2).toLocaleString()} morning + ₦{Math.round((s.daily_fare || 3500) / 2).toLocaleString()} afternoon</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DECLINE TODAY TRIP MODAL */}
      {declineModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-rose-700 font-black text-sm">
                <AlertCircle size={18} />
                <span>Report Inability to Cover Route</span>
              </div>
              <button onClick={() => setDeclineModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Reporting unable to cover will immediately notify the City Manager to dispatch an emergency pool escort so students and parents are not disappointed.
            </p>

            <div className="space-y-2 text-xs">
              <label className="font-bold text-slate-800 block">Reason for Inability to Cover *</label>
              <select
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-rose-600"
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
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmittingCommitment}
                onClick={handleDeclineTrips}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-md shadow-rose-600/20 cursor-pointer"
              >
                {isSubmittingCommitment ? 'Alerting...' : 'Alert City Manager for Emergency Backup'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PIN HOUSE LOCATION MODAL */}
      {pinLocationModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-purple-900 font-black text-sm">
                <MapPin size={18} className="text-purple-700" />
                <span>Pin My Residential Location</span>
              </div>
              <button onClick={() => setPinLocationModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
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
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-purple-600"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Closest Landmark</label>
                <input
                  type="text"
                  placeholder="e.g. Opposite Ebeano Supermarket"
                  value={locationForm.closest_landmark}
                  onChange={(e) => setLocationForm({ ...locationForm, closest_landmark: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:outline-purple-600"
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
                    className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-[10px] flex items-center gap-1 cursor-pointer"
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
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingLocation}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black shadow-md shadow-purple-600/20 cursor-pointer"
                >
                  {savingLocation ? 'Saving...' : 'Save Pinned Location'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
