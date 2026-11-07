import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest, sessionHasRole } from '@/lib/session';
import { writeAuditLog } from '@/lib/audit/log';
import { SeerBitClient } from '@/lib/payments/seerbit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/super-admin/wallets
 * Lists all system wallets with owner enrichments, available candidates for wallet creation,
 * and aggregated financial metrics.
 */
export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session || !sessionHasRole(session, 'super_admin')) {
    return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
  }

  try {
    const supabase = getAdminClient();

    // Fetch wallets, users, and schools in parallel
    const [walletsRes, usersRes, schoolsRes] = await Promise.all([
      supabase
        .from('wallets')
        .select('*')
        .order('created_at', { ascending: false }),

      supabase
        .from('user_profiles')
        .select('id, full_name, email, phone, username, avatar_url')
        .order('full_name', { ascending: true }),

      supabase
        .from('schools')
        .select('id, name, logo_url')
        .order('name', { ascending: true }),
    ]);

    if (walletsRes.error) {
      throw new Error(walletsRes.error.message);
    }

    const rawWallets = walletsRes.data || [];
    const allUsers = usersRes.data || [];
    const allSchools = schoolsRes.data || [];

    const usersMap = new Map<string, any>();
    allUsers.forEach((u) => usersMap.set(u.id, u));

    const schoolsMap = new Map<string, any>();
    allSchools.forEach((s) => schoolsMap.set(s.id, s));

    // Enrich wallets
    const wallets = rawWallets.map((w) => {
      const user = w.user_id ? usersMap.get(w.user_id) : null;
      const school = w.school_id ? schoolsMap.get(w.school_id) : null;

      let displayName = 'Platform Treasury';
      if (w.entity_type === 'school') {
        displayName = school?.name || w.virtual_account_name || 'School Account';
      } else if (user?.full_name) {
        displayName = user.full_name;
      } else if (w.virtual_account_name) {
        displayName = w.virtual_account_name;
      } else if (w.payout_account_name) {
        displayName = w.payout_account_name;
      }

      return {
        ...w,
        owner_name: displayName,
        owner_username: user?.username || null,
        owner_email: user?.email || null,
        owner_phone: user?.phone || null,
        owner_avatar: user?.avatar_url || null,
        school_name: school?.name || null,
        available_balance_ngn: (w.available_balance_kobo || 0) / 100,
        reserved_balance_ngn: (w.reserved_balance_kobo || 0) / 100,
        pending_earnings_ngn: (w.pending_earnings_kobo || 0) / 100,
        escrow_balance_ngn: (w.escrow_balance_kobo || 0) / 100,
        locked_balance_ngn: (w.locked_balance_kobo || 0) / 100,
      };
    });

    // Compute key statistics
    const totalWallets = wallets.length;
    const activeWallets = wallets.filter((w) => (w.status || 'active').toLowerCase() === 'active').length;
    const frozenWallets = wallets.filter((w) => ['frozen', 'suspended', 'closed'].includes((w.status || '').toLowerCase())).length;
    const totalFloatNgn = wallets.reduce((acc, w) => acc + w.available_balance_ngn, 0);
    const totalReservedNgn = wallets.reduce((acc, w) => acc + w.reserved_balance_ngn + w.pending_earnings_ngn, 0);

    // Identify users and schools without wallets for quick creation selection
    const userWalletKeys = new Set(
      rawWallets.filter((w) => w.user_id).map((w) => `${w.user_id}_${w.entity_type}`)
    );
    const schoolWalletIds = new Set(
      rawWallets.filter((w) => w.entity_type === 'school' && w.school_id).map((w) => w.school_id)
    );

    const candidateUsers = allUsers.slice(0, 150).map((u) => ({
      id: u.id,
      full_name: u.full_name || u.username || 'Unnamed User',
      email: u.email,
      phone: u.phone,
      hasParentWallet: userWalletKeys.has(`${u.id}_parent`),
      hasEscortWallet: userWalletKeys.has(`${u.id}_escort`),
    }));

    const candidateSchools = allSchools.map((s) => ({
      id: s.id,
      name: s.name,
      hasWallet: schoolWalletIds.has(s.id),
    }));

    return NextResponse.json({
      success: true,
      stats: {
        total_wallets: totalWallets,
        active_wallets: activeWallets,
        frozen_wallets: frozenWallets,
        total_float_ngn: totalFloatNgn,
        total_reserved_ngn: totalReservedNgn,
      },
      wallets,
      candidateUsers,
      candidateSchools,
    });
  } catch (error: any) {
    console.error('[super-admin/wallets GET] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch wallets' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/super-admin/wallets
 * Creates a new wallet for a user, school, or treasury entity.
 */
export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session || !sessionHasRole(session, 'super_admin')) {
    return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const {
      entity_type,
      user_id,
      school_id,
      initial_balance_ngn = 0,
      status = 'active',
      currency = 'NGN',
      virtual_account_number,
      virtual_bank_name,
      virtual_account_name,
      virtual_account_reference,
      payout_bank_code,
      payout_account_number,
      payout_account_name,
      payout_bank_verified = false,
      notes,
    } = body;

    if (!entity_type) {
      return NextResponse.json({ error: 'entity_type is required' }, { status: 400 });
    }

    if (!['parent', 'escort', 'school', 'platform_treasury'].includes(entity_type)) {
      return NextResponse.json({ error: 'Invalid entity_type' }, { status: 400 });
    }

    const supabase = getAdminClient();

    // 1. Validation according to entity type
    if (entity_type === 'school') {
      if (!school_id) {
        return NextResponse.json({ error: 'school_id is required for a school wallet' }, { status: 400 });
      }
      // Check if school already has a wallet
      const { data: existing } = await supabase
        .from('wallets')
        .select('id')
        .eq('school_id', school_id)
        .eq('entity_type', 'school')
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ error: 'A wallet already exists for this school' }, { status: 409 });
      }
    } else if (entity_type === 'parent' || entity_type === 'escort') {
      if (!user_id) {
        return NextResponse.json({ error: `user_id is required for a ${entity_type} wallet` }, { status: 400 });
      }
      // Check if user already has a wallet of this type
      const { data: existing } = await supabase
        .from('wallets')
        .select('id')
        .eq('user_id', user_id)
        .eq('entity_type', entity_type)
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          { error: `This user already possesses an active ${entity_type} wallet.` },
          { status: 409 }
        );
      }
    } else if (entity_type === 'platform_treasury') {
      const { data: existing } = await supabase
        .from('wallets')
        .select('id')
        .eq('entity_type', 'platform_treasury')
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          { error: 'A platform treasury wallet already exists in the system.' },
          { status: 409 }
        );
      }
    }

    // 2. Resolve virtual account defaults if not explicitly provided
    let vRef = virtual_account_reference;
    let vName = virtual_account_name;
    let vBank = virtual_bank_name || 'Wema Bank (SeerBit)';
    let vNumber = virtual_account_number;

    if (!vRef) {
      const prefix = entity_type === 'parent' ? 'PAR' : entity_type === 'escort' ? 'ESC' : entity_type === 'school' ? 'SCH' : 'SYS';
      const targetId = (user_id || school_id || 'DISC').toString().replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
      vRef = `VIRT-${prefix}-${targetId}-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    if (!vName && user_id) {
      const { data: u } = await supabase.from('user_profiles').select('full_name, email, phone').eq('id', user_id).maybeSingle();
      if (u?.full_name) {
        vName = `MYEDURIDE / ${u.full_name.toUpperCase()}`;
      }
    } else if (!vName && school_id) {
      const { data: s } = await supabase.from('schools').select('name').eq('id', school_id).maybeSingle();
      if (s?.name) {
        vName = `MYEDURIDE / ${s.name.toUpperCase()}`;
      }
    }

    // Auto-provision virtual account via SeerBit if account number is not explicitly supplied
    if (!vNumber && entity_type !== 'platform_treasury') {
      try {
        let recipientName = vName || 'MyEduRide User';
        let recipientEmail = 'support@myeduride.com';
        let recipientPhone: string | undefined = undefined;

        if (user_id) {
          const { data: u } = await supabase.from('user_profiles').select('full_name, email, phone').eq('id', user_id).maybeSingle();
          if (u) {
            recipientName = u.full_name || recipientName;
            recipientEmail = u.email || recipientEmail;
            recipientPhone = u.phone || undefined;
          }
        } else if (school_id) {
          const { data: s } = await supabase.from('schools').select('name').eq('id', school_id).maybeSingle();
          if (s) {
            recipientName = s.name || recipientName;
          }
        }

        const virtualAcc = await SeerBitClient.createVirtualAccount({
          fullName: recipientName,
          email: recipientEmail,
          phoneNumber: recipientPhone,
          reference: vRef,
        });

        if (virtualAcc?.accountNumber) {
          vNumber = virtualAcc.accountNumber;
          vBank = virtualAcc.bankName || vBank;
          vName = virtualAcc.accountName || vName;
        }
      } catch (vaErr) {
        console.warn('[super-admin/wallets POST] Could not auto-provision SeerBit virtual account:', vaErr);
      }
    }

    const initialKobo = Math.max(0, Math.round(Number(initial_balance_ngn || 0) * 100));

    // 3. Insert new wallet
    const { data: newWallet, error: insertError } = await supabase
      .from('wallets')
      .insert({
        user_id: user_id || null,
        school_id: school_id || null,
        entity_type,
        currency,
        available_balance_kobo: initialKobo,
        reserved_balance_kobo: 0,
        escrow_balance_kobo: 0,
        locked_balance_kobo: 0,
        pending_earnings_kobo: 0,
        balance: initialKobo / 100,
        virtual_account_number: vNumber || null,
        virtual_bank_name: vBank,
        virtual_account_name: vName || null,
        virtual_account_reference: vRef,
        payout_bank_code: payout_bank_code || null,
        payout_account_number: payout_account_number || null,
        payout_account_name: payout_account_name || null,
        payout_bank_verified: Boolean(payout_bank_verified),
        status: status || 'active',
      })
      .select()
      .single();

    if (insertError) {
      console.error('[super-admin/wallets POST] Insert error:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // 4. If initial balance > 0, record double-entry transaction record
    if (initialKobo > 0) {
      await supabase.from('wallet_transactions').insert({
        wallet_id: newWallet.id,
        transaction_type: 'CREDIT',
        channel: 'ADMIN_INITIAL_CREDIT',
        reference: `INIT-${newWallet.id.slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`,
        amount_kobo: initialKobo,
        balance_before_kobo: 0,
        balance_after_kobo: initialKobo,
        status: 'COMPLETED',
        description: notes || 'Initial wallet opening credit by Super Admin',
      });
    }

    // 5. Audit Log
    await writeAuditLog(supabase, {
      actor_user_id: session.user_id,
      action: 'admin_create_wallet',
      entity_type: 'wallet',
      entity_id: newWallet.id,
      details: {
        entity_type,
        user_id,
        school_id,
        initial_balance_ngn,
        status,
        notes,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Wallet created successfully',
      wallet: {
        ...newWallet,
        available_balance_ngn: (newWallet.available_balance_kobo || 0) / 100,
      },
    });
  } catch (error: any) {
    console.error('[super-admin/wallets POST] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create wallet' },
      { status: 500 }
    );
  }
}

