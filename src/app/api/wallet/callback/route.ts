import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Universal Multi-Entity Wallet Callback Router
 * 1. Resolves transaction reference from SeerBit.
 * 2. Restores user session cookie so cross-origin redirects never get kicked to /auth/login.
 * 3. Intelligently redirects to School Admin, Parent, or Escort wallet portal.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const reference =
    searchParams.get('reference') ||
    searchParams.get('paymentReference') ||
    searchParams.get('trxref') ||
    '';

  if (!reference) {
    return NextResponse.redirect(`${origin}/dashboard`);
  }

  const supabase = getAdminClient();

  // 1. Locate Payment Intent to determine Entity & User identity
  const { data: intent } = await supabase
    .from('payment_intents')
    .select('*, wallet:wallets(id, entity_type, school_id)')
    .eq('reference', reference)
    .maybeSingle();

  // 2. Determine target destination dashboard
  let destination = '/dashboard';
  const entityType =
    intent?.metadata?.entity_type ||
    (intent?.wallet as any)?.entity_type ||
    (reference.startsWith('MYEDU-SCH-') ? 'school' : reference.startsWith('MYEDU-ESC-') ? 'escort' : 'parent');

  if (entityType === 'school' || reference.startsWith('MYEDU-SCH-')) {
    destination = `/dashboard/school-admin/wallet?reference=${encodeURIComponent(reference)}`;
  } else if (entityType === 'escort' || reference.startsWith('MYEDU-ESC-')) {
    destination = `/dashboard/escort/wallet?reference=${encodeURIComponent(reference)}`;
  } else {
    destination = `/dashboard/parent?tab=wallet&reference=${encodeURIComponent(reference)}`;
  }

  const redirectResponse = NextResponse.redirect(new URL(destination, origin));

  // 3. Session Restoration Guard:
  // If user was redirected cross-origin or cookie was stripped, restore session directly from DB
  const userId = intent?.user_id;
  if (userId) {
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, username, email, full_name, phone, avatar_url')
        .eq('id', userId)
        .single();

      const { data: userRoles } = await supabase
        .from('user_school_roles')
        .select('school_id, role, is_active')
        .eq('user_id', userId)
        .eq('is_active', true);

      const targetSchoolId =
        intent?.metadata?.school_id ||
        (intent?.wallet as any)?.school_id ||
        (userRoles || [])[0]?.school_id;

      let primarySchool: any = null;
      if (targetSchoolId) {
        const { data: school } = await supabase
          .from('schools')
          .select('id, name, logo_url, welcome_message, gps_lat, gps_lng, address, location_address, location_landmark, location_pinned_at')
          .eq('id', targetSchoolId)
          .single();
        if (school) primarySchool = school;
      }

      if (profile) {
        const sessionPayload = {
          user_id: profile.id,
          username: profile.username,
          email: profile.email,
          full_name: profile.full_name,
          phone: profile.phone ?? null,
          avatar_url: profile.avatar_url ?? null,
          roles: userRoles || [],
          primary_school: primarySchool,
        };

        const sessionData = JSON.stringify(sessionPayload);

        // Set session cookie on the redirect response
        redirectResponse.cookies.set('myeduride_session', sessionData, {
          httpOnly: false,
          secure: false,
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7,
          path: '/',
        });
      }
    } catch (sessionErr) {
      console.warn('[WalletCallback] Session restoration notice:', sessionErr);
    }
  }

  return redirectResponse;
}
