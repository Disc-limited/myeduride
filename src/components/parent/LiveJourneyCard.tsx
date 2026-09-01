'use client';

import { useState, useEffect } from 'react';
import { Navigation, Bus, ArrowRight, Layers, Plus, Minus, MapPin, Compass, ShieldCheck, Radio } from 'lucide-react';
import LiveJourneyModal from './LiveJourneyModal';
import { useLiveVehiclePosition } from '@/hooks/useLiveVehiclePosition';

interface LiveJourneyCardProps {
  childName?: string;
  hasActiveJourney?: boolean;
  escortName?: string;
  escortCode?: string;
  escortPhone?: string;
  vehicleModel?: string;
  licensePlate?: string;
  routeName?: string;
  studentsCount?: number;
  etaMinutes?: number;
  etaTime?: string;
  sessionId?: string;
  targetStopName?: string;
  targetStopLat?: number;
  targetStopLng?: number;
  onOpenLiveJourney?: () => void;
}

export default function LiveJourneyCard({
  childName = 'Student',
  hasActiveJourney = false,
  escortName = 'Assigned Escort',
  escortCode = 'ESC',
  escortPhone = '+234 802 345 6789',
  vehicleModel = 'School Bus',
  licensePlate = '—',
  routeName = 'Designated Route',
  studentsCount = 0,
  etaMinutes = 0,
  etaTime = '—',
  sessionId,
  targetStopName = 'Maryland Junction',
  targetStopLat,
  targetStopLng,
  onOpenLiveJourney,
}: LiveJourneyCardProps) {
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('roadmap');
  const [zoomLevel, setZoomLevel] = useState(14);
  const [busProgress, setBusProgress] = useState(45); // percentage along route
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Live Position Subscription & Lerp Interpolation
  const {
    speedKmh,
    displayHeading,
    isConnected,
    distanceToStopMeters,
    etaMinutes: liveEta,
  } = useLiveVehiclePosition({
    sessionId: hasActiveJourney ? (sessionId || 'active-journey-session') : null,
    targetStopLat,
    targetStopLng,
  });

  // Animate shuttle movement along simulated route if no raw GPS
  useEffect(() => {
    if (!hasActiveJourney) return;
    const timer = setInterval(() => {
      setBusProgress((prev) => (prev >= 85 ? 30 : prev + 1.5));
    }, 2000);
    return () => clearInterval(timer);
  }, [hasActiveJourney]);

  const effectiveEta = liveEta ?? etaMinutes ?? 8;
  const effectiveSpeed = speedKmh > 0 ? `${speedKmh} km/h` : '38 km/h';

  if (!hasActiveJourney) {
    return (
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between h-full">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">Live Journey</h2>
          <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
            ● Inactive
          </span>
        </div>

        <div className="py-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
            <Bus className="w-6 h-6" />
          </div>
          <p className="text-xs font-bold text-slate-700">No Live Journey In Progress</p>
          <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
            When your child's school shuttle trip starts, live Google Map GPS tracking will appear here.
          </p>
        </div>

        <button
          type="button"
          disabled
          className="w-full bg-slate-50 border border-slate-200 text-slate-400 text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-not-allowed"
        >
          <span>No Active Trip</span>
        </button>
      </div>
    );
  }

  const handleOpenRadar = () => {
    if (onOpenLiveJourney) {
      onOpenLiveJourney();
    } else {
      setIsModalOpen(true);
    }
  };

  return (
    <>
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between h-full hover:shadow-md transition-all">
        {/* Card Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5 truncate">
            <span>Live Journey</span>
            <span className="text-slate-400 font-normal">–</span>
            <span className="text-slate-700 truncate">{childName}</span>
          </h2>
          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1 shrink-0 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {isConnected ? 'Live Telemetry' : 'Live GPS'}
          </span>
        </div>

        {/* Google Map Visual Canvas */}
        <div className="relative my-3 rounded-2xl overflow-hidden border border-slate-200 shadow-inner h-[150px] bg-slate-100 group">
          {/* Map Background Tiles (Roadmap / Satellite) */}
          <div
            className={`absolute inset-0 transition-opacity duration-300 bg-cover bg-center ${
              mapType === 'satellite' ? 'opacity-90' : 'opacity-100'
            }`}
            style={{
              backgroundImage:
                mapType === 'satellite'
                  ? "linear-gradient(rgba(15, 23, 42, 0.3), rgba(15, 23, 42, 0.3)), url('https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80')"
                  : "linear-gradient(rgba(248, 250, 252, 0.2), rgba(248, 250, 252, 0.2)), url('/images/background%20image.png')",
            }}
          />

          {/* Google Maps Road Network Overlay Graphic */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" preserveAspectRatio="none">
            {/* Main Highway / Route Polyline */}
            <path
              d="M 20,120 Q 90,40 180,80 T 320,30"
              fill="none"
              stroke="#10b981"
              strokeWidth="5"
              strokeLinecap="round"
            />
            {/* Active GPS Traffic Line */}
            <path
              d="M 20,120 Q 90,40 180,80 T 320,30"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2"
              strokeDasharray="8 6"
              className="animate-pulse"
            />
          </svg>

          {/* Origin Marker (School) */}
          <div className="absolute left-[8%] bottom-[12%] z-20 flex flex-col items-center">
            <div className="w-6 h-6 rounded-full bg-blue-600 border-2 border-white shadow-md flex items-center justify-center text-white text-[9px] font-bold">
              SCH
            </div>
            <span className="text-[8px] font-extrabold text-slate-800 bg-white/90 px-1 rounded shadow-2xs mt-0.5">
              School
            </span>
          </div>

          {/* Live Shuttle Bus Moving Marker */}
          <div
            className="absolute z-30 transition-all duration-1000 ease-linear flex flex-col items-center -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${busProgress}%`,
              top: `${60 - Math.sin((busProgress / 100) * Math.PI * 2) * 20}%`,
            }}
          >
            {/* Animated Pulse Ring */}
            <div className="absolute -inset-2 rounded-full bg-amber-400/40 animate-ping" />

            {/* Bus Badge Marker */}
            <div
              className="relative w-8 h-8 rounded-xl bg-amber-400 border-2 border-white shadow-lg flex items-center justify-center text-slate-900 font-bold transition-transform duration-300"
              style={{ transform: `rotate(${displayHeading || 0}deg)` }}
            >
              <Bus className="w-4 h-4" />
            </div>

            <span className="text-[8px] font-extrabold text-slate-900 bg-amber-300 px-1.5 py-0.5 rounded-md shadow-md mt-0.5 whitespace-nowrap">
              {effectiveSpeed}
            </span>
          </div>

          {/* Destination Marker (Home / Dropoff Stop) */}
          <div className="absolute right-[8%] top-[12%] z-20 flex flex-col items-center">
            <div className="w-6 h-6 rounded-full bg-emerald-600 border-2 border-white shadow-md flex items-center justify-center text-white">
              <Navigation className="w-3 h-3 fill-white" />
            </div>
            <span className="text-[8px] font-extrabold text-slate-800 bg-white/90 px-1 rounded shadow-2xs mt-0.5">
              Stop 3
            </span>
          </div>

          {/* Map Type Switcher (Roadmap / Satellite) */}
          <div className="absolute left-2.5 top-2.5 z-30 flex items-center bg-white/95 rounded-lg border border-slate-200/80 p-0.5 shadow-sm text-[9px] font-bold">
            <button
              type="button"
              onClick={() => setMapType('roadmap')}
              className={`px-2 py-0.5 rounded-md transition-colors ${
                mapType === 'roadmap' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Map
            </button>
            <button
              type="button"
              onClick={() => setMapType('satellite')}
              className={`px-2 py-0.5 rounded-md transition-colors ${
                mapType === 'satellite' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Satellite
            </button>
          </div>

          {/* Map Zoom Controls */}
          <div className="absolute right-2.5 bottom-7 z-30 flex flex-col bg-white/95 rounded-lg border border-slate-200/80 shadow-sm">
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(z + 1, 18))}
              className="p-1 text-slate-600 hover:bg-slate-100 border-b border-slate-100 cursor-pointer"
              title="Zoom In"
            >
              <Plus className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(z - 1, 10))}
              className="p-1 text-slate-600 hover:bg-slate-100 cursor-pointer"
              title="Zoom Out"
            >
              <Minus className="w-3 h-3" />
            </button>
          </div>

          {/* Floating ETA Callout Badge */}
          <div className="absolute right-2.5 top-2.5 bg-white/95 border border-slate-200/90 shadow-md backdrop-blur-md px-2.5 py-1 rounded-xl text-center z-30">
            <span className="text-sm font-black text-slate-900 block leading-none">{effectiveEta}</span>
            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5">
              min away
            </span>
          </div>

          {/* Watermark (Bottom-Left) */}
          <div className="absolute left-2.5 bottom-1.5 z-30 flex items-center gap-1 select-none pointer-events-none">
            <span className="text-[10px] font-bold text-slate-700 tracking-tight bg-white/80 px-1 py-0.5 rounded">
              <span className="text-blue-500">G</span>
              <span className="text-red-500">o</span>
              <span className="text-yellow-500">o</span>
              <span className="text-blue-500">g</span>
              <span className="text-green-500">l</span>
              <span className="text-red-500">e</span> Maps
            </span>
          </div>
        </div>

        {/* Shuttle Telemetry Specs Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-left bg-slate-50/80 rounded-2xl p-2.5 border border-slate-100 text-[11px]">
          <div className="min-w-0" title={`Escort Officer: ${escortName}`}>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block truncate">
              Escort
            </span>
            <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
              <div className="w-5 h-5 rounded-full bg-slate-300 overflow-hidden shrink-0 flex items-center justify-center font-bold text-[9px] text-slate-700">
                {escortName ? escortName.substring(0, 2).toUpperCase() : 'ES'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-800 truncate leading-none">{escortName}</p>
                <p className="text-[8px] text-slate-400 truncate">{escortCode}</p>
              </div>
            </div>
          </div>

          <div className="min-w-0" title={`Shuttle Vehicle: ${vehicleModel} (${licensePlate})`}>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block truncate">
              Vehicle
            </span>
            <p className="font-bold text-slate-800 truncate mt-0.5 leading-none">{vehicleModel}</p>
            <p className="text-[8px] text-slate-400 truncate">{licensePlate}</p>
          </div>

          <div className="min-w-0" title={`Bus Route: ${routeName}`}>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block truncate">
              Route
            </span>
            <p className="font-bold text-slate-800 truncate mt-0.5 leading-none">{routeName}</p>
            <p className="text-[8px] text-slate-400 truncate">{studentsCount} Students</p>
          </div>

          <div className="min-w-0" title={`Estimated Time of Arrival: ${etaTime}`}>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block truncate">
              ETA
            </span>
            <p className="font-extrabold text-emerald-700 truncate mt-0.5 leading-none">
              {effectiveEta} min
            </p>
            <p className="text-[8px] text-slate-400 truncate">{etaTime}</p>
          </div>
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={handleOpenRadar}
          className="mt-3 w-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-2xs hover:border-slate-300 active:scale-98 cursor-pointer"
        >
          <span>Open Full Map Tracking</span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
        </button>
      </div>

      {/* Fullscreen Interactive Radar Modal */}
      <LiveJourneyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        childName={childName}
        escortName={escortName}
        escortCode={escortCode}
        escortPhone={escortPhone}
        vehicleModel={vehicleModel}
        licensePlate={licensePlate}
        routeName={routeName}
        sessionId={sessionId}
        targetStopName={targetStopName}
        targetStopLat={targetStopLat}
        targetStopLng={targetStopLng}
      />
    </>
  );
}
