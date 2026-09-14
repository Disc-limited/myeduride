export type EscortPortal = 'school_escort' | 'myeduride_escort' | 'shared_ride_escort';

function parseApplicationData(raw: unknown): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return { ...(raw as Record<string, any>) };
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

/** Flatten escort_applications row + nested application_data. */
export function hydrateEscortApplication(row: any): any {
  if (!row || typeof row !== 'object') return row;
  const parsed = parseApplicationData(row.application_data);
  return {
    ...row,
    ...parsed,
    id: row.id,
    user_id: row.user_id || parsed.user_id || parsed.userId,
    fullName: row.full_name || parsed.fullName || parsed.name,
    email: row.email || parsed.email || parsed.emailOrUsername,
  };
}

/**
 * Explicit application type wins. Username prefixes and employment fields
 * must not force a school portal on a MyEduRide escort.
 */
export function resolveEscortCategory(app: any): EscortPortal {
  const merged = app?.application_data ? hydrateEscortApplication(app) : app || {};
  const explicit = String(
    merged.escortType || merged.escortCategory || merged.escort_type || ''
  ).toLowerCase();

  if (explicit === 'myeduride_escort' || explicit === 'shared_escort') return 'myeduride_escort';
  if (explicit === 'shared_ride_escort') return 'shared_ride_escort';
  if (explicit === 'school_escort') return 'school_escort';

  if (merged.createdRole === 'school_admin' || merged.createdBySchoolId) {
    return 'school_escort';
  }

  if (
    merged.service_type === 'shared_ride' ||
    merged.is_shared_ride ||
    merged.services?.shared_ride ||
    merged.carpool_offering
  ) {
    return 'shared_ride_escort';
  }

  return 'myeduride_escort';
}

export function isApprovedEscortStatus(status: unknown): boolean {
  return ['CITY_MANAGER_APPROVED', 'ACTIVE', 'ACTIVATED'].includes(String(status || '').toUpperCase());
}

export function isMyEduRidePortal(app: any): boolean {
  const portal = resolveEscortCategory(app);
  return portal === 'myeduride_escort' || portal === 'shared_ride_escort';
}

export function isApprovedMyEduRideEscort(app: any): boolean {
  return isMyEduRidePortal(app) && isApprovedEscortStatus(app?.status);
}

export function foldEscortKey(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function findEscortApplicationForSession(applications: any[], session: any): any | null {
  if (!Array.isArray(applications) || applications.length === 0 || !session) return null;

  const userId = session.user_id || session.id || '';
  const email = String(session.email || session.emailOrUsername || '').toLowerCase().trim();
  const username = String(session.username || '').toLowerCase().trim();
  const sessionFolds = [
    session.email,
    session.emailOrUsername,
    session.username,
    session.full_name,
    session.fullName,
    session.phone,
  ]
    .map(foldEscortKey)
    .filter((key) => key.length >= 4);

  let best: { app: any; score: number } | null = null;
  for (const app of applications) {
    const appEmail = String(app.email || app.emailOrUsername || '').toLowerCase().trim();
    const appUser = String(app.username || app.emailOrUsername || '').toLowerCase().trim();
    const appFolds = [
      app.email,
      app.emailOrUsername,
      app.username,
      app.fullName,
      app.full_name,
      app.name,
      app.escort_code,
      app.escortIdCode,
      app.id,
      appEmail.split('@')[0],
    ]
      .map(foldEscortKey)
      .filter((key) => key.length >= 4);

    let score = 0;
    if (userId && (app.user_id === userId || app.id === userId)) score += 100;
    if (email && appEmail && email === appEmail) score += 80;
    if (username && (appUser === username || appEmail === username || appEmail.split('@')[0] === username)) {
      score += 70;
    }
    if (sessionFolds.some((key) => appFolds.includes(key))) score += 60;

    if (score > 0 && (!best || score > best.score)) {
      best = { app, score };
    }
  }

  return best?.app || null;
}
