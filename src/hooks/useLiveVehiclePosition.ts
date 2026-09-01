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
  targetStopLat?: number;
  targetStopLng?: number;
  initialLat?: number;
  initialLng?: number;
  onApproachingStop?: (distanceMeters: number, etaMinutes: number) => void;
}

export function useLiveVehiclePosition({
  sessionId,
  targetStopLat,
  targetStopLng,
  initialLat = 6.5244,
  initialLng = 3.3792,
  onApproachingStop,
}: UseLiveVehiclePositionOptions) {
  const [currentPosition, setCurrentPosition] = useState<TelemetryPoint>({
    lat: initialLat,
    lng: initialLng,
    speedKmh: 0,
    heading: 0,
    timestamp: new Date().toISOString(),
  });

  const [displayLat, setDisplayLat] = useState(initialLat);
  const [displayLng, setDisplayLng] = useState(initialLng);
  const [displayHeading, setDisplayHeading] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [distanceToStopMeters, setDistanceToStopMeters] = useState<number | null>(null);
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
  const [hasAlertedApproaching, setHasAlertedApproaching] = useState(false);

  const animFrameRef = useRef<number | null>(null);
  const targetPosRef = useRef<{ lat: number; lng: number; heading: number }>({
    lat: initialLat,
    lng: initialLng,
    heading: 0,
  });

  const supabase = createClient();

  // Smooth Marker Animation Loop (lerp)
  useEffect(() => {
    let currentL = displayLat;
    let currentG = displayLng;
    let currentH = displayHeading;

    const animate = () => {
      const target = targetPosRef.current;
      // Interpolation factor
      const factor = 0.08;

      currentL += (target.lat - currentL) * factor;
      currentG += (target.lng - currentG) * factor;

      // Handle 360 wrap-around for heading
      let diffHeading = target.heading - currentH;
      if (diffHeading > 180) diffHeading -= 360;
      if (diffHeading < -180) diffHeading += 360;
      currentH += diffHeading * factor;

      setDisplayLat(currentL);
      setDisplayLng(currentG);
      setDisplayHeading(currentH);

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  // Realtime Supabase Broadcast Subscription
  useEffect(() => {
    if (!sessionId) {
      setIsConnected(false);
      return;
    }

    const channel = supabase
      .channel(`tracking:session_${sessionId}`)
      .on('broadcast', { event: 'telemetry_ping' }, ({ payload }) => {
        const point: TelemetryPoint = {
          lat: payload.lat,
          lng: payload.lng,
          speedKmh: payload.speedKmh ?? 0,
          heading: payload.heading ?? 0,
          accuracyMeters: payload.accuracyMeters,
          batteryLevel: payload.batteryLevel,
          timestamp: payload.timestamp || new Date().toISOString(),
        };

        setCurrentPosition(point);
        targetPosRef.current = {
          lat: point.lat,
          lng: point.lng,
          heading: point.heading,
        };
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
          if (dist <= 600 && !hasAlertedApproaching) {
            setHasAlertedApproaching(true);
            onApproachingStop?.(Math.round(dist), eta);
          }
        }
      })
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      channel.unsubscribe();
    };
  }, [
    sessionId,
    targetStopLat,
    targetStopLng,
    hasAlertedApproaching,
    onApproachingStop,
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
