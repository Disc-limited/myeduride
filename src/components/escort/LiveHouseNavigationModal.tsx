'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Navigation,
  MapPin,
  Compass,
  Phone,
  ShieldCheck,
  X,
  ExternalLink,
  BellRing,
  CheckCircle2,
  AlertCircle,
  Car,
  Home,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { calculateHaversineDistance } from '@/lib/platform/geofence';

interface LiveHouseNavigationModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: any | null;
  escortId?: string;
  tripPhase?: 'morning_pickup' | 'afternoon_dropoff';
  onArrived?: (student: any) => void;
}

function calculateCompassBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  const theta = Math.atan2(y, x);
  return ((theta * 180) / Math.PI + 360) % 360;
}

function getCardinalDirection(bearing: number): string {
  const directions = ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West'];
  const index = Math.round(bearing / 45) % 8;
  return directions[index];
}

export default function LiveHouseNavigationModal({
  isOpen,
  onClose,
  student,
  escortId,
  tripPhase = 'morning_pickup',
  onArrived,
}: LiveHouseNavigationModalProps) {
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [parentNotified, setParentNotified] = useState(false);
  const [notifiedDistance, setNotifiedDistance] = useState<number | null>(null);
  const [isAlerting, setIsAlerting] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const alertTriggeredRef = useRef(false);

  const targetLat = student?.house_lat ? Number(student.house_lat) : null;
  const targetLng = student?.house_lng ? Number(student.house_lng) : null;
  const hasTargetCoords = targetLat != null && targetLng != null;

  // Initialize parent notification state from student record if already alerted today
  useEffect(() => {
    if (student) {
      const alreadyNotified =
        tripPhase === 'afternoon_dropoff'
          ? Boolean(student.afternoon_proximity_notified_at || student.is_afternoon_proximity_notified)
          : Boolean(student.morning_proximity_notified_at || student.is_morning_proximity_notified);
      setParentNotified(alreadyNotified);
      alertTriggeredRef.current = alreadyNotified;
    }
  }, [student, tripPhase]);

  // Live GPS tracking watcher
  useEffect(() => {
    if (!isOpen || !hasTargetCoords) return;

    if (!('geolocation' in navigator)) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }

    setGpsError(null);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCurrentCoords({ lat, lng });
        setGpsAccuracy(Math.round(pos.coords.accuracy));
      },
      (err) => {
        console.warn('[LiveHouseNav] GPS error:', err.message);
        setGpsError('Unable to acquire high-accuracy GPS position. Check permissions.');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 10000,
      }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [isOpen, hasTargetCoords]);

  // Compute live distance, bearing, and ETA
  const liveNavigationData = useMemo(() => {
    if (!currentCoords || !hasTargetCoords) {
      return {
        distanceMeters: null,
        bearing: 0,
        cardinal: 'Direct',
        etaMinutes: null,
        isClose: false,
        isAtDoorstep: false,
      };
    }

    const dist = calculateHaversineDistance(
      currentCoords.lat,
      currentCoords.lng,
      targetLat!,
      targetLng!
    );
    const bearing = calculateCompassBearing(
      currentCoords.lat,
      currentCoords.lng,
      targetLat!,
      targetLng!
    );
    const eta = Math.max(1, Math.round(dist / 250));

    return {
      distanceMeters: Math.round(dist),
      bearing: Math.round(bearing),
      cardinal: getCardinalDirection(bearing),
      etaMinutes: eta,
      isClose: dist <= 500,
      isAtDoorstep: dist <= 45,
    };
  }, [currentCoords, hasTargetCoords, targetLat, targetLng]);

  // Trigger automated proximity notification when escort approaches within 500m
  useEffect(() => {
    if (
      !isOpen ||
      !student?.id ||
      !currentCoords ||
      !liveNavigationData.distanceMeters ||
      liveNavigationData.distanceMeters > 500 ||
      alertTriggeredRef.current ||
      parentNotified ||
      isAlerting
    ) {
      return;
    }

    alertTriggeredRef.current = true;
    setIsAlerting(true);

    fetch('/api/escorts/proximity-alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: student.id,
        escort_id: escortId,
        current_lat: currentCoords.lat,
        current_lng: currentCoords.lng,
        trip_phase: tripPhase,
        threshold_meters: 500,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.triggered || data.already_notified) {
          setParentNotified(true);
          setNotifiedDistance(liveNavigationData.distanceMeters);
          toast.success(
            `🔔 Parent Auto-Notified! Proximity alert sent: Escort is ${liveNavigationData.distanceMeters}m away (~${liveNavigationData.etaMinutes} mins).`
          );
        }
      })
      .catch((err) => {
        console.warn('[LiveHouseNav] Proximity alert network error:', err);
      })
      .finally(() => {
        setIsAlerting(false);
      });
  }, [
    isOpen,
    student?.id,
    currentCoords,
    liveNavigationData.distanceMeters,
    liveNavigationData.etaMinutes,
    parentNotified,
    isAlerting,
    escortId,
    tripPhase,
  ]);

  if (!isOpen || !student) return null;

  const studentName = student.name || `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student';
  const parentPhone = student.parent_phone || '';
  const nativeNavUrl = hasTargetCoords
    ? `https://www.google.com/maps/dir/?api=1&destination=${targetLat},${targetLng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(student.house_address || 'Lagos')}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-[#0A1128] text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 flex items-center justify-center font-black shrink-0">
              <Navigation size={20} />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 block">
                Live Doorstep Guidance
              </span>
              <h2 className="text-base sm:text-lg font-black truncate">{studentName}</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
          {/* Automated Proximity Banner */}
          {parentNotified ? (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-center justify-between gap-2.5 animate-in fade-in">
              <div className="flex items-center gap-2 min-w-0">
                <BellRing size={16} className="text-emerald-600 shrink-0 animate-bounce" />
                <div className="min-w-0">
                  <span className="font-bold block text-[11px] text-emerald-900">Parent Automatically Notified 🔔</span>
                  <span className="text-[10px] text-emerald-700 block truncate">
                    System informed parent of your close approach{notifiedDistance ? ` (${notifiedDistance}m away)` : ''}.
                  </span>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-200/70 text-emerald-900 font-bold text-[9px] uppercase shrink-0">
                Alert Active
              </span>
            </div>
          ) : liveNavigationData.isClose ? (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex items-center gap-2.5">
              <RefreshCw size={15} className="text-amber-600 animate-spin shrink-0" />
              <div className="min-w-0">
                <span className="font-bold block text-[11px] text-amber-900">Approaching Proximity Zone (&lt; 500m)</span>
                <span className="text-[10px] text-amber-700 block truncate">
                  Dispatching automatic approach message to parent...
                </span>
              </div>
            </div>
          ) : null}

          {/* GPS Status Warning */}
          {gpsError && (
            <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{gpsError}</span>
            </div>
          )}

          {/* Real-time Distance & Direction HUD */}
          <div className="p-4 sm:p-5 rounded-3xl bg-slate-900 text-white space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <Car size={13} className="text-emerald-400" />
                <span>Escort Vehicle ➔ House</span>
              </span>
              <span className="font-mono text-[10px] text-slate-400">
                GPS Accuracy: {gpsAccuracy != null ? `±${gpsAccuracy}m` : 'Calibrating...'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              {/* Distance Display */}
              <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Distance to House</span>
                <p className="text-2xl sm:text-3xl font-black text-white mt-1">
                  {liveNavigationData.distanceMeters != null
                    ? liveNavigationData.distanceMeters >= 1000
                      ? `${(liveNavigationData.distanceMeters / 1000).toFixed(1)} km`
                      : `${liveNavigationData.distanceMeters} m`
                    : 'Locating...'}
                </p>
                <span className="text-[10px] text-emerald-400 font-medium mt-0.5 block">
                  {liveNavigationData.isAtDoorstep
                    ? '🎯 At Destination Doorstep'
                    : liveNavigationData.isClose
                    ? '⚡ Approaching Doorstep'
                    : 'In Transit'}
                </span>
              </div>

              {/* Bearing & Movement Direction */}
              <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Movement Heading</span>
                <p className="text-2xl sm:text-3xl font-black text-white mt-1 flex items-center gap-1.5">
                  <Compass
                    size={24}
                    className="text-emerald-400 shrink-0 transition-transform duration-500"
                    style={{ transform: `rotate(${liveNavigationData.bearing}deg)` }}
                  />
                  <span>{liveNavigationData.cardinal}</span>
                </p>
                <span className="text-[10px] text-slate-400 font-medium mt-0.5 block">
                  Bearing: {liveNavigationData.bearing}° · ~{liveNavigationData.etaMinutes || 2} mins ETA
                </span>
              </div>
            </div>

            {/* Turn guidance prompt */}
            <div className="p-3 bg-slate-800/60 rounded-2xl border border-slate-700/60 flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">
                {liveNavigationData.isAtDoorstep
                  ? '✅ You have arrived at the gate! Verify student with parent.'
                  : liveNavigationData.isClose
                  ? `Proceed ${liveNavigationData.cardinal} toward ${student.house_landmark || 'front gate'}.`
                  : `Head ${liveNavigationData.cardinal} along route corridor.`}
              </span>
            </div>
          </div>

          {/* Student & Destination Location Details */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="flex items-center gap-2.5">
              <img
                src={student.photo_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                alt={studentName}
                className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0"
              />
              <div className="min-w-0">
                <span className="font-black text-slate-900 block text-xs truncate">{studentName}</span>
                <span className="text-[11px] text-slate-500 block truncate">
                  {student.school_name || 'Assigned School'} · {student.class_name || 'Assigned Student'}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200/80 space-y-1">
              <div className="flex items-start gap-1.5">
                <Home size={14} className="text-slate-400 shrink-0 mt-0.5" />
                <span className="font-semibold text-slate-800 text-[11px] leading-snug">
                  {student.house_address || student.pickup_address || 'Home Address'}
                </span>
              </div>
              {student.house_landmark && (
                <p className="text-[10px] text-slate-500 pl-5">
                  <span className="font-bold">Landmark:</span> {student.house_landmark}
                </p>
              )}
              {student.house_notes && (
                <p className="text-[10px] text-slate-500 pl-5">
                  <span className="font-bold">Approach Note:</span> {student.house_notes}
                </p>
              )}
            </div>
          </div>

          {/* Guardian Contact Info */}
          <div className="p-3.5 rounded-2xl bg-white border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Parent / Guardian</span>
              <p className="font-bold text-slate-900 text-xs">{student.parent_name || 'Parent on file'}</p>
            </div>
            {parentPhone && (
              <a
                href={`tel:${parentPhone}`}
                className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <Phone size={13} />
                <span>Call Parent</span>
              </a>
            )}
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0 flex flex-col sm:flex-row items-center gap-2">
          {/* External Turn-by-Turn Voice Navigation Button */}
          <a
            href={nativeNavUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:flex-1 min-h-[44px] py-2.5 px-4 rounded-xl bg-[#0A1128] hover:bg-slate-800 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Navigation size={14} className="text-emerald-400" />
            <span>Turn-by-Turn GPS</span>
            <ExternalLink size={12} className="opacity-70" />
          </a>

          {/* I Have Arrived / Verify PIN Action */}
          <button
            type="button"
            onClick={() => {
              onClose();
              if (onArrived) {
                onArrived(student);
              }
            }}
            className="w-full sm:flex-1 min-h-[44px] py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
          >
            <ShieldCheck size={16} />
            <span>I Have Arrived (Verify PIN)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
