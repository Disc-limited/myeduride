'use client';

import { useState, useEffect, useMemo } from 'react';
import { Navigation, Bus, ArrowRight, Layers, Plus, Minus, MapPin, Compass, ShieldCheck, Radio } from 'lucide-react';
import LiveJourneyModal from './LiveJourneyModal';
import { useLiveVehiclePosition } from '@/hooks/useLiveVehiclePosition';
import LiveVehicleMap from '@/components/shared/LiveVehicleMap';
import { fetchDrivingRoute } from '@/lib/navigation/road-router';

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
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Live Position Subscription & 60FPS Continuous Motion
  const {
    displayLat,
    displayLng,
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

  const cardPins = useMemo(() => {
    const pins: Array<{ lat: number; lng: number; label?: string; kind?: 'home' | 'school' | 'stop' }> = [];
    if (targetStopLat != null && targetStopLng != null && Number.isFinite(targetStopLat) && Number.isFinite(targetStopLng)) {
      pins.push({
        lat: Number(targetStopLat),
        lng: Number(targetStopLng),
        label: targetStopName || 'Doorstep',
        kind: 'home',
      });
    }
    return pins;
  }, [targetStopLat, targetStopLng, targetStopName]);

  const [roadCoordinates, setRoadCoordinates] = useState<Array<{ lat: number; lng: number }>>([]);

  useEffect(() => {
    let cancelled = false;
    const waypoints: Array<{ lat: number; lng: number }> = [];

    if (displayLat != null && displayLng != null && Number.isFinite(displayLat) && Number.isFinite(displayLng)) {
      waypoints.push({ lat: displayLat, lng: displayLng });
    }
    if (targetStopLat != null && targetStopLng != null && Number.isFinite(targetStopLat) && Number.isFinite(targetStopLng)) {
      waypoints.push({ lat: targetStopLat, lng: targetStopLng });
    }

    if (waypoints.length >= 2) {
      fetchDrivingRoute(waypoints).then((pts) => {
        if (!cancelled && pts.length >= 2) {
          setRoadCoordinates(pts);
        }
      });
    } else {
      setRoadCoordinates([]);
    }

    return () => {
      cancelled = true;
    };
  }, [displayLat, displayLng, targetStopLat, targetStopLng]);

  const effectiveEta = liveEta ?? etaMinutes ?? 8;
  const effectiveSpeed = speedKmh > 0 ? `${Math.round(speedKmh)} km/h` : '38 km/h';

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

        {/* Real Live Leaflet Map Canvas */}
        <div className="relative my-3 rounded-2xl overflow-hidden border border-slate-200 shadow-inner h-[175px] bg-slate-100 group">
          <LiveVehicleMap
            key="parent-card-live-map"
            mapType={mapType}
            heightClassName="h-full"
            className="w-full h-full rounded-2xl border-0"
            vehicleLat={displayLat}
            vehicleLng={displayLng}
            vehicleHeading={displayHeading}
            vehicleSpeedKmh={speedKmh}
            vehicleLabel={vehicleModel || 'EduRide'}
            pins={cardPins}
            routeCoordinates={roadCoordinates.length >= 2 ? roadCoordinates : undefined}
            followVehicle={true}
            hideAttribution={true}
            showZoom={false}
            emptyMessage="Waiting for live vehicle GPS..."
          />

          {/* Floating ETA Callout Badge */}
          <div className="absolute right-2.5 top-2.5 bg-white/95 border border-slate-200/90 shadow-md backdrop-blur-md px-2.5 py-1 rounded-xl text-center z-30 pointer-events-none">
            <span className="text-sm font-black text-slate-900 block leading-none">{effectiveEta}</span>
            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5">
              min away
            </span>
          </div>

          {/* Map Type Switcher */}
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
