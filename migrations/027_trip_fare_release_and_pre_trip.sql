-- ==============================================================================
-- Migration 027: Trip Leg Tracking, Atomic Fare Split & Pre-Trip Authorization
-- Standards: Exact Integer Arithmetic, Pessimistic Locking, Zero-Trust Ledger
-- ==============================================================================

-- 1. Support Platform Treasury Wallet & Flexible User/Entity Constraints
ALTER TABLE public.wallets ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.wallets DROP CONSTRAINT IF EXISTS wallets_user_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_wallets_user_entity_unique 
  ON public.wallets(user_id, entity_type) 
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_wallets_platform_treasury_unique 
  ON public.wallets(entity_type) 
  WHERE entity_type = 'platform_treasury';

-- 2. Seed Default Platform Treasury Wallet if absent
INSERT INTO public.wallets (
  entity_type,
  available_balance_kobo,
  reserved_balance_kobo,
  escrow_balance_kobo,
  locked_balance_kobo,
  pending_earnings_kobo,
  currency,
  status
)
SELECT 
  'platform_treasury',
  0,
  0,
  0,
  0,
  0,
  'NGN',
  'active'
WHERE NOT EXISTS (
  SELECT 1 FROM public.wallets WHERE entity_type = 'platform_treasury'
);

-- 3. ATOMIC PRE-TRIP AUTHORIZATION PROCEDURE
-- Validates available balance, reserves/escrows daily fee, and spawns pickup & dropoff trip_legs
CREATE OR REPLACE FUNCTION public.execute_atomic_trip_authorization(
  p_student_id        UUID,
  p_parent_user_id    UUID,
  p_school_id         UUID,
  p_gross_kobo        BIGINT,
  p_session_id        UUID DEFAULT NULL,
  p_escort_wallet_id  UUID DEFAULT NULL,
  p_reference         VARCHAR(120) DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_parent_wallet     RECORD;
  v_pickup_kobo       BIGINT;
  v_dropoff_kobo      BIGINT;
  v_vat_kobo          BIGINT;
  v_km_kobo           BIGINT;
  v_myeduride_km_kobo BIGINT;
  v_driver_share_kobo BIGINT;
  v_myeduride_total   BIGINT;
  v_hold_id           UUID;
  v_leg_pickup_id     UUID;
  v_leg_dropoff_id    UUID;
  v_ref               VARCHAR(120);
  v_bal_before        BIGINT;
  v_bal_after         BIGINT;
BEGIN
  IF p_gross_kobo <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  -- 1. Find and Lock Parent Wallet
  SELECT * INTO v_parent_wallet 
  FROM public.wallets 
  WHERE user_id = p_parent_user_id AND entity_type = 'parent' 
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Fallback: check any wallet for user
    SELECT * INTO v_parent_wallet 
    FROM public.wallets 
    WHERE user_id = p_parent_user_id 
    ORDER BY created_at ASC 
    LIMIT 1 
    FOR UPDATE;
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'WALLET_NOT_FOUND');
  END IF;

  v_bal_before := v_parent_wallet.available_balance_kobo;

  -- 2. Validate Available Balance (Pillar: Strict Non-Negative Vault)
  IF v_bal_before < p_gross_kobo THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INSUFFICIENT_FUNDS',
      'available_balance_kobo', v_bal_before,
      'required_kobo', p_gross_kobo,
      'available_balance_ngn', v_bal_before / 100.0,
      'required_ngn', p_gross_kobo / 100.0
    );
  END IF;

  v_bal_after := v_bal_before - p_gross_kobo;
  v_ref := COALESCE(p_reference, 'AUTH-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || SUBSTR(p_student_id::text, 1, 8) || '-' || SUBSTR(gen_random_uuid()::text, 1, 6));

  -- 3. Calculate integer split legs (50% pickup, 50% dropoff)
  v_pickup_kobo := p_gross_kobo / 2;
  v_dropoff_kobo := p_gross_kobo - v_pickup_kobo;

  v_vat_kobo          := ROUND(p_gross_kobo * 6::NUMERIC / 100);
  v_km_kobo           := p_gross_kobo - v_vat_kobo;
  v_myeduride_km_kobo := ROUND(v_km_kobo * 20::NUMERIC / 100);
  v_driver_share_kobo := v_km_kobo - v_myeduride_km_kobo;
  v_myeduride_total   := v_vat_kobo + v_myeduride_km_kobo;

  -- 4. Move balance from Available to Escrow
  UPDATE public.wallets
  SET available_balance_kobo = v_bal_after,
      escrow_balance_kobo = escrow_balance_kobo + p_gross_kobo,
      updated_at = NOW()
  WHERE id = v_parent_wallet.id;

  -- 5. Record Transaction in Ledger
  INSERT INTO public.wallet_transactions (
    wallet_id,
    transaction_type,
    channel,
    amount_kobo,
    balance_before_kobo,
    balance_after_kobo,
    reference,
    trip_id,
    student_id,
    status,
    description,
    metadata
  ) VALUES (
    v_parent_wallet.id,
    'DEBIT',
    'TRIP_ESCROW_HOLD',
    p_gross_kobo,
    v_bal_before,
    v_bal_after,
    v_ref,
    p_session_id,
    p_student_id,
    'COMPLETED',
    'Daily school transit fee reserved in secure escrow',
    jsonb_build_object(
      'student_id', p_student_id,
      'school_id', p_school_id,
      'pickup_leg_kobo', v_pickup_kobo,
      'dropoff_leg_kobo', v_dropoff_kobo
    )
  );

  -- 6. Insert Escrow Hold Record
  INSERT INTO public.escrow_holds (
    parent_wallet_id,
    escort_wallet_id,
    school_id,
    trip_id,
    student_id,
    gross_amount_kobo,
    vat_kobo,
    km_charge_kobo,
    myeduride_km_fee_kobo,
    driver_share_kobo,
    myeduride_total_kobo,
    status
  ) VALUES (
    v_parent_wallet.id,
    p_escort_wallet_id,
    p_school_id,
    p_session_id,
    p_student_id,
    p_gross_kobo,
    v_vat_kobo,
    v_km_kobo,
    v_myeduride_km_kobo,
    v_driver_share_kobo,
    v_myeduride_total,
    'HELD'
  ) RETURNING id INTO v_hold_id;

  -- 7. Create Independent Trip Legs (Leg 1: Pickup, Leg 2: Dropoff)
  INSERT INTO public.trip_legs (
    session_id,
    student_id,
    parent_wallet_id,
    escort_wallet_id,
    leg_type,
    amount_kobo,
    status
  ) VALUES (
    p_session_id,
    p_student_id,
    v_parent_wallet.id,
    p_escort_wallet_id,
    'pickup',
    v_pickup_kobo,
    'PENDING'
  ) RETURNING id INTO v_leg_pickup_id;

  INSERT INTO public.trip_legs (
    session_id,
    student_id,
    parent_wallet_id,
    escort_wallet_id,
    leg_type,
    amount_kobo,
    status
  ) VALUES (
    p_session_id,
    p_student_id,
    v_parent_wallet.id,
    p_escort_wallet_id,
    'dropoff',
    v_dropoff_kobo,
    'PENDING'
  ) RETURNING id INTO v_leg_dropoff_id;

  RETURN jsonb_build_object(
    'success', true,
    'authorized', true,
    'reference', v_ref,
    'escrow_hold_id', v_hold_id,
    'pickup_leg_id', v_leg_pickup_id,
    'dropoff_leg_id', v_leg_dropoff_id,
    'gross_amount_kobo', p_gross_kobo,
    'balance_before_kobo', v_bal_before,
    'balance_after_kobo', v_bal_after
  );
END;
$$;

-- 4. ATOMIC FARE RELEASE STORED PROCEDURE
-- Releases held escrow upon completion of both legs: splits VAT, Platform Revenue, and Driver Share
CREATE OR REPLACE FUNCTION public.process_trip_fare_release(
  p_student_id        UUID,
  p_trip_id           UUID DEFAULT NULL,
  p_escort_wallet_id  UUID DEFAULT NULL,
  p_idempotency_key   VARCHAR(120) DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_escrow_hold       RECORD;
  v_parent_wallet     RECORD;
  v_escort_wallet     RECORD;
  v_treasury_wallet   RECORD;
  v_ref               VARCHAR(120);
  v_driver_kobo       BIGINT;
  v_platform_kobo     BIGINT;
  v_gross_kobo        BIGINT;
  v_target_escort_id  UUID;
BEGIN
  -- 1. Idempotency Check: prevent duplicate releases
  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.wallet_transactions 
      WHERE reference = p_idempotency_key OR metadata->>'idempotency_key' = p_idempotency_key
    ) THEN
      RETURN jsonb_build_object('success', true, 'status', 'ALREADY_PROCESSED');
    END IF;
  END IF;

  -- 2. Find Active Escrow Hold
  SELECT * INTO v_escrow_hold 
  FROM public.escrow_holds
  WHERE student_id = p_student_id 
    AND status = 'HELD'
    AND (p_trip_id IS NULL OR trip_id = p_trip_id)
  ORDER BY created_at DESC 
  LIMIT 1 
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'NO_ACTIVE_ESCROW_HOLD');
  END IF;

  v_gross_kobo    := v_escrow_hold.gross_amount_kobo;
  v_driver_kobo   := v_escrow_hold.driver_share_kobo;
  v_platform_kobo := v_escrow_hold.myeduride_total_kobo;

  -- Assert exact integer balance reconciliation
  ASSERT (v_driver_kobo + v_platform_kobo) = v_gross_kobo,
    'FATAL: Integrity check failed — fare split does not sum to gross amount!';

  -- 3. Lock Involved Wallets FOR UPDATE
  SELECT * INTO v_parent_wallet 
  FROM public.wallets 
  WHERE id = v_escrow_hold.parent_wallet_id 
  FOR UPDATE;

  -- Target escort wallet (credit driver share if escort wallet assigned)
  v_target_escort_id := COALESCE(p_escort_wallet_id, v_escrow_hold.escort_wallet_id);

  SELECT * INTO v_treasury_wallet 
  FROM public.wallets 
  WHERE entity_type = 'platform_treasury' 
  LIMIT 1 
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'TREASURY_WALLET_NOT_CONFIGURED');
  END IF;

  -- 4. Deduct Escrow from Parent Wallet
  UPDATE public.wallets
  SET escrow_balance_kobo = GREATEST(0, escrow_balance_kobo - v_gross_kobo),
      updated_at = NOW()
  WHERE id = v_parent_wallet.id;

  -- 5. Credit Driver Pending Earnings (Subject to City Manager settlement/clearance)
  IF v_target_escort_id IS NOT NULL THEN
    SELECT * INTO v_escort_wallet 
    FROM public.wallets 
    WHERE id = v_target_escort_id 
    FOR UPDATE;

    IF FOUND THEN
      UPDATE public.wallets
      SET pending_earnings_kobo = pending_earnings_kobo + v_driver_kobo,
          updated_at = NOW()
      WHERE id = v_escort_wallet.id;

      -- Escort Ledger Credit
      INSERT INTO public.wallet_transactions (
        wallet_id,
        transaction_type,
        channel,
        amount_kobo,
        balance_before_kobo,
        balance_after_kobo,
        reference,
        trip_id,
        student_id,
        status,
        description,
        metadata
      ) VALUES (
        v_escort_wallet.id,
        'CREDIT',
        'DRIVER_FARE_SHARE',
        v_driver_kobo,
        v_escort_wallet.pending_earnings_kobo,
        v_escort_wallet.pending_earnings_kobo + v_driver_kobo,
        'REL-DRV-' || SUBSTR(v_escrow_hold.id::text, 1, 8) || '-' || SUBSTR(gen_random_uuid()::text, 1, 6),
        p_trip_id,
        p_student_id,
        'COMPLETED',
        'Trip fare driver earnings (80% net KM) credited to pending balance',
        jsonb_build_object(
          'escrow_hold_id', v_escrow_hold.id,
          'idempotency_key', p_idempotency_key
        )
      );
    END IF;
  END IF;

  -- 6. Credit Platform Treasury
  UPDATE public.wallets
  SET available_balance_kobo = available_balance_kobo + v_platform_kobo,
      updated_at = NOW()
  WHERE id = v_treasury_wallet.id;

  INSERT INTO public.wallet_transactions (
    wallet_id,
    transaction_type,
    channel,
    amount_kobo,
    balance_before_kobo,
    balance_after_kobo,
    reference,
    trip_id,
    student_id,
    status,
    description,
    metadata
  ) VALUES (
    v_treasury_wallet.id,
    'CREDIT',
    'PLATFORM_COMMISSION',
    v_platform_kobo,
    v_treasury_wallet.available_balance_kobo,
    v_treasury_wallet.available_balance_kobo + v_platform_kobo,
    'REL-PLT-' || SUBSTR(v_escrow_hold.id::text, 1, 8) || '-' || SUBSTR(gen_random_uuid()::text, 1, 6),
    p_trip_id,
    p_student_id,
    'COMPLETED',
    'Platform revenue: 6% VAT + 20% KM commission',
    jsonb_build_object(
      'escrow_hold_id', v_escrow_hold.id,
      'vat_kobo', v_escrow_hold.vat_kobo,
      'km_fee_kobo', v_escrow_hold.myeduride_km_fee_kobo
    )
  );

  -- 7. Update Escrow Hold Status
  UPDATE public.escrow_holds
  SET status = 'RELEASED',
      approved_at = NOW()
  WHERE id = v_escrow_hold.id;

  -- 8. Mark Any Open Trip Legs as COMPLETED
  UPDATE public.trip_legs
  SET status = 'COMPLETED',
      completed_at = COALESCE(completed_at, NOW()),
      updated_at = NOW()
  WHERE student_id = p_student_id 
    AND status IN ('PENDING', 'IN_PROGRESS')
    AND (p_trip_id IS NULL OR session_id = p_trip_id);

  RETURN jsonb_build_object(
    'success', true,
    'status', 'RELEASED',
    'escrow_hold_id', v_escrow_hold.id,
    'gross_amount_kobo', v_gross_kobo,
    'driver_share_kobo', v_driver_kobo,
    'platform_share_kobo', v_platform_kobo,
    'vat_kobo', v_escrow_hold.vat_kobo
  );
END;
$$;
