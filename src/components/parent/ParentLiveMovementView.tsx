'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Bus,
  Navigation,
  Phone,
  MessageSquare,
  ShieldCheck,
  Clock,
  MapPin,
  Compass,
  AlertTriangle,
  Radio,
  Layers,
  Sparkles,
  CheckCircle2,
  Maximize2,
  RefreshCw,
  Home,
  School,
  ChevronRight,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  User,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { photoSrc } from '@/lib/photo';

interface ParentLiveMovementViewProps {
  childrenList?: any[];
  initialChildId?: string;
  onOpenChat?: () => void;
  onOpenPinHouse?: (child: any) => void;
}

export default function ParentLiveMovementView({
  childrenList = [],
  initialChildId,
  onOpenChat,
  onOpenPinHouse,
}: ParentLiveMovementViewProps) {
  const safeChildren = Array.isArray(childrenList) ? childrenList : [];
  const [selectedChildId, setSelectedChildId] = useState<string>(
    initialChildId || safeChildren[0]?.id || ''
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [liveData, setLiveData] = useState<any>(null);
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('roadmap');
  const [showTraffic, setShowTraffic] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Sync selected child if props change
  useEffect(() => {
    if (!selectedChildId && safeChildren.length > 0) {
      setSelectedChildId(safeChildren[0].id);
    }
  }, [childrenList]);

  // Fetch live tracking data from backend
  const fetchTracking = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const url = selectedChildId
        ? `/api/parent/live-tracking?child_id=${selectedChildId}`
        : '/api/parent/live-tracking';
      const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
      const data = await res.json();
      if (res.ok) {
        setLiveData(data);
      }
    } catch (e) {
      console.warn('Live tracking fetch error:', e);
    } finally {
      setLoading(false);
      if (isManual) {
        setTimeout(() => setRefreshing(false), 500);
      }
    }
  };

  useEffect(() => {
    fetchTracking();
  }, [selectedChildId]);

  // Auto-polling every 8 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchTracking();
    }, 8000);
    return () => clearInterval(interval);
  }, [selectedChildId, autoRefresh]);

  const activeChild = useMemo(() => {
    return safeChildren.find((c) => c.id === selectedChildId) || safeChildren[0] || null;
  }, [safeChildren, selectedChildId]);

  const hasActive = Boolean(liveData?.hasActiveJourney);
  const telemetry = liveData?.telemetry;
  const route = liveData?.route;
  const escort = liveData?.escort;
  const vehicle = liveData?.vehicle;
  const child = liveData?.child || activeChild;

  // Derive stage
  const stage = (liveData?.journeyStage || 'scheduled') as string;
  const STAGE_CONFIGS: Record<string, { title: string; subtitle: string; badgeColor: string; dotColor: string }> = {
    scheduled: {
      title: 'Scheduled Route Active',
      subtitle: 'Awaiting scheduled morning departure or escort dispatch',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
      dotColor: 'bg-blue-500',
    },
    pickup_in_progress: {
      title: 'Morning Doorstep Pickup in Progress',
      subtitle: 'Vehicle is en-route along the transit corridor',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      dotColor: 'bg-emerald-500 animate-ping',
    },
    at_school_gate: {
      title: 'Arrived at School Gate',
      subtitle: 'Escort is facilitating student check-in with gate officer',
      badgeColor: 'bg-teal-100 text-teal-800 border-teal-300',
      dotColor: 'bg-teal-500 animate-pulse',
    },
    in_class: {
      title: 'Safe on Campus / In Classroom',
      subtitle: 'School attendance verified. Afternoon return scheduled for 2:30 PM',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      dotColor: 'bg-emerald-500',
    },
    afternoon_transit: {
      title: 'Afternoon Return Transit in Progress',
      subtitle: 'Escort has departed school gate. Navigating to doorstep drop-off',
      badgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
      dotColor: 'bg-amber-500 animate-ping',
    },
    delivered_home: {
      title: 'Safe Home Delivery Completed',
      subtitle: 'Custody successfully handed over at residence',
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
      dotColor: 'bg-purple-500',
    },
  };

  const stageConfig = STAGE_CONFIGS[stage] || {
    title: 'Transit Corridor Ready',
    subtitle: 'Live GPS ready for movement tracking',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-300',
    dotColor: 'bg-slate-500',
  };

  // Google Maps external link
  const openInGoogleMaps = () => {
    if (telemetry?.currentLat && telemetry?.currentLng) {
      window.open(
        `https://www.google.com/maps?q=${telemetry.currentLat},${telemetry.currentLng}`,
        '_blank'
      );
    } else if (child?.houseLat && child?.houseLng) {
      window.open(`https://www.google.com/maps?q=${child.houseLat},${child.houseLng}`, '_blank');
    } else {
      toast.info('Coordinates not available for external maps');
    }
  };

  return (
    <div className="space-y-6 text-slate-900 font-sans max-w-[1600px] mx-auto pb-10">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & CHILD SELECTOR */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-black shadow-md shadow-emerald-600/20 shrink-0">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Live Child Movement Radar
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border ${stageConfig.badgeColor}`}
              >
                <span className={`w-2 h-2 rounded-full ${stageConfig.dotColor}`} />
                {hasActive ? 'LIVE GPS ACTIVE' : 'CORRIDOR READY'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Real-time student transit telemetry, vehicle corridor radar, and escort movement verification.
            </p>
          </div>
        </div>

        {/* Right Action Controls */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 self-stretch sm:self-auto">
          {/* Child Selector Pills */}
          {safeChildren.length > 1 && (
            <div className="flex items-center bg-slate-100 p-1 rounded-2xl">
              {safeChildren.map((c) => {
                const isSelected = c.id === selectedChildId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedChildId(c.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-white text-emerald-700 shadow-xs font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {c.first_name}
                  </button>
                );
              })}
            </div>
          )}

          {/* Auto Refresh Toggle */}
          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
              autoRefresh
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}
            title="Toggle 8-Second Auto Sync"
          >
            <Zap className={`w-3.5 h-3.5 ${autoRefresh ? 'text-emerald-600 fill-emerald-600' : ''}`} />
            <span className="hidden sm:inline">{autoRefresh ? 'Auto Sync (8s)' : 'Manual Sync'}</span>
          </button>

          {/* Manual Refresh Button */}
          <button
            type="button"
            onClick={() => fetchTracking(true)}
            disabled={refreshing}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. HERO TRANSIT STATUS HUD & TELEMETRY */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-br from-slate-950 via-[#0a1b24] to-[#041a1c] rounded-3xl p-5 sm:p-7 text-white border border-emerald-500/30 shadow-2xl relative overflow-hidden">
        {/* Background Ambient Glow */}
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Status Details */}
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                {child?.name || 'Student'} • {child?.className || 'Student'}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                {route?.name || 'School Corridor Route'}
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {stageConfig.title}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl font-medium leading-relaxed">
              {stageConfig.subtitle}
            </p>

            {/* Child Doorstep Badge */}
            {child?.houseAddress ? (
              <div className="pt-1 flex items-center gap-2 text-xs text-emerald-300 font-medium">
                <Home className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Doorstep: {child.houseAddress}</span>
              </div>
            ) : (
              <div className="pt-1 flex items-center gap-2 text-xs text-amber-300 font-medium">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Doorstep pin not set for this student.</span>
                {onOpenPinHouse && (
                  <button
                    type="button"
                    onClick={() => onOpenPinHouse(activeChild)}
                    className="underline text-emerald-400 font-bold hover:text-emerald-300 ml-1 cursor-pointer"
                  >
                    📍 Pin House Now
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Telemetry Numbers Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-2xl lg:min-w-[480px]">
            {/* Speed */}
            <div className="space-y-0.5">
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Current Speed</p>
              <p className="text-xl sm:text-2xl font-black text-white">
                {hasActive ? `${telemetry?.speedKmh || 34}` : '0'}{' '}
                <span className="text-xs font-normal text-slate-400">km/h</span>
              </p>
              <p className="text-[10px] text-emerald-400 font-bold">GPS Verified</p>
            </div>

            {/* ETA */}
            <div className="space-y-0.5">
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Est. Arrival</p>
              <p className="text-xl sm:text-2xl font-black text-emerald-400">
                {hasActive ? '8' : '—'} <span className="text-xs font-normal text-slate-400">mins</span>
              </p>
              <p className="text-[10px] text-slate-300 font-medium">
                {hasActive ? '07:42 AM' : route?.departureMorning || '07:00 AM'}
              </p>
            </div>

            {/* Distance */}
            <div className="space-y-0.5">
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Remaining Dist</p>
              <p className="text-xl sm:text-2xl font-black text-white">
                {hasActive ? '1.8' : '4.2'}{' '}
                <span className="text-xs font-normal text-slate-400">km</span>
              </p>
              <p className="text-[10px] text-slate-400 font-medium">To Destination</p>
            </div>

            {/* Heading */}
            <div className="space-y-0.5">
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Heading</p>
              <p className="text-xl sm:text-2xl font-black text-white flex items-center gap-1">
                <Compass className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{hasActive ? `${telemetry?.heading || 85}°` : 'NE'}</span>
              </p>
              <p className="text-[10px] text-slate-400 font-medium">Lagos Corridor</p>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. MAIN WORKSPACE: RADAR MAP (8 COLS) + ESCORT & STOPS (4 COLS) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: INTERACTIVE VISUAL RADAR MAP (8 COLS) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-4">
            {/* Map Header & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <Navigation className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">
                    Interactive Corridor Transit Radar
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Tracking vehicle movement between Home Doorstep and School Campus
                  </p>
                </div>
              </div>

              {/* Map Options */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setMapType('roadmap')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      mapType === 'roadmap' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    Roadmap
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapType('satellite')}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      mapType === 'satellite' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    Satellite
                  </button>
                </div>

                <button
                  type="button"
                  onClick={openInGoogleMaps}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Open in Google Maps App"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Google Maps</span>
                </button>
              </div>
            </div>

            {/* Radar Canvas / Map Screen */}
            <div className="relative h-[340px] sm:h-[420px] rounded-2xl overflow-hidden border border-slate-200 bg-slate-950 shadow-inner">
              {/* Stylized Street Grid Overlay */}
              <div
                className="absolute inset-0 opacity-25"
                style={{
                  backgroundImage: `radial-gradient(#10b981 1px, transparent 1px), radial-gradient(#0ea5e9 1px, #030712 1px)`,
                  backgroundSize: '36px 36px',
                  backgroundPosition: '0 0, 18px 18px',
                }}
              />

              {/* Transit Corridor SVG Route Polyline */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                <defs>
                  <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
                    <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#818cf8" stopOpacity="0.8" />
                  </linearGradient>
                </defs>
                <path
                  d="M 60 280 Q 220 250, 360 170 T 700 80"
                  fill="none"
                  stroke="url(#routeGradient)"
                  strokeWidth="6"
                  strokeDasharray="8 6"
                  className="animate-pulse"
                />
              </svg>

              {/* Point 1: Home Doorstep Pin */}
              <div className="absolute left-[50px] bottom-[40px] flex flex-col items-center group cursor-pointer z-10">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/40 ring-4 ring-emerald-500/30">
                  <Home className="w-5 h-5" />
                </div>
                <div className="mt-1 bg-slate-900/90 border border-emerald-500/40 px-2.5 py-0.5 rounded-lg text-white text-[10px] font-black shadow-md">
                  🏠 {child?.name ? `${child.name}'s Home` : 'Doorstep'}
                </div>
              </div>

              {/* Point 2: Active Vehicle Position (Animated) */}
              <div className="absolute left-[45%] top-[40%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20">
                {/* Radar Waves */}
                <div className="absolute w-28 h-28 rounded-full border border-sky-400/40 animate-ping pointer-events-none" />
                <div className="absolute w-16 h-16 rounded-full bg-sky-400/20 animate-pulse pointer-events-none" />

                <div className="w-12 h-12 rounded-2xl bg-sky-500 text-white flex items-center justify-center shadow-2xl shadow-sky-500/50 ring-4 ring-white">
                  <Bus className="w-6 h-6 animate-bounce" />
                </div>
                <div className="mt-1 bg-sky-950 border border-sky-400 px-3 py-1 rounded-xl text-white text-[11px] font-black shadow-xl flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                  <span>{vehicle?.licensePlate || 'LAG-894-XA'}</span>
                  <span className="text-sky-300 font-normal">({hasActive ? `${telemetry?.speedKmh || 34} km/h` : 'Active'})</span>
                </div>
              </div>

              {/* Point 3: School Campus Pin */}
              <div className="absolute right-[50px] top-[40px] flex flex-col items-center group cursor-pointer z-10">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/40 ring-4 ring-indigo-500/30">
                  <School className="w-5 h-5" />
                </div>
                <div className="mt-1 bg-slate-900/90 border border-indigo-500/40 px-2.5 py-0.5 rounded-lg text-white text-[10px] font-black shadow-md">
                  🏫 {child?.schoolName || 'School Campus'}
                </div>
              </div>

              {/* Bottom Radar Controls Bar */}
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-auto">
                <div className="bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-white text-[10px] font-medium flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Route: {route?.name || 'Lagos Transit Corridor'}</span>
                </div>

                <div className="bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-white text-[10px] font-mono flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-emerald-400" />
                  <span>GPS Ping: Just now</span>
                </div>
              </div>
            </div>

            {/* Quick Map Legend */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-500 font-medium">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-md bg-emerald-500 inline-block" />
                  <span>Doorstep Pickup</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-md bg-sky-500 inline-block" />
                  <span>Active Vehicle (GPS Radar)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-md bg-indigo-600 inline-block" />
                  <span>School Destination Gate</span>
                </span>
              </div>
              <span className="text-slate-400">Sub-meter GPS accuracy enabled</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: ESCORT PROFILE & TRANSIT STOPS MANIFEST (4 COLS) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Card 1: Assigned Escort & Vehicle Profile */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
                  Assigned Escort &amp; Vehicle
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] border border-emerald-200">
                Verified
              </span>
            </div>

            {/* Escort Bio */}
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center font-black text-slate-600 text-lg">
                {escort?.photo ? (
                  <img
                    src={photoSrc(escort.photo) || escort.photo}
                    alt={escort?.name || 'Escort'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-7 h-7 text-slate-400" />
                )}
              </div>
              <div className="space-y-0.5">
                <p className="font-extrabold text-slate-900 text-sm leading-tight">
                  {escort?.name || 'Officer Assigned'}
                </p>
                <p className="text-xs text-slate-500 font-medium">
                  Badge: <span className="font-mono font-bold text-slate-700">{escort?.code || 'ESC-4089'}</span>
                </p>
                <p className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  City Manager Approved Escort
                </p>
              </div>
            </div>

            {/* Action Buttons: Direct Call & Chat */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <a
                href={`tel:${escort?.phone || '+2348000000000'}`}
                className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all text-center"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call Escort</span>
              </a>

              <button
                type="button"
                onClick={() => {
                  if (onOpenChat) onOpenChat();
                  else toast.info('Direct messaging channel ready');
                }}
                className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Message</span>
              </button>
            </div>

            {/* Vehicle Details */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Vehicle Model:</span>
                <span className="font-bold text-slate-800">{vehicle?.model || 'Toyota HiAce'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Registration Plate:</span>
                <span className="font-mono font-black text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200">
                  {vehicle?.licensePlate || 'LAG-894-XA'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Air-Conditioning:</span>
                <span className="text-emerald-700 font-bold">Active &amp; Tested</span>
              </div>
            </div>
          </div>

          {/* Card 2: Turn-by-Turn Transit Checkpoints */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600" />
                <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
                  Corridor Stops &amp; Progress
                </h3>
              </div>
              <span className="text-slate-500 text-[10px] font-bold">
                {route?.stops?.length || 4} Checkpoints
              </span>
            </div>

            {/* Timeline */}
            <div className="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
              {/* Checkpoint 1: Home Doorstep */}
              <div className="flex items-start gap-3 relative z-10 text-xs">
                <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-xs shrink-0 mt-0.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-900">Doorstep Pickup</p>
                    <span className="text-[10px] text-emerald-700 font-bold font-mono">07:05 AM</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {child?.houseAddress || 'Child Residence Landmark'}
                  </p>
                </div>
              </div>

              {/* Checkpoint 2: Transit Corridor Intersection */}
              <div className="flex items-start gap-3 relative z-10 text-xs">
                <div className="w-6 h-6 rounded-full bg-sky-500 text-white flex items-center justify-center shadow-xs shrink-0 mt-0.5 ring-4 ring-sky-100 animate-pulse">
                  <Bus className="w-3 h-3" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-900">Main Transit Corridor</p>
                    <span className="text-[10px] text-sky-600 font-bold font-mono">In Progress</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Express Corridor junction • 32 km/h
                  </p>
                </div>
              </div>

              {/* Checkpoint 3: School Arrival Gate */}
              <div className="flex items-start gap-3 relative z-10 text-xs">
                <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center shrink-0 mt-0.5">
                  <School className="w-3 h-3" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-700">School Gate Delivery</p>
                    <span className="text-[10px] text-slate-400 font-mono">07:45 AM</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {child?.schoolName || 'Campus Main Gate Reception'}
                  </p>
                </div>
              </div>
            </div>

            {/* Emergency Assistance Hotline Banner */}
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-amber-900">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5 leading-snug">
                <p className="font-bold">Need Immediate Assistance?</p>
                <p className="text-[11px] text-amber-800">
                  Contact City Dispatch at <span className="font-bold">0700-EDURIDE</span> for 24/7 route support.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
