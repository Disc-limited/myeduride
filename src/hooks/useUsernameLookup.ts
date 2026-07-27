'use client';

import { useEffect, useState } from 'react';
import { isValidUsername, normalizeUsername } from '@/lib/auth/username';

export type UsernameLookupUser = {
  id: string;
  username: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  roles: string[];
};

export type UsernameLookupScope = 'staff' | 'parent' | 'global';

type UseUsernameLookupOptions = {
  schoolId?: string;
  scope?: UsernameLookupScope;
};

// Client-side cache for lookup results
const clientLookupCache = new Map<string, {
  existingUser: UsernameLookupUser | null;
  taken: boolean;
  timestamp: number;
}>();

const CLIENT_CACHE_TTL = 3 * 60 * 1000; // 3 minutes

export function clearUsernameLookupCache() {
  clientLookupCache.clear();
}

export function useUsernameLookup(username: string, options?: UseUsernameLookupOptions) {
  const [existingUser, setExistingUser] = useState<UsernameLookupUser | null>(null);
  const [taken, setTaken] = useState(false);
  const [checking, setChecking] = useState(false);

  const schoolId = options?.schoolId;
  const scope = options?.scope || (schoolId ? 'staff' : 'global');

  useEffect(() => {
    const normalized = normalizeUsername(username);
    if (!normalized || !isValidUsername(normalized)) {
      setExistingUser(null);
      setTaken(false);
      setChecking(false);
      return;
    }

    const cacheKey = `${normalized}:${schoolId || ''}:${scope}`;
    const cached = clientLookupCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CLIENT_CACHE_TTL) {
      setTaken(cached.taken);
      setExistingUser(cached.existingUser);
      setChecking(false);
      return;
    }

    let cancelled = false;
    setChecking(true);

    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ username: normalized });
        if (schoolId) params.set('school_id', schoolId);
        if (scope) params.set('scope', scope);

        const res = await fetch(`/api/users/lookup-by-username?${params.toString()}`, {
          credentials: 'include',
          cache: 'no-store',
        });
        const data = await res.json();

        if (res.ok) {
          clientLookupCache.set(cacheKey, {
            existingUser: data.found ? data.user : null,
            taken: !!data.taken,
            timestamp: Date.now()
          });
        }

        if (!cancelled) {
          setTaken(!!data.taken);
          setExistingUser(res.ok && data.found ? data.user : null);
        }
      } catch {
        if (!cancelled) {
          setExistingUser(null);
          setTaken(false);
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username, schoolId, scope]);

  return { existingUser, taken, checking, isExisting: !!existingUser };
}
