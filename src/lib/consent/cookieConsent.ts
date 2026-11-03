/**
 * Enterprise Cookie & Consent Persistence Service for MyEduRide
 * 
 * Provides resilient, dual-layer storage (First-party Cookie + LocalStorage)
 * with auto-healing, SSR guards, long-term persistence (365 days), and
 * cross-tab synchronization.
 */

export type CookieConsentStatus = 'accepted_all' | 'essential_only' | 'custom';

export interface CookiePreferences {
  essential: boolean; // Always true & locked
  analytics: boolean;
  safetyLocation: boolean;
}

export interface CookieConsentRecord {
  status: CookieConsentStatus;
  version: number;
  timestamp: string;
  preferences: CookiePreferences;
}

export const COOKIE_CONSENT_KEY = 'myeduride_cookie_consent';
export const COOKIE_CONSENT_VERSION = 1;
export const COOKIE_CONSENT_MAX_AGE_SECONDS = 365 * 24 * 60 * 60; // 1 year (compliant standard)
export const COOKIE_CONSENT_EVENT = 'myeduride:cookie-consent-updated';

/**
 * Safely retrieves a cookie by name from document.cookie
 */
function readCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const prefix = `${encodeURIComponent(name)}=`;
    const cookies = document.cookie ? document.cookie.split(';') : [];
    for (let c of cookies) {
      c = c.trim();
      if (c.startsWith(prefix)) {
        return decodeURIComponent(c.substring(prefix.length));
      }
    }
  } catch {
    // Fail gracefully in restricted environments
  }
  return null;
}

/**
 * Safely persists a cookie with long-lived max-age, path=/, and SameSite=Lax
 */
function writeCookieValue(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === 'undefined') return;
  try {
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const encodedValue = encodeURIComponent(value);
    const secureFlag = isHttps ? '; Secure' : '';
    document.cookie = `${encodeURIComponent(name)}=${encodedValue}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax${secureFlag}`;
  } catch {
    // Fail gracefully in restricted environments
  }
}

/**
 * Safely parses and validates a consent JSON payload
 */
function parseConsentRecord(rawJson: string | null): CookieConsentRecord | null {
  if (!rawJson) return null;
  try {
    const parsed = JSON.parse(rawJson);
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.status === 'string' &&
      parsed.preferences &&
      typeof parsed.preferences === 'object'
    ) {
      return {
        status: parsed.status as CookieConsentStatus,
        version: typeof parsed.version === 'number' ? parsed.version : COOKIE_CONSENT_VERSION,
        timestamp: typeof parsed.timestamp === 'string' ? parsed.timestamp : new Date().toISOString(),
        preferences: {
          essential: true, // Always enforced
          analytics: Boolean(parsed.preferences.analytics),
          safetyLocation: Boolean(parsed.preferences.safetyLocation),
        },
      };
    }
  } catch {
    // Malformed JSON
  }
  return null;
}

/**
 * Retrieves the current cookie consent record.
 * Checks both First-Party Cookie and LocalStorage.
 * Auto-heals: if found in one layer but missing in the other (e.g. after localStorage purge),
 * synchronizes across both layers automatically.
 */
export function getConsent(): CookieConsentRecord | null {
  if (typeof window === 'undefined') return null;

  let cookieRecord: CookieConsentRecord | null = null;
  let localRecord: CookieConsentRecord | null = null;

  // 1. Check First-Party Cookie
  try {
    const cookieRaw = readCookieValue(COOKIE_CONSENT_KEY);
    cookieRecord = parseConsentRecord(cookieRaw);
  } catch {
    cookieRecord = null;
  }

  // 2. Check LocalStorage
  try {
    const localRaw = window.localStorage.getItem(COOKIE_CONSENT_KEY);
    localRecord = parseConsentRecord(localRaw);
  } catch {
    localRecord = null;
  }

  const validRecord = cookieRecord || localRecord;

  // 3. Auto-heal synchronization across tiers
  if (validRecord) {
    const recordJson = JSON.stringify(validRecord);

    if (!cookieRecord) {
      writeCookieValue(COOKIE_CONSENT_KEY, recordJson, COOKIE_CONSENT_MAX_AGE_SECONDS);
    }
    if (!localRecord) {
      try {
        window.localStorage.setItem(COOKIE_CONSENT_KEY, recordJson);
      } catch {
        // LocalStorage may be blocked/full
      }
    }
  }

  return validRecord;
}

/**
 * Quick check to verify if the device has already consented to cookies.
 */
export function hasConsented(): boolean {
  return getConsent() !== null;
}

/**
 * Saves cookie consent choice with dual-layer persistence (Cookie + LocalStorage)
 * and dispatches a cross-component event.
 */
export function saveConsent(
  status: CookieConsentStatus,
  preferences?: Partial<CookiePreferences>
): CookieConsentRecord {
  const finalPreferences: CookiePreferences = {
    essential: true, // Always true
    analytics: status === 'accepted_all' ? true : status === 'essential_only' ? false : Boolean(preferences?.analytics),
    safetyLocation: status === 'essential_only' ? true : Boolean(preferences?.safetyLocation ?? true),
  };

  const record: CookieConsentRecord = {
    status,
    version: COOKIE_CONSENT_VERSION,
    timestamp: new Date().toISOString(),
    preferences: finalPreferences,
  };

  const recordJson = JSON.stringify(record);

  // 1. Write First-Party Cookie (survives session logout and local storage clear)
  writeCookieValue(COOKIE_CONSENT_KEY, recordJson, COOKIE_CONSENT_MAX_AGE_SECONDS);

  // 2. Write LocalStorage (redundant high-speed cache)
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(COOKIE_CONSENT_KEY, recordJson);
    }
  } catch {
    // Graceful fallback
  }

  // 3. Dispatch notification event for live listener synchronization
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(COOKIE_CONSENT_EVENT, {
          detail: record,
        })
      );
    }
  } catch {
    // Browser environment fallback
  }

  return record;
}
