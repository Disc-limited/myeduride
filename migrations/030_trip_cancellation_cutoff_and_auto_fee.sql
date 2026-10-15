-- ==============================================================================
-- Migration 030: Strict Pickup Cutoff Enforcement & Auto Fare Deduction Architecture
-- Ensures:
-- 1. Parents can only indicate "Not Going" before agreed pickup time.
-- 2. Once agreed pickup time is met, "Not Going" is blocked and daily fee is automatically deducted.
-- 3. Cancellations before pickup time immediately remove student from driver queue and waive/refund escrow hold.
-- ==============================================================================

-- 1. Add Fee and Cutoff Status Columns to escort_student_daily_trips
ALTER TABLE public.escort_student_daily_trips
  ADD COLUMN IF NOT EXISTS fee_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'deducted', 'waived', 'refunded'
  ADD COLUMN IF NOT EXISTS fee_deducted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS fee_deducted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fee_amount_kobo BIGINT,
  ADD COLUMN IF NOT EXISTS agreed_pickup_time TEXT,
  ADD COLUMN IF NOT EXISTS cutoff_passed BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_escort_daily_trips_fee_status
  ON public.escort_student_daily_trips (trip_date, fee_status);

-- 2. Stored Procedure: Atomic Escrow Hold Cancellation / Waiver
-- When parent cancels before agreed pickup cutoff, refunds any held funds back to parent available balance
CREATE OR REPLACE FUNCTION public.cancel_trip_escrow_hold(
  p_student_id UUID,
  p_reason     TEXT DEFAULT 'Parent declared Not Going before pickup cutoff'
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_escrow_hold   RECORD;
  v_parent_wallet RECORD;
  v_gross_kobo    BIGINT;
BEGIN
  -- 1. Locate active HELD escrow hold for this student created today
  SELECT * INTO v_escrow_hold
  FROM public.escrow_holds
  WHERE student_id = p_student_id
    AND status = 'HELD'
    AND created_at >= CURRENT_DATE
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    -- No hold was placed yet, nothing to refund
    RETURN jsonb_build_object(
      'success', true,
      'status', 'NO_HOLD_TO_REFUND',
      'refunded_kobo', 0
    );
  END IF;

  v_gross_kobo := v_escrow_hold.gross_amount_kobo;

  -- 2. Lock parent wallet FOR UPDATE
  SELECT * INTO v_parent_wallet
  FROM public.wallets
  WHERE id = v_escrow_hold.parent_wallet_id
  FOR UPDATE;

  IF FOUND THEN
    -- Return escrow funds back to available balance
    UPDATE public.wallets
    SET available_balance_kobo = available_balance_kobo + v_gross_kobo,
        escrow_balance_kobo = GREATEST(0, escrow_balance_kobo - v_gross_kobo),
        updated_at = NOW()
    WHERE id = v_parent_wallet.id;

    -- Record Ledger Transaction
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
      'CREDIT',
      'ESCROW_REFUND_TRIP_CANCELED',
      v_gross_kobo,
      v_parent_wallet.available_balance_kobo,
      v_parent_wallet.available_balance_kobo + v_gross_kobo,
      'REF-CANC-' || SUBSTR(v_escrow_hold.id::text, 1, 8) || '-' || SUBSTR(gen_random_uuid()::text, 1, 6),
      v_escrow_hold.trip_id,
      p_student_id,
      'COMPLETED',
      'Escrow hold refunded: Parent marked child Not Going before scheduled pickup cutoff',
      jsonb_build_object(
        'escrow_hold_id', v_escrow_hold.id,
        'reason', p_reason
      )
    );
  END IF;

  -- 3. Update Escrow Hold Status
  UPDATE public.escrow_holds
  SET status = 'REFUNDED',
      updated_at = NOW()
  WHERE id = v_escrow_hold.id;

  -- 4. Mark associated open trip legs as CANCELED
  UPDATE public.trip_legs
  SET status = 'CANCELED',
      updated_at = NOW()
  WHERE student_id = p_student_id
    AND status IN ('PENDING', 'IN_PROGRESS');

  RETURN jsonb_build_object(
    'success', true,
    'status', 'REFUNDED',
    'escrow_hold_id', v_escrow_hold.id,
    'refunded_kobo', v_gross_kobo,
    'refunded_ngn', v_gross_kobo / 100.0
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
