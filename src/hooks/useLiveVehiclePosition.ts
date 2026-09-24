'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  TelemetryPoint,
  calculateHaversineDistance,
  estimateEtaMinutes,
} from '@/lib/types/tracking-types';

interface UseLiveVehiclePositionOptions {
  sessionId?: string | null;
  schoolId?: string | null;        // Fallback fleet channel if no formal session row exists
  escortId?: string | null;
  vehicleId?: string | null;
  targetStopLat?: number;
  targetStopLng?: number;
  initialLat?: number;
  initialLng?: number;
  initialPingAt?: string | null;
  onApproachingStop?: (distanceMeters: number, etaMinutes: number) => void;
}

export function useLiveVehiclePosition({
  sessionId,
  schoolId,
  escortId,
  vehicleId,
  targetStopLat,
  targetStopLng,
  initialLat = 6.5244,
  initialLng = 3.3792,
  initialPingAt,
  onApproachingStop,
}: UseLiveVehiclePositionOptions) {
  const [currentPosition, setCurrentPosition] = useState<TelemetryPoint>({
    lat: initialLat,
    lng: initialLng,
    speedKmh: 0,
    heading: 0,
    timestamp: initialPingAt || new Date().toISOString(),
  });

  const [displayLat, setDisplayLat] = useState(initialLat);
  const [displayLng, setDisplayLng] = useState(initialLng);
  const [displayHeading, setDisplayHeading] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [distanceToStopMeters, setDistanceToStopMeters] = useState<number | null>(null);
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);

  // Monotonic epoch tracking to permanently eliminate the time-travel bug
  const latestTelemetryEpochRef = useRef<number>(0);
  const hasReceivedLivePingRef = useRef<boolean>(false);

  // Stabilize callback ref so it never triggers effect teardown/reconnect
  const onApproachingStopRef = useRef(onApproachingStop);
  useEffect(() => {
    onApproachingStopRef.current = onApproachingStop;
  }, [onApproachingStop]);
  const hasAlertedApproachingRef = useRef(false);

  const supabase = createClient();

  // Reset tracking state whenever a new session starts
  useEffect(() => {
    hasReceivedLivePingRef.current = false;
    hasAlertedApproachingRef.current = false;
    latestTelemetryEpochRef.current = initialPingAt ? new Date(initialPingAt).getTime() : 0;
  }, [sessionId]);

  // Seed / refresh from polled session snapshot ONLY if we haven't received fresher live data
  useEffect(() => {
    if (initialLat == null || initialLng == null) return;
    if (!Number.isFinite(initialLat) || !Number.isFinite(initialLng)) return;

    const polledEpoch = initialPingAt ? new Date(initialPingAt).getTime() : 0;

    // Time-travel protection: If WebSocket already provided fresher telemetry, ignore stale DB poll
    if (hasReceivedLivePingRef.current && polledEpoch <= latestTelemetryEpochRef.current) {
      return;
    }

    if (polledEpoch > 0) {
      latestTelemetryEpochRef.current = Math.max(latestTelemetryEpochRef.current, polledEpoch);
    }

    setCurrentPosition((prev) => ({
      ...prev,
      lat: initialLat,
      lng: initialLng,
      timestamp: initialPingAt || prev.timestamp || new Date().toISOString(),
    }));
    setDisplayLat(initialLat);
    setDisplayLng(initialLng);
  }, [initialLat, initialLng, initialPingAt]);

  // Realtime Supabase Broadcast Subscription
  // Subscribes to:
  //   1. Session channel: `tracking:session_<sessionId>` (direct, authoritative)
  //   2. School fleet channel: `tracking:school_<schoolId>` (fleet fallback)
  useEffect(() => {
    if (!sessionId && !schoolId && !escortId) {
      setIsConnected(false);
      return;
    }

    const handleTelemetryPayload = (payload: any) => {
      if (!payload || payload.lat == null || payload.lng == null) return;

      // Fleet channel guard: Ensure the broadcast belongs to this child's escort/vehicle
      if (escortId && payload.escortId && payload.escortId !== escortId) return;
      if (vehicleId && payload.vehicleId && payload.vehicleId !== vehicleId) return;

      const payloadEpoch = payload.timestamp ? new Date(payload.timestamp).getTime() : Date.now();
      if (payloadEpoch < latestTelemetryEpochRef.current) {
        // Discard out-of-order historical packet
        return;
      }

      latestTelemetryEpochRef.current = payloadEpoch;
      hasReceivedLivePingRef.current = true;

      const point: TelemetryPoint = {
        lat: Number(payload.lat),
        lng: Number(payload.lng),
        speedKmh: Number(payload.speedKmh) || 0,
        heading: Number(payload.heading) || 0,
        accuracyMeters: payload.accuracyMeters != null ? Number(payload.accuracyMeters) : undefined,
        batteryLevel: payload.batteryLevel,
        timestamp: payload.timestamp || new Date().toISOString(),
      };

      if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return;

      setCurrentPosition(point);
      setDisplayLat(point.lat);
      setDisplayLng(point.lng);
      setDisplayHeading(point.heading);
      setIsConnected(true);

      // Compute Distance & ETA to Parent's Target Stop
      if (targetStopLat && targetStopLng) {
        const dist = calculateHaversineDistance(
          point.lat,
          point.lng,
          targetStopLat,
          targetStopLng
        );
        const eta = estimateEtaMinutes(dist, point.speedKmh);

        setDistanceToStopMeters(Math.round(dist));
        setEtaMinutes(eta);

        // Geofence trigger: vehicle within 600 meters
        if (dist <= 600 && !hasAlertedApproachingRef.current) {
          hasAlertedApproachingRef.current = true;
          onApproachingStopRef.current?.(Math.round(dist), eta);
        }
      }
    };

    const channels: ReturnType<typeof supabase.channel>[] = [];

    // Primary: session-level channel
    if (sessionId) {
      const sessionCh = supabase
        .channel(`tracking:session_${sessionId}`)
        .on('broadcast', { event: 'telemetry_ping' }, ({ payload }) => {
          handleTelemetryPayload(payload);
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') setIsConnected(true);
          else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') setIsConnected(false);
        });
      channels.push(sessionCh);
    }

    // Direct escort-level channel (instant handshake before session sync)
    if (escortId) {
      const escortCh = supabase
        .channel(`tracking:escort_${escortId}`)
        .on('broadcast', { event: 'telemetry_ping' }, ({ payload }) => {
          handleTelemetryPayload(payload);
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED' && !sessionId) setIsConnected(true);
        });
      channels.push(escortCh);
    }

    // Fallback: school-level fleet channel (receives fleet_vehicle_ping from escort)
    if (schoolId) {
      const schoolCh = supabase
        .channel(`tracking:school_${schoolId}`)
        .on('broadcast', { event: 'fleet_vehicle_ping' }, ({ payload }) => {
          handleTelemetryPayload(payload);
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED' && !sessionId && !escortId) setIsConnected(true);
        });
      channels.push(schoolCh);
    }

    return () => {
      channels.forEach((ch) => ch.unsubscribe());
      setIsConnected(false);
    };
  }, [
    sessionId,
    schoolId,
    escortId,
    vehicleId,
    targetStopLat,
    targetStopLng,
  ]);

  return {
    rawPosition: currentPosition,
    displayLat,
    displayLng,
    displayHeading,
    speedKmh: currentPosition.speedKmh,
    isConnected,
    distanceToStopMeters,
    etaMinutes,
    lastPingAt: currentPosition.timestamp,
  };
}
