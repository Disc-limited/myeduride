import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest, sessionHasRole } from '@/lib/session';
import { authEmailFromUsername, isValidUsername, normalizeUsername } from '@/lib/auth/username';
import { TIME_FIELDS, timeInputToDb } from '@/lib/time-input';
import { writeAuditLog } from '@/lib/audit/log';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    if (!session || !sessionHasRole(session, 'super_admin')) {
      return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const {
      school_id,
      name,
      address,
      primary_color,
      secondary_color,
      admin_user_id,
      admin_name,
      admin_email,
      admin_phone,
      admin_username,
    } = body;

    if (!school_id) {
      return NextResponse.json({ error: 'school_id is required' }, { status: 400 });
    }

    const supabase = getAdminClient();

    // 1. Verify school exists
    const { data: existingSchool, error: schoolFetchErr } = await supabase
      .from('schools')
      .select('id, name')
      .eq('id', school_id)
      .single();

    if (schoolFetchErr || !existingSchool) {
      return NextResponse.json({ error: 'School not found' }, { status: 404 });
    }

    // 2. Prepare school updates
    const schoolUpdates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) {
      const trimmedName = String(name).trim();
      if (!trimmedName) {
        return NextResponse.json({ error: 'School name cannot be empty' }, { status: 400 });
      }
      schoolUpdates.name = trimmedName;
    }

    if (address !== undefined) {
      schoolUpdates.address = address?.trim() || null;
    }
    if (primary_color !== undefined) {
      schoolUpdates.primary_color = primary_color?.trim() || '#1B4D3E';
    }
    if (secondary_color !== undefined) {
      schoolUpdates.secondary_color = secondary_color?.trim() || '#D4A017';
    }

    for (const tf of TIME_FIELDS) {
      if (body[tf] !== undefined) {
        const val = String(body[tf]).trim();
        const dbTime = val ? timeInputToDb(val) : null;
        if (dbTime) schoolUpdates[tf] = dbTime;
      }
    }

    const { error: schoolUpdateErr } = await supabase
      .from('schools')
      .update(schoolUpdates)
      .eq('id', school_id);

    if (schoolUpdateErr) {
      console.error('[super-admin/schools/update] school update failed:', schoolUpdateErr);
      return NextResponse.json({ error: schoolUpdateErr.message }, { status: 500 });
    }

    // 3. Update School Admin Account if specified
    let targetAdminUserId = admin_user_id;

    if (!targetAdminUserId) {
      // Find school admin for this school
      const { data: adminRole } = await supabase
        .from('user_school_roles')
        .select('user_id')
        .eq('school_id', school_id)
        .eq('role', 'school_admin')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (adminRole?.user_id) {
        targetAdminUserId = adminRole.user_id;
      }
    }

    if (targetAdminUserId) {
      const { data: adminProfile } = await supabase
        .from('user_profiles')
        .select('id, username, full_name, email, phone')
        .eq('id', targetAdminUserId)
        .maybeSingle();

      if (adminProfile) {
        const adminProfileUpdates: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };

        let finalUsername = adminProfile.username;
        if (admin_username && admin_username.trim() !== adminProfile.username) {
          finalUsername = normalizeUsername(admin_username);
          if (!isValidUsername(finalUsername)) {
            return NextResponse.json(
              { error: 'Username must be 3–30 characters (letters, numbers, underscore only)' },
              { status: 400 }
            );
          }

          // Check username uniqueness
          const { data: existingUser } = await supabase
            .from('user_profiles')
            .select('id')
            .eq('username', finalUsername)
            .neq('id', targetAdminUserId)
            .maybeSingle();

          if (existingUser) {
            return NextResponse.json(
              { error: `Username @${finalUsername} is already taken` },
              { status: 409 }
            );
          }
          adminProfileUpdates.username = finalUsername;
        }

        // Email address update (effective immediately)
        let normalizedEmail = adminProfile.email;
        if (admin_email !== undefined) {
          normalizedEmail = admin_email?.trim() ? admin_email.toLowerCase().trim() : null;

          if (normalizedEmail && normalizedEmail !== adminProfile.email) {
            // Check email format
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
              return NextResponse.json(
                { error: 'Invalid email address format' },
                { status: 400 }
              );
            }

            // Check email uniqueness
            const { data: existingEmailUser } = await supabase
              .from('user_profiles')
              .select('id, username')
              .eq('email', normalizedEmail)
              .neq('id', targetAdminUserId)
              .maybeSingle();

            if (existingEmailUser) {
              return NextResponse.json(
                { error: `Email "${normalizedEmail}" is already in use by @${existingEmailUser.username}` },
                { status: 409 }
              );
            }
          }
          adminProfileUpdates.email = normalizedEmail;
        }

        if (admin_name !== undefined) {
          adminProfileUpdates.full_name = admin_name?.trim() || adminProfile.full_name;
        }

        if (admin_phone !== undefined) {
          adminProfileUpdates.phone = admin_phone?.trim() || null;
        }

        // Update profile in DB
        const { error: profileErr } = await supabase
          .from('user_profiles')
          .update(adminProfileUpdates)
          .eq('id', targetAdminUserId);

        if (profileErr) {
          console.error('[super-admin/schools/update] profile update failed:', profileErr);
          return NextResponse.json({ error: profileErr.message }, { status: 500 });
        }

        // Synchronize with Supabase Auth (effective immediately)
        const authEmail = authEmailFromUsername(finalUsername);
        const { error: authErr } = await supabase.auth.admin.updateUserById(targetAdminUserId, {
          email: authEmail,
          email_confirm: true,
          user_metadata: {
            username: finalUsername,
            full_name: adminProfileUpdates.full_name || adminProfile.full_name,
            email: normalizedEmail,
          },
        });

        if (authErr) {
          console.warn('[super-admin/schools/update] auth update warning:', authErr.message);
        }
      }
    }

    // Write audit log
    await writeAuditLog(supabase, {
      actor_user_id: session.user_id,
      action: 'school_updated_by_super_admin',
      details: {
        school_id,
        school_name: schoolUpdates.name || existingSchool.name,
        admin_user_id: targetAdminUserId || null,
        admin_email: admin_email || null,
      },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: 'School information and administrator details updated successfully',
    });
  } catch (err: any) {
    console.error('[super-admin/schools/update] crash:', err);
    return NextResponse.json({ error: err?.message || 'Failed to update school' }, { status: 500 });
  }
}
