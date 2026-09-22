// @ts-nocheck
'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  Phone,
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
  ArrowRight,
  Headphones,
  Copy,
  Info,
  Building,
  CheckSquare,
  Square,
  RotateCcw,
  Compass,
  Trophy,
  Wifi,
  Radio,
  Battery,
  Zap,
  MapPinOff,
  Maximize2,
  X,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import SchoolNoticeBanner from '@/components/shared/SchoolNoticeBanner';
import LocationPermissionModal from '@/components/shared/LocationPermissionModal';
import LiveVehicleMap from '@/components/shared/LiveVehicleMap';
import { useEscortTelemetryTracker } from '@/hooks/useEscortTelemetryTracker';

interface SharedEscortDashboardProps {
  session?: any;
  escortData?: any;
  liveDashboardData?: any;
  onRefreshData?: () => void;
  onOpenVerificationModal?: (student?: any) => void;
  onOpenIncidentModal?: () => void;
  onOpenAccountModal?: () => void;
  onOpenIdCardModal?: () => void;
  onNavigateStudent?: (student: any) => void;
  onNavChange?: (tab: string) => void;
  isAvailableForOtherSchools?: boolean;
  onToggleAvailableForOtherSchools?: () => void;
}

export default function SharedEscortDashboard({
  session,
  escortData,
  liveDashboardData,
  onRefreshData,
  onOpenVerificationModal,
  onOpenIncidentModal,
  onOpenAccountModal,
  onOpenIdCardModal,
  onNavigateStudent,
  onNavChange,
  isAvailableForOtherSchools = false,
  onToggleAvailableForOtherSchools,
}: SharedEscortDashboardProps) {
  const [showWalletBalance, setShowWalletBalance] = useState(true);
  
  // Interactive State Management for Dashboard
  const [commTab, setCommTab] = useState<'all' | 'parents' | 'school' | 'cityManager'>('all');
  const [morningTripStarted, setMorningTripStarted] = useState(false);
  const [afternoonTripStarted, setAfternoonTripStarted] = useState(false);
  const [isManualMode, setIsManualMode] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [liveGps, setLiveGps] = useState<{
    lat: number | null;
    lng: number | null;
    heading: number;
    speedKmh: number;
  }>({ lat: null, lng: null, heading: 0, speedKmh: 0 });
  const [checklist, setChecklist] = useState({
    seatStudents: false,
    ensureSeatbelts: false,
    checkBelongings: false,
  });
  const [isProcessingTripAction, setIsProcessingTripAction] = useState(false);
  const [isSimulatingDrive, setIsSimulatingDrive] = useState(false);

  // GPS Hardware Pre-Warming: Acquire fast initial fix on mount so start_trip has instant coordinates
  useEffect(() => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLiveGps((prev) => ({
          lat: prev.lat ?? pos.coords.latitude,
          lng: prev.lng ?? pos.coords.longitude,
          heading: prev.heading || pos.coords.heading || 0,
          speedKmh: prev.speedKmh || (pos.coords.speed ? pos.coords.speed * 3.6 : 0),
        }));
      },
      () => {},
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 10000 }
    );
  }, []);

  // Keep local trip/session state aligned with live dashboard payload
  useEffect(() => {
    const remoteSessionId = liveDashboardData?.activeSession?.id || null;
    if (remoteSessionId) setActiveSessionId(remoteSessionId);

    const status = liveDashboardData?.escort?.today_trip_status;
    const tripType = liveDashboardData?.activeSession?.trip_type;
    if (status === 'in_progress') {
      if (tripType === 'afternoon_dropoff') {
        setAfternoonTripStarted(true);
      } else {
        setMorningTripStarted(true);
      }
    } else if (status === 'completed' || status === 'pending' || status === 'accepted') {
      if (status !== 'accepted') {
        setMorningTripStarted(false);
        setAfternoonTripStarted(false);
      }
      if (status === 'completed' || status === 'pending') {
        setActiveSessionId(null);
      }
    }
  }, [
    liveDashboardData?.activeSession?.id,
    liveDashboardData?.activeSession?.trip_type,
    liveDashboardData?.escort?.today_trip_status,
  ]);

  // Dynamic Live Database Bindings
  const escortName = liveDashboardData?.escort?.name || escortData?.name || escortData?.fullName || session?.full_name || 'Escort';
  const escortCode = liveDashboardData?.escort?.code || escortData?.escort_code || escortData?.id || null;
  const assignedSchools = liveDashboardData?.assigned_schools || [];
  const assignedSchoolNames = Array.from(new Set(assignedSchools.map((s: any) => s?.name).filter(Boolean)));
  const schoolName =
    assignedSchoolNames.length > 0
      ? assignedSchoolNames.join(' · ')
      : liveDashboardData?.school?.name || escortData?.createdBySchoolName || 'Assigned School';
  const walletBal = Number(liveDashboardData?.wallet?.balance ?? 0);
  const totalTrips = liveDashboardData?.stats?.totalTrips ?? 0;
  const totalStudents = liveDashboardData?.stats?.totalStudents ?? liveDashboardData?.students?.manifest?.length ?? 0;
  const totalDistance = liveDashboardData?.stats?.totalDistance ?? '0 km';

  // Live Pickup List Data from Supabase DB
  const morningList = liveDashboardData?.students?.morning || [];
  const afternoonList = liveDashboardData?.students?.afternoon || [];
  const droppedOffList = liveDashboardData?.students?.dropped_off || morningList.filter((s: any) => s.dropped || s.status === 'DROPPED_OFF' || s.morning_status === 'DROPPED_OFF_AT_SCHOOL');
  const isPicked = (s: any) => Boolean(s?.picked || s?.status === 'PICKED' || s?.status === 'ON_BOARD' || s?.status === 'DROPPED_OFF' || s?.morning_status === 'PICKED_UP_FROM_HOME' || s?.morning_status === 'DROPPED_OFF_AT_SCHOOL');
  const morningPickedCount = morningList.filter(isPicked).length;
  const nextPickup = morningList.find((s: any) => !isPicked(s)) || null;
  const tripStatus = liveDashboardData?.escort?.today_trip_status;
  const morningTripActive = tripStatus === 'in_progress';
  const afternoonReleased = afternoonList.filter((s: any) => s.picked || s.afternoon_status === 'PICKED_UP_FROM_GATE' || s.afternoon_status === 'SAFE_AT_HOME').length;
  const allHome = afternoonList.length > 0 && afternoonList.every((s: any) => s.dropped || s.afternoon_status === 'SAFE_AT_HOME');
  const schoolLat = liveDashboardData?.school?.gps_lat;
  const schoolLng = liveDashboardData?.school?.gps_lng;
  const mapPins = morningList.filter((s: any) => s.house_lat && s.house_lng);
  const liveMapPins = [
    ...(schoolLat != null && schoolLng != null
      ? [{
          lat: Number(schoolLat),
          lng: Number(schoolLng),
          label: String(schoolName).length > 28 ? `${String(schoolName).slice(0, 26)}…` : schoolName,
          kind: 'school' as const,
        }]
      : []),
    ...mapPins.slice(0, 6).map((s: any) => {
      const name = String(s.name || 'Stop');
      return {
        lat: Number(s.house_lat),
        lng: Number(s.house_lng),
        label: name.length > 22 ? `${name.slice(0, 20)}…` : name,
        kind: 'home' as const,
      };
    }),
  ];
  const dismissalClocks = assignedSchools
    .map((s: any) => {
      const clock = String(s?.dismissal_start_time || s?.student_gate_end || '').slice(0, 5);
      return clock ? { name: s.name, clock } : null;
    })
    .filter(Boolean) as Array<{ name: string; clock: string }>;
  const dismissalLabel = liveDashboardData?.school?.dismissal_start_time || liveDashboardData?.route?.afternoon_time || null;
  const dismissalClock = dismissalLabel ? String(dismissalLabel).slice(0, 5) : null;
  const announcements = liveDashboardData?.announcements || [];
  const lastSync = liveDashboardData?.last_sync
    ? new Date(liveDashboardData.last_sync).toLocaleTimeString('en-NG', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  // Active Trip & Real-Time Telemetry Broadcaster
  const isTripActive = morningTripStarted || afternoonTripStarted || morningTripActive;
  const currentTripSessionId =
    activeSessionId || liveDashboardData?.activeSession?.id || null;

  const handleTelemetryError = (err: string, code?: number) => {
    // If permission was denied, prompt user with helper modal instead of throwing repeated alerts
    if (code === 1) {
      setShowLocationModal(true);
    }
  };

  // Generate realistic simulation waypoints along the route corridor
  const simulationWaypoints = useMemo(() => {
    const pts: Array<{ lat: number; lng: number }> = [];
    const homePins = liveMapPins.filter((p) => p.kind === 'home' || p.kind === 'stop');
    const schoolPins = liveMapPins.filter((p) => p.kind === 'school');
    homePins.forEach((p) => pts.push({ lat: p.lat, lng: p.lng }));
    schoolPins.forEach((p) => pts.push({ lat: p.lat, lng: p.lng }));

    // Fallback circular road corridor loop around the coordinate if 0 or 1 pin is present
    if (pts.length < 2) {
      const c = pts.length === 1 ? pts[0] : { lat: 6.5244, lng: 3.3792 };
      pts.length = 0;
      pts.push({ lat: c.lat, lng: c.lng });
      pts.push({ lat: c.lat + 0.0025, lng: c.lng + 0.0018 });
      pts.push({ lat: c.lat + 0.0048, lng: c.lng + 0.0006 });
      pts.push({ lat: c.lat + 0.0035, lng: c.lng - 0.0024 });
      pts.push({ lat: c.lat + 0.0012, lng: c.lng - 0.0028 });
      pts.push({ lat: c.lat, lng: c.lng });
    }
    return pts;
  }, [liveMapPins]);

  const {
    isBroadcasting,
    hasPermissionError,
    currentSpeedKmh,
    currentHeading,
    gpsAccuracy,
    pingCount,
    batteryLevel,
    retryLocationAccess,
  } = useEscortTelemetryTracker({
    sessionId: currentTripSessionId || undefined,
    schoolId: liveDashboardData?.activeSession?.school_id || liveDashboardData?.escort?.school_id || escortData?.school_id,
    vehicleId: liveDashboardData?.vehicle?.id || escortData?.vehicle_id,
    escortId: liveDashboardData?.escort?.id || escortData?.id || undefined,
    isActive: Boolean(isTripActive && !isManualMode && currentTripSessionId),
    isSimulating: isSimulatingDrive,
    simulationWaypoints,
    onError: handleTelemetryError,
    onPositionUpdate: (point) => {
      setLiveGps({
        lat: point.lat,
        lng: point.lng,
        heading: point.heading || 0,
        speedKmh: point.speedKmh || 0,
      });
    },
  });

  const getChildAddress = (raw: unknown) => {
    if (!raw) return 'Address not set';
    const text = String(raw).trim();
    if (text.startsWith('{') && text.includes('discount')) return 'Home address on file';
    return text;
  };

  // Lock body scroll while map is expanded for driving focus
  useEffect(() => {
    if (!mapExpanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mapExpanded]);

  const formatPickupAddress = (student: any) => {
    const raw = student?.house_address || student?.pickup_address || student?.address || '';
    if (!raw) return 'Home address on file';
    const text = String(raw).trim();
    if (text.startsWith('{') && text.includes('discount')) return 'Home address on file';
    return text;
  };

  const renderLiveRouteMap = (opts?: { expanded?: boolean }) => {
    const expanded = Boolean(opts?.expanded);
    return (
      <LiveVehicleMap
        key={expanded ? 'escort-map-expanded' : 'escort-map-inline'}
        heightClassName={
          expanded
            ? 'h-[calc(100vh-5.5rem)] sm:h-[calc(100vh-6rem)]'
            : 'h-[280px] sm:h-[320px] lg:h-[380px]'
        }
        className={expanded ? 'rounded-2xl border-0 shadow-none' : 'rounded-xl border-0 shadow-none'}
        pins={liveMapPins}
        routeCoordinates={simulationWaypoints.length >= 2 ? simulationWaypoints : undefined}
        vehicleLat={isTripActive ? liveGps.lat : null}
        vehicleLng={isTripActive ? liveGps.lng : null}
        vehicleHeading={liveGps.heading || currentHeading || 0}
        vehicleSpeedKmh={liveGps.speedKmh || currentSpeedKmh || 0}
        vehicleLabel={liveDashboardData?.vehicle?.plate_number || 'You'}
        followVehicle={Boolean(isTripActive && liveGps.lat != null && liveGps.lng != null)}
        showZoom={expanded}
        hideAttribution
        emptyMessage="Route GPS is not pinned yet. School or house coordinates will draw the live map."
      />
    );
  };
  const handleStartMorningTrip = async () => {
    if (morningList.length === 0) {
      toast.info('No morning student pickups scheduled.');
      return;
    }
    if (isProcessingTripAction) return;
    setIsProcessingTripAction(true);
    try {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(40);
      }
      const completing = morningTripStarted || morningTripActive;
      const res = await fetch('/api/escorts/dashboard-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: completing ? 'complete_trip' : 'start_trip',
          trip_type: 'morning',
          school_id: liveDashboardData?.school?.id || liveDashboardData?.escort?.school_id,
          lat: liveGps.lat,
          lng: liveGps.lng,
          heading: liveGps.heading,
          speedKmh: liveGps.speedKmh,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update trip');
      setMorningTripStarted(!completing);
      if (!completing && data.sessionId) {
        setActiveSessionId(data.sessionId);
      }
      if (completing) {
        setActiveSessionId(null);
        setIsSimulatingDrive(false);
      }
      toast.success(data.message || (completing ? 'Morning trip completed.' : 'Morning trip started. Live tracking enabled.'));
      onRefreshData?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update morning trip');
    } finally {
      setIsProcessingTripAction(false);
    }
  };

  // Handle Afternoon Trip Checklist Toggle
  const toggleChecklist = (key: keyof typeof checklist) => {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Handle Afternoon Trip Start / Stop
  const handleStartAfternoonTrip = async () => {
    if (!afternoonTripStarted) {
      if (!checklist.seatStudents || !checklist.ensureSeatbelts || !checklist.checkBelongings) {
        toast.error('Please complete all safety checks before starting the trip.');
        return;
      }
    }
    if (isProcessingTripAction) return;
    setIsProcessingTripAction(true);
    try {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(40);
      }
      const completing = afternoonTripStarted;
      const res = await fetch('/api/escorts/dashboard-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: completing ? 'complete_trip' : 'start_trip',
          trip_type: 'afternoon',
          school_id: liveDashboardData?.school?.id || liveDashboardData?.escort?.school_id,
          lat: liveGps.lat,
          lng: liveGps.lng,
          heading: liveGps.heading,
          speedKmh: liveGps.speedKmh,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update trip');
      setAfternoonTripStarted(!completing);
      if (completing) {
        setIsManualMode(false);
        setActiveSessionId(null);
        setIsSimulatingDrive(false);
      } else if (data.sessionId) {
        setActiveSessionId(data.sessionId);
      }
      toast.success(data.message || (completing ? 'Afternoon trip completed.' : 'Afternoon trip started. Live tracking enabled.'));
      onRefreshData?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update afternoon trip');
    } finally {
      setIsProcessingTripAction(false);
    }
  };

  return (
    <div className="space-y-6 font-sans text-slate-800 text-xs">
      {/* OFFICIAL SCHOOL NOTICES & PUBLIC HOLIDAY ADVISORIES */}
      <SchoolNoticeBanner role="escorts" schoolId={liveDashboardData?.escort?.school_id || liveDashboardData?.escort?.primary_school_id || escortData?.school_id || escortData?.primary_school_id} />

      {/* LOCATION PERMISSION BLOCKED WARNING BANNER */}
      {hasPermissionError && isTripActive && !isManualMode && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 shadow-sm text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <MapPinOff className="w-5 h-5" />
            </div>
            <div>
              <p className="font-extrabold text-sm text-slate-900">
                Location Access Blocked on Browser
              </p>
              <p className="text-[11px] text-slate-600">
                Live GPS broadcasting is paused. Enable location or continue in manual mode.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <button
              type="button"
              onClick={() => setShowLocationModal(true)}
              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs transition-all shadow-xs cursor-pointer"
            >
              How to Enable Location
            </button>
            <button
              type="button"
              onClick={() => setIsManualMode(true)}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs transition-all cursor-pointer"
            >
              Manual Mode
            </button>
          </div>
        </div>
      )}

      {/* MANUAL TRANSIT MODE ACTIVE BANNER */}
      {isManualMode && isTripActive && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3.5 shadow-sm text-blue-950 flex items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <Compass className="w-4 h-4 text-blue-600 animate-spin" />
            <div>
              <span className="font-extrabold text-xs text-blue-950">Manual Transit Mode Active: </span>
              <span className="text-[11px] text-blue-800">You can manually advance stops and scan students without GPS.</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsManualMode(false);
              retryLocationAccess();
            }}
            className="px-3 py-1 rounded-xl bg-white hover:bg-blue-100 border border-blue-300 text-blue-800 font-extrabold text-xs transition-all cursor-pointer"
          >
            Retry GPS
          </button>
        </div>
      )}

      {/* LIVE TELEMETRY RADAR BROADCAST RIBBON (Active during trips with GPS) */}
      {isBroadcasting && !hasPermissionError && !isManualMode && (
        <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 border border-emerald-500/40 rounded-2xl p-3.5 shadow-lg shadow-emerald-950/30 text-white flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-white">
                  Live GPS Radar Active
                </span>
                <span className="bg-emerald-500/30 text-emerald-300 border border-emerald-500/50 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Pinging (3s)
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Broadcasting live vehicle telemetry to {schoolName} Gate & Parents
              </p>
            </div>
          </div>

          {/* Telemetry Pills */}
          <div className="flex items-center gap-2.5 text-xs font-bold">
            <div className="bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>{currentSpeedKmh > 0 ? `${currentSpeedKmh} km/h` : 'Moving'}</span>
            </div>

            <div className="bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-blue-400" />
              <span>{currentHeading}° Bearing</span>
            </div>

            {gpsAccuracy !== null && (
              <div className="bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-xl text-slate-300 hidden sm:flex items-center gap-1">
                <span>±{gpsAccuracy}m GPS accuracy</span>
              </div>
            )}

            {batteryLevel !== null && (
              <div className="bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-xl text-slate-300 flex items-center gap-1">
                <Battery className="w-3.5 h-3.5 text-emerald-400" />
                <span>{batteryLevel}%</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* LOCATION PERMISSION HELPER MODAL */}
      <LocationPermissionModal
        isOpen={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        onRetry={() => {
          retryLocationAccess();
          toast.success('Retrying GPS location access...');
        }}
        onEnableManualMode={() => {
          setIsManualMode(true);
          toast.info('Switched to Manual Transit Mode.');
        }}
      />

      {/* ========================================================================= */}
      {/* 1. HERO ROW: GIGO/MIGO AI BANNER + TODAY'S TRIP SUMMARY */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left: GIGO/MIGO AI Greeting Banner (8 Cols) */}
        <div className="lg:col-span-8 bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start md:items-center gap-3.5 min-w-0">
            {/* Robot Mascot Icon */}
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center shadow-md shrink-0 border border-emerald-300">
              <div className="relative">
                <Sparkles className="w-6 h-6" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-300 animate-ping" />
              </div>
            </div>

            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-extrabold text-[10px] uppercase tracking-wider">
                  MIGO AI
                </span>
                <h3 className="font-extrabold text-slate-900 text-sm md:text-base tracking-tight truncate">
                  {liveDashboardData?.migo?.greeting || `Good day, ${escortName.split(' ')[0]}!`}
                </h3>
              </div>
              <p className="text-slate-600 text-xs font-medium truncate">
                {morningList.length > 0 ? (
                  <>You have <strong className="text-slate-900 font-bold">{totalTrips || morningList.length} trip{Number(totalTrips) === 1 ? '' : 's'}</strong> today. {nextPickup ? `${nextPickup.name} is next.` : 'Morning pickups are in progress.'}</>
                ) : (
                  <>No students are assigned to you yet. City Manager approved assignments will appear here.</>
                )}
              </p>

              {/* Action Chips */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => toast.info('Safety Rules: Maintain 40km/h limit & ensure seatbelts.')}
                  className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-200/80 flex items-center gap-1.5 transition-all"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Follow safety rules</span>
                </button>

                <button
                  type="button"
                  onClick={() => toast.info('Trip Status synchronised with central dispatch.')}
                  className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 text-[11px] font-bold border border-blue-200/80 flex items-center gap-1.5 transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>Update trip status</span>
                </button>

                <button
                  type="button"
                  onClick={() => toast.info('Communication guideline: Be polite and keep parents informed.')}
                  className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 text-[11px] font-bold border border-amber-200/80 flex items-center gap-1.5 transition-all"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
                  <span>Keep communication professional</span>
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => toast.info('Operational status is nominal and connected to central server.')}
            className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 border border-slate-200 transition-all shrink-0 hidden md:block"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Right: TODAY'S TRIP SUMMARY Card (4 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
              TODAY'S TRIP SUMMARY
            </h4>
            <button
              type="button"
              onClick={() => onNavChange?.('trips')}
              className="text-[11px] font-bold text-emerald-600 hover:underline"
            >
              View All
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center divide-x divide-slate-100 pt-1">
            <div>
              <span className="text-2xl font-black text-slate-900 leading-tight block">{totalTrips}</span>
              <span className="text-[10px] text-slate-500 font-semibold block uppercase tracking-wider">Total Trips</span>
            </div>
            <div>
              <span className="text-2xl font-black text-slate-900 leading-tight block">{totalStudents}</span>
              <span className="text-[10px] text-slate-500 font-semibold block uppercase tracking-wider">Students</span>
            </div>
            <div>
              <span className="text-2xl font-black text-slate-900 leading-tight block">{totalDistance}</span>
              <span className="text-[10px] text-slate-500 font-semibold block uppercase tracking-wider">Total Distance</span>
            </div>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 2. ROW 1: NEXT PICKUP + TRIP PROGRESS, then tall LIVE MAP */}
      {/* ========================================================================= */}
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Card 1: NEXT PICKUP */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
                NEXT PICKUP
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-extrabold">
                {nextPickup?.time || nextPickup?.estimated_transit_mins != null ? `${nextPickup.estimated_transit_mins} min` : (nextPickup ? 'Queued' : 'Standby')}
              </span>
            </div>

            {nextPickup ? (
              <div className="flex items-start gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="w-10 h-10 rounded-full bg-purple-600 text-white font-extrabold flex items-center justify-center text-sm shadow-sm shrink-0 overflow-hidden">
                  {nextPickup.photo_url || nextPickup.avatar ? (
                    <img src={nextPickup.photo_url || nextPickup.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    nextPickup.name?.substring(0, 2)?.toUpperCase() || 'ST'
                  )}
                </div>
                <div className="min-w-0 space-y-0.5">
                  <span className="text-[10px] font-medium text-slate-400 block uppercase">First Pickup</span>
                  <h4 className="font-extrabold text-slate-900 text-sm truncate">{nextPickup.name}</h4>
                  <p className="text-[11px] text-slate-600 font-medium flex items-center gap-1 leading-snug">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">{formatPickupAddress(nextPickup)}</span>
                  </p>
                </div>
              </div>
            ) : morningList.length > 0 ? (
              <div className="p-5 text-center bg-emerald-50 rounded-xl border border-emerald-100 space-y-1">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
                <p className="text-emerald-800 font-bold text-xs">All morning pickups complete</p>
                <p className="text-emerald-700 text-[10px]">Start the trip to school when you are ready.</p>
              </div>
            ) : (
              <div className="p-5 text-center bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <Clock className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                <p className="text-slate-700 font-bold text-xs">No Pickups Scheduled</p>
                <p className="text-slate-400 text-[10px]">Assigned students appear here after City Manager approval.</p>
              </div>
            )}

            <button
              type="button"
              disabled={!nextPickup && morningList.length === 0}
              onClick={() => {
                const target = nextPickup || morningList[0];
                if (!target) return;
                if (onNavigateStudent) onNavigateStudent(target);
                else if (target.google_maps_nav_url) window.open(target.google_maps_nav_url, '_blank');
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-[#00A859] hover:bg-emerald-600 disabled:opacity-50 text-white font-extrabold text-xs transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Navigate</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Card 3: TRIP PROGRESS */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 space-y-3 flex flex-col justify-between">
            <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
              TRIP PROGRESS
            </h4>

            <div className="space-y-3 relative pl-4 border-l-2 border-slate-200 text-xs">
              <div className="relative">
                <span className={`absolute -left-[21px] top-0.5 w-3.5 h-3.5 rounded-full ${morningPickedCount > 0 ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-600'} flex items-center justify-center text-[8px] font-bold`}>1</span>
                <h5 className="font-extrabold text-blue-900 text-xs">Pickup in Progress</h5>
                <p className="text-[10px] text-blue-700 font-medium">
                  {morningPickedCount} of {morningList.length} Completed
                </p>
              </div>

              <div className="relative">
                <span className={`absolute -left-[21px] top-0.5 w-3.5 h-3.5 rounded-full ${droppedOffList.length > 0 ? 'bg-amber-500 text-white' : 'bg-slate-300 text-slate-600'} flex items-center justify-center text-[8px] font-bold`}>2</span>
                <h5 className="font-bold text-slate-700 text-xs">Drop-off to School</h5>
                <p className="text-[10px] text-slate-500">{droppedOffList.length > 0 ? `${droppedOffList.length} of ${morningList.length} at school` : 'Pending'}</p>
              </div>

              <div className="relative">
                <span className={`absolute -left-[21px] top-0.5 w-3.5 h-3.5 rounded-full ${afternoonReleased > 0 ? 'bg-purple-600 text-white' : 'bg-slate-300 text-slate-600'} flex items-center justify-center text-[8px] font-bold`}>3</span>
                <h5 className="font-bold text-slate-700 text-xs">Afternoon Pickup</h5>
                <p className="text-[10px] text-slate-500">{afternoonReleased > 0 ? `${afternoonReleased} released` : 'Pending'}</p>
              </div>

              <div className="relative">
                <span className={`absolute -left-[21px] top-0.5 w-3.5 h-3.5 rounded-full ${allHome ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-600'} flex items-center justify-center text-[8px] font-bold`}>4</span>
                <h5 className={`font-medium text-xs ${allHome ? 'text-emerald-800' : 'text-slate-400'}`}>Return Trip</h5>
                <p className="text-[10px] text-slate-400">{allHome ? 'Completed' : 'Pending'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Full-width LIVE MAP & ROUTE — taller for clear driving view */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-emerald-600" /> LIVE MAP & ROUTE
            </h4>
            <div className="flex items-center gap-2">
              {isTripActive && (
                <button
                  type="button"
                  onClick={() => setIsSimulatingDrive((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-extrabold transition-all cursor-pointer shadow-xs ${
                    isSimulatingDrive
                      ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                  title={isSimulatingDrive ? 'Stop simulated live movement' : 'Simulate live movement along the route to test real-time parent tracking'}
                >
                  <Navigation className="w-3 h-3" />
                  <span>{isSimulatingDrive ? '■ Stop Test Drive' : '▶ Simulate Live Movement'}</span>
                </button>
              )}
              {isTripActive && isBroadcasting ? (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                  {isSimulatingDrive ? 'Simulated Drive' : 'Live GPS'}{liveGps.speedKmh ? ` · ${Math.round(liveGps.speedKmh)} km/h` : ''}
                </span>
              ) : (
                <span className="text-[10px] text-slate-400 font-medium">Route overview</span>
              )}
              <button
                type="button"
                onClick={() => setMapExpanded(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold transition-all cursor-pointer"
                title="Expand map for driving"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Expand</span>
              </button>
            </div>
          </div>

          <div className="relative w-full rounded-xl overflow-hidden border border-slate-200 shadow-inner">
            {renderLiveRouteMap()}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10px] font-semibold text-slate-600 pt-1">
            {morningList.length > 0 ? (
              morningList.slice(0, 2).map((stu, i) => (
                <span key={stu.id || i} className="flex items-center gap-1.5">
                  <span className={`w-4 h-4 rounded-full ${i === 0 ? 'bg-purple-600' : 'bg-amber-500'} text-white text-[9px] font-extrabold flex items-center justify-center`}>
                    {i + 1}
                  </span>
                  <span>{stu.name}</span>
                </span>
              ))
            ) : (
              <span className="text-slate-400">Route Standby</span>
            )}
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[9px] font-extrabold flex items-center justify-center">🎒</span>
              <span>{schoolName} (Drop-off)</span>
            </span>
          </div>
        </div>
      </div>

      {/* Fullscreen driving map */}
      {mapExpanded && (
        <div className="fixed inset-0 z-[90] bg-slate-950/95 p-3 sm:p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 shrink-0">
            <div className="min-w-0">
              <p className="text-white font-black text-sm tracking-tight">Live Route Map</p>
              <p className="text-[11px] text-slate-300 font-medium truncate">
                {isBroadcasting
                  ? `Broadcasting GPS${liveGps.speedKmh ? ` · ${Math.round(liveGps.speedKmh)} km/h` : ''}`
                  : 'Expanded view for clear on-road navigation'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMapExpanded(false)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white text-slate-900 text-xs font-bold shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
              Close
            </button>
          </div>
          <div className="flex-1 min-h-0 rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
            {renderLiveRouteMap({ expanded: true })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. ROW 2: PICKUP LISTS (MORNING, DROPPED OFF, AFTERNOON AT SCHOOL) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5">
        
        {/* Card 1: MORNING PICKUP LIST (4 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
              MORNING PICKUP LIST
            </h4>
            <span className="text-[10px] text-emerald-700 font-bold">
              {morningPickedCount} of {morningList.length} Picked
            </span>
          </div>

          <div className="space-y-2.5">
            {morningList.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-100 text-slate-400">
                <Users className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                <p className="font-bold text-slate-600">No Morning Pickups</p>
                <p className="text-[10px]">Assigned students for morning transport will list here.</p>
              </div>
            ) : (
              morningList.map((stu: any, index: number) => (
                <div key={stu.id || index} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`w-5 h-5 rounded-full ${index === 0 ? 'bg-purple-600' : 'bg-amber-500'} text-white font-extrabold text-[10px] flex items-center justify-center shrink-0`}>
                      {index + 1}
                    </span>
                    <div className={`w-7 h-7 rounded-full ${index === 0 ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-800'} font-bold flex items-center justify-center text-xs shrink-0`}>
                      {stu.avatar || stu.name?.substring(0, 2)?.toUpperCase() || 'ST'}
                    </div>
                    <div className="min-w-0">
                      <h5 className="font-extrabold text-slate-900 text-xs truncate">{stu.name}</h5>
                      <p className="text-[10px] text-slate-500 truncate">{stu.address}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded ${isPicked(stu) ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'} font-extrabold text-[9px] shrink-0 flex items-center gap-1`}>
                    {isPicked(stu) ? `PICKED ${stu.time || ''} ✓` : `NEXT ${stu.time || ''}`.trim()}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="pt-2 border-t border-slate-100 space-y-2">
            <p className="text-[10px] text-slate-500 font-medium text-center">
              All picked up? Start trip to school
            </p>
            <button
              type="button"
              disabled={(morningList.length === 0 && !morningTripStarted && !morningTripActive) || isProcessingTripAction}
              onClick={handleStartMorningTrip}
              className={`w-full py-2.5 px-4 rounded-xl ${
                morningTripStarted || morningTripActive
                  ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                  : 'bg-[#00A859] hover:bg-emerald-600 shadow-emerald-600/20'
              } disabled:opacity-50 text-white font-extrabold text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer`}
            >
              {isProcessingTripAction ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{morningTripStarted || morningTripActive ? 'Completing Trip…' : 'Starting Trip…'}</span>
                </>
              ) : (
                <span>{morningTripStarted || morningTripActive ? '■ Complete Morning Trip' : '▶ Start Trip to School'}</span>
              )}
            </button>
          </div>
        </div>

        {/* Card 2: DROPPED OFF LIST (4 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
              DROPPED OFF LIST
            </h4>
            <span className="text-[10px] text-slate-400 font-medium">{droppedOffList.length} of {morningList.length} Dropped</span>
          </div>

          {droppedOffList.length === 0 ? (
          <div className="py-6 px-4 text-center space-y-2 flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-50 text-slate-300 flex items-center justify-center border border-slate-100">
              <Building className="w-9 h-9" />
            </div>
            <p className="text-xs text-slate-600 font-semibold max-w-[200px] leading-snug">
              No students dropped off yet. Once the gate officer scans your arrival, this list will appear.
            </p>
          </div>
          ) : (
            <div className="space-y-2.5">
              {droppedOffList.map((stu: any, index: number) => (
                <div key={stu.id || index} className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                    {stu.name?.substring(0, 2)?.toUpperCase() || 'ST'}
                  </div>
                  <div className="min-w-0">
                    <h5 className="font-extrabold text-slate-900 text-xs truncate">{stu.name}</h5>
                    <p className="text-[10px] text-emerald-800 truncate">{stu.school_name || schoolName}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Card 3: AFTERNOON PICKUP LIST (AT SCHOOL) (4 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
              AFTERNOON PICKUP LIST{' '}
              <span className="text-[10px] text-slate-400 font-normal">
                ({assignedSchoolNames.length > 1 ? 'All assigned schools' : `At ${schoolName}`})
              </span>
            </h4>
            <span className="text-[10px] text-emerald-700 font-bold text-right">
              {dismissalClocks.length > 1
                ? dismissalClocks.map((d) => `${String(d.name).split(' ')[0]} ${d.clock}`).join(' · ')
                : dismissalClock
                  ? `Starts at ${dismissalClock}`
                  : 'Scheduled'}
            </span>
          </div>

          <div className="space-y-2">
            {afternoonList.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-100 text-slate-400">
                <Building className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                <p className="font-bold text-slate-600">No Afternoon Pickups</p>
                <p className="text-[10px]">Students ready for gate release will list here.</p>
              </div>
            ) : (
              afternoonList.map((stu: any, index: number) => (
                <div key={stu.id || index} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-purple-600 text-white font-extrabold text-[10px] flex items-center justify-center shrink-0">
                    {index + 1}
                  </span>
                  <div className="w-7 h-7 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center text-xs shrink-0">
                    {stu.name?.substring(0, 2)?.toUpperCase() || 'ST'}
                  </div>
                  <div className="min-w-0">
                    <h5 className="font-extrabold text-slate-900 text-xs truncate">{stu.name}</h5>
                    <p className="text-[10px] text-slate-500 truncate">{stu.note || `Pick from ${schoolName} Gate`}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-200/80 text-blue-900 text-center text-xs font-semibold">
            Gate Officer will scan & release students to you.
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 4. ROW 3: GATE OFFICER RELEASE + TRIP CONTROL + TRIP JOURNEY */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5">
        
        {/* Card 1: GATE OFFICER RELEASE (Afternoon) (4 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
              GATE OFFICER RELEASE <span className="text-[10px] text-purple-700 font-bold">(Afternoon)</span>
            </h4>
          </div>

          <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
            <div className="w-14 h-14 rounded-xl bg-indigo-100 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <p className="text-xs text-slate-700 font-medium leading-snug">
              Gate Officer scans your Escort ID and releases students to you.
            </p>
          </div>

          <div className={`flex items-center justify-center gap-1.5 p-2 rounded-xl border font-extrabold text-xs ${
            afternoonReleased > 0
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}>
            <span>{afternoonReleased > 0 ? `${afternoonReleased} student${afternoonReleased === 1 ? '' : 's'} released` : 'Pending release'}</span>
          </div>
          {onOpenIdCardModal && (
            <button
              type="button"
              onClick={onOpenIdCardModal}
              className="w-full py-2 rounded-xl bg-[#0A1128] text-white font-extrabold text-xs flex items-center justify-center gap-1.5"
            >
              <QrCode className="w-3.5 h-3.5 text-emerald-400" />
              Show Gate Pass
            </button>
          )}
        </div>

        {/* Card 2: TRIP CONTROL (4 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 space-y-3 flex flex-col justify-between">
          <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
            TRIP CONTROL
          </h4>

          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2 text-slate-600 font-semibold p-1">
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Waiting for students to board...</span>
            </div>

            <button
              type="button"
              onClick={() => toggleChecklist('seatStudents')}
              className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 transition-all text-left text-xs font-semibold text-slate-800"
            >
              {checklist.seatStudents ? (
                <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <Square className="w-4 h-4 text-slate-400 shrink-0" />
              )}
              <span>Seat all students</span>
            </button>

            <button
              type="button"
              onClick={() => toggleChecklist('ensureSeatbelts')}
              className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 transition-all text-left text-xs font-semibold text-slate-800"
            >
              {checklist.ensureSeatbelts ? (
                <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <Square className="w-4 h-4 text-slate-400 shrink-0" />
              )}
              <span>Ensure seatbelts</span>
            </button>

            <button
              type="button"
              onClick={() => toggleChecklist('checkBelongings')}
              className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 transition-all text-left text-xs font-semibold text-slate-800"
            >
              {checklist.checkBelongings ? (
                <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <Square className="w-4 h-4 text-slate-400 shrink-0" />
              )}
              <span>Check belongings</span>
            </button>
          </div>

          <button
            type="button"
            disabled={isProcessingTripAction}
            onClick={handleStartAfternoonTrip}
            className={`w-full py-2.5 px-4 rounded-xl ${
              afternoonTripStarted
                ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
            } disabled:opacity-50 text-white font-extrabold text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer`}
          >
            {isProcessingTripAction ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{afternoonTripStarted ? 'Completing Trip…' : 'Starting Trip…'}</span>
              </>
            ) : (
              <span>{afternoonTripStarted ? '■ Complete Afternoon Trip' : '▶ Start Trip'}</span>
            )}
          </button>
        </div>

        {/* Card 3: TRIP JOURNEY (Afternoon) (4 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 space-y-3 flex flex-col justify-between">
          <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
            TRIP JOURNEY <span className="text-[10px] text-purple-700 font-bold">(Afternoon)</span>
          </h4>

          <div className="space-y-2.5 relative pl-4 border-l-2 border-emerald-500 text-xs">
            {/* Journey Stop 1 */}
            <div className="relative flex items-center justify-between">
              <span className="absolute -left-[21px] w-4 h-4 rounded-full bg-emerald-600 text-white font-extrabold text-[10px] flex items-center justify-center">1</span>
              <div>
                <h5 className="font-extrabold text-slate-900 text-xs">{schoolName} <span className="text-[10px] font-normal text-slate-500">(Pickup)</span></h5>
              </div>
              <span className="font-mono text-slate-500 text-[11px] font-semibold">Scheduled</span>
            </div>

            {afternoonList.length > 0 ? (
              afternoonList.map((stu: any, idx: number) => (
                <div key={stu.id || idx} className="relative flex items-center justify-between">
                  <span className="absolute -left-[21px] w-4 h-4 rounded-full bg-emerald-600 text-white font-extrabold text-[10px] flex items-center justify-center">{idx + 2}</span>
                  <div>
                    <h5 className="font-extrabold text-slate-900 text-xs">{stu.name} <span className="text-[10px] font-normal text-slate-500">(Drop-off)</span></h5>
                  </div>
                  <span className="font-mono text-slate-500 text-[11px] font-semibold">Pending</span>
                </div>
              ))
            ) : (
              <div className="text-slate-400 text-[11px] py-1">No afternoon drop-off stops queued</div>
            )}
          </div>

          <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700 text-center text-xs font-semibold">
            Operational Schedule Active ⌛
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 5. ROW 4: WALLET OVERVIEW + SAVINGS & PROTECTION + QUICK STATISTICS */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5">
        
        {/* Card 1: WALLET OVERVIEW (4 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
              WALLET OVERVIEW
            </h4>
            <button
              type="button"
              onClick={() => onNavChange?.('wallet')}
              className="text-[11px] font-bold text-emerald-600 hover:underline"
            >
              View All
            </button>
          </div>

          {/* Dark Blue Inner Wallet Box */}
          <div className="bg-[#0A1633] text-white p-4 rounded-2xl space-y-3 shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-300 font-medium uppercase tracking-wider block">Available Balance</span>
                <h3 className="text-2xl font-black font-mono text-white mt-0.5">
                  {showWalletBalance ? `₦${walletBal.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '••••••'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onNavChange?.('wallet')}
                className="px-3.5 py-1.5 rounded-full bg-white text-slate-900 font-extrabold text-xs hover:bg-slate-100 transition-all shadow-sm cursor-pointer"
              >
                Fund Wallet
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">Today's Earnings</span>
                <strong className="text-white font-extrabold font-mono text-sm">
                  ₦{(liveDashboardData?.wallet?.todayEarnings ?? 0.0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">This Month</span>
                <strong className="text-white font-extrabold font-mono text-sm">
                  ₦{(liveDashboardData?.wallet?.monthEarnings ?? 0.0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </strong>
              </div>
            </div>
          </div>

          {/* Quick Action Icons Grid */}
          <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-semibold text-slate-700 pt-1">
            <button
              type="button"
              onClick={() => onNavChange?.('wallet')}
              className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex flex-col items-center gap-1 transition-all"
            >
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span>Transactions</span>
            </button>

            <button
              type="button"
              onClick={() => onNavChange?.('wallet')}
              className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex flex-col items-center gap-1 transition-all"
            >
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <span>Withdraw</span>
            </button>

            <button
              type="button"
              onClick={() => onNavChange?.('wallet')}
              className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex flex-col items-center gap-1 transition-all"
            >
              <RotateCcw className="w-4 h-4 text-emerald-600" />
              <span>Transfer</span>
            </button>

            <button
              type="button"
              onClick={() => onNavChange?.('wallet')}
              className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex flex-col items-center gap-1 transition-all"
            >
              <Wallet className="w-4 h-4 text-emerald-600" />
              <span>Statements</span>
            </button>
          </div>
        </div>

        {/* Card 2: SAVINGS & PROTECTION (4 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 space-y-3 flex flex-col justify-between">
          <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
            SAVINGS & PROTECTION
          </h4>

          <div className="space-y-2.5">
            {/* EduSave */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <PiggyBank className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="font-extrabold text-slate-900 text-xs">EduSave</h5>
                  <p className="text-[10px] text-slate-500">Savings: <strong className="text-slate-900 font-bold font-mono">₦{(liveDashboardData?.wallet?.eduSave ?? 0.0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p>
                </div>
              </div>
              <button type="button" onClick={() => onNavChange?.('edusave')} className="text-[11px] font-bold text-emerald-600 hover:underline">View</button>
            </div>

            {/* EduInsuRed */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="font-extrabold text-slate-900 text-xs">EduInsuRed</h5>
                  <p className="text-[10px] text-slate-500">{liveDashboardData?.wallet?.eduInsuRedActive ? 'Active Plan' : 'Plan Inactive'}</p>
                </div>
              </div>
              <button type="button" onClick={() => onNavChange?.('eduinsured')} className="text-[11px] font-bold text-emerald-600 hover:underline">View</button>
            </div>

            {/* SafetyConnect */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="font-extrabold text-slate-900 text-xs">SafetyConnect</h5>
                  <p className="text-[10px] text-slate-500">Emergency support for you</p>
                </div>
              </div>
              <button type="button" onClick={() => onOpenIncidentModal?.()} className="text-[11px] font-bold text-emerald-600 hover:underline">View</button>
            </div>
          </div>
        </div>

        {/* Card 3: QUICK STATISTICS (4 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
              QUICK STATISTICS
            </h4>
            <button type="button" onClick={() => onNavChange?.('reports')} className="text-[11px] font-bold text-emerald-600 hover:underline">View All</button>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600 flex items-center gap-1.5"><Car className="w-3.5 h-3.5 text-emerald-600" /> Trips Completed <span className="text-[10px] text-slate-400">(Today)</span></span>
              <strong className="font-black text-slate-900 text-xs">{liveDashboardData?.stats?.tripsCompletedToday ?? 0}</strong>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600 flex items-center gap-1.5"><Compass className="w-3.5 h-3.5 text-emerald-600" /> Total Distance <span className="text-[10px] text-slate-400">(Today)</span></span>
              <strong className="font-black text-slate-900 text-xs">{totalDistance}</strong>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600 flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-emerald-600" /> Total Students <span className="text-[10px] text-slate-400">(Served)</span></span>
              <strong className="font-black text-slate-900 text-xs">{totalStudents}</strong>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600 flex items-center gap-1.5"><Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" /> Average Rating</span>
              <strong className="font-black text-amber-600 text-xs">⭐ {liveDashboardData?.stats?.averageRating != null ? liveDashboardData.stats.averageRating : '—'}</strong>
            </div>

            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-semibold">On-Time Performance</span>
                <strong className="font-extrabold text-emerald-600 text-xs">{liveDashboardData?.stats?.onTimePerformance != null ? `${liveDashboardData.stats.onTimePerformance}%` : '—'}</strong>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${liveDashboardData?.stats?.onTimePerformance ?? 0}%` }} />
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 6. ROW 5: COMMUNICATIONS + ANNOUNCEMENTS + TODAY'S DESTINATIONS */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5">
        
        {/* Card 1: COMMUNICATIONS (4 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
              COMMUNICATIONS
            </h4>
            <button type="button" onClick={() => onNavChange?.('chat')} className="text-[11px] font-bold text-emerald-600 hover:underline">View All</button>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-[10px] font-bold">
            {(['all', 'parents', 'school', 'cityManager'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setCommTab(tab)}
                className={`px-2 py-1 rounded-lg capitalize transition-all ${
                  commTab === tab ? 'bg-white text-slate-900 shadow-xs font-extrabold' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {tab === 'cityManager' ? 'City Manager' : tab}
              </button>
            ))}
          </div>

          {/* Chat Messages List */}
          <div className="space-y-2 text-xs">
            {liveDashboardData?.notifications?.list && liveDashboardData.notifications.list.length > 0 ? (
              liveDashboardData.notifications.list.slice(0, 3).map((notif: any) => (
                <div key={notif.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center shrink-0">
                      🔔
                    </div>
                    <div className="min-w-0">
                      <h5 className="font-extrabold text-slate-900 text-xs truncate">{notif.title || 'Notification'}</h5>
                      <p className="text-[10px] text-slate-500 truncate">{notif.message}</p>
                    </div>
                  </div>
                  <span className="text-[9px] text-slate-400 font-mono shrink-0">
                    {notif.created_at ? new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'}
                  </span>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
                <MessageSquare className="w-5 h-5 mx-auto mb-1 text-slate-300" />
                <p className="font-semibold text-slate-600 text-xs">No Messages</p>
                <p className="text-[10px]">Direct messages with parents, schools, and city managers will appear here.</p>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: ANNOUNCEMENTS (4 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
              ANNOUNCEMENTS
            </h4>
            <button type="button" onClick={() => onNavChange?.('city-manager')} className="text-[11px] font-bold text-emerald-600 hover:underline">View All</button>
          </div>

          <div className="space-y-2.5 text-xs">
            {announcements.length > 0 ? (
              announcements.slice(0, 3).map((notice: any) => (
                <div key={notice.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h5 className="font-extrabold text-slate-900 text-xs truncate">{notice.title}</h5>
                      <span className="text-[9px] text-slate-400 font-mono shrink-0">
                        {notice.created_at ? new Date(notice.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }) : ''}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 line-clamp-2">{notice.body}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
                <p className="font-semibold text-slate-600 text-xs">No announcements</p>
                <p className="text-[10px]">School and City Manager notices for your assigned campus will appear here.</p>
              </div>
            )}
          </div>
        </div>

        {/* Card 3: TODAY'S DESTINATIONS (4 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
              TODAY'S DESTINATIONS
            </h4>
            <button type="button" onClick={() => onNavChange?.('trips')} className="text-[11px] font-bold text-emerald-600 hover:underline">View Route</button>
          </div>

          <div className="space-y-2.5 relative pl-4 border-l-2 border-emerald-500 text-xs">
            {morningList.length > 0 ? (
              morningList.slice(0, 3).map((stu: any, idx: number) => (
                <div key={stu.id || idx} className="relative flex items-center justify-between">
                  <span className="absolute -left-[21px] w-4 h-4 rounded-full bg-purple-600 text-white font-extrabold text-[10px] flex items-center justify-center">{idx + 1}</span>
                  <div>
                    <h5 className="font-extrabold text-slate-900 text-xs">{stu.name}</h5>
                    <p className="text-[10px] text-slate-500 truncate max-w-[150px]">{stu.address}</p>
                  </div>
                  <span className="font-mono text-slate-500 text-[10px] font-semibold">{stu.time || ''}</span>
                </div>
              ))
            ) : (
              <div className="text-slate-400 text-xs py-2">
                No route destinations scheduled today.
              </div>
            )}

            <div className="relative flex items-center justify-between">
              <span className="absolute -left-[21px] w-4 h-4 rounded-full bg-emerald-600 text-white font-extrabold text-[10px] flex items-center justify-center">🎒</span>
              <div>
                <h5 className="font-extrabold text-slate-900 text-xs">School Station</h5>
                <p className="text-[10px] text-slate-500">{schoolName}</p>
              </div>
              <span className="font-mono text-slate-500 text-[10px] font-semibold">Destination</span>
            </div>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 7. BOTTOM CALL-TO-ACTION BANNER */}
      {/* ========================================================================= */}
      <div className="bg-[#081530] rounded-2xl p-4 sm:p-5 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/40 text-amber-300 flex items-center justify-center text-xl shrink-0">
            🛡️
          </div>
          <div>
            <h4 className="font-extrabold text-white text-sm sm:text-base flex items-center gap-2">
              <span>{escortName} · {escortCode}</span>
            </h4>
            <p className="text-slate-300 text-xs font-medium">
              Verified Certified Escort — {schoolName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold">
          <span className="text-slate-300 text-center md:text-right">
            Available for multi-school transit? <br className="hidden sm:block" /> Enable cross-school standby mode.
          </span>

          <button
            type="button"
            onClick={onToggleAvailableForOtherSchools}
            className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 border shadow-md cursor-pointer ${
              isAvailableForOtherSchools
                ? 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-700'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <span>Available for Other Schools</span>
            <div className={`w-8 h-4 rounded-full transition-all relative p-0.5 ${isAvailableForOtherSchools ? 'bg-emerald-300' : 'bg-slate-600'}`}>
              <div className={`w-3 h-3 rounded-full bg-white transition-all shadow-sm ${isAvailableForOtherSchools ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 8. SYSTEM STATUS FOOTER */}
      {/* ========================================================================= */}
      <footer className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center justify-between text-[11px] font-semibold text-slate-500 gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span>System Status</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <strong className="text-slate-800 font-bold">Operational</strong>
          </span>

          <span className="flex items-center gap-1.5">
            <span>GPS</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <strong className="text-slate-800 font-bold">Connected</strong>
          </span>

          <span className="flex items-center gap-1.5">
            <span>Internet</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <strong className="text-slate-800 font-bold">Connected</strong>
          </span>

          <span className="text-slate-400">
            Last Sync: <strong className="text-slate-700 font-mono">{lastSync || '—'}</strong>
          </span>
        </div>

        <div className="font-mono text-slate-400 font-bold">
          MyEduRide v2.5.0
        </div>
      </footer>

    </div>
  );
}
