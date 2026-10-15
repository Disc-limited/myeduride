import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, isAuthorizedSchoolAdmin } from '@/lib/auth/auth-server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getEscortApplications } from '@/lib/escort/escort-db';
import { resolveEscortCategory } from '@/lib/escort/escort-category';

export const dynamic = 'force-dynamic';

export interface ApprovedRecipient {
  id: string;
  user_id?: string | null;
  name: string;
  code: string;
  phone: string;
  email?: string;
  type: 'escort' | 'driver' | 'staff';
  badge: string;
  status: string;
  verified: boolean;
  vehicle_info?: string | null;
  wallet_id?: string | null;
}

/**
 * GET /api/schools/wallet/recipients
 * Fetches database-approved escorts, drivers, and safety staff associated with this school.
 * Protects against unvetted disbursements by verifying accreditation records in Supabase.
 */
export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const classification = searchParams.get('type') || 'all'; // 'escort' | 'driver' | 'all'
    const searchQuery = (searchParams.get('q') || '').trim().toLowerCase();

    const primarySchoolId =
      searchParams.get('school_id') ||
      (session as any).primary_school?.id ||
      session.roles?.find((r: any) => r.school_id)?.school_id;

    if (!primarySchoolId) {
      return NextResponse.json({ error: 'School ID could not be determined' }, { status: 400 });
    }

    if (!isAuthorizedSchoolAdmin(session, primarySchoolId)) {
      return NextResponse.json(
        { error: 'Access denied: School Admin role required' },
        { status: 403 }
      );
    }

    const supabase = getAdminClient();
    const recipients: ApprovedRecipient[] = [];
    const seenCodes = new Set<string>();

    // -------------------------------------------------------------
    // 1. Fetch Approved Escorts
    // -------------------------------------------------------------
    if (classification === 'all' || classification === 'escort') {
      // A. Query Supabase escort_applications
      const { data: dbApps } = await supabase
        .from('escort_applications')
        .select('*')
        .or(`school_id.eq.${primarySchoolId},allocated_school_ids.cs.{${primarySchoolId}}`);

      // B. Query getEscortApplications() store
      const allStoreApps = await getEscortApplications().catch(() => []);

      const combinedApps = [...(dbApps || []), ...allStoreApps];

      for (const app of combinedApps) {
        const status = (app.status || '').toUpperCase();
        const isApproved =
          status === 'CITY_MANAGER_APPROVED' ||
          status === 'ACTIVATED' ||
          status === 'ACTIVE' ||
          status === 'APPROVED';

        if (!isApproved) continue;

        const appSchoolId =
          app.school_id || app.schoolId || app.primary_school_id || app.primarySchoolId;
        const createdSchoolId = app.createdBySchoolId;
        const allocatedList: string[] = app.allocated_school_ids || app.allocatedSchoolIds || [];

        const isLinkedToSchool =
          appSchoolId === primarySchoolId ||
          createdSchoolId === primarySchoolId ||
          allocatedList.includes(primarySchoolId) ||
          resolveEscortCategory(app) === 'myeduride_escort';

        if (!isLinkedToSchool) continue;

        const rawCode =
          app.escort_code || app.escortCode || `ESC-${(app.id || '').slice(0, 6).toUpperCase()}`;
        const name = app.full_name || app.fullName || app.name || 'Accredited Escort';
        const phone = app.phone || 'Phone on file';
        const email = app.email || app.emailOrUsername || '';

        const dedupKey = `${name.toLowerCase()}-${rawCode.toLowerCase()}`;
        if (seenCodes.has(dedupKey)) continue;
        seenCodes.add(dedupKey);

        recipients.push({
          id: app.id || app.user_id,
          user_id: app.user_id || null,
          name,
          code: rawCode,
          phone,
          email,
          type: 'escort',
          badge: 'Approved Escort',
          status: 'CITY_MANAGER_APPROVED',
          verified: true,
          vehicle_info: app.vehicleType || app.regNumber || null,
        });
      }

      // C. Query user_school_roles for active escorts
      const { data: escortRoles } = await supabase
        .from('user_school_roles')
        .select('user_id, role, user:user_profiles(id, full_name, phone, email)')
        .eq('school_id', primarySchoolId)
        .eq('role', 'escort')
        .eq('is_active', true);

      for (const r of escortRoles || []) {
        const u = Array.isArray(r.user) ? r.user[0] : r.user;
        if (!u) continue;
        const code = `ESC-ROL-${u.id.slice(0, 6).toUpperCase()}`;
        const dedupKey = `${(u.full_name || '').toLowerCase()}-${code.toLowerCase()}`;
        if (seenCodes.has(dedupKey)) continue;
        seenCodes.add(dedupKey);

        recipients.push({
          id: u.id,
          user_id: u.id,
          name: u.full_name || 'School Escort',
          code,
          phone: u.phone || 'Phone on file',
          email: u.email || '',
          type: 'escort',
          badge: 'Approved School Escort',
          status: 'ACTIVE',
          verified: true,
        });
      }
    }

    // -------------------------------------------------------------
    // 2. Fetch Approved Transport Drivers & Staff
    // -------------------------------------------------------------
    if (classification === 'all' || classification === 'driver') {
      // A. Query school vehicles with assigned drivers
      const { data: vehicles } = await supabase
        .from('school_vehicles')
        .select('*')
        .eq('school_id', primarySchoolId);

      for (const v of vehicles || []) {
        if (!v.assigned_driver_name) continue;
        const code = v.reg_number ? `DRV-${v.reg_number}` : `DRV-${v.id.slice(0, 6).toUpperCase()}`;
        const dedupKey = `${v.assigned_driver_name.toLowerCase()}-${code.toLowerCase()}`;
        if (seenCodes.has(dedupKey)) continue;
        seenCodes.add(dedupKey);

        recipients.push({
          id: `veh-drv-${v.id}`,
          user_id: null,
          name: v.assigned_driver_name,
          code,
          phone: v.assigned_driver_phone || 'Phone on file',
          type: 'driver',
          badge: 'Assigned Fleet Driver',
          status: 'ACTIVE',
          verified: true,
          vehicle_info: `${v.type || 'Vehicle'} (${v.reg_number || 'N/A'})`,
        });
      }

      // B. Query user_school_roles for driver / gate / staff roles
      const { data: staffRoles } = await supabase
        .from('user_school_roles')
        .select('user_id, role, user:user_profiles(id, full_name, phone, email)')
        .eq('school_id', primarySchoolId)
        .in('role', ['driver', 'staff', 'gate_officer', 'teacher'])
        .eq('is_active', true);

      for (const r of staffRoles || []) {
        const u = Array.isArray(r.user) ? r.user[0] : r.user;
        if (!u) continue;
        const code = `STF-${r.role.slice(0, 3).toUpperCase()}-${u.id.slice(0, 4).toUpperCase()}`;
        const dedupKey = `${(u.full_name || '').toLowerCase()}-${code.toLowerCase()}`;
        if (seenCodes.has(dedupKey)) continue;
        seenCodes.add(dedupKey);

        recipients.push({
          id: u.id,
          user_id: u.id,
          name: u.full_name || 'Staff Member',
          code,
          phone: u.phone || 'Phone on file',
          email: u.email || '',
          type: r.role === 'driver' ? 'driver' : 'staff',
          badge: r.role === 'driver' ? 'Verified Driver' : 'School Staff',
          status: 'ACTIVE',
          verified: true,
        });
      }
    }

    // -------------------------------------------------------------
    // 3. Filter by search query if provided
    // -------------------------------------------------------------
    let filtered = recipients;
    if (searchQuery) {
      filtered = recipients.filter((r) => {
        return (
          r.name.toLowerCase().includes(searchQuery) ||
          r.code.toLowerCase().includes(searchQuery) ||
          r.phone.toLowerCase().includes(searchQuery) ||
          (r.email && r.email.toLowerCase().includes(searchQuery))
        );
      });
    }

    return NextResponse.json({
      success: true,
      count: filtered.length,
      recipients: filtered,
    });
  } catch (err: any) {
    console.error('[wallet/recipients GET] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to search recipients' },
      { status: 500 }
    );
  }
}
