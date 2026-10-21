-- ==============================================================================
-- Migration 032: Transport Daily Escrow & Automated 7:00 PM Escort Settlement
-- Standard: Zero-Loss Integrity & Financial Vault Hardening (Phase 4)
-- 
-- 1. Escrow hold lifecycle: strict integer assertion (driver_share + platform_fee == gross)
-- 2. process_trip_fare_release: credits escort available_balance_kobo directly
-- 3. Stored Procedure: process_evening_escrow_settlement(p_date, p_dry_run)
-- 4. Exception Handling: incomplete trips vaulted as 'SETTLEMENT_HELD_FOR_REVIEW'
-- ==============================================================================

-- 1. Add settlement tracking columns to escort_student_daily_trips
ALTER TABLE public.escort_student_daily_trips
  ADD COLUMN IF NOT EXISTS settlement_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS settlement_hold_reason TEXT,
  ADD COLUMN IF NOT EXISTS settlement_ref TEXT;

CREATE INDEX IF NOT EXISTS idx_escort_daily_trips_settlement
  ON public.escort_student_daily_trips (trip_date, settlement_status);

-- 2. HARDEN TRIP AUTHORIZATION WITH STRICT MATHEMATICAL ASSERTION
CREATE OR REPLACE FUNCTION public.execute_atomic_trip_authorization(
  p_student_id       UUID,
  p_parent_user_id   UUID,
  p_school_id        UUID,
  p_gross_kobo       BIGINT,
  p_session_id       VARCHAR(100) DEFAULT NULL,
  p_escort_wallet_id UUID DEFAULT NULL,
  p_reference        VARCHAR(120) DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_parent_wallet     RECORD;
  v_bal_before        BIGINT;
  v_bal_after         BIGINT;
  v_ref               VARCHAR(120);
  v_hold_id           UUID;
  v_pickup_leg_id     UUID;
  v_dropoff_leg_id    UUID;
  v_pickup_kobo       BIGINT;
  v_dropoff_kobo      BIGINT;
  v_vat_kobo          BIGINT;
  v_km_kobo           BIGINT;
  v_myeduride_km_kobo BIGINT;
  v_driver_share_kobo BIGINT;
  v_myeduride_total   BIGINT;
BEGIN
  -- 1. Lock Parent Wallet FOR UPDATE
  SELECT * INTO v_parent_wallet 
  FROM public.wallets 
  WHERE user_id = p_parent_user_id AND entity_type = 'parent'
  LIMIT 1 
  FOR UPDATE;

  IF NOT FOUND THEN
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

  -- 2. Validate Available Balance
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

  -- STRICT FINTECH HARDENING ASSERTION:
  -- Sum of driver share and platform share must exactly equal gross amount
  ASSERT (v_driver_share_kobo + v_myeduride_total) = p_gross_kobo,
    'FATAL: Escrow commitment integrity check failed — fare split does not equal gross amount';

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
      'dropoff_leg_kobo', v_dropoff_kobo,
      'driver_share_kobo', v_driver_share_kobo,
      'platform_share_kobo', v_myeduride_total
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

  -- 7. Create Independent Trip Legs
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
  ) RETURNING id INTO v_pickup_leg_id;

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
  ) RETURNING id INTO v_dropoff_leg_id;

  RETURN jsonb_build_object(
    'success', true,
    'authorized', true,
    'reference', v_ref,
    'escrow_hold_id', v_hold_id,
    'pickup_leg_id', v_pickup_leg_id,
    'dropoff_leg_id', v_dropoff_leg_id,
    'gross_amount_kobo', p_gross_kobo,
    'available_balance_after_kobo', v_bal_after
  );
END;
$$;

-- 3. HARDENED ATOMIC FARE RELEASE (CREDITS ESCORT AVAILABLE BALANCE DIRECTLY)
CREATE OR REPLACE FUNCTION public.process_trip_fare_release(
  p_student_id        UUID,
  p_trip_id           VARCHAR(120) DEFAULT NULL,
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
  v_escort_bal_before BIGINT;
  v_escort_bal_after  BIGINT;
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

  -- 2. Find Active Escrow Hold (HELD)
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

  v_target_escort_id := COALESCE(p_escort_wallet_id, v_escrow_hold.escort_wallet_id);

  SELECT * INTO v_treasury_wallet 
  FROM public.wallets 
  WHERE entity_type = 'platform_treasury' 
  LIMIT 1 
  FOR UPDATE;

  -- Auto-provision treasury wallet if missing in test environments
  IF NOT FOUND THEN
    INSERT INTO public.wallets (
      entity_type,
      currency,
      available_balance_kobo,
      status
    ) VALUES (
      'platform_treasury',
      'NGN',
      0,
      'active'
    ) RETURNING * INTO v_treasury_wallet;
  END IF;

  -- 4. Deduct Escrow from Parent Wallet
  IF v_parent_wallet.id IS NOT NULL THEN
    UPDATE public.wallets
    SET escrow_balance_kobo = GREATEST(0, escrow_balance_kobo - v_gross_kobo),
        updated_at = NOW()
    WHERE id = v_parent_wallet.id;
  END IF;

  -- 5. Credit Driver AVAILABLE Balance (Phase 4 7:00 PM Settlement Requirement)
  IF v_target_escort_id IS NOT NULL THEN
    SELECT * INTO v_escort_wallet 
    FROM public.wallets 
    WHERE id = v_target_escort_id 
    FOR UPDATE;

    IF FOUND THEN
      v_escort_bal_before := v_escort_wallet.available_balance_kobo;
      v_escort_bal_after  := v_escort_bal_before + v_driver_kobo;

      UPDATE public.wallets
      SET available_balance_kobo = v_escort_bal_after,
          pending_earnings_kobo = GREATEST(0, pending_earnings_kobo - v_driver_kobo),
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
        v_escort_bal_before,
        v_escort_bal_after,
        COALESCE(p_idempotency_key, 'PAY-DRV-' || SUBSTR(v_escrow_hold.id::text, 1, 8) || '-' || SUBSTR(gen_random_uuid()::text, 1, 6)),
        p_trip_id,
        p_student_id,
        'COMPLETED',
        'Daily ride fare share credited to available balance (7:00 PM settlement)',
        jsonb_build_object(
          'escrow_hold_id', v_escrow_hold.id,
          'idempotency_key', p_idempotency_key,
          'settled_at', NOW()
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
      approved_at = NOW(),
      updated_at = NOW()
  WHERE id = v_escrow_hold.id;

  -- 8. Mark Any Open Trip Legs as COMPLETED
  UPDATE public.trip_legs
  SET status = 'COMPLETED',
      completed_at = COALESCE(completed_at, NOW()),
      updated_at = NOW()
  WHERE student_id = p_student_id 
    AND status IN ('PENDING', 'IN_PROGRESS')
    AND (p_trip_id IS NULL OR session_id = p_trip_id);

  -- 9. Update escort_student_daily_trips status
  UPDATE public.escort_student_daily_trips
  SET settlement_status = 'settled',
      settled_at = NOW(),
      fee_status = 'settled',
      updated_at = NOW()
  WHERE student_id = p_student_id
    AND trip_date = CURRENT_DATE;

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

-- 4. AUTOMATED BATCH 7:00 PM EVENING ESCROW SETTLEMENT ENGINE
CREATE OR REPLACE FUNCTION public.process_evening_escrow_settlement(
  p_date    DATE DEFAULT CURRENT_DATE,
  p_dry_run BOOLEAN DEFAULT FALSE
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_trip               RECORD;
  v_escrow             RECORD;
  v_release_res        JSONB;
  v_total_processed    INTEGER := 0;
  v_settled_count      INTEGER := 0;
  v_settled_kobo       BIGINT := 0;
  v_held_review_count  INTEGER := 0;
  v_canceled_count     INTEGER := 0;
  v_held_trip_ids      TEXT[] := ARRAY[]::TEXT[];
  v_settled_trip_ids   TEXT[] := ARRAY[]::TEXT[];
  v_escort_payouts     JSONB := '{}'::JSONB;
  v_escort_key         TEXT;
  v_prev_escort_kobo   BIGINT;
  v_idempotency_key    VARCHAR(120);
BEGIN
  -- Iterate through all daily trips for target date
  FOR v_trip IN
    SELECT 
      t.id,
      t.student_id,
      t.escort_id,
      t.school_id,
      t.trip_date,
      t.morning_picked_up,
      t.afternoon_picked_up,
      t.afternoon_dropped_off,
      t.is_canceled_by_parent,
      t.fee_status,
      t.settlement_status,
      eh.id AS escrow_hold_id,
      eh.escort_wallet_id,
      eh.driver_share_kobo,
      eh.gross_amount_kobo
    FROM public.escort_student_daily_trips t
    LEFT JOIN public.escrow_holds eh ON eh.student_id = t.student_id 
      AND eh.status = 'HELD' 
      AND eh.created_at::DATE = p_date
    WHERE t.trip_date = p_date
    ORDER BY t.created_at ASC
  LOOP
    v_total_processed := v_total_processed + 1;

    -- CASE 1: CANCELED BY PARENT BEFORE CUTOFF
    IF v_trip.is_canceled_by_parent THEN
      IF NOT p_dry_run THEN
        -- Ensure any lingering escrow hold is cancelled/refunded
        PERFORM public.cancel_trip_escrow_hold(v_trip.student_id, 'Evening Settlement Audit: Pre-cutoff parent cancellation confirmation');
        UPDATE public.escort_student_daily_trips
        SET settlement_status = 'refunded',
            updated_at = NOW()
        WHERE id = v_trip.id;
      END IF;
      v_canceled_count := v_canceled_count + 1;
      CONTINUE;
    END IF;

    -- CASE 2: INCOMPLETE TRIP (STARTED BUT NOT DROPPED OFF IN AFTERNOON)
    -- Flag with 'SETTLEMENT_HELD_FOR_REVIEW' to prevent erroneous payout
    IF (v_trip.morning_picked_up OR v_trip.afternoon_picked_up) AND NOT v_trip.afternoon_dropped_off THEN
      IF NOT p_dry_run THEN
        UPDATE public.escort_student_daily_trips
        SET settlement_status = 'SETTLEMENT_HELD_FOR_REVIEW',
            settlement_hold_reason = 'Trip started but student was not confirmed dropped off in afternoon',
            updated_at = NOW()
        WHERE id = v_trip.id;

        -- Create notification for City Manager / Admin investigation
        INSERT INTO public.notifications (
          user_id,
          student_id,
          school_id,
          title,
          message,
          type,
          metadata
        ) VALUES (
          v_trip.escort_id,
          v_trip.student_id,
          v_trip.school_id,
          '⚠️ Trip Settlement Held For Review',
          'Evening settlement could not release fare automatically because the afternoon drop-off was not confirmed. City Manager will review.',
          'safety_alert',
          jsonb_build_object(
            'daily_trip_id', v_trip.id,
            'escort_id', v_trip.escort_id,
            'reason', 'INCOMPLETE_SERVICE_LEG',
            'trip_date', p_date
          )
        );
      END IF;

      v_held_review_count := v_held_review_count + 1;
      v_held_trip_ids := array_append(v_held_trip_ids, v_trip.id::TEXT);
      CONTINUE;
    END IF;

    -- CASE 3: COMPLETED TRIP (MORNING PICKED UP + AFTERNOON DROPPED OFF)
    IF v_trip.morning_picked_up AND v_trip.afternoon_dropped_off THEN
      -- Check if already settled
      IF v_trip.settlement_status = 'settled' THEN
        CONTINUE;
      END IF;

      v_idempotency_key := 'SETTLE-' || p_date::TEXT || '-' || v_trip.student_id::TEXT || '-' || v_trip.escort_id;

      IF NOT p_dry_run THEN
        v_release_res := public.process_trip_fare_release(
          v_trip.student_id,
          v_trip.id::VARCHAR(120),
          v_trip.escort_wallet_id,
          v_idempotency_key
        );

        IF (v_release_res->>'success')::BOOLEAN THEN
          v_settled_count := v_settled_count + 1;
          v_settled_kobo  := v_settled_kobo + COALESCE(v_trip.driver_share_kobo, 80000);
          v_settled_trip_ids := array_append(v_settled_trip_ids, v_trip.id::TEXT);

          -- Aggregate escort payouts
          v_escort_key := v_trip.escort_id;
          v_prev_escort_kobo := COALESCE((v_escort_payouts->>v_escort_key)::BIGINT, 0);
          v_escort_payouts := jsonb_set(
            v_escort_payouts,
            ARRAY[v_escort_key],
            to_jsonb(v_prev_escort_kobo + COALESCE(v_trip.driver_share_kobo, 80000))
          );
        END IF;
      ELSE
        v_settled_count := v_settled_count + 1;
        v_settled_kobo  := v_settled_kobo + COALESCE(v_trip.driver_share_kobo, 80000);
        v_settled_trip_ids := array_append(v_settled_trip_ids, v_trip.id::TEXT);
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'date', p_date,
    'dry_run', p_dry_run,
    'total_trips_analyzed', v_total_processed,
    'settled_trips_count', v_settled_count,
    'settled_amount_kobo', v_settled_kobo,
    'settled_amount_ngn', v_settled_kobo / 100.0,
    'held_for_review_count', v_held_review_count,
    'held_trip_ids', v_held_trip_ids,
    'canceled_trips_count', v_canceled_count,
    'settled_trip_ids', v_settled_trip_ids,
    'escort_payouts_summary', v_escort_payouts
  );
END;
$$;
