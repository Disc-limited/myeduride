'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface ParentUser {
  id: string;
  username: string;
  full_name: string;
  phone: string | null;
  email: string | null;
}

interface ParentSearchCacheEntry {
  parents: ParentUser[];
  timestamp: number;
}

const cache = new Map<string, ParentSearchCacheEntry>();
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

export function clearParentSearchCache() {
  cache.clear();
}

export function useParentSearch(schoolId: string | null | undefined, searchTerm: string = '') {
  const [parents, setParents] = useState<ParentUser[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const performSearch = useCallback(async (query: string, currentSchoolId: string) => {
    const trimmed = query.trim();
    const cacheKey = `${currentSchoolId}:${trimmed.toLowerCase()}`;

    // Check cache
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      setParents(cached.parents);
      setIsLoading(false);
      setIsFetching(false);
      return;
    }

    // Cancel prior fetch
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsFetching(true);
    setError(null);

    try {
      const url = new URL('/api/school-admin/parents/search', window.location.origin);
      url.searchParams.set('school_id', currentSchoolId);
      if (trimmed) {
        url.searchParams.set('q', trimmed);
      }

      const res = await fetch(url.toString(), {
        signal: controller.signal,
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to search parents');
      }

      const data = await res.json();
      const resultParents: ParentUser[] = data.parents || [];

      // Store in cache
      cache.set(cacheKey, {
        parents: resultParents,
        timestamp: Date.now(),
      });

      setParents(resultParents);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('[useParentSearch]', err);
        setError(err.message || 'Error loading parents');
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
        setIsFetching(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!schoolId) {
      setParents([]);
      setIsLoading(false);
      setIsFetching(false);
      return;
    }

    setIsLoading(true);

    const debounceTime = searchTerm.trim() ? 150 : 0;
    const handler = setTimeout(() => {
      performSearch(searchTerm, schoolId);
    }, debounceTime);

    return () => {
      clearTimeout(handler);
    };
  }, [schoolId, searchTerm, performSearch]);

  const refetch = useCallback(() => {
    if (schoolId) {
      // Clear cache for current query
      const trimmed = searchTerm.trim();
      const cacheKey = `${schoolId}:${trimmed.toLowerCase()}`;
      cache.delete(cacheKey);
      performSearch(searchTerm, schoolId);
    }
  }, [schoolId, searchTerm, performSearch]);

  return { parents, isLoading, isFetching, error, refetch };
}
