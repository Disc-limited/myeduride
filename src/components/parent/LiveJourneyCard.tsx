'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Navigation,
  Bus,
  ArrowRight,
  Layers,
  MapPin,
  Compass,
  ShieldCheck,
  Radio,
  School,
  Home,
  CheckCircle2
} from 'lucide-react';
import LiveJourneyModal from './LiveJourneyModal';
import { useLiveVehiclePosition } from '@/hooks/useLiveVehiclePosition';
import LiveVehicleMap from '@/components/shared/LiveVehicleMap';
import { fetchDrivingRoute } from '@/lib/navigation/road-router';

interface LiveJourneyCardProps {
  childName?: string;
  schoolName?: string;
  schoolAddress?: string;
  schoolLat?: number | null;
  schoolLng?: number | null;
  houseAddress?: string | null;
  houseLat?: number | null;
  houseLng?: number | null;
  hasActiveJourney?: boolean;
  journeyStage?: string;
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
  targetStopLat?: number | null;
  targetStopLng?: number | null;
  stops?: any[];
  onOpenLiveJourney?: () => void;
}

export default function LiveJourneyCard({
  childName = '',
  schoolName = '',
  schoolAddress = '',
  schoolLat,
  schoolLng,
  houseAddress = '',
  houseLat,
  houseLng,
  hasActiveJourney = false,
  journeyStage = 'scheduled',
  escortName = '',
  escortCode = '',
  escortPhone = '',
  vehicleModel = '',
  licensePlate = '',
  routeName = '',
  studentsCount = 0,
  etaMinutes = 0,
  etaTime = '—',
  sessionId,
  targetStopName,
  targetStopLat,
  targetStopLng,
  stops = [],
  onOpenLiveJourney,
}: LiveJourneyCardProps) {
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('roadmap');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Live Position Subscription & Continuous Motion
  const {
    displayLat,
    displayLng,
    speedKmh,
    displayHeading,
    isConnected,
    distanceToStopMeters,
    etaMinutes: liveEta,
  } = useLiveVehiclePosition({
    sessionId: hasActiveJourney ? (sessionId || null) : null,
    targetStopLat: targetStopLat ?? houseLat ?? null,
    targetStopLng: targetStopLng ?? houseLng ?? null,
    initialLat: hasActiveJourney ? undefined : null,
    initialLng: hasActiveJourney ? undefined : null,
  });

  const cardPins = useMemo(() => {
    const pins: Array<{ lat: number; lng: number; label?: string; kind?: 'home' | 'school' | 'stop' }> = [];

    const hLat = houseLat != null && Number.isFinite(Number(houseLat)) ? Number(houseLat) : null;
    const hLng = houseLng != null && Number.isFinite(Number(houseLng)) ? Number(houseLng) : null;
    const sLat = schoolLat != null && Number.isFinite(Number(schoolLat)) ? Number(schoolLat) : null;
    const sLng = schoolLng != null && Number.isFinite(Number(schoolLng)) ? Number(schoolLng) : null;

    if (hLat != null && hLng != null) {
      pins.push({
        lat: hLat,
        lng: hLng,
        label: `${childName}'s Home`,
        kind: 'home',
      });
    }

    if (sLat != null && sLng != null) {
      pins.push({
        lat: sLat,
        lng: sLng,
        label: schoolName || 'School',
        kind: 'school',
      });
    }

    if (targetStopLat != null && targetStopLng != null && Number.isFinite(Number(targetStopLat)) && Number.isFinite(Number(targetStopLng))) {
      const tLat = Number(targetStopLat);
      const tLng = Number(targetStopLng);
      const exists = pins.some((p) => Math.abs(p.lat - tLat) < 0.0002 && Math.abs(p.lng - tLng) < 0.0002);
      if (!exists) {
        pins.push({
          lat: tLat,
          lng: tLng,
          label: targetStopName || 'Doorstep',
          kind: 'stop',
        });
      }
    }

    return pins;
  }, [houseLat, houseLng, schoolLat, schoolLng, targetStopLat, targetStopLng, childName, schoolName, targetStopName]);

  const [roadCoordinates, setRoadCoordinates] = useState<Array<{ lat: number; lng: number }>>([]);

  useEffect(() => {
    let cancelled = false;

    if (journeyStage === 'in_class' || journeyStage === 'delivered_home') {
      setRoadCoordinates([]);
      return;
    }

    const waypoints: Array<{ lat: number; lng: number }> = [];

    if (hasActiveJourney && displayLat != null && displayLng != null && Number.isFinite(displayLat) && Number.isFinite(displayLng)) {
      waypoints.push({ lat: displayLat, lng: displayLng });

      if (targetStopLat != null && targetStopLng != null && Number.isFinite(targetStopLat) && Number.isFinite(targetStopLng)) {
        waypoints.push({ lat: Number(targetStopLat), lng: Number(targetStopLng) });
      } else if (cardPins.length > 0) {
        waypoints.push({ lat: cardPins[0].lat, lng: cardPins[0].lng });
      }
    } else {
      const homePin = cardPins.find((p) => p.kind === 'home');
      const schoolPin = cardPins.find((p) => p.kind === 'school');
      if (homePin && schoolPin) {
        waypoints.push({ lat: homePin.lat, lng: homePin.lng });
        waypoints.push({ lat: schoolPin.lat, lng: schoolPin.lng });
      }
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
  }, [hasActiveJourney, journeyStage, displayLat, displayLng, targetStopLat, targetStopLng, cardPins]);

  const effectiveEta = liveEta ?? etaMinutes ?? 8;
  const isChildInClass = journeyStage === 'in_class' || journeyStage === 'at_school_gate';
  const isDeliveredHome = journeyStage === 'delivered_home';

  const handleOpenRadar = () => {
    if (onOpenLiveJourney) {
      onOpenLiveJourney();
    } else {
      setIsModalOpen(true);
    }
  };

  if (!hasActiveJourney) {
    return (
      <>
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between h-full">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5">
              <span>Live Journey</span>
              <span className="text-slate-400 font-normal">–</span>
              <span className="text-slate-700 truncate">{childName}</span>
            </h2>
            <span
              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                isChildInClass
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-extrabold'
                  : isDeliveredHome
                    ? 'bg-blue-50 text-blue-700 border border-blue-200 font-extrabold'
                    : 'bg-slate-100 text-slate-500'
              }`}
            >
              {isChildInClass ? '● Safe in School' : isDeliveredHome ? '● Safe at Home' : '● Scheduled'}
            </span>
          </div>

          <div className="py-6 text-center">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xs ${
                isChildInClass
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                  : isDeliveredHome
                    ? 'bg-blue-50 text-blue-600 border border-blue-200'
                    : 'bg-slate-50 border border-slate-100 text-slate-400'
              }`}
            >
              {isChildInClass ? (
                <School className="w-6 h-6" />
              ) : isDeliveredHome ? (
                <Home className="w-6 h-6" />
              ) : (
                <Bus className="w-6 h-6" />
              )}
            </div>
            <p className="text-xs font-black text-slate-800">
              {isChildInClass
                ? `Safe in Class${schoolName ? ` at ${schoolName}` : ''}`
                : isDeliveredHome
                  ? `Safely Delivered Home`
                  : 'Designated Corridor Standby'}
            </p>
            <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
              {isChildInClass
                ? `${childName || 'Your child'} is safely seated in campus reception/class. Afternoon transit will activate when dismissal begins.`
                : isDeliveredHome
                  ? `${childName || 'Your child'} has arrived safely at home doorstep.`
                  : `Morning shuttle corridor between doorstep and ${schoolName || 'school'} is ready.`}
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenRadar}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
          >
            <span>{isChildInClass ? 'View School Campus Pin' : 'Open Live Map Corridor'}</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>

        {/* Upgraded Modal */}
        <LiveJourneyModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          childName={childName}
          schoolName={schoolName}
          schoolAddress={schoolAddress}
          schoolLat={schoolLat}
          schoolLng={schoolLng}
          houseAddress={houseAddress}
          houseLat={houseLat}
          houseLng={houseLng}
          escortName={escortName}
          escortCode={escortCode}
          escortPhone={escortPhone}
          vehicleModel={vehicleModel}
          licensePlate={licensePlate}
          routeName={routeName}
          sessionId={sessionId}
          journeyStage={journeyStage}
          hasActiveJourney={hasActiveJourney}
          targetStopName={targetStopName}
          targetStopLat={targetStopLat}
          targetStopLng={targetStopLng}
          stops={stops}
        />
      </>
    );
  }

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
            vehicleLat={hasActiveJourney ? displayLat : null}
            vehicleLng={hasActiveJourney ? displayLng : null}
            vehicleHeading={displayHeading}
            vehicleSpeedKmh={speedKmh}
            vehicleLabel={vehicleModel || 'EduRide'}
            pins={cardPins}
            routeCoordinates={roadCoordinates.length >= 2 ? roadCoordinates : undefined}
            followVehicle={Boolean(hasActiveJourney && displayLat != null && displayLng != null)}
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

          <div className="min-w-0" title={`Route: ${routeName}`}>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block truncate">
              Corridor
            </span>
            <p className="font-bold text-slate-800 truncate mt-0.5 leading-none">{routeName}</p>
            <p className="text-[8px] text-slate-400 truncate">{schoolName}</p>
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
        schoolName={schoolName}
        schoolAddress={schoolAddress}
        schoolLat={schoolLat}
        schoolLng={schoolLng}
        houseAddress={houseAddress}
        houseLat={houseLat}
        houseLng={houseLng}
        escortName={escortName}
        escortCode={escortCode}
        escortPhone={escortPhone}
        vehicleModel={vehicleModel}
        licensePlate={licensePlate}
        routeName={routeName}
        sessionId={sessionId}
        journeyStage={journeyStage}
        hasActiveJourney={hasActiveJourney}
        targetStopName={targetStopName}
        targetStopLat={targetStopLat}
        targetStopLng={targetStopLng}
        stops={stops}
      />
    </>
  );
}
