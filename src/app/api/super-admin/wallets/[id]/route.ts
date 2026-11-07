import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest, sessionHasRole } from '@/lib/session';
import { writeAuditLog } from '@/lib/audit/log';
import { SeerBitClient } from '@/lib/payments/seerbit';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/super-admin/wallets/[id]
 * Read single wallet with enriched user/school profile, recent ledger transactions,
 * and escrow holds.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = getSessionFromRequest(request);
  if (!session || !sessionHasRole(session, 'super_admin')) {
    return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Wallet ID is required' }, { status: 400 });
  }

  try {
    const supabase = getAdminClient();

    // 1. Fetch wallet
    const { data: wallet, error: walletErr } = await supabase
      .from('wallets')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (walletErr || !wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    // 2. Fetch associated user profile, school, transactions, and escrow holds in parallel
    const [userRes, schoolRes, txRes, escrowRes] = await Promise.all([
      wallet.user_id
        ? supabase.from('user_profiles').select('*').eq('id', wallet.user_id).maybeSingle()
        : Promise.resolve({ data: null }),
      wallet.school_id
        ? supabase.from('schools').select('*').eq('id', wallet.school_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from('wallet_transactions')
        .select('*')
        .eq('wallet_id', id)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('escrow_holds')
        .select('*')
        .or(`parent_wallet_id.eq.${id},escort_wallet_id.eq.${id}`)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    const user = userRes.data;
    const school = schoolRes.data;

    let displayName = 'Platform Treasury';
    if (wallet.entity_type === 'school') {
      displayName = school?.name || wallet.virtual_account_name || 'School Account';
    } else if (user?.full_name) {
      displayName = user.full_name;
    } else if (wallet.virtual_account_name) {
      displayName = wallet.virtual_account_name;
    }

    const enrichedWallet = {
      ...wallet,
      owner_name: displayName,
      owner_email: user?.email || null,
      owner_phone: user?.phone || null,
      owner_username: user?.username || null,
      school_name: school?.name || null,
      available_balance_ngn: (wallet.available_balance_kobo || 0) / 100,
      reserved_balance_ngn: (wallet.reserved_balance_kobo || 0) / 100,
      pending_earnings_ngn: (wallet.pending_earnings_kobo || 0) / 100,
      escrow_balance_ngn: (wallet.escrow_balance_kobo || 0) / 100,
    };

    const formattedTransactions = (txRes.data || []).map((t) => ({
      ...t,
      amount_ngn: (t.amount_kobo || 0) / 100,
      balance_before_ngn: (t.balance_before_kobo || 0) / 100,
      balance_after_ngn: (t.balance_after_kobo || 0) / 100,
    }));

    return NextResponse.json({
      success: true,
      wallet: enrichedWallet,
      user,
      school,
      transactions: formattedTransactions,
      escrow_holds: escrowRes.data || [],
    });
  } catch (error: any) {
    console.error(`[super-admin/wallets/${id} GET] Error:`, error);
    return NextResponse.json({ error: error.message || 'Failed to read wallet' }, { status: 500 });
  }
}

/**
 * PATCH / PUT /api/super-admin/wallets/[id]
 * Updates wallet status, virtual/payout bank details, or performs double-entry admin ledger adjustment.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = getSessionFromRequest(request);
  if (!session || !sessionHasRole(session, 'super_admin')) {
    return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Wallet ID is required' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const {
      status,
      virtual_account_number,
      virtual_bank_name,
      virtual_account_name,
      virtual_account_reference,
      payout_bank_code,
      payout_account_number,
      payout_account_name,
      payout_bank_verified,
      adjustment, // { type: 'CREDIT' | 'DEBIT', amount_ngn: number, reason: string }
    } = body;

    const supabase = getAdminClient();

    // 1. Fetch current wallet state
    const { data: currentWallet, error: fetchErr } = await supabase
      .from('wallets')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !currentWallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    let newAvailableKobo = currentWallet.available_balance_kobo || 0;
    let adjustmentRecorded = null;

    // 2. Perform Double-Entry Admin Balance Adjustment if requested
    if (adjustment && adjustment.amount_ngn && Number(adjustment.amount_ngn) > 0) {
      const adjAmountNgn = Number(adjustment.amount_ngn);
      const adjAmountKobo = Math.round(adjAmountNgn * 100);
      const adjType = (adjustment.type || 'CREDIT').toUpperCase();
      const reason = adjustment.reason?.trim() || 'Super Admin manual adjustment';

      if (!['CREDIT', 'DEBIT'].includes(adjType)) {
        return NextResponse.json({ error: "adjustment.type must be either 'CREDIT' or 'DEBIT'" }, { status: 400 });
      }

      if (adjType === 'DEBIT') {
        if (newAvailableKobo < adjAmountKobo) {
          return NextResponse.json(
            {
              error: `Insufficient available balance to debit. Current: ₦${(newAvailableKobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}, Attempted: ₦${adjAmountNgn.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`,
            },
            { status: 400 }
          );
        }
        newAvailableKobo -= adjAmountKobo;
      } else {
        newAvailableKobo += adjAmountKobo;
      }

      // Record immutable ledger transaction
      const txRef = `ADMIN-ADJ-${id.slice(0, 6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
      const { data: tx, error: txErr } = await supabase
        .from('wallet_transactions')
        .insert({
          wallet_id: id,
          transaction_type: adjType,
          channel: 'ADMIN_MANUAL_ADJUSTMENT',
          reference: txRef,
          amount_kobo: adjAmountKobo,
          balance_before_kobo: currentWallet.available_balance_kobo || 0,
          balance_after_kobo: newAvailableKobo,
          status: 'COMPLETED',
          description: `Admin ${adjType}: ${reason}`,
          metadata: {
            admin_user_id: session.user_id,
            admin_email: session.email,
            reason,
            timestamp: new Date().toISOString(),
          },
        })
        .select()
        .single();

      if (txErr) {
        console.error('[super-admin/wallets PATCH] Error recording transaction:', txErr);
        return NextResponse.json({ error: 'Failed to record adjustment in transaction ledger' }, { status: 500 });
      }

      adjustmentRecorded = tx;
    }

    // 3. Prepare wallet updates
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
      available_balance_kobo: newAvailableKobo,
      balance: newAvailableKobo / 100,
    };

    // Auto-generate SeerBit Virtual Account if requested
    if (body.generate_virtual_account || body.action === 'generate_virtual_account') {
      try {
        let recipientName = currentWallet.virtual_account_name || 'MyEduRide User';
        let recipientEmail = 'support@myeduride.com';
        let recipientPhone: string | undefined = undefined;

        if (currentWallet.user_id) {
          const { data: u } = await supabase.from('user_profiles').select('full_name, email, phone').eq('id', currentWallet.user_id).maybeSingle();
          if (u) {
            recipientName = u.full_name || recipientName;
            recipientEmail = u.email || recipientEmail;
            recipientPhone = u.phone || undefined;
          }
        } else if (currentWallet.school_id) {
          const { data: s } = await supabase.from('schools').select('name').eq('id', currentWallet.school_id).maybeSingle();
          if (s) {
            recipientName = s.name || recipientName;
          }
        }

        const prefix = currentWallet.entity_type === 'parent' ? 'PAR' : currentWallet.entity_type === 'escort' ? 'ESC' : currentWallet.entity_type === 'school' ? 'SCH' : 'SYS';
        const targetId = (currentWallet.user_id || currentWallet.school_id || 'DISC').toString().replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
        const vRef = currentWallet.virtual_account_reference || `VIRT-${prefix}-${targetId}-${Math.floor(1000 + Math.random() * 9000)}`;

        const virtualAcc = await SeerBitClient.createVirtualAccount({
          fullName: recipientName,
          email: recipientEmail,
          phoneNumber: recipientPhone,
          reference: vRef,
        });

        if (virtualAcc?.accountNumber) {
          updates.virtual_account_number = virtualAcc.accountNumber;
          updates.virtual_bank_name = virtualAcc.bankName || 'Wema Bank (SeerBit)';
          updates.virtual_account_name = virtualAcc.accountName || `MYEDURIDE / ${recipientName.toUpperCase()}`;
          updates.virtual_account_reference = vRef;
        }
      } catch (vaErr) {
        console.warn('[super-admin/wallets PATCH] SeerBit virtual account generation error:', vaErr);
      }
    }

    if (status !== undefined) updates.status = status;
    if (virtual_account_number !== undefined) updates.virtual_account_number = virtual_account_number || null;
    if (virtual_bank_name !== undefined) updates.virtual_bank_name = virtual_bank_name || null;
    if (virtual_account_name !== undefined) updates.virtual_account_name = virtual_account_name || null;
    if (virtual_account_reference !== undefined) updates.virtual_account_reference = virtual_account_reference || null;
    if (payout_bank_code !== undefined) updates.payout_bank_code = payout_bank_code || null;
    if (payout_account_number !== undefined) updates.payout_account_number = payout_account_number || null;
    if (payout_account_name !== undefined) updates.payout_account_name = payout_account_name || null;
    if (payout_bank_verified !== undefined) updates.payout_bank_verified = Boolean(payout_bank_verified);

    const { data: updatedWallet, error: updateErr } = await supabase
      .from('wallets')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateErr) {
      console.error('[super-admin/wallets PATCH] Update error:', updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // 4. Audit Log
    await writeAuditLog(supabase, {
      actor_user_id: session.user_id,
      action: 'admin_update_wallet',
      entity_type: 'wallet',
      entity_id: id,
      details: {
        updates,
        adjustmentRecorded: adjustmentRecorded ? { type: adjustment.type, amount: adjustment.amount_ngn } : null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Wallet updated successfully',
      wallet: {
        ...updatedWallet,
        available_balance_ngn: (updatedWallet.available_balance_kobo || 0) / 100,
      },
      adjustment: adjustmentRecorded,
    });
  } catch (error: any) {
    console.error(`[super-admin/wallets/${id} PATCH] Error:`, error);
    return NextResponse.json({ error: error.message || 'Failed to update wallet' }, { status: 500 });
  }
}

/**
 * DELETE /api/super-admin/wallets/[id]
 * Safely deletes a wallet with audit log and balance safeguards.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = getSessionFromRequest(request);
  if (!session || !sessionHasRole(session, 'super_admin')) {
    return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Wallet ID is required' }, { status: 400 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    const supabase = getAdminClient();

    // 1. Fetch wallet to inspect balance and type
    const { data: wallet, error: fetchErr } = await supabase
      .from('wallets')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    // Prevent accidental deletion of primary platform treasury
    if (wallet.entity_type === 'platform_treasury' && !force) {
      return NextResponse.json(
        { error: 'Cannot delete the Platform Treasury wallet. You may freeze or reset its balance instead.' },
        { status: 400 }
      );
    }

    // 2. Financial Safety Check: Non-zero liquid funds
    const totalLiquidKobo = (wallet.available_balance_kobo || 0) + (wallet.reserved_balance_kobo || 0) + (wallet.escrow_balance_kobo || 0);
    if (totalLiquidKobo > 0 && !force) {
      const balanceNgn = totalLiquidKobo / 100;
      return NextResponse.json(
        {
          error: `Wallet holds liquid funds of ₦${balanceNgn.toLocaleString('en-NG', { minimumFractionDigits: 2 })}. Please debit or zero out funds before deleting, or pass force=true.`,
          balance_ngn: balanceNgn,
        },
        { status: 400 }
      );
    }

    // 3. Clean up associated ledger foreign key records if any exist
    await supabase.from('wallet_transactions').delete().eq('wallet_id', id);
    await supabase.from('escrow_holds').delete().or(`parent_wallet_id.eq.${id},escort_wallet_id.eq.${id}`);

    // 4. Delete the wallet
    const { error: deleteErr } = await supabase
      .from('wallets')
      .delete()
      .eq('id', id);

    if (deleteErr) {
      console.error('[super-admin/wallets DELETE] Error:', deleteErr);
      return NextResponse.json({ error: deleteErr.message }, { status: 500 });
    }

    // 5. Audit Log
    await writeAuditLog(supabase, {
      actor_user_id: session.user_id,
      action: 'admin_delete_wallet',
      entity_type: 'wallet',
      entity_id: id,
      details: {
        entity_type: wallet.entity_type,
        user_id: wallet.user_id,
        school_id: wallet.school_id,
        wiped_balance_kobo: totalLiquidKobo,
        forced: force,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Wallet successfully deleted',
      deleted_wallet_id: id,
    });
  } catch (error: any) {
    console.error(`[super-admin/wallets/${id} DELETE] Error:`, error);
    return NextResponse.json({ error: error.message || 'Failed to delete wallet' }, { status: 500 });
  }
}

