-- ==============================================================================
-- Migration 031: School Gate System Daily Billing & Stored Procedure
-- Phase 3.1: Automated Daily Gate Fee Deduction & Audit Trail
-- Standards: Pessimistic Row Locking (SELECT FOR UPDATE), Idempotency, Immutable Ledger
-- ==============================================================================

-- 1. Ensure daily_gate_fee_kobo column exists on schools table (Default: ₦2,500/day = 250,000 kobo)
ALTER TABLE public.schools 
  ADD COLUMN IF NOT EXISTS daily_gate_fee_kobo BIGINT NOT NULL DEFAULT 250000;

-- 2. Ensure unique active wallet index per school exists
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallets_school_entity_unique 
  ON public.wallets(school_id, entity_type) 
  WHERE entity_type = 'school' AND school_id IS NOT NULL;

-- 3. Stored Procedure: Execute Daily School Gate Access Fee Deduction
CREATE OR REPLACE FUNCTION public.execute_daily_school_gate_deduction(
  p_school_id UUID,
  p_date      DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_school             RECORD;
  v_wallet             RECORD;
  v_fee_kobo           BIGINT;
  v_reference          VARCHAR(120);
  v_date_str           VARCHAR(8);
  v_existing_tx        RECORD;
  v_tx_id              UUID;
  v_new_balance        BIGINT;
BEGIN
  -- 1. Validate School Exists
  SELECT id, name, COALESCE(daily_gate_fee_kobo, 250000) AS daily_gate_fee_kobo
  INTO v_school
  FROM public.schools
  WHERE id = p_school_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'SCHOOL_NOT_FOUND',
      'error', 'Specified school does not exist'
    );
  END IF;

  v_fee_kobo := v_school.daily_gate_fee_kobo;
  v_date_str := to_char(p_date, 'YYYYMMDD');
  v_reference := 'GATE-SYS-' || p_school_id::text || '-' || v_date_str;

  -- 2. Idempotency Check: Verify if gate fee has already been deducted for this date
  SELECT id, reference, amount_kobo, created_at INTO v_existing_tx
  FROM public.wallet_transactions
  WHERE reference = v_reference
     OR (wallet_id IN (SELECT id FROM public.wallets WHERE school_id = p_school_id AND entity_type = 'school')
         AND channel = 'GATE_SYSTEM_DAILY_ACCESS'
         AND metadata->>'date' = p_date::text)
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'status', 'ALREADY_DEDUCTED',
      'message', 'Daily gate access fee has already been deducted for this school on ' || p_date::text,
      'reference', v_existing_tx.reference,
      'amount_kobo', v_existing_tx.amount_kobo,
      'amount_ngn', (v_existing_tx.amount_kobo::NUMERIC / 100),
      'deducted_at', v_existing_tx.created_at
    );
  END IF;

  -- 3. Lock School Wallet Row FOR UPDATE (Pessimistic Concurrency Control)
  SELECT * INTO v_wallet
  FROM public.wallets
  WHERE school_id = p_school_id AND entity_type = 'school'
  FOR UPDATE;

  -- If absent, provision active institutional wallet atomically
  IF NOT FOUND THEN
    INSERT INTO public.wallets (
      entity_type,
      school_id,
      currency,
      available_balance_kobo,
      reserved_balance_kobo,
      escrow_balance_kobo,
      locked_balance_kobo,
      pending_earnings_kobo,
      status
    ) VALUES (
      'school',
      p_school_id,
      'NGN',
      0,
      0,
      0,
      0,
      0,
      'active'
    )
    ON CONFLICT (school_id, entity_type) WHERE entity_type = 'school' AND school_id IS NOT NULL
    DO UPDATE SET updated_at = NOW()
    RETURNING * INTO v_wallet;
  END IF;

  -- 4. Check for Fee Waiver (e.g. 0 kobo for complimentary tiers)
  IF v_fee_kobo <= 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'status', 'WAIVED_ZERO_FEE',
      'message', 'School gate fee is configured as zero (complimentary tier)',
      'school_id', p_school_id,
      'date', p_date::text
    );
  END IF;

  -- 5. Solvency Check: Available balance vs Daily Gate Fee
  IF v_wallet.available_balance_kobo < v_fee_kobo THEN
    RETURN jsonb_build_object(
      'success', false,
      'status', 'INSUFFICIENT_FUNDS',
      'message', 'School wallet has insufficient funds to settle daily gate fee',
      'school_id', p_school_id,
      'wallet_id', v_wallet.id,
      'available_balance_kobo', v_wallet.available_balance_kobo,
      'available_balance_ngn', (v_wallet.available_balance_kobo::NUMERIC / 100),
      'required_fee_kobo', v_fee_kobo,
      'required_fee_ngn', (v_fee_kobo::NUMERIC / 100),
      'shortfall_kobo', (v_fee_kobo - v_wallet.available_balance_kobo),
      'shortfall_ngn', ((v_fee_kobo - v_wallet.available_balance_kobo)::NUMERIC / 100)
    );
  END IF;

  -- 6. Execute Atomic Debit
  v_new_balance := v_wallet.available_balance_kobo - v_fee_kobo;

  UPDATE public.wallets
  SET available_balance_kobo = v_new_balance,
      updated_at = NOW()
  WHERE id = v_wallet.id;

  -- 7. Write Immutable Ledger Row with Double-Entry Audit Trail
  INSERT INTO public.wallet_transactions (
    wallet_id,
    transaction_type,
    channel,
    amount_kobo,
    balance_before_kobo,
    balance_after_kobo,
    reference,
    status,
    description,
    metadata
  ) VALUES (
    v_wallet.id,
    'DEBIT',
    'GATE_SYSTEM_DAILY_ACCESS',
    v_fee_kobo,
    v_wallet.available_balance_kobo,
    v_new_balance,
    v_reference,
    'COMPLETED',
    'Daily Gate Management System Access Fee - ' || to_char(p_date, 'DD Mon YYYY'),
    jsonb_build_object(
      'school_id', p_school_id,
      'school_name', v_school.name,
      'billing_type', 'GATE_SYSTEM_DAILY_ACCESS',
      'date', p_date::text,
      'fee_kobo', v_fee_kobo,
      'fee_ngn', (v_fee_kobo::NUMERIC / 100)
    )
  )
  RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'DEDUCTED',
    'transaction_id', v_tx_id,
    'reference', v_reference,
    'school_id', p_school_id,
    'wallet_id', v_wallet.id,
    'amount_kobo', v_fee_kobo,
    'amount_ngn', (v_fee_kobo::NUMERIC / 100),
    'balance_before_kobo', v_wallet.available_balance_kobo,
    'balance_before_ngn', (v_wallet.available_balance_kobo::NUMERIC / 100),
    'balance_after_kobo', v_new_balance,
    'balance_after_ngn', (v_new_balance::NUMERIC / 100),
    'deducted_at', NOW()
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
