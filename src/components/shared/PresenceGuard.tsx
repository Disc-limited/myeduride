'use client';

import { useEffect, useRef } from 'react';
import { getSession } from '@/lib/api';

// Rate limit: ping at most once every 2 minutes
const PING_INTERVAL_MS = 120_000;
// Periodic heartbeat even without activity
const HEARTBEAT_INTERVAL_MS = 90_000;

export function PresenceGuard() {
  const lastPingRef = useRef<number>(0);

  useEffect(() => {
    const session = getSession();
    if (!session?.user_id) return;

    const ping = async () => {
      const now = Date.now();
      if (now - lastPingRef.current < PING_INTERVAL_MS) return;
      lastPingRef.current = now;

      try {
        await fetch('/api/presence', {
          method: 'POST',
          // credentials: 'include' ensures the session cookie is sent
          credentials: 'include',
        });
      } catch {
        // Network errors are non-critical; silent fail is fine
      }
    };

    // Immediate ping on mount so the user appears online right away
    ping();

    const handleActivity = () => ping();

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('scroll', handleActivity);
    window.addEventListener('focus', handleActivity);
    window.addEventListener('visibilitychange', handleActivity);

    // Periodic heartbeat as a fallback even without user interaction
    const interval = setInterval(ping, HEARTBEAT_INTERVAL_MS);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      window.removeEventListener('focus', handleActivity);
      window.removeEventListener('visibilitychange', handleActivity);
      clearInterval(interval);
    };
  }, []); // Empty deps — session is read once synchronously on mount

  return null;
}
