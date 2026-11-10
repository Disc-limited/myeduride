-- ==============================================================================
-- Migration 035: Daisaf Wallet System Specification Harmonization
-- Standards: Zero-Loss Integer Kobo, Cryptographic Ledger, Pay-As-You-Go Gate & Escort
--
-- 1. Daisaf Company Revenue Wallet (Aliased / Seeded)
-- 2. School Wallet Configuration (₦10,000 minimum funding, ₦3/scan, ₦50/day escort, 2% service charge)
-- 3. Gate Scan Logs (₦3 Pay-As-You-Go per sign-in & sign-out)
-- 4. Escort Arrival & GPS Geofence Verification ("I Am Here for Pickup")
-- 5. Delay Penalty Ledger (2 min grace + 1 min scan buffer -> ₦50/min into Escrow)
-- 6. Stored Procedures: deduct_gate_scan_fee, record_escort_arrival_event, apply_trip_delay_penalty
-- ==============================================================================

-- 1. DAISAF COMPANY REVENUE WALLET
DO $$
BEGIN
  -- Add 'daisaf' and 'escrow' support to wallet entity type check if constrained
  ALTER TABLE public.wallets DROP CONSTRAINT IF EXISTS wallets_entity_type_check;
  
  -- Ensure unique index for Daisaf company revenue wallet
  CREATE UNIQUE INDEX IF NOT EXISTS idx_wallets_daisaf_entity_unique 
    ON public.wallets(entity_type) 
    WHERE entity_type = 'daisaf';

  -- Seed the Daisaf primary revenue wallet if absent
  IF NOT EXISTS (SELECT 1 FROM public.wallets WHERE entity_type = 'daisaf') THEN
    INSERT INTO public.wallets (
      entity_type,
      currency,
      available_balance_kobo,
      reserved_balance_kobo,
      escrow_balance_kobo,
      locked_balance_kobo,
      pending_earnings_kobo,
      status
    ) VALUES (
      'daisaf',
      'NGN',
      0,
      0,
      0,
      0,
      0,
      'active'
    );
  END IF;
END $$;

-- 2. SCHOOL WALLET CONFIGURATION COLUMNS
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS wallet_mode VARCHAR(30) NOT NULL DEFAULT 'school_funded',
  ADD COLUMN IF NOT EXISTS is_wallet_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS gate_scan_fee_kobo BIGINT NOT NULL DEFAULT 300,            -- ₦3 per scan
  ADD COLUMN IF NOT EXISTS min_school_funding_kobo BIGINT NOT NULL DEFAULT 1000000,   -- ₦10,000 min deposit
  ADD COLUMN IF NOT EXISTS school_escort_pickup_fee_kobo BIGINT NOT NULL DEFAULT 2500, -- ₦25 per pickup
  ADD COLUMN IF NOT EXISTS school_escort_dropoff_fee_kobo BIGINT NOT NULL DEFAULT 2500, -- ₦25 per dropoff
  ADD COLUMN IF NOT EXISTS school_escort_daily_fee_kobo BIGINT NOT NULL DEFAULT 5000, -- ₦50 per student/day
  ADD COLUMN IF NOT EXISTS service_charge_percent NUMERIC(5, 2) NOT NULL DEFAULT 2.0; -- 2% monthly spend

-- Add constraint on wallet_mode
ALTER TABLE public.schools DROP CONSTRAINT IF EXISTS chk_schools_wallet_mode;
ALTER TABLE public.schools 
  ADD CONSTRAINT chk_schools_wallet_mode 
  CHECK (wallet_mode IN ('school_funded', 'parent_funded', 'inactive'));

-- 3. GATE SCAN METER LOGS (₦3 Pay-As-You-Go per sign-in & sign-out)
CREATE TABLE IF NOT EXISTS public.gate_scan_logs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id             UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id            UUID REFERENCES public.students(id) ON DELETE SET NULL,
  staff_profile_id      UUID REFERENCES public.teacher_profiles(id) ON DELETE SET NULL,
  scan_direction        VARCHAR(10) NOT NULL CHECK (scan_direction IN ('sign_in', 'sign_out')),
  scan_fee_kobo         BIGINT NOT NULL DEFAULT 300,
  billed_wallet_id      UUID REFERENCES public.wallets(id) ON DELETE SET NULL,
  payer_type            VARCHAR(20) NOT NULL DEFAULT 'school' CHECK (payer_type IN ('school', 'parent')),
  status                VARCHAR(30) NOT NULL DEFAULT 'BILLED'
                        CHECK (status IN ('BILLED', 'BLOCKED_INSUFFICIENT_FUNDS', 'WAIVED')),
  failure_reason        TEXT,
  transaction_ref       VARCHAR(120),
  scanned_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gate_scan_logs_school ON public.gate_scan_logs(school_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_gate_scan_logs_student ON public.gate_scan_logs(student_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_gate_scan_logs_ref ON public.gate_scan_logs(transaction_ref);

-- 4. ESCORT PICKUP ARRIVALS & GPS GEOFENCE AUDIT ("I Am Here for Pickup")
CREATE TABLE IF NOT EXISTS public.escort_pickup_arrivals (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id               UUID REFERENCES public.escort_student_daily_trips(id) ON DELETE CASCADE,
  student_id            UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  escort_id             VARCHAR(100) NOT NULL,
  escort_user_id        UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  parent_user_id        UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  escort_lat            NUMERIC(10, 7) NOT NULL,
  escort_lng            NUMERIC(10, 7) NOT NULL,
  target_lat            NUMERIC(10, 7) NOT NULL,
  target_lng            NUMERIC(10, 7) NOT NULL,
  distance_meters       NUMERIC(10, 2) NOT NULL,
  geofence_passed       BOOLEAN NOT NULL DEFAULT FALSE,
  arrived_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  grace_expires_at      TIMESTAMPTZ NOT NULL, -- arrival + 2 minutes
  penalty_starts_at     TIMESTAMPTZ NOT NULL, -- arrival + 3 minutes (grace + 1 min scan buffer)
  boarded_at            TIMESTAMPTZ,
  delay_minutes         INTEGER NOT NULL DEFAULT 0,
  penalty_kobo          BIGINT NOT NULL DEFAULT 0,
  penalty_status        VARCHAR(30) NOT NULL DEFAULT 'NONE'
                        CHECK (penalty_status IN ('NONE', 'PENDING', 'CHARGED', 'WAIVED', 'INSUFFICIENT_FUNDS')),
  penalty_ref           VARCHAR(120),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escort_arrivals_student ON public.escort_pickup_arrivals(student_id, arrived_at DESC);
CREATE INDEX IF NOT EXISTS idx_escort_arrivals_trip ON public.escort_pickup_arrivals(trip_id);

-- 5. TRIP DELAY PENALTIES TABLE (₦50/min into Escrow)
CREATE TABLE IF NOT EXISTS public.trip_delay_penalties (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  arrival_event_id      UUID NOT NULL REFERENCES public.escort_pickup_arrivals(id) ON DELETE CASCADE,
  parent_user_id        UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  parent_wallet_id      UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  delay_minutes         INTEGER NOT NULL CHECK (delay_minutes > 0),
  rate_per_min_kobo     BIGINT NOT NULL DEFAULT 5000, -- ₦50.00 / minute
  total_penalty_kobo    BIGINT NOT NULL CHECK (total_penalty_kobo > 0),
  status                VARCHAR(20) NOT NULL DEFAULT 'ESCROWED'
                        CHECK (status IN ('ESCROWED', 'RELEASED_TO_ESCORT', 'REFUNDED', 'FAILED')),
  transaction_ref       VARCHAR(120) NOT NULL UNIQUE,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delay_penalties_parent ON public.trip_delay_penalties(parent_user_id, created_at DESC);

-- 6. STORED PROCEDURE: ATOMIC GATE SCAN ₦3 DEDUCTION & BALANCES CHECK
CREATE OR REPLACE FUNCTION public.deduct_gate_scan_fee(
  p_school_id           UUID,
  p_student_id          UUID DEFAULT NULL,
  p_staff_profile_id    UUID DEFAULT NULL,
  p_scan_direction      VARCHAR(10) DEFAULT 'sign_in'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_school              RECORD;
  v_payer_wallet        RECORD;
  v_daisaf_wallet       RECORD;
  v_fee_kobo            BIGINT := 300; -- ₦3
  v_parent_user_id      UUID;
  v_payer_type          VARCHAR(20) := 'school';
  v_ref                 VARCHAR(120);
  v_new_bal_kobo        BIGINT;
  v_scan_log_id         UUID;
BEGIN
  -- 1. Fetch School & Wallet Mode
  SELECT id, name, wallet_mode, is_wallet_active, COALESCE(gate_scan_fee_kobo, 300) AS gate_scan_fee_kobo
  INTO v_school
  FROM public.schools
  WHERE id = p_school_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'SCHOOL_NOT_FOUND', 'code', 'school_not_found');
  END IF;

  -- Unmetered / Inactive wallet mode: Gate Manager operates freely without wallet deduction
  IF v_school.is_wallet_active = FALSE OR v_school.wallet_mode = 'inactive' THEN
    RETURN jsonb_build_object(
      'success', true,
      'payer_type', 'none',
      'scan_fee_kobo', 0,
      'fee_kobo', 0,
      'new_balance_kobo', 0,
      'new_balance_ngn', 0,
      'code', 'unmetered',
      'message', 'Gate scan approved in unmetered mode.'
    );
  END IF;

  v_fee_kobo := v_school.gate_scan_fee_kobo;

  -- 2. Resolve Daisaf Revenue Wallet
  SELECT * INTO v_daisaf_wallet
  FROM public.wallets
  WHERE entity_type IN ('daisaf', 'platform_treasury')
  ORDER BY (entity_type = 'daisaf') DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Fallback seed Daisaf wallet
    INSERT INTO public.wallets (entity_type, currency, available_balance_kobo, status)
    VALUES ('daisaf', 'NGN', 0, 'active')
    RETURNING * INTO v_daisaf_wallet;
  END IF;

  -- 3. Determine Payer Wallet (School vs Parent)
  IF v_school.wallet_mode = 'parent_funded' AND p_student_id IS NOT NULL THEN
    v_payer_type := 'parent';
    
    -- Look up primary linked parent
    SELECT parent_user_id INTO v_parent_user_id
    FROM public.student_parents
    WHERE student_id = p_student_id
    ORDER BY is_primary DESC
    LIMIT 1;

    IF v_parent_user_id IS NULL THEN
      -- Student not linked to a parent on MyEduRide -> unlinked student rejected
      RETURN jsonb_build_object(
        'success', false,
        'error', 'UNREGISTERED_STUDENT_GATE_BLOCKED',
        'code', 'unregistered_student',
        'message', 'Student is not linked to an active MyEduRide parent account.'
      );
    END IF;

    -- Lock parent wallet
    SELECT * INTO v_payer_wallet
    FROM public.wallets
    WHERE user_id = v_parent_user_id AND entity_type = 'parent'
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'PARENT_WALLET_NOT_FOUND',
        'code', 'parent_wallet_not_found',
        'message', 'Parent wallet does not exist.'
      );
    END IF;

  ELSE
    -- School Funded Gate Manager (Pay-As-You-Go)
    v_payer_type := 'school';

    SELECT * INTO v_payer_wallet
    FROM public.wallets
    WHERE school_id = p_school_id AND entity_type = 'school'
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND THEN
      -- Provision if missing
      INSERT INTO public.wallets (entity_type, school_id, currency, available_balance_kobo, status)
      VALUES ('school', p_school_id, 'NGN', 0, 'active')
      RETURNING * INTO v_payer_wallet;
    END IF;
  END IF;

  -- 4. Check for Insufficient Funds (Real-time Gate Lockout Invariant)
  IF v_payer_wallet.available_balance_kobo < v_fee_kobo THEN
    -- Record blocked scan attempt
    INSERT INTO public.gate_scan_logs (
      school_id,
      student_id,
      staff_profile_id,
      scan_direction,
      scan_fee_kobo,
      billed_wallet_id,
      payer_type,
      status,
      failure_reason
    ) VALUES (
      p_school_id,
      p_student_id,
      p_staff_profile_id,
      p_scan_direction,
      v_fee_kobo,
      v_payer_wallet.id,
      v_payer_type,
      'BLOCKED_INSUFFICIENT_FUNDS',
      'Wallet balance (' || (v_payer_wallet.available_balance_kobo::NUMERIC / 100)::text || ' NGN) is less than scan fee (3.00 NGN)'
    );

    RETURN jsonb_build_object(
      'success', false,
      'error', 'INSUFFICIENT_WALLET_FUNDS',
      'code', 'insufficient_funds',
      'payer_type', v_payer_type,
      'available_balance_kobo', v_payer_wallet.available_balance_kobo,
      'available_balance_ngn', (v_payer_wallet.available_balance_kobo::NUMERIC / 100),
      'required_kobo', v_fee_kobo,
      'required_ngn', (v_fee_kobo::NUMERIC / 100),
      'message', CASE 
        WHEN v_payer_type = 'school' THEN 'School wallet balance is insufficient to process gate scan. Please top up your wallet.'
        ELSE 'Parent wallet balance is insufficient. Please top up transit funds.'
      END
    );
  END IF;

  -- 5. Execute Atomic Debit & Credit
  v_new_bal_kobo := v_payer_wallet.available_balance_kobo - v_fee_kobo;
  v_ref := 'SCAN-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MISS') || '-' || SUBSTR(gen_random_uuid()::text, 1, 6);

  -- Debit Payer Wallet
  UPDATE public.wallets
  SET available_balance_kobo = v_new_bal_kobo,
      updated_at = NOW()
  WHERE id = v_payer_wallet.id;

  -- Credit Daisaf Company Revenue Wallet
  UPDATE public.wallets
  SET available_balance_kobo = available_balance_kobo + v_fee_kobo,
      updated_at = NOW()
  WHERE id = v_daisaf_wallet.id;

  -- Insert Double-Entry Transactions (Triggers SHA-256 Ledger Hash Chain)
  INSERT INTO public.wallet_transactions (
    wallet_id,
    counterpart_wallet_id,
    transaction_type,
    channel,
    amount_kobo,
    balance_before_kobo,
    balance_after_kobo,
    reference,
    student_id,
    status,
    description,
    metadata
  ) VALUES (
    v_payer_wallet.id,
    v_daisaf_wallet.id,
    'DEBIT',
    CASE WHEN p_scan_direction = 'sign_in' THEN 'DAILY_GATE_FEE' ELSE 'DAILY_GATE_FEE' END,
    v_fee_kobo,
    v_payer_wallet.available_balance_kobo,
    v_new_bal_kobo,
    v_ref,
    p_student_id,
    'COMPLETED',
    'Gate Scan ' || UPPER(p_scan_direction) || ' (₦3 Pay-As-You-Go)',
    jsonb_build_object(
      'scan_direction', p_scan_direction,
      'school_id', p_school_id,
      'student_id', p_student_id,
      'staff_profile_id', p_staff_profile_id,
      'payer_type', v_payer_type
    )
  );

  INSERT INTO public.wallet_transactions (
    wallet_id,
    counterpart_wallet_id,
    transaction_type,
    channel,
    amount_kobo,
    balance_before_kobo,
    balance_after_kobo,
    reference,
    student_id,
    status,
    description,
    metadata
  ) VALUES (
    v_daisaf_wallet.id,
    v_payer_wallet.id,
    'CREDIT',
    'DAILY_GATE_FEE',
    v_fee_kobo,
    v_daisaf_wallet.available_balance_kobo,
    v_daisaf_wallet.available_balance_kobo + v_fee_kobo,
    v_ref || '-REV',
    p_student_id,
    'COMPLETED',
    'Gate Scan Revenue (₦3 Pay-As-You-Go)',
    jsonb_build_object(
      'payer_wallet_id', v_payer_wallet.id,
      'school_id', p_school_id,
      'scan_direction', p_scan_direction
    )
  );

  -- 6. Log Scan Meter Event
  INSERT INTO public.gate_scan_logs (
    school_id,
    student_id,
    staff_profile_id,
    scan_direction,
    scan_fee_kobo,
    billed_wallet_id,
    payer_type,
    status,
    transaction_ref
  ) VALUES (
    p_school_id,
    p_student_id,
    p_staff_profile_id,
    p_scan_direction,
    v_fee_kobo,
    v_payer_wallet.id,
    v_payer_type,
    'BILLED',
    v_ref
  )
  RETURNING id INTO v_scan_log_id;

  RETURN jsonb_build_object(
    'success', true,
    'scan_log_id', v_scan_log_id,
    'reference', v_ref,
    'fee_kobo', v_fee_kobo,
    'fee_ngn', (v_fee_kobo::NUMERIC / 100),
    'payer_type', v_payer_type,
    'new_balance_kobo', v_new_bal_kobo,
    'new_balance_ngn', (v_new_bal_kobo::NUMERIC / 100)
  );
END;
$$;

-- 7. STORED PROCEDURE: RECORD ESCORT ARRIVAL EVENT WITH GPS GEOFENCE
CREATE OR REPLACE FUNCTION public.record_escort_arrival_event(
  p_student_id          UUID,
  p_escort_id           VARCHAR(100),
  p_escort_lat          NUMERIC,
  p_escort_lng          NUMERIC,
  p_escort_user_id      UUID DEFAULT NULL,
  p_trip_id             UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_student             RECORD;
  v_parent_user_id      UUID;
  v_target_lat          NUMERIC;
  v_target_lng          NUMERIC;
  v_distance_meters     NUMERIC;
  v_geofence_passed     BOOLEAN := FALSE;
  v_now                 TIMESTAMPTZ := NOW();
  v_grace_expires_at    TIMESTAMPTZ;
  v_penalty_starts_at   TIMESTAMPTZ;
  v_event_id            UUID;
BEGIN
  -- 1. Fetch Student House Coordinates
  SELECT id, house_lat, house_lng, house_address, school_id
  INTO v_student
  FROM public.students
  WHERE id = p_student_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'STUDENT_NOT_FOUND');
  END IF;

  -- 2. Resolve Primary Parent
  SELECT parent_user_id INTO v_parent_user_id
  FROM public.student_parents
  WHERE student_id = p_student_id
  ORDER BY is_primary DESC
  LIMIT 1;

  IF v_parent_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NO_LINKED_PARENT');
  END IF;

  v_target_lat := COALESCE(v_student.house_lat, p_escort_lat);
  v_target_lng := COALESCE(v_student.house_lng, p_escort_lng);

  -- 3. Calculate Haversine Distance (in meters)
  v_distance_meters := (
    6371000 * acos(
      least(1.0, greatest(-1.0,
        cos(radians(p_escort_lat)) * cos(radians(v_target_lat)) *
        cos(radians(v_target_lng) - radians(p_escort_lng)) +
        sin(radians(p_escort_lat)) * sin(radians(v_target_lat))
      ))
    )
  );

  -- Geofence tolerance: 150 meters
  IF v_distance_meters <= 150.0 THEN
    v_geofence_passed := TRUE;
  END IF;

  -- 4. Calculate Timestamps: 2 min grace + 1 min scan buffer = 3 mins
  v_grace_expires_at := v_now + INTERVAL '2 minutes';
  v_penalty_starts_at := v_now + INTERVAL '3 minutes';

  -- 5. Insert Arrival Event
  INSERT INTO public.escort_pickup_arrivals (
    trip_id,
    student_id,
    escort_id,
    escort_user_id,
    parent_user_id,
    escort_lat,
    escort_lng,
    target_lat,
    target_lng,
    distance_meters,
    geofence_passed,
    arrived_at,
    grace_expires_at,
    penalty_starts_at,
    penalty_status
  ) VALUES (
    p_trip_id,
    p_student_id,
    p_escort_id,
    p_escort_user_id,
    v_parent_user_id,
    p_escort_lat,
    p_escort_lng,
    v_target_lat,
    v_target_lng,
    v_distance_meters,
    v_geofence_passed,
    v_now,
    v_grace_expires_at,
    v_penalty_starts_at,
    'NONE'
  )
  RETURNING id INTO v_event_id;

  RETURN jsonb_build_object(
    'success', true,
    'arrival_id', v_event_id,
    'student_id', p_student_id,
    'parent_user_id', v_parent_user_id,
    'distance_meters', ROUND(v_distance_meters, 1),
    'geofence_passed', v_geofence_passed,
    'arrived_at', v_now,
    'grace_expires_at', v_grace_expires_at,
    'penalty_starts_at', v_penalty_starts_at
  );
END;
$$;

-- 8. STORED PROCEDURE: APPLY TRIP DELAY PENALTY (₦50/min into Escrow)
CREATE OR REPLACE FUNCTION public.apply_trip_delay_penalty(
  p_arrival_id          UUID,
  p_boarded_at          TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_arrival             RECORD;
  v_parent_wallet       RECORD;
  v_elapsed_seconds     INTEGER;
  v_delay_minutes       INTEGER;
  v_rate_kobo           BIGINT := 5000; -- ₦50.00 / minute
  v_penalty_kobo        BIGINT;
  v_new_bal_kobo        BIGINT;
  v_ref                 VARCHAR(120);
BEGIN
  -- 1. Fetch Arrival Record
  SELECT * INTO v_arrival
  FROM public.escort_pickup_arrivals
  WHERE id = p_arrival_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'ARRIVAL_RECORD_NOT_FOUND');
  END IF;

  IF v_arrival.penalty_status = 'CHARGED' THEN
    RETURN jsonb_build_object('success', true, 'status', 'ALREADY_CHARGED', 'penalty_kobo', v_arrival.penalty_kobo);
  END IF;

  -- 2. Calculate Delay Beyond 3-Minute Threshold (2 min grace + 1 min scan)
  v_elapsed_seconds := EXTRACT(EPOCH FROM (p_boarded_at - v_arrival.penalty_starts_at))::INTEGER;

  IF v_elapsed_seconds <= 0 THEN
    -- Boarded within grace period -> 0 penalty
    UPDATE public.escort_pickup_arrivals
    SET boarded_at = p_boarded_at,
        delay_minutes = 0,
        penalty_kobo = 0,
        penalty_status = 'WAIVED',
        updated_at = NOW()
    WHERE id = p_arrival_id;

    RETURN jsonb_build_object(
      'success', true,
      'delay_minutes', 0,
      'penalty_kobo', 0,
      'penalty_ngn', 0,
      'message', 'Boarded within 3-minute grace period. No penalty applied.'
    );
  END IF;

  v_delay_minutes := CEIL(v_elapsed_seconds::NUMERIC / 60.0)::INTEGER;
  v_penalty_kobo := v_delay_minutes * v_rate_kobo;
  v_ref := 'PENALTY-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || SUBSTR(gen_random_uuid()::text, 1, 8);

  -- 3. Lock Parent Wallet
  SELECT * INTO v_parent_wallet
  FROM public.wallets
  WHERE user_id = v_arrival.parent_user_id AND entity_type = 'parent'
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND OR v_parent_wallet.available_balance_kobo < v_penalty_kobo THEN
    -- Mark penalty as insufficient funds
    UPDATE public.escort_pickup_arrivals
    SET boarded_at = p_boarded_at,
        delay_minutes = v_delay_minutes,
        penalty_kobo = v_penalty_kobo,
        penalty_status = 'INSUFFICIENT_FUNDS',
        updated_at = NOW()
    WHERE id = p_arrival_id;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'INSUFFICIENT_FUNDS_FOR_PENALTY',
      'delay_minutes', v_delay_minutes,
      'penalty_kobo', v_penalty_kobo,
      'available_balance_kobo', COALESCE(v_parent_wallet.available_balance_kobo, 0)
    );
  END IF;

  -- 4. Debit Parent Wallet Available Balance & Credit Parent Escrow Balance
  v_new_bal_kobo := v_parent_wallet.available_balance_kobo - v_penalty_kobo;

  UPDATE public.wallets
  SET available_balance_kobo = v_new_bal_kobo,
      escrow_balance_kobo = escrow_balance_kobo + v_penalty_kobo,
      updated_at = NOW()
  WHERE id = v_parent_wallet.id;

  -- 5. Record Double-Entry Ledger Row
  INSERT INTO public.wallet_transactions (
    wallet_id,
    transaction_type,
    channel,
    amount_kobo,
    balance_before_kobo,
    balance_after_kobo,
    reference,
    student_id,
    status,
    description,
    metadata
  ) VALUES (
    v_parent_wallet.id,
    'DEBIT',
    'WAITING_CHARGE',
    v_penalty_kobo,
    v_parent_wallet.available_balance_kobo,
    v_new_bal_kobo,
    v_ref,
    v_arrival.student_id,
    'COMPLETED',
    'Escort Pickup Delay Penalty (' || v_delay_minutes::text || ' min delay @ ₦50/min into Escrow)',
    jsonb_build_object(
      'arrival_id', p_arrival_id,
      'delay_minutes', v_delay_minutes,
      'rate_per_min_kobo', v_rate_kobo
    )
  );

  -- 6. Insert Delay Penalty Record
  INSERT INTO public.trip_delay_penalties (
    arrival_event_id,
    parent_user_id,
    parent_wallet_id,
    delay_minutes,
    rate_per_min_kobo,
    total_penalty_kobo,
    status,
    transaction_ref,
    notes
  ) VALUES (
    p_arrival_id,
    v_arrival.parent_user_id,
    v_parent_wallet.id,
    v_delay_minutes,
    v_rate_kobo,
    v_penalty_kobo,
    'ESCROWED',
    v_ref,
    'Charged for ' || v_delay_minutes::text || ' minutes delay after 3-minute grace period.'
  );

  -- 7. Update Arrival Record Status
  UPDATE public.escort_pickup_arrivals
  SET boarded_at = p_boarded_at,
      delay_minutes = v_delay_minutes,
      penalty_kobo = v_penalty_kobo,
      penalty_status = 'CHARGED',
      penalty_ref = v_ref,
      updated_at = NOW()
  WHERE id = p_arrival_id;

  RETURN jsonb_build_object(
    'success', true,
    'delay_minutes', v_delay_minutes,
    'penalty_kobo', v_penalty_kobo,
    'penalty_ngn', (v_penalty_kobo::NUMERIC / 100),
    'transaction_ref', v_ref,
    'new_available_balance_kobo', v_new_bal_kobo
  );
END;
$$;
