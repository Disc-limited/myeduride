import { NextRequest, NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { getSessionFromRequest, sessionHasRole } from '@/lib/session';
import { SeerBitClient } from '@/lib/payments/seerbit';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = getSessionFromRequest(request);
  if (!session || !sessionHasRole(session, 'super_admin')) {
    return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || 'generate_all';
    const supabase = getAdminClient();

    if (action === 'reset_all') {
      const { data, error } = await supabase
        .from('wallets')
        .update({
          virtual_account_number: null,
          virtual_bank_name: null,
          virtual_account_name: null,
          virtual_account_reference: null,
          updated_at: new Date().toISOString(),
        })
        .or('virtual_account_number.not.is.null,virtual_bank_name.not.is.null,virtual_account_name.not.is.null,virtual_account_reference.not.is.null')
        .select('id');

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: `Successfully reverted virtual accounts on ${data?.length || 0} wallets.`,
        count: data?.length || 0,
      });
    }

    if (action === 'generate_all') {
      // Find all wallets needing virtual accounts
      const { data: pendingWallets, error: fetchErr } = await supabase
        .from('wallets')
        .select('id, user_id, school_id, entity_type')
        .is('virtual_account_number', null)
        .neq('entity_type', 'platform_treasury');

      if (fetchErr) {
        return NextResponse.json({ error: fetchErr.message }, { status: 500 });
      }

      const walletsToProcess = pendingWallets || [];
      let successCount = 0;
      const errors: Array<{ walletId: string; error: string }> = [];

      for (const w of walletsToProcess) {
        try {
          let recipientName = 'DISC Partner';
          let recipientEmail = 'support@myeduride.com';
          let recipientPhone: string | undefined = undefined;

          if (w.user_id) {
            const { data: u } = await supabase
              .from('user_profiles')
              .select('full_name, email, phone')
              .eq('id', w.user_id)
              .maybeSingle();
            if (u) {
              recipientName = u.full_name || recipientName;
              recipientEmail = u.email || recipientEmail;
              recipientPhone = u.phone || undefined;
            }
          } else if (w.school_id) {
            const { data: s } = await supabase
              .from('schools')
              .select('name')
              .eq('id', w.school_id)
              .maybeSingle();
            if (s?.name) {
              recipientName = s.name;
            }
          }

          const prefix = w.entity_type === 'parent' ? 'PAR' : w.entity_type === 'escort' ? 'ESC' : w.entity_type === 'school' ? 'SCH' : 'SYS';
          const targetId = (w.user_id || w.school_id || 'DISC').toString().replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
          const vRef = `VIRT-${prefix}-${targetId}-${Date.now().toString().slice(-6)}`;

          const virtualAcc = await SeerBitClient.createVirtualAccount({
            fullName: recipientName,
            email: recipientEmail,
            phoneNumber: recipientPhone,
            reference: vRef,
          });

          if (virtualAcc?.accountNumber) {
            await supabase
              .from('wallets')
              .update({
                virtual_account_number: virtualAcc.accountNumber,
                virtual_bank_name: virtualAcc.bankName || null,
                virtual_account_name: virtualAcc.accountName || null,
                virtual_account_reference: vRef,
                updated_at: new Date().toISOString(),
              })
              .eq('id', w.id);
            successCount++;
          }
        } catch (itemErr: any) {
          errors.push({ walletId: w.id, error: itemErr.message || 'Failed to issue account' });
        }
      }

      return NextResponse.json({
        success: true,
        message: `Generated virtual accounts for ${successCount} of ${walletsToProcess.length} wallets.`,
        generated_count: successCount,
        total_pending: walletsToProcess.length,
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    return NextResponse.json({ error: 'Invalid action. Supported actions: generate_all, reset_all' }, { status: 400 });
  } catch (err: any) {
    console.error('[batch-virtual-accounts API error]:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

