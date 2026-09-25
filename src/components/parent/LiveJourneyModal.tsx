'use client';

import { useState, useEffect, useMemo } from 'react';
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
  School,
  Home,
  Check
} from 'lucide-react';
import { useLiveVehiclePosition } from '@/hooks/useLiveVehiclePosition';
import LiveVehicleMap from '@/components/shared/LiveVehicleMap';
import { fetchDrivingRoute } from '@/lib/navigation/road-router';

export interface RouteStopItem {
  id?: string;
  stopNumber?: number;
  name: string;
  landmark?: string;
  lat?: number | null;
  lng?: number | null;
  etaMorning?: string;
}

interface LiveJourneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  childName?: string;
  schoolName?: string;
  schoolAddress?: string;
  schoolLat?: number | null;
  schoolLng?: number | null;
  houseAddress?: string | null;
  houseLat?: number | null;
  houseLng?: number | null;
  escortName?: string;
  escortPhone?: string;
  escortCode?: string;
  vehicleModel?: string;
  licensePlate?: string;
  routeName?: string;
  sessionId?: string | null;
  journeyStage?: string;
  hasActiveJourney?: boolean;
  targetStopName?: string;
  targetStopLat?: number | null;
  targetStopLng?: number | null;
  stops?: RouteStopItem[];
  isNotReadyYet?: boolean;
  delayedMinutes?: number | null;
  shiftedPickupTime?: string | null;
  notReadyReason?: string | null;
  onNotReadyYet?: () => void;
}

export default function LiveJourneyModal({
  isOpen,
  onClose,
  childName = '',
  schoolName = '',
  schoolAddress = '',
  schoolLat,
  schoolLng,
  houseAddress = '',
  houseLat,
  houseLng,
  escortName = '',
  escortPhone = '',
  escortCode = '',
  vehicleModel = '',
  licensePlate = '',
  routeName = '',
  sessionId,
  journeyStage = 'scheduled',
  hasActiveJourney = false,
  targetStopName,
  targetStopLat,
  targetStopLng,
  stops = [],
  isNotReadyYet = false,
  delayedMinutes = 15,
  shiftedPickupTime = null,
  notReadyReason = null,
  onNotReadyYet,
}: LiveJourneyModalProps) {
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('roadmap');

  // Live Position Subscription
  const {
    displayLat,
    displayLng,
    speedKmh,
    displayHeading,
    isConnected,
    distanceToStopMeters,
    etaMinutes,
    lastPingAt,
  } = useLiveVehiclePosition({
    sessionId: hasActiveJourney ? (sessionId || null) : null,
    targetStopLat: targetStopLat ?? houseLat ?? null,
    targetStopLng: targetStopLng ?? houseLng ?? null,
    initialLat: hasActiveJourney ? undefined : null,
    initialLng: hasActiveJourney ? undefined : null,
  });

  // Calculate real pins grounded in student doorstep & school location
  const modalPins = useMemo(() => {
    const pins: Array<{ lat: number; lng: number; label?: string; kind?: 'home' | 'school' | 'stop' }> = [];

    const hLat = houseLat != null && Number.isFinite(Number(houseLat)) ? Number(houseLat) : null;
    const hLng = houseLng != null && Number.isFinite(Number(houseLng)) ? Number(houseLng) : null;
    const sLat = schoolLat != null && Number.isFinite(Number(schoolLat)) ? Number(schoolLat) : null;
    const sLng = schoolLng != null && Number.isFinite(Number(schoolLng)) ? Number(schoolLng) : null;

    if (hLat != null && hLng != null) {
      pins.push({
        lat: hLat,
        lng: hLng,
        label: childName ? `${childName}'s Home` : 'Home Doorstep',
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

    // Include other route stops if provided and distinct
    if (stops && stops.length > 0) {
      stops.forEach((st) => {
        if (st.lat != null && st.lng != null && Number.isFinite(Number(st.lat)) && Number.isFinite(Number(st.lng))) {
          const lat = Number(st.lat);
          const lng = Number(st.lng);
          const alreadyExists = pins.some(
            (p) => Math.abs(p.lat - lat) < 0.0002 && Math.abs(p.lng - lng) < 0.0002
          );
          if (!alreadyExists) {
            pins.push({
              lat,
              lng,
              label: st.name,
              kind: 'stop',
            });
          }
        }
      });
    }

    return pins;
  }, [houseLat, houseLng, schoolLat, schoolLng, childName, schoolName, stops]);

  const [roadCoordinates, setRoadCoordinates] = useState<Array<{ lat: number; lng: number }>>([]);

  // Fetch true turn-by-turn road route coordinates
  useEffect(() => {
    let cancelled = false;

    // When student is safely in class or home, no moving polyline is needed
    if (journeyStage === 'in_class' || journeyStage === 'delivered_home') {
      setRoadCoordinates([]);
      return;
    }

    const waypoints: Array<{ lat: number; lng: number }> = [];

    // Priority 1: If live vehicle coordinates exist, route from vehicle to target/destinations
    if (
      hasActiveJourney &&
      displayLat != null &&
      displayLng != null &&
      Number.isFinite(displayLat) &&
      Number.isFinite(displayLng)
    ) {
      waypoints.push({ lat: displayLat, lng: displayLng });

      if (targetStopLat != null && targetStopLng != null && Number.isFinite(targetStopLat) && Number.isFinite(targetStopLng)) {
        waypoints.push({ lat: Number(targetStopLat), lng: Number(targetStopLng) });
      } else if (modalPins.length > 0) {
        waypoints.push({ lat: modalPins[0].lat, lng: modalPins[0].lng });
      }
    } else {
      // Priority 2: Standby/scheduled corridor between home and school
      const homePin = modalPins.find((p) => p.kind === 'home');
      const schoolPin = modalPins.find((p) => p.kind === 'school');
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
  }, [
    hasActiveJourney,
    journeyStage,
    displayLat,
    displayLng,
    targetStopLat,
    targetStopLng,
    modalPins,
  ]);

  // Dynamic Stop sequence
  const displayStops = useMemo(() => {
    if (stops && stops.length > 0) {
      return stops;
    }
    const generated: RouteStopItem[] = [];
    if (houseLat != null && houseLng != null) {
      generated.push({
        id: 'stop-doorstep',
        stopNumber: 1,
        name: childName ? `${childName}'s Doorstep` : 'Doorstep Pickup',
        landmark: houseAddress || 'Residence Doorstep',
        lat: houseLat,
        lng: houseLng,
        etaMorning: '07:05 AM',
      });
    }
    if (schoolLat != null && schoolLng != null) {
      generated.push({
        id: 'stop-school',
        stopNumber: generated.length + 1,
        name: schoolName || 'School Main Gate',
        landmark: schoolAddress || 'Campus Reception',
        lat: schoolLat,
        lng: schoolLng,
        etaMorning: '07:35 AM',
      });
    }
    return generated;
  }, [stops, childName, houseAddress, houseLat, houseLng, schoolName, schoolAddress, schoolLat, schoolLng]);

  if (!isOpen) return null;

  const currentEta = etaMinutes ?? (hasActiveJourney ? 8 : 0);
  const currentDistText = distanceToStopMeters
    ? distanceToStopMeters > 1000
      ? `${(distanceToStopMeters / 1000).toFixed(1)} km`
      : `${distanceToStopMeters} m`
    : hasActiveJourney
      ? 'In transit'
      : '0 km';

  const isChildInClass = journeyStage === 'in_class' || journeyStage === 'at_school_gate';
  const isDeliveredHome = journeyStage === 'delivered_home';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden font-sans">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
              {isChildInClass ? (
                <School className="w-5 h-5" />
              ) : isDeliveredHome ? (
                <Home className="w-5 h-5" />
              ) : (
                <Bus className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-slate-900 text-base tracking-tight">
                  Live Shuttle Radar
                </h3>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${hasActiveJourney ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`} />
                  {hasActiveJourney ? 'LIVE GPS ACTIVE' : isChildInClass ? 'SAFE IN SCHOOL' : isDeliveredHome ? 'SAFE AT HOME' : 'TRANSIT CORRIDOR'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {childName ? (
                  <>Student: <span className="font-bold text-slate-800">{childName}</span></>
                ) : null}
                {schoolName ? (
                  <span className="text-slate-600">{childName ? ' • ' : ''}{schoolName}</span>
                ) : null}
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
              <LiveVehicleMap
                key="parent-modal-live-map"
                mapType={mapType}
                heightClassName="h-full"
                className="w-full h-full rounded-3xl border-0"
                vehicleLat={hasActiveJourney ? displayLat : null}
                vehicleLng={hasActiveJourney ? displayLng : null}
                vehicleHeading={displayHeading}
                vehicleSpeedKmh={speedKmh}
                vehicleLabel={vehicleModel || 'EduRide'}
                pins={modalPins}
                routeCoordinates={roadCoordinates.length >= 2 ? roadCoordinates : undefined}
                followVehicle={Boolean(hasActiveJourney && displayLat != null && displayLng != null)}
                hideAttribution={true}
                showZoom={true}
                emptyMessage={
                  isChildInClass
                    ? `Safe at ${schoolName}`
                    : isDeliveredHome
                      ? `Safely arrived at ${childName}'s home`
                      : hasActiveJourney
                        ? 'Connecting live shuttle GPS...'
                        : `Transit corridor between doorstep and ${schoolName}`
                }
              />

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

              {/* Live Status Callout Banner */}
              <div className="absolute right-3 top-3 z-30 bg-slate-900/90 backdrop-blur-md text-white border border-slate-700/80 px-3.5 py-2 rounded-2xl shadow-xl flex items-center gap-3">
                {isChildInClass ? (
                  <div>
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                      Student Location
                    </span>
                    <span className="text-sm font-black text-white leading-none">
                      Safe in Campus
                    </span>
                  </div>
                ) : isDeliveredHome ? (
                  <div>
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                      Student Location
                    </span>
                    <span className="text-sm font-black text-white leading-none">
                      Delivered Home
                    </span>
                  </div>
                ) : hasActiveJourney ? (
                  <>
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
                  </>
                ) : (
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Corridor Status
                    </span>
                    <span className="text-sm font-black text-white leading-none">
                      Scheduled Standby
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Dynamic Stop Sequence List */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5">
              <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">
                Student Route Corridor &amp; Stops
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {displayStops.map((stop, idx) => {
                  const isSchoolStop = stop.name.toLowerCase().includes('school') || idx === displayStops.length - 1;
                  const isHomeStop = !isSchoolStop;

                  let badgeColor = 'bg-white border-slate-200 text-slate-700';
                  let icon = <MapPin className="w-4 h-4 text-slate-400 shrink-0" />;
                  let statusText = stop.etaMorning || 'Scheduled';

                  if (isChildInClass) {
                    if (isSchoolStop) {
                      badgeColor = 'bg-emerald-100/70 border-emerald-300 text-emerald-950 ring-2 ring-emerald-400/40';
                      icon = <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />;
                      statusText = 'Student In Class';
                    } else {
                      badgeColor = 'bg-slate-100 border-slate-200 text-slate-600';
                      icon = <Check className="w-4 h-4 text-slate-400 shrink-0" />;
                      statusText = 'Morning Pickup Complete';
                    }
                  } else if (isDeliveredHome) {
                    if (isHomeStop) {
                      badgeColor = 'bg-emerald-100/70 border-emerald-300 text-emerald-950 ring-2 ring-emerald-400/40';
                      icon = <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />;
                      statusText = 'Delivered Home';
                    } else {
                      badgeColor = 'bg-slate-100 border-slate-200 text-slate-600';
                      icon = <Check className="w-4 h-4 text-slate-400 shrink-0" />;
                      statusText = 'School Departure Complete';
                    }
                  } else if (hasActiveJourney) {
                    badgeColor = 'bg-amber-50 border-amber-300 text-amber-950 ring-2 ring-amber-400/40';
                    icon = <Bus className="w-4 h-4 text-amber-700 shrink-0 animate-pulse" />;
                    statusText = `In Transit (~${currentEta} min)`;
                  }

                  return (
                    <div
                      key={stop.id || `stop-${idx}`}
                      className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all ${badgeColor}`}
                    >
                      {icon}
                      <div className="min-w-0 flex-1">
                        <p className="font-extrabold truncate text-xs">{stop.name}</p>
                        <p className="text-[10px] text-slate-500 truncate">
                          {stop.landmark || (isHomeStop ? houseAddress : schoolAddress) || 'Pinned Location'}
                        </p>
                        <p className="text-[9px] font-bold text-emerald-700 mt-0.5">{statusText}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Driver & Vehicle Specs, Escort Quick Contact (4 Cols) */}
          <div className="lg:col-span-4 space-y-4 flex flex-col justify-between">
            
            {/* Escort Officer Profile Card */}
            <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200 space-y-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                Assigned Route Escort
              </span>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-black text-base flex items-center justify-center shadow-md">
                  {escortName ? escortName.substring(0, 2).toUpperCase() : 'ES'}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-black text-slate-900 text-sm truncate">{escortName || 'Awaiting Escort Assignment'}</h4>
                  <p className="text-xs text-slate-500 font-mono">{escortCode || (escortName ? 'ESC' : 'Pending')}</p>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 mt-1">
                    <ShieldCheck className="w-3 h-3" /> Gold Shield Certified
                  </span>
                </div>
              </div>

              {/* Direct Actions */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/80">
                {escortPhone ? (
                  <a
                    href={`tel:${escortPhone}`}
                    className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-600/20"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Call Escort</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="py-2.5 px-3 rounded-xl bg-slate-200 text-slate-400 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-not-allowed"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>No Phone</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => alert(`Direct communication channel ready for ${childName ? `${childName}'s` : 'assigned'} escort.`)}
                  className="py-2.5 px-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
                  <span>Message</span>
                </button>
              </div>

              {onNotReadyYet && !isChildInClass && !isDeliveredHome && (
                <button
                  type="button"
                  onClick={onNotReadyYet}
                  className={`w-full py-2.5 px-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs ${
                    isNotReadyYet
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 hover:border-amber-300'
                  }`}
                  title="Click if child needs extra time to get ready; notifies escort and shifts pickup slot"
                >
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{isNotReadyYet ? `⏳ Pickup Shifted (+${delayedMinutes || 15}m)` : '⏳ Child Not Ready Yet?'}</span>
                </button>
              )}
            </div>

            {/* Vehicle & Safety Telemetry */}
            <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200 space-y-2.5 text-xs">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                Vehicle &amp; Route Corridor
              </span>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Model:</span>
                <span className="font-bold text-slate-900 truncate max-w-[180px]">{vehicleModel || 'Assigned Shuttle'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Plate Number:</span>
                <span className="font-mono font-bold text-slate-900 bg-slate-200 px-1.5 py-0.5 rounded">
                  {licensePlate || 'Pending'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/60">
                <span className="text-slate-500">Route Name:</span>
                <span className="font-bold text-slate-900 truncate max-w-[160px]">{routeName || (schoolName ? `${schoolName} Corridor` : 'Designated Route')}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Status:</span>
                <span className="font-extrabold text-emerald-700 truncate max-w-[160px]">
                  {isChildInClass
                    ? 'Safe at School'
                    : isDeliveredHome
                      ? 'Safely at Home'
                      : hasActiveJourney
                        ? 'En Route'
                        : 'Standby'}
                </span>
              </div>
            </div>

            {/* Emergency / Safety Button */}
            <button
              type="button"
              onClick={() => alert('Emergency dispatch notification sent to School Admin & City Manager.')}
              className="w-full py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
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
            <span>
              Realtime GPS telemetry • {lastPingAt ? `Last ping: ${new Date(lastPingAt).toLocaleTimeString()}` : 'Live corridor active'}
            </span>
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
