-- ==============================================================================
-- Migration 036: School Gate Manager Prepaid Credit Unit Architecture
--
-- 1. School Gate Credit Vault (stored in milli-units: 1000 milli-units = 1.0 unit)
--    - 1 Unit = ₦6.00/day = 1 Clock-In (0.5 unit / ₦3) + 1 Clock-Out (0.5 unit / ₦3)
--    - Packages: 25 Units (₦3,000), 50 Units (₦6,000), 100 Units (₦12,000), etc.
--    - New School Free Trial: 25 Units granted on onboarding before payment
-- 2. Gate Credit Packages Catalog
-- 3. Immutable School Gate Credit Ledger (Purchases, Free Trial, Scan Deductions)
-- 4. Monthly Gate Credit Reports Table
-- 5. Stored Procedures:
--    - purchase_school_gate_credits
--    - claim_school_free_trial_credits
--    - deduct_gate_scan_fee (updated to meter 0.5 credit unit per clock-in/clock-out)
-- ==============================================================================

-- 1. ADD GATE CREDIT VAULT COLUMNS TO SCHOOLS
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS gate_credit_balance_milli BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS free_trial_credits_claimed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS free_trial_claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS low_credit_threshold_units INTEGER NOT NULL DEFAULT 10;

-- Guard against negative credit balance
ALTER TABLE public.schools DROP CONSTRAINT IF EXISTS chk_schools_gate_credit_non_negative;
ALTER TABLE public.schools
  ADD CONSTRAINT chk_schools_gate_credit_non_negative
  CHECK (gate_credit_balance_milli >= 0);

-- 2. GATE CREDIT PACKAGES CATALOG
CREATE TABLE IF NOT EXISTS public.gate_credit_packages (
  id                  VARCHAR(50) PRIMARY KEY,
  name                VARCHAR(100) NOT NULL,
  units               INTEGER NOT NULL CHECK (units > 0),
  price_kobo          BIGINT NOT NULL CHECK (price_kobo > 0),
  daily_equivalent    INTEGER NOT NULL DEFAULT 25,
  description         TEXT,
  badge_text          VARCHAR(50),
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  display_order       INTEGER NOT NULL DEFAULT 1,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.gate_credit_packages (id, name, units, price_kobo, daily_equivalent, description, badge_text, display_order)
VALUES
  ('PKG_25',  'Starter Credit Bundle',       25,  300000,  25,  '25 Gate Credit Units · Covers 50 full clock-in/out cycles (₦6/day per unit)', 'Starter',      1),
  ('PKG_50',  'Standard Growth Bundle',      50,  600000,  50,  '50 Gate Credit Units · Covers 100 clock-in/out scans across your campus',     'Most Popular', 2),
  ('PKG_100', 'Institutional Pro Bundle',   100, 1200000, 100,  '100 Gate Credit Units · Covers 200 clock-in/out scans for medium schools',    'Best Value',   3),
  ('PKG_200', 'Campus Enterprise Bundle',   200, 2400000, 200,  '200 Gate Credit Units · High-capacity gate operations for large campuses',   'Enterprise',   4),
  ('PKG_500', 'Mega Institutional Bundle',  500, 6000000, 500,  '500 Gate Credit Units · Full-term institutional gate attendance volume',     'Mega Tier',    5)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  units = EXCLUDED.units,
  price_kobo = EXCLUDED.price_kobo,
  daily_equivalent = EXCLUDED.daily_equivalent,
  description = EXCLUDED.description,
  badge_text = EXCLUDED.badge_text,
  display_order = EXCLUDED.display_order;

-- 3. SCHOOL GATE CREDIT LEDGER (IMMUTABLE AUDIT TRAIL)
CREATE TABLE IF NOT EXISTS public.school_gate_credit_ledger (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id             UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  entry_type            VARCHAR(30) NOT NULL
                        CHECK (entry_type IN ('PURCHASE', 'FREE_TRIAL', 'CONSUMPTION_SCAN', 'ADJUSTMENT_CREDIT', 'ADJUSTMENT_DEBIT')),
  units_delta_milli     BIGINT NOT NULL, -- e.g. +25000 for 25 units, -500 for 0.5 unit scan
  units_before_milli    BIGINT NOT NULL,
  units_after_milli     BIGINT NOT NULL,
  amount_kobo           BIGINT NOT NULL DEFAULT 0, -- Purchase price in kobo or scan value (300 kobo = ₦3)
  wallet_transaction_id UUID REFERENCES public.wallet_transactions(id) ON DELETE SET NULL,
  package_id            VARCHAR(50) REFERENCES public.gate_credit_packages(id) ON DELETE SET NULL,
  student_id            UUID REFERENCES public.students(id) ON DELETE SET NULL,
  staff_profile_id      UUID REFERENCES public.teacher_profiles(id) ON DELETE SET NULL,
  person_name           VARCHAR(200),
  person_code           VARCHAR(100),
  person_role           VARCHAR(40), -- 'student' | 'staff'
  scan_type             VARCHAR(20) CHECK (scan_type IN ('clock_in', 'clock_out', 'manual')),
  reference             VARCHAR(120) NOT NULL UNIQUE,
  description           TEXT NOT NULL,
  actor_user_id         UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  metadata              JSONB DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_school_date
  ON public.school_gate_credit_ledger(school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_entry_type
  ON public.school_gate_credit_ledger(school_id, entry_type, created_at DESC);

-- Enable RLS on credit ledger & packages
ALTER TABLE public.gate_credit_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_gate_credit_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gate_credit_packages_read_all" ON public.gate_credit_packages;
CREATE POLICY "gate_credit_packages_read_all"
  ON public.gate_credit_packages
  FOR SELECT
  TO authenticated
  USING (true);

-- 4. MONTHLY GATE CREDIT REPORTS TABLE
CREATE TABLE IF NOT EXISTS public.school_gate_monthly_reports (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id             UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  report_month          VARCHAR(7) NOT NULL, -- Format: 'YYYY-MM'
  opening_units_milli   BIGINT NOT NULL DEFAULT 0,
  purchased_units_milli BIGINT NOT NULL DEFAULT 0,
  trial_units_milli     BIGINT NOT NULL DEFAULT 0,
  consumed_units_milli  BIGINT NOT NULL DEFAULT 0,
  closing_units_milli   BIGINT NOT NULL DEFAULT 0,
  total_clock_ins       INTEGER NOT NULL DEFAULT 0,
  total_clock_outs      INTEGER NOT NULL DEFAULT 0,
  total_amount_kobo     BIGINT NOT NULL DEFAULT 0,
  recipient_emails      TEXT[],
  email_dispatched      BOOLEAN NOT NULL DEFAULT FALSE,
  dispatched_at         TIMESTAMPTZ,
  report_payload        JSONB DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, report_month)
);

CREATE INDEX IF NOT EXISTS idx_gate_monthly_reports_school
  ON public.school_gate_monthly_reports(school_id, report_month DESC);

ALTER TABLE public.school_gate_monthly_reports ENABLE ROW LEVEL SECURITY;

-- 5. AUTO-GRANT 25 FREE TRIAL UNITS TO EXISTING & NEW SCHOOLS
DO $$
DECLARE
  r_school RECORD;
  v_ref    VARCHAR(120);
BEGIN
  FOR r_school IN
    SELECT id, name, gate_credit_balance_milli
    FROM public.schools
    WHERE free_trial_credits_claimed = FALSE
  LOOP
    v_ref := 'GC-TRIAL-INIT-' || SUBSTR(r_school.id::text, 1, 8);

    UPDATE public.schools
    SET gate_credit_balance_milli = gate_credit_balance_milli + 25000,
        free_trial_credits_claimed = TRUE,
        free_trial_claimed_at = NOW()
    WHERE id = r_school.id;

    INSERT INTO public.school_gate_credit_ledger (
      school_id,
      entry_type,
      units_delta_milli,
      units_before_milli,
      units_after_milli,
      amount_kobo,
      reference,
      description,
      metadata
    ) VALUES (
      r_school.id,
      'FREE_TRIAL',
      25000,
      r_school.gate_credit_balance_milli,
      r_school.gate_credit_balance_milli + 25000,
      0,
      v_ref,
      'Complimentary 25 Units Onboarding Free Trial Grant',
      jsonb_build_object('trial_units', 25, 'auto_granted', true)
    ) ON CONFLICT (reference) DO NOTHING;
  END LOOP;
END $$;

-- Trigger function so any newly registered school automatically gets 25 units free trial
CREATE OR REPLACE FUNCTION public.fn_grant_new_school_trial_credits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ref VARCHAR(120);
BEGIN
  IF NEW.free_trial_credits_claimed = FALSE AND NEW.gate_credit_balance_milli = 0 THEN
    NEW.gate_credit_balance_milli := 25000;
    NEW.free_trial_credits_claimed := TRUE;
    NEW.free_trial_claimed_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_new_school_trial_credits_before ON public.schools;
CREATE TRIGGER trg_new_school_trial_credits_before
  BEFORE INSERT ON public.schools
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_grant_new_school_trial_credits();

CREATE OR REPLACE FUNCTION public.fn_log_new_school_trial_credits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ref VARCHAR(120);
BEGIN
  IF NEW.free_trial_credits_claimed = TRUE AND NEW.gate_credit_balance_milli >= 25000 THEN
    v_ref := 'GC-TRIAL-NEW-' || SUBSTR(NEW.id::text, 1, 8);
    INSERT INTO public.school_gate_credit_ledger (
      school_id,
      entry_type,
      units_delta_milli,
      units_before_milli,
      units_after_milli,
      amount_kobo,
      reference,
      description,
      metadata
    ) VALUES (
      NEW.id,
      'FREE_TRIAL',
      25000,
      0,
      NEW.gate_credit_balance_milli,
      0,
      v_ref,
      'Complimentary 25 Units New School Free Trial Grant',
      jsonb_build_object('trial_units', 25, 'auto_granted', true)
    ) ON CONFLICT (reference) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_new_school_trial_credits_after ON public.schools;
CREATE TRIGGER trg_new_school_trial_credits_after
  AFTER INSERT ON public.schools
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_log_new_school_trial_credits();

-- 6. STORED PROCEDURE: CLAIM 25-UNIT FREE TRIAL (IDEMPOTENT SINGLE-CLAIM)
CREATE OR REPLACE FUNCTION public.claim_school_free_trial_credits(
  p_school_id UUID,
  p_actor_id  UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_school          RECORD;
  v_new_units_milli BIGINT;
  v_ref             VARCHAR(120);
BEGIN
  SELECT * INTO v_school FROM public.schools WHERE id = p_school_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'School not found.');
  END IF;

  IF v_school.free_trial_credits_claimed = TRUE THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Free trial of 25 units has already been claimed for this school.',
      'already_claimed', true,
      'current_units', ROUND(v_school.gate_credit_balance_milli::NUMERIC / 1000, 2)
    );
  END IF;

  v_ref := 'GC-TRIAL-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MISS') || '-' || SUBSTR(gen_random_uuid()::text, 1, 6);
  v_new_units_milli := v_school.gate_credit_balance_milli + 25000;

  UPDATE public.schools
  SET gate_credit_balance_milli = v_new_units_milli,
      free_trial_credits_claimed = TRUE,
      free_trial_claimed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_school_id;

  INSERT INTO public.school_gate_credit_ledger (
    school_id, entry_type, units_delta_milli, units_before_milli, units_after_milli,
    amount_kobo, reference, description, actor_user_id
  ) VALUES (
    p_school_id, 'FREE_TRIAL', 25000, v_school.gate_credit_balance_milli, v_new_units_milli,
    0, v_ref, 'Claimed 25 Units New School Onboarding Free Trial', p_actor_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'new_units', ROUND(v_new_units_milli::NUMERIC / 1000, 2),
    'units_added', 25,
    'reference', v_ref
  );
END;
$$;

-- 7. STORED PROCEDURE: ATOMIC PURCHASE OF GATE CREDITS FROM SCHOOL WALLET
CREATE OR REPLACE FUNCTION public.purchase_school_gate_credits(
  p_school_id     UUID,
  p_package_id    VARCHAR(50) DEFAULT NULL,
  p_actor_id      UUID DEFAULT NULL,
  p_custom_units  INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pkg             RECORD;
  v_school          RECORD;
  v_wallet          RECORD;
  v_daisaf_wallet   RECORD;
  v_units           INTEGER;
  v_price_kobo      BIGINT;
  v_pkg_name        VARCHAR(100);
  v_new_units_milli BIGINT;
  v_new_wallet_kobo BIGINT;
  v_ref             VARCHAR(120);
  v_tx_id           UUID;
BEGIN
  -- 1. Resolve Package or Custom Units Tier (25 units = ₦3,000 -> ₦120 / unit = 12,000 kobo / unit)
  IF p_package_id IS NOT NULL AND p_package_id <> 'CUSTOM' THEN
    SELECT * INTO v_pkg FROM public.gate_credit_packages WHERE id = p_package_id AND is_active = TRUE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Selected credit package is invalid or inactive.');
    END IF;
    v_units := v_pkg.units;
    v_price_kobo := v_pkg.price_kobo;
    v_pkg_name := v_pkg.name;
  ELSIF p_custom_units IS NOT NULL AND p_custom_units >= 25 AND (p_custom_units % 25 = 0) THEN
    v_units := p_custom_units;
    v_price_kobo := (p_custom_units::BIGINT * 12000); -- 25 units = 300,000 kobo (₦3,000)
    v_pkg_name := 'Custom ' || p_custom_units || ' Units Bundle';
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Please select a valid credit package (25, 50, 100 units, or multiples of 25).');
  END IF;

  -- 2. Lock School Record
  SELECT * INTO v_school FROM public.schools WHERE id = p_school_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'School not found.');
  END IF;

  -- 3. Lock School Institutional Wallet
  SELECT * INTO v_wallet
  FROM public.wallets
  WHERE school_id = p_school_id AND entity_type = 'school'
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Auto-initialize empty wallet so error message clearly states ₦0.00 balance
    INSERT INTO public.wallets (entity_type, school_id, currency, available_balance_kobo, status)
    VALUES ('school', p_school_id, 'NGN', 0, 'active')
    RETURNING * INTO v_wallet;
  END IF;

  IF v_wallet.available_balance_kobo < v_price_kobo THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'insufficient_wallet_funds',
      'error', 'Insufficient school wallet balance (₦' || TO_CHAR(v_wallet.available_balance_kobo::NUMERIC / 100, 'FM999,999,990.00') || '). You need ₦' || TO_CHAR(v_price_kobo::NUMERIC / 100, 'FM999,999,990.00') || ' to purchase ' || v_units || ' Gate Credit Units. Please fund your wallet first.',
      'available_kobo', v_wallet.available_balance_kobo,
      'available_ngn', ROUND(v_wallet.available_balance_kobo::NUMERIC / 100, 2),
      'required_kobo', v_price_kobo,
      'required_ngn', ROUND(v_price_kobo::NUMERIC / 100, 2)
    );
  END IF;

  -- 4. Lock Daisaf Revenue Wallet
  SELECT * INTO v_daisaf_wallet
  FROM public.wallets
  WHERE entity_type IN ('daisaf', 'platform_treasury')
  ORDER BY (entity_type = 'daisaf') DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.wallets (entity_type, currency, available_balance_kobo, status)
    VALUES ('daisaf', 'NGN', 0, 'active')
    RETURNING * INTO v_daisaf_wallet;
  END IF;

  v_ref := 'GC-BUY-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MISS') || '-' || UPPER(SUBSTR(gen_random_uuid()::text, 1, 6));
  v_new_wallet_kobo := v_wallet.available_balance_kobo - v_price_kobo;
  v_new_units_milli := v_school.gate_credit_balance_milli + (v_units::BIGINT * 1000);

  -- 5. Atomic Wallet Debit & Platform Revenue Credit
  UPDATE public.wallets
  SET available_balance_kobo = v_new_wallet_kobo,
      updated_at = NOW()
  WHERE id = v_wallet.id;

  UPDATE public.wallets
  SET available_balance_kobo = available_balance_kobo + v_price_kobo,
      updated_at = NOW()
  WHERE id = v_daisaf_wallet.id;

  -- 6. Double-Entry Wallet Transactions
  INSERT INTO public.wallet_transactions (
    wallet_id, counterpart_wallet_id, transaction_type, channel,
    amount_kobo, balance_before_kobo, balance_after_kobo, reference,
    status, description, metadata
  ) VALUES (
    v_wallet.id, v_daisaf_wallet.id, 'DEBIT', 'GATE_CREDIT_PURCHASE',
    v_price_kobo, v_wallet.available_balance_kobo, v_new_wallet_kobo,
    v_ref, 'COMPLETED',
    'School Gate Credit Purchase: ' || v_units || ' Units (' || v_pkg_name || ')',
    jsonb_build_object(
      'school_id', p_school_id,
      'package_id', COALESCE(p_package_id, 'CUSTOM'),
      'units_purchased', v_units,
      'units_before', ROUND(v_school.gate_credit_balance_milli::NUMERIC / 1000, 2),
      'units_after', ROUND(v_new_units_milli::NUMERIC / 1000, 2)
    )
  ) RETURNING id INTO v_tx_id;

  INSERT INTO public.wallet_transactions (
    wallet_id, counterpart_wallet_id, transaction_type, channel,
    amount_kobo, balance_before_kobo, balance_after_kobo, reference,
    status, description, metadata
  ) VALUES (
    v_daisaf_wallet.id, v_wallet.id, 'CREDIT', 'GATE_CREDIT_PURCHASE',
    v_price_kobo, v_daisaf_wallet.available_balance_kobo, v_daisaf_wallet.available_balance_kobo + v_price_kobo,
    v_ref || '-REV', 'COMPLETED',
    'Gate Credit Package Revenue: ' || v_school.name || ' (' || v_units || ' Units)',
    jsonb_build_object(
      'school_id', p_school_id,
      'school_name', v_school.name,
      'units_purchased', v_units
    )
  );

  -- 7. Credit School Gate Units Vault
  UPDATE public.schools
  SET gate_credit_balance_milli = v_new_units_milli,
      is_wallet_active = TRUE,
      wallet_mode = CASE WHEN wallet_mode = 'inactive' THEN 'school_funded' ELSE wallet_mode END,
      updated_at = NOW()
  WHERE id = p_school_id;

  -- 8. Record in School Gate Credit Ledger
  INSERT INTO public.school_gate_credit_ledger (
    school_id, entry_type, units_delta_milli, units_before_milli, units_after_milli,
    amount_kobo, wallet_transaction_id, package_id, reference, description, actor_user_id, metadata
  ) VALUES (
    p_school_id, 'PURCHASE', (v_units::BIGINT * 1000), v_school.gate_credit_balance_milli, v_new_units_milli,
    v_price_kobo, v_tx_id, CASE WHEN p_package_id <> 'CUSTOM' THEN p_package_id ELSE NULL END,
    v_ref,
    'Purchased ' || v_units || ' Gate Credit Units (' || v_pkg_name || ') via School Wallet',
    p_actor_id,
    jsonb_build_object(
      'package_name', v_pkg_name,
      'units_purchased', v_units,
      'amount_ngn', ROUND(v_price_kobo::NUMERIC / 100, 2),
      'wallet_balance_after_ngn', ROUND(v_new_wallet_kobo::NUMERIC / 100, 2)
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'reference', v_ref,
    'package_name', v_pkg_name,
    'units_purchased', v_units,
    'units_before', ROUND(v_school.gate_credit_balance_milli::NUMERIC / 1000, 2),
    'new_units', ROUND(v_new_units_milli::NUMERIC / 1000, 2),
    'debited_kobo', v_price_kobo,
    'debited_ngn', ROUND(v_price_kobo::NUMERIC / 100, 2),
    'wallet_balance_after_kobo', v_new_wallet_kobo,
    'wallet_balance_after_ngn', ROUND(v_new_wallet_kobo::NUMERIC / 100, 2)
  );
END;
$$;

-- 8. UPDATED STORED PROCEDURE: ATOMIC GATE SCAN METERING (0.5 UNIT = 500 MILLI-UNITS = ₦3.00 PER SCAN)
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
  v_fee_kobo            BIGINT := 300;  -- ₦3.00 equivalent per half-unit scan
  v_scan_units_milli    BIGINT := 500;  -- 0.5 Unit per Clock-In or Clock-Out (1.0 Unit = Clock-In + Clock-Out = ₦6/day)
  v_parent_user_id      UUID;
  v_payer_type          VARCHAR(20) := 'school';
  v_ref                 VARCHAR(120);
  v_new_bal_kobo        BIGINT;
  v_new_units_milli     BIGINT;
  v_scan_log_id         UUID;
  v_person_name         VARCHAR(200) := 'Campus Member';
  v_person_code         VARCHAR(100) := '';
  v_person_role         VARCHAR(40)  := 'student';
  v_scan_type_label     VARCHAR(20);
BEGIN
  -- 1. Lock School Record
  SELECT
    id,
    name,
    wallet_mode,
    is_wallet_active,
    COALESCE(gate_scan_fee_kobo, 300) AS gate_scan_fee_kobo,
    COALESCE(gate_credit_balance_milli, 0) AS gate_credit_balance_milli
  INTO v_school
  FROM public.schools
  WHERE id = p_school_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'SCHOOL_NOT_FOUND', 'code', 'school_not_found');
  END IF;

  v_scan_type_label := CASE WHEN p_scan_direction = 'sign_out' THEN 'clock_out' ELSE 'clock_in' END;

  -- Resolve Person Identity for Audit Documentation
  IF p_student_id IS NOT NULL THEN
    v_person_role := 'student';
    SELECT TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), COALESCE(student_id_number, '')
    INTO v_person_name, v_person_code
    FROM public.students
    WHERE id = p_student_id;
  ELSIF p_staff_profile_id IS NOT NULL THEN
    v_person_role := 'staff';
    SELECT COALESCE(u.full_name, 'Staff Member'), COALESCE(tp.staff_id_number, '')
    INTO v_person_name, v_person_code
    FROM public.teacher_profiles tp
    LEFT JOIN public.user_profiles u ON u.id = tp.user_id
    WHERE tp.id = p_staff_profile_id;
  END IF;

  -- 2. Parent-Funded Mode (if configured specifically for parent-direct billing)
  IF v_school.wallet_mode = 'parent_funded' AND p_student_id IS NOT NULL THEN
    v_payer_type := 'parent';
    v_fee_kobo := v_school.gate_scan_fee_kobo;

    SELECT parent_user_id INTO v_parent_user_id
    FROM public.student_parents
    WHERE student_id = p_student_id
    ORDER BY is_primary DESC
    LIMIT 1;

    IF v_parent_user_id IS NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'UNREGISTERED_STUDENT_GATE_BLOCKED',
        'code', 'unregistered_student',
        'message', 'Student is not linked to an active MyEduRide parent account.'
      );
    END IF;

    SELECT * INTO v_payer_wallet
    FROM public.wallets
    WHERE user_id = v_parent_user_id AND entity_type = 'parent'
    LIMIT 1
    FOR UPDATE;

    IF NOT FOUND OR v_payer_wallet.available_balance_kobo < v_fee_kobo THEN
      RETURN jsonb_build_object(
        'success', false,
        'payer_type', 'parent',
        'error', 'INSUFFICIENT_WALLET_BALANCE',
        'code', 'insufficient_funds',
        'message', 'Parent wallet has insufficient funds for gate scan.'
      );
    END IF;

    SELECT * INTO v_daisaf_wallet
    FROM public.wallets
    WHERE entity_type IN ('daisaf', 'platform_treasury')
    ORDER BY (entity_type = 'daisaf') DESC
    LIMIT 1
    FOR UPDATE;

    v_new_bal_kobo := v_payer_wallet.available_balance_kobo - v_fee_kobo;
    v_ref := 'SCAN-PAR-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MISS') || '-' || SUBSTR(gen_random_uuid()::text, 1, 6);

    UPDATE public.wallets SET available_balance_kobo = v_new_bal_kobo, updated_at = NOW() WHERE id = v_payer_wallet.id;
    IF v_daisaf_wallet.id IS NOT NULL THEN
      UPDATE public.wallets SET available_balance_kobo = available_balance_kobo + v_fee_kobo, updated_at = NOW() WHERE id = v_daisaf_wallet.id;
    END IF;

    INSERT INTO public.gate_scan_logs (
      school_id, student_id, staff_profile_id, scan_direction, scan_fee_kobo,
      billed_wallet_id, payer_type, status, transaction_ref
    ) VALUES (
      p_school_id, p_student_id, p_staff_profile_id, p_scan_direction, v_fee_kobo,
      v_payer_wallet.id, 'parent', 'BILLED', v_ref
    ) RETURNING id INTO v_scan_log_id;

    RETURN jsonb_build_object(
      'success', true,
      'scan_log_id', v_scan_log_id,
      'reference', v_ref,
      'payer_type', 'parent',
      'fee_kobo', v_fee_kobo,
      'new_balance_kobo', v_new_bal_kobo,
      'new_balance_ngn', ROUND(v_new_bal_kobo::NUMERIC / 100, 2)
    );
  END IF;

  -- 3. SCHOOL PREPAID GATE CREDIT UNIT METERING (Default Mode)
  -- Each Clock-In = 0.5 Unit (500 milli-units = ₦3.00)
  -- Each Clock-Out = 0.5 Unit (500 milli-units = ₦3.00)
  -- Complete Day (Clock-In + Clock-Out) = 1.0 Unit (1,000 milli-units = ₦6.00)
  IF v_school.gate_credit_balance_milli < v_scan_units_milli THEN
    INSERT INTO public.gate_scan_logs (
      school_id, student_id, staff_profile_id, scan_direction, scan_fee_kobo,
      payer_type, status, failure_reason
    ) VALUES (
      p_school_id, p_student_id, p_staff_profile_id, p_scan_direction, v_fee_kobo,
      'school', 'BLOCKED_INSUFFICIENT_FUNDS',
      'Insufficient gate credit units (' || ROUND(v_school.gate_credit_balance_milli::NUMERIC / 1000, 1) || ' units remaining)'
    );

    RETURN jsonb_build_object(
      'success', false,
      'payer_type', 'school',
      'error', 'INSUFFICIENT_GATE_CREDITS',
      'code', 'insufficient_credits',
      'remaining_units', ROUND(v_school.gate_credit_balance_milli::NUMERIC / 1000, 1),
      'required_units', 0.5,
      'message', 'Gate Credit Units exhausted (' || ROUND(v_school.gate_credit_balance_milli::NUMERIC / 1000, 1) || ' units left). Please ask the School Admin to purchase Gate Credit Units.'
    );
  END IF;

  -- 4. Deduct 0.5 Unit (500 milli-units) from School Gate Credit Vault
  v_new_units_milli := v_school.gate_credit_balance_milli - v_scan_units_milli;
  v_ref := 'GC-SCAN-' || TO_CHAR(NOW(), 'YYYYMMDD-HH24MISS') || '-' || UPPER(SUBSTR(gen_random_uuid()::text, 1, 6));

  UPDATE public.schools
  SET gate_credit_balance_milli = v_new_units_milli,
      updated_at = NOW()
  WHERE id = p_school_id;

  -- 5. Document Every Unit Spent in Immutable School Gate Credit Ledger
  INSERT INTO public.school_gate_credit_ledger (
    school_id,
    entry_type,
    units_delta_milli,
    units_before_milli,
    units_after_milli,
    amount_kobo,
    student_id,
    staff_profile_id,
    person_name,
    person_code,
    person_role,
    scan_type,
    reference,
    description,
    metadata
  ) VALUES (
    p_school_id,
    'CONSUMPTION_SCAN',
    -v_scan_units_milli,
    v_school.gate_credit_balance_milli,
    v_new_units_milli,
    v_fee_kobo, -- 300 kobo = ₦3.00 equivalent value
    p_student_id,
    p_staff_profile_id,
    v_person_name,
    v_person_code,
    v_person_role,
    v_scan_type_label,
    v_ref,
    CASE
      WHEN p_scan_direction = 'sign_in' THEN 'Clock-In Scan: ' || COALESCE(v_person_name, 'Member') || ' (' || COALESCE(NULLIF(v_person_code, ''), UPPER(v_person_role)) || ') · -0.5 Unit (₦3)'
      ELSE 'Clock-Out Scan: ' || COALESCE(v_person_name, 'Member') || ' (' || COALESCE(NULLIF(v_person_code, ''), UPPER(v_person_role)) || ') · -0.5 Unit (₦3)'
    END,
    jsonb_build_object(
      'scan_direction', p_scan_direction,
      'scan_type', v_scan_type_label,
      'person_name', v_person_name,
      'person_code', v_person_code,
      'person_role', v_person_role,
      'unit_cost_ngn', 3,
      'daily_unit_rate_ngn', 6
    )
  );

  -- 6. Log to Gate Scan Logs
  INSERT INTO public.gate_scan_logs (
    school_id,
    student_id,
    staff_profile_id,
    scan_direction,
    scan_fee_kobo,
    payer_type,
    status,
    transaction_ref
  ) VALUES (
    p_school_id,
    p_student_id,
    p_staff_profile_id,
    p_scan_direction,
    v_fee_kobo,
    'school',
    'BILLED',
    v_ref
  ) RETURNING id INTO v_scan_log_id;

  RETURN jsonb_build_object(
    'success', true,
    'scan_log_id', v_scan_log_id,
    'reference', v_ref,
    'payer_type', 'school',
    'units_deducted', 0.5,
    'remaining_units', ROUND(v_new_units_milli::NUMERIC / 1000, 1),
    'remaining_units_milli', v_new_units_milli,
    'fee_kobo', v_fee_kobo,
    'new_balance_kobo', 0,
    'new_balance_ngn', 0
  );
END;
$$;

