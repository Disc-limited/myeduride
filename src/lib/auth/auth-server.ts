import { NextRequest } from 'next/server';
import { getSessionFromRequest, hasRole, sessionHasRole, AppSession } from '@/lib/session';

export { getSessionFromRequest, hasRole, sessionHasRole };
export type { AppSession };

/**
 * Checks if the session has school_admin or super_admin permissions.
 * Optionally checks for specific school_id match.
 */
export function isAuthorizedSchoolAdmin(session: AppSession | null, schoolId?: string): boolean {
  if (!session) return false;
  if (sessionHasRole(session, 'super_admin')) return true;
  if (schoolId) {
    return hasRole(session, 'school_admin', schoolId);
  }
  return sessionHasRole(session, 'school_admin');
}
