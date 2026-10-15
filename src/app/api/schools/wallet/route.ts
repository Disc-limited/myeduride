import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSchoolWalletOverview } from '@/lib/school/school-wallet';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session?.user_id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedSchoolId = searchParams.get('school_id');

    const supabase = getAdminClient();

    // 1. Fetch user's active administrative roles for Zero-IDOR isolation
    const { data: userRoles, error: rolesErr } = await supabase
      .from('user_school_roles')
      .select('school_id, role, is_active')
      .eq('user_id', session.user_id)
      .eq('is_active', true);

    if (rolesErr) {
      return NextResponse.json({ error: 'Failed to query permissions' }, { status: 500 });
    }

    const isSuperAdmin = (userRoles || []).some((r) => r.role === 'super_admin');
    const adminSchoolIds = (userRoles || [])
      .filter((r) => r.role === 'school_admin' || r.role === 'super_admin')
      .map((r) => r.school_id)
      .filter(Boolean);

    let targetSchoolId: string | null = null;

    if (requestedSchoolId) {
      // Caller specified a school - ensure they have administrative custody
      if (!isSuperAdmin && !adminSchoolIds.includes(requestedSchoolId)) {
        return NextResponse.json(
          { error: 'Forbidden: Insufficient privileges for requested school' },
          { status: 403 }
        );
      }
      targetSchoolId = requestedSchoolId;
    } else {
      // Pick first accessible admin school
      targetSchoolId =
        adminSchoolIds[0] ||
        (session as any).primary_school?.id ||
        (session.roles || []).find(
          (r: any) => r.role === 'school_admin' || r.role === 'super_admin'
        )?.school_id ||
        null;
    }

    if (!targetSchoolId) {
      return NextResponse.json(
        { error: 'No associated school found with school administrator privileges' },
        { status: 403 }
      );
    }

    // 2. Fetch live wallet overview
    const overview = await getSchoolWalletOverview(targetSchoolId);

    return NextResponse.json({
      success: true,
      ...overview,
    });
  } catch (err: any) {
    console.error('[SchoolsWallet API] GET exception:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
