'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { TelemetryPoint } from '@/lib/types/tracking-types';
import {
  isForegroundServiceSupported,
  startForegroundTracking,
  stopForegroundTracking,
  addForegroundLocationListener,
} from '@/lib/platform/foregroundTracking';

export type GeolocationPermissionState = 'prompt' | 'granted' | 'denied' | 'unavailable';

interface UseEscortTelemetryOptions {
  sessionId?: string;
  schoolId?: string;
  vehicleId?: string;
  escortId?: string;
  isActive: boolean;
  isSimulating?: boolean;
  simulationWaypoints?: Array<{ lat: number; lng: number }>;
  currentStopIndex?: number;
  onPositionUpdate?: (point: TelemetryPoint) => void;
  onError?: (errorMessage: string, code?: number) => void;
}

export function useEscortTelemetryTracker({
  sessionId,
  schoolId,
  vehicleId,
  escortId,
  isActive,
  isSimulating = false,
  simulationWaypoints = [],
  currentStopIndex = 0,
  onPositionUpdate,
  onError,
}: UseEscortTelemetryOptions) {
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [permissionState, setPermissionState] = useState<GeolocationPermissionState>('prompt');
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState(0);
  const [currentHeading, setCurrentHeading] = useState(0);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [lastPingAt, setLastPingAt] = useState<string | null>(null);
  const [pingCount, setPingCount] = useState(0);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);

  const watchIdRef = useRef<number | null>(null);
  const lastBroadcastTimeRef = useRef<number>(0);
  const lastDbSyncTimeRef = useRef<number>(0);
  const lastErrorMessageRef = useRef<string | null>(null);
  const wakeLockRef = useRef<any>(null);
  // Gate: only broadcast once the Supabase channel has confirmed SUBSCRIBED
  const isSessionChannelReadyRef = useRef<boolean>(false);
  const isSchoolChannelReadyRef = useRef<boolean>(false);
  const isEscortChannelReadyRef = useRef<boolean>(false);
  const latestTelemetryPointRef = useRef<TelemetryPoint | null>(null);
  const lastBroadcastHeadingRef = useRef<number>(0);

  // Ref-stabilized callbacks to prevent unnecessary effect teardown / re-execution loops
  const onPositionUpdateRef = useRef(onPositionUpdate);
  const onErrorRef = useRef(onError);
  const simulationWaypointsRef = useRef(simulationWaypoints);

  useEffect(() => {
    onPositionUpdateRef.current = onPositionUpdate;
  }, [onPositionUpdate]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (simulationWaypoints && simulationWaypoints.length >= 2) {
      simulationWaypointsRef.current = simulationWaypoints;
    }
  }, [simulationWaypoints]);

  const supabase = createClient();

  // Battery status listener
  useEffect(() => {
    if (typeof window !== 'undefined' && 'getBattery' in navigator) {
      (navigator as any)
        .getBattery()
        .then((battery: any) => {
          setBatteryLevel(Math.round(battery.level * 100));
          battery.addEventListener('levelchange', () => {
            setBatteryLevel(Math.round(battery.level * 100));
          });
        })
        .catch(() => {});
    }
  }, []);

  // Screen Wake Lock handler to prevent phone from sleeping while navigating
  const requestWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator && (navigator as any).wakeLock) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      }
    } catch (e) {
      // Wake lock not supported or denied
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
  }, []);

  // Manual retry trigger
  const retryLocationAccess = useCallback(() => {
    lastErrorMessageRef.current = null;
    setPermissionState('prompt');
    setRetryTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!isActive || (!sessionId && !escortId)) {
      setIsBroadcasting(false);
      releaseWakeLock();
      if (watchIdRef.current !== null) {
        navigator.geolocation?.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (isForegroundServiceSupported()) {
        stopForegroundTracking().catch(() => {});
      }
      return;
    }

    if (typeof window === 'undefined') return;

    // Start Native Android Foreground Service with Persistent Notification if supported
    if (isForegroundServiceSupported()) {
      startForegroundTracking({
        title: 'MyEduRide Transit Service',
        text: 'Live vehicle telemetry & student safety route active',
        subText: 'Real-time GPS Tracking',
      }).catch((err) => console.warn('[Tracker] Could not start foreground tracking:', err));
    }

    // Query browser permission status if supported (Chrome, Edge, Firefox)
    if ('permissions' in navigator && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((permissionStatus) => {
          setPermissionState(permissionStatus.state as GeolocationPermissionState);
          permissionStatus.onchange = () => {
            setPermissionState(permissionStatus.state as GeolocationPermissionState);
            if (permissionStatus.state === 'granted') {
              lastErrorMessageRef.current = null;
            }
          };
        })
        .catch(() => {
          // Permissions API query not supported on some WebKit/Safari versions
        });
    }

    requestWakeLock();
    setIsBroadcasting(true);

    // Setup Supabase Realtime Broadcast Channels
    // IMPORTANT: Do NOT send until status === 'SUBSCRIBED' — messages sent before the
    // WebSocket handshake completes are silently dropped by the Supabase Realtime SDK.
    isSessionChannelReadyRef.current = false;
    isSchoolChannelReadyRef.current = false;
    isEscortChannelReadyRef.current = false;

    const sessionChannel = sessionId
      ? supabase.channel(`tracking:session_${sessionId}`, {
          config: { broadcast: { self: false } },
        })
      : null;

    if (sessionChannel) {
      sessionChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          isSessionChannelReadyRef.current = true;
          console.log('[Tracker] Session broadcast channel ready');
          if (latestTelemetryPointRef.current) {
            sessionChannel.send({
              type: 'broadcast',
              event: 'telemetry_ping',
              payload: {
                ...latestTelemetryPointRef.current,
                sessionId,
                vehicleId,
                escortId,
                currentStopIndex,
              },
            });
          }
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          isSessionChannelReadyRef.current = false;
        }
      });
    }

    const escortChannel = escortId
      ? supabase.channel(`tracking:escort_${escortId}`, {
          config: { broadcast: { self: false } },
        })
      : null;

    if (escortChannel) {
      escortChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          isEscortChannelReadyRef.current = true;
          console.log('[Tracker] Escort broadcast channel ready');
          if (latestTelemetryPointRef.current) {
            escortChannel.send({
              type: 'broadcast',
              event: 'telemetry_ping',
              payload: {
                ...latestTelemetryPointRef.current,
                sessionId,
                vehicleId,
                escortId,
                currentStopIndex,
              },
            });
          }
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          isEscortChannelReadyRef.current = false;
        }
      });
    }

    const schoolChannel = schoolId
      ? supabase.channel(`tracking:school_${schoolId}`, { config: { broadcast: { self: false } } })
      : null;

    if (schoolChannel) {
      schoolChannel.subscribe((status) => {
        isSchoolChannelReadyRef.current = status === 'SUBSCRIBED';
        if (status === 'SUBSCRIBED' && latestTelemetryPointRef.current) {
          schoolChannel.send({
            type: 'broadcast',
            event: 'fleet_vehicle_ping',
            payload: {
              ...latestTelemetryPointRef.current,
              sessionId,
              vehicleId,
              escortId,
              currentStopIndex,
            },
          });
        }
      });
    }

    // Core telemetry processor shared between native foreground GPS and browser watchPosition
    const processTelemetryPoint = async (
      lat: number,
      lng: number,
      accuracy: number,
      speedMps: number | null,
      headingDeg: number,
      timestampVal?: number | string
    ) => {
      setPermissionState('granted');
      lastErrorMessageRef.current = null;

      const now = Date.now();
      const speedKmh = speedMps !== null && speedMps >= 0 ? speedMps * 3.6 : 0;
      const heading = headingDeg || 0;

      // Discard severe GPS jitter.
      // Threshold is 150m (not 45m) because Nigerian urban canyons, traffic, and low-end Android
      // devices commonly report 60–120m accuracy. The smooth lerp animation in useLiveVehiclePosition
      // already absorbs the visual jitter, so we only reject truly unusable fixes.
      if (accuracy > 150) {
        console.warn(`[Tracker] GPS fix discarded — accuracy ${Math.round(accuracy)}m exceeds 150m threshold`);
        return;
      }

      // Heading delta check: if heading changed by > 25 degrees, emit faster to capture turns cleanly
      let headingDiff = Math.abs(heading - lastBroadcastHeadingRef.current);
      if (headingDiff > 180) headingDiff = 360 - headingDiff;
      const isSignificantTurn = headingDiff >= 25;

      // Adaptive ping throttle:
      // High speed (> 15 km/h): 1500ms
      // Low speed (5-15 km/h): 2500ms
      // Stationary (<= 5 km/h): 3500ms
      // Sharp turn (> 25°): 1200ms
      const minThrottleMs = isSignificantTurn
        ? 1200
        : speedKmh > 15
          ? 1500
          : speedKmh > 5
            ? 2500
            : 3500;

      if (lastBroadcastTimeRef.current > 0 && now - lastBroadcastTimeRef.current < minThrottleMs) {
        return;
      }

      const telemetryPoint: TelemetryPoint = {
        lat,
        lng,
        speedKmh: Math.round(speedKmh * 10) / 10,
        heading: Math.round(heading),
        accuracyMeters: Math.round(accuracy),
        batteryLevel: batteryLevel ?? undefined,
        timestamp: typeof timestampVal === 'number' ? new Date(timestampVal).toISOString() : (timestampVal || new Date().toISOString()),
      };

      // Always cache latest point for instantaneous handshake flush
      latestTelemetryPointRef.current = telemetryPoint;

      setCurrentSpeedKmh(telemetryPoint.speedKmh);
      setCurrentHeading(telemetryPoint.heading);
      setGpsAccuracy(telemetryPoint.accuracyMeters || 0);
      setLastPingAt(telemetryPoint.timestamp);
      setPingCount((prev) => prev + 1);
      onPositionUpdateRef.current?.(telemetryPoint);

      let broadcastSent = false;

      // 1. Fast Ephemeral WebSocket Broadcast (Sub-second latency)
      // Only send once the channel is confirmed SUBSCRIBED — un-subscribed sends are silently dropped.
      if (sessionChannel && isSessionChannelReadyRef.current) {
        sessionChannel.send({
          type: 'broadcast',
          event: 'telemetry_ping',
          payload: {
            ...telemetryPoint,
            sessionId,
            vehicleId,
            escortId,
            currentStopIndex,
          },
        });
        broadcastSent = true;
      }

      if (escortChannel && isEscortChannelReadyRef.current) {
        escortChannel.send({
          type: 'broadcast',
          event: 'telemetry_ping',
          payload: {
            ...telemetryPoint,
            sessionId,
            vehicleId,
            escortId,
            currentStopIndex,
          },
        });
        broadcastSent = true;
      }

      if (schoolChannel && isSchoolChannelReadyRef.current) {
        schoolChannel.send({
          type: 'broadcast',
          event: 'fleet_vehicle_ping',
          payload: {
            ...telemetryPoint,
            sessionId,
            vehicleId,
            escortId,
            currentStopIndex,
          },
        });
        broadcastSent = true;
      }

      if (broadcastSent) {
        lastBroadcastTimeRef.current = now;
        lastBroadcastHeadingRef.current = heading;
      }

      // 2. Periodic Database Sync (every ~12 seconds)
      if (sessionId && now - lastDbSyncTimeRef.current > 12000) {
        lastDbSyncTimeRef.current = now;
        try {
          await supabase
            .from('vehicle_active_sessions')
            .update({
              current_lat: telemetryPoint.lat,
              current_lng: telemetryPoint.lng,
              current_speed_kmh: telemetryPoint.speedKmh,
              current_heading: telemetryPoint.heading,
              current_stop_index: currentStopIndex,
              gps_accuracy_meters: telemetryPoint.accuracyMeters,
              battery_level: batteryLevel,
              last_ping_at: telemetryPoint.timestamp,
            })
            .eq('id', sessionId);
        } catch (dbErr) {
          console.error('Failed to sync telemetry to DB:', dbErr);
        }
      }
    };

    let simulationTimer: NodeJS.Timeout | null = null;
    let nativeListenerCleanup: (() => void) | null = null;

    if (isSimulating) {
      setPermissionState('granted');
      lastErrorMessageRef.current = null;

      const wps =
        simulationWaypointsRef.current && simulationWaypointsRef.current.length >= 2
          ? simulationWaypointsRef.current
          : [];

      if (wps.length < 2) {
        return () => {};
      }

      let wpIndex = 0;
      let stepProgress = 0;
      const STEPS_PER_SEGMENT = 12;

      const runSimulationStep = () => {
        const from = wps[wpIndex];
        const to = wps[(wpIndex + 1) % wps.length];

        stepProgress += 1;
        const ratio = Math.min(stepProgress / STEPS_PER_SEGMENT, 1);

        const lat = from.lat + (to.lat - from.lat) * ratio;
        const lng = from.lng + (to.lng - from.lng) * ratio;

        // Calculate forward road bearing
        const dLng = ((to.lng - from.lng) * Math.PI) / 180;
        const y = Math.sin(dLng) * Math.cos((to.lat * Math.PI) / 180);
        const x =
          Math.cos((from.lat * Math.PI) / 180) * Math.sin((to.lat * Math.PI) / 180) -
          Math.sin((from.lat * Math.PI) / 180) * Math.cos((to.lat * Math.PI) / 180) * Math.cos(dLng);
        const bearing = Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360);

        // 35 km/h = 9.7 m/s
        processTelemetryPoint(lat, lng, 6, 9.7, bearing, Date.now());

        if (stepProgress >= STEPS_PER_SEGMENT) {
          stepProgress = 0;
          wpIndex = (wpIndex + 1) % wps.length;
        }
      };

      runSimulationStep();
      simulationTimer = setInterval(runSimulationStep, 1500);
    } else {
      // 1. Listen to Native Android Hardware GPS via Foreground Service
      if (isForegroundServiceSupported()) {
        addForegroundLocationListener((nativePos) => {
          processTelemetryPoint(
            nativePos.latitude,
            nativePos.longitude,
            nativePos.accuracy,
            nativePos.speed,
            nativePos.heading,
            nativePos.timestamp
          );
        }).then((unsub) => {
          nativeListenerCleanup = unsub;
        });
      }

      // 2. Fallback / Complementary Browser Geolocation Watcher
      if ('geolocation' in navigator) {
        watchIdRef.current = navigator.geolocation.watchPosition(
          async (pos) => {
            processTelemetryPoint(
              pos.coords.latitude,
              pos.coords.longitude,
              pos.coords.accuracy,
              pos.coords.speed,
              pos.coords.heading || 0,
              pos.timestamp
            );
          },
          (error) => {
            if (error.code === 1) {
              setPermissionState('denied');
              if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
              }
            } else if (error.code === 2) {
              setPermissionState('unavailable');
            }

            const errKey = `${error.code}:${error.message}`;
            if (lastErrorMessageRef.current !== errKey) {
              lastErrorMessageRef.current = errKey;
              onErrorRef.current?.(error.message, error.code);
            }
          },
          {
            enableHighAccuracy: true,
            timeout: 12000,
            maximumAge: 2000,
          }
        );
      }
    }

    return () => {
      if (simulationTimer) {
        clearInterval(simulationTimer);
        simulationTimer = null;
      }
      if (watchIdRef.current !== null) {
        navigator.geolocation?.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (nativeListenerCleanup) {
        nativeListenerCleanup();
        nativeListenerCleanup = null;
      }
      if (isForegroundServiceSupported()) {
        stopForegroundTracking().catch(() => {});
      }
      releaseWakeLock();
      sessionChannel?.unsubscribe();
      escortChannel?.unsubscribe();
      schoolChannel?.unsubscribe();
      setIsBroadcasting(false);
    };
  }, [
    isActive,
    sessionId,
    schoolId,
    vehicleId,
    escortId,
    isSimulating,
    retryTrigger,
    requestWakeLock,
    releaseWakeLock,
  ]);

  return {
    isBroadcasting,
    permissionState,
    hasPermissionError: permissionState === 'denied' || permissionState === 'unavailable',
    currentSpeedKmh,
    currentHeading,
    gpsAccuracy,
    lastPingAt,
    pingCount,
    batteryLevel,
    retryLocationAccess,
  };
}
