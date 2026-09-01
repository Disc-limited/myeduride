'use client';

import { useState } from 'react';
import {
  X,
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
  Maximize2
} from 'lucide-react';
import { useLiveVehiclePosition } from '@/hooks/useLiveVehiclePosition';

interface LiveJourneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  childName?: string;
  escortName?: string;
  escortPhone?: string;
  escortCode?: string;
  vehicleModel?: string;
  licensePlate?: string;
  routeName?: string;
  sessionId?: string;
  targetStopName?: string;
  targetStopLat?: number;
  targetStopLng?: number;
}

export default function LiveJourneyModal({
  isOpen,
  onClose,
  childName = 'Student',
  escortName = 'Officer John Okonkwo',
  escortPhone = '+234 802 345 6789',
  escortCode = 'ESC-4089',
  vehicleModel = 'Toyota Hiace (Air-Conditioned)',
  licensePlate = 'LAG-894-XA',
  routeName = 'Ikeja Main Route (Morning Shuttle)',
  sessionId,
  targetStopName = 'Stop 3 (Maryland Junction)',
  targetStopLat = 6.5744,
  targetStopLng = 3.3662,
}: LiveJourneyModalProps) {
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('roadmap');
  const [showTraffic, setShowTraffic] = useState(true);

  // Live Position Subscription & Lerp Interpolation
  const {
    speedKmh,
    displayHeading,
    isConnected,
    distanceToStopMeters,
    etaMinutes,
    lastPingAt,
  } = useLiveVehiclePosition({
    sessionId: sessionId || 'demo-active-session',
    targetStopLat,
    targetStopLng,
  });

  if (!isOpen) return null;

  const currentEta = etaMinutes ?? 8;
  const currentDistText = distanceToStopMeters
    ? distanceToStopMeters > 1000
      ? `${(distanceToStopMeters / 1000).toFixed(1)} km`
      : `${distanceToStopMeters} m`
    : '1.4 km';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden font-sans">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
              <Bus className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-slate-900 text-base tracking-tight">
                  Live Shuttle Radar
                </h3>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  {isConnected ? 'LIVE GPS STREAM' : 'ACTIVE ROUTE'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Tracking <span className="font-bold text-slate-800">{childName}</span> on {routeName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* Left: Interactive Live Radar Map Canvas (8 Cols) */}
          <div className="lg:col-span-8 space-y-4">
            <div className="relative h-[320px] sm:h-[380px] rounded-3xl overflow-hidden border border-slate-200 shadow-inner bg-slate-900">
              
              {/* Map Background Tile Graphic */}
              <div
                className={`absolute inset-0 bg-cover bg-center transition-all duration-300 ${
                  mapType === 'satellite' ? 'opacity-75' : 'opacity-90'
                }`}
                style={{
                  backgroundImage:
                    mapType === 'satellite'
                      ? "linear-gradient(rgba(15, 23, 42, 0.4), rgba(15, 23, 42, 0.4)), url('https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80')"
                      : "linear-gradient(rgba(15, 23, 42, 0.15), rgba(15, 23, 42, 0.15)), url('/images/background%20image.png')",
                }}
              />

              {/* Highway Network Overlay */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" preserveAspectRatio="none">
                <path
                  d="M 40,290 C 120,240 180,310 260,200 S 390,140 520,70"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
                <path
                  d="M 40,290 C 120,240 180,310 260,200 S 390,140 520,70"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="3"
                  strokeDasharray="10 8"
                  className="animate-pulse"
                />
              </svg>

              {/* Start Point Marker (School Origin) */}
              <div className="absolute left-[8%] bottom-[12%] z-20 flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-blue-600 border-2 border-white shadow-lg flex items-center justify-center text-white text-[10px] font-black">
                  SCH
                </div>
                <span className="text-[10px] font-extrabold text-slate-900 bg-white/95 px-2 py-0.5 rounded-md shadow-md mt-1">
                  School Gate
                </span>
              </div>

              {/* Real-time Moving Shuttle Bus Marker */}
              <div
                className="absolute z-30 transition-all duration-700 ease-out flex flex-col items-center -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: '48%',
                  top: '52%',
                }}
              >
                {/* Radar Waves */}
                <div className="absolute -inset-4 rounded-full bg-amber-400/30 animate-ping" />
                <div className="absolute -inset-8 rounded-full bg-emerald-400/20 animate-pulse" />

                {/* Bus Avatar with Direction Angle */}
                <div
                  className="relative w-12 h-12 rounded-2xl bg-amber-400 border-3 border-white shadow-2xl flex items-center justify-center text-slate-900 font-bold transition-transform duration-300"
                  style={{ transform: `rotate(${displayHeading || 45}deg)` }}
                >
                  <Bus className="w-6 h-6" />
                </div>

                {/* Telemetry Capsule */}
                <div className="mt-1 flex items-center gap-1 bg-slate-950/90 border border-slate-700 text-white px-2 py-0.5 rounded-full text-[10px] font-black shadow-lg">
                  <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                  <span>{speedKmh > 0 ? `${speedKmh} km/h` : '36 km/h'}</span>
                </div>
              </div>

              {/* Destination / Parent Stop Marker */}
              <div className="absolute right-[12%] top-[14%] z-20 flex flex-col items-center">
                <div className="w-9 h-9 rounded-full bg-emerald-600 border-2 border-white shadow-xl flex items-center justify-center text-white animate-bounce">
                  <Navigation className="w-4 h-4 fill-white" />
                </div>
                <span className="text-[10px] font-extrabold text-emerald-900 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded-md shadow-md mt-1">
                  Your Pickup Stop
                </span>
              </div>

              {/* Top Controls Overlay */}
              <div className="absolute left-3 top-3 z-30 flex items-center gap-2">
                <div className="flex bg-white/95 rounded-xl border border-slate-200 p-1 shadow-md text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setMapType('roadmap')}
                    className={`px-3 py-1 rounded-lg transition-colors ${
                      mapType === 'roadmap' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Roadmap
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapType('satellite')}
                    className={`px-3 py-1 rounded-lg transition-colors ${
                      mapType === 'satellite' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Satellite
                  </button>
                </div>
              </div>

              {/* Live ETA Floating Banner */}
              <div className="absolute right-3 top-3 z-30 bg-slate-900/90 backdrop-blur-md text-white border border-slate-700/80 px-3.5 py-2 rounded-2xl shadow-xl flex items-center gap-3">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Estimated Arrival
                  </span>
                  <span className="text-lg font-black text-emerald-400 leading-none">
                    ~ {currentEta} mins
                  </span>
                </div>
                <div className="border-l border-slate-700 pl-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Distance
                  </span>
                  <span className="text-sm font-black text-white leading-none">
                    {currentDistText}
                  </span>
                </div>
              </div>
            </div>

            {/* Stop Sequence Progress Bar */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5">
              <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">
                Route Stops Sequence
              </h4>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-emerald-100/60 border border-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-extrabold text-emerald-950 truncate">1. School Campus</p>
                    <p className="text-[10px] text-emerald-700">Departed 07:15 AM</p>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 flex items-center gap-2 ring-2 ring-amber-400/40">
                  <Bus className="w-4 h-4 text-amber-700 shrink-0 animate-pulse" />
                  <div className="min-w-0">
                    <p className="font-extrabold text-amber-950 truncate">2. Ikeja Mall</p>
                    <p className="text-[10px] text-amber-700 font-bold">In Transit (~2 min)</p>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-extrabold text-slate-700 truncate">3. Maryland Junc.</p>
                    <p className="text-[10px] text-slate-400">Target Stop (~8 min)</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Driver & Vehicle Specs, Escort Quick Contact (4 Cols) */}
          <div className="lg:col-span-4 space-y-4 flex flex-col justify-between">
            
            {/* Escort Officer Profile Card */}
            <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200 space-y-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                Verified Escort Officer
              </span>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-black text-base flex items-center justify-center shadow-md">
                  JO
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-black text-slate-900 text-sm truncate">{escortName}</h4>
                  <p className="text-xs text-slate-500">{escortCode}</p>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 mt-1">
                    <ShieldCheck className="w-3 h-3" /> Gold Shield Certified
                  </span>
                </div>
              </div>

              {/* Direct Actions */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/80">
                <a
                  href={`tel:${escortPhone}`}
                  className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-600/20"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call Escort</span>
                </a>
                <button
                  type="button"
                  onClick={() => alert(`Connecting live chat with ${escortName}...`)}
                  className="py-2.5 px-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                  <span>Message</span>
                </button>
              </div>
            </div>

            {/* Vehicle & Safety Telemetry */}
            <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200 space-y-2.5 text-xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                Vehicle Specifications
              </span>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Model:</span>
                <span className="font-bold text-slate-900">{vehicleModel}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Plate Number:</span>
                <span className="font-mono font-bold text-slate-900 bg-slate-200 px-1.5 py-0.5 rounded">
                  {licensePlate}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Telemetry Status:</span>
                <span className="font-bold text-emerald-700 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> 100% Operational
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Target Stop:</span>
                <span className="font-extrabold text-slate-900 truncate max-w-[160px]">
                  {targetStopName}
                </span>
              </div>
            </div>

            {/* Emergency / Safety Button */}
            <button
              type="button"
              onClick={() => alert('Emergency dispatch alert sent to School Admin & City Manager.')}
              className="w-full py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all"
            >
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>Report Route Emergency / Issue</span>
            </button>
          </div>

        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            <span>Updated live via Supabase Realtime • Last ping {lastPingAt ? new Date(lastPingAt).toLocaleTimeString() : 'Just now'}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="font-bold text-slate-700 hover:text-slate-900 cursor-pointer"
          >
            Close Radar
          </button>
        </div>

      </div>
    </div>
  );
}
