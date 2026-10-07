-- ==============================================================================
-- Migration 026: SeerBit Payment Gateway, Double-Entry Ledger & Financial Vault
-- Standards: CBN-Aligned FinTech Architecture, Zero-Trust Hardening, Tamper-Evident Ledger
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. UPGRADE WALLETS TABLE TO ENTERPRISE INTEGER KOBO ARCHITECTURE
DO $$ 
BEGIN
  -- Add columns if not already present
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wallets' AND column_name='entity_type') THEN
    ALTER TABLE public.wallets ADD COLUMN entity_type VARCHAR(30) NOT NULL DEFAULT 'parent';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wallets' AND column_name='school_id') THEN
    ALTER TABLE public.wallets ADD COLUMN school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wallets' AND column_name='available_balance_kobo') THEN
    ALTER TABLE public.wallets ADD COLUMN available_balance_kobo BIGINT NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wallets' AND column_name='reserved_balance_kobo') THEN
    ALTER TABLE public.wallets ADD COLUMN reserved_balance_kobo BIGINT NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wallets' AND column_name='escrow_balance_kobo') THEN
    ALTER TABLE public.wallets ADD COLUMN escrow_balance_kobo BIGINT NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wallets' AND column_name='locked_balance_kobo') THEN
    ALTER TABLE public.wallets ADD COLUMN locked_balance_kobo BIGINT NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wallets' AND column_name='pending_earnings_kobo') THEN
    ALTER TABLE public.wallets ADD COLUMN pending_earnings_kobo BIGINT NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wallets' AND column_name='seerbit_customer_id') THEN
    ALTER TABLE public.wallets ADD COLUMN seerbit_customer_id VARCHAR(100);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wallets' AND column_name='virtual_account_number') THEN
    ALTER TABLE public.wallets ADD COLUMN virtual_account_number VARCHAR(20);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wallets' AND column_name='virtual_bank_name') THEN
    ALTER TABLE public.wallets ADD COLUMN virtual_bank_name VARCHAR(100);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wallets' AND column_name='virtual_account_name') THEN
    ALTER TABLE public.wallets ADD COLUMN virtual_account_name VARCHAR(150);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wallets' AND column_name='virtual_account_reference') THEN
    ALTER TABLE public.wallets ADD COLUMN virtual_account_reference VARCHAR(100);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wallets' AND column_name='payout_bank_code') THEN
    ALTER TABLE public.wallets ADD COLUMN payout_bank_code VARCHAR(10);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wallets' AND column_name='payout_account_number') THEN
    ALTER TABLE public.wallets ADD COLUMN payout_account_number VARCHAR(20);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wallets' AND column_name='payout_account_name') THEN
    ALTER TABLE public.wallets ADD COLUMN payout_account_name VARCHAR(150);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wallets' AND column_name='payout_bank_verified') THEN
    ALTER TABLE public.wallets ADD COLUMN payout_bank_verified BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='wallets' AND column_name='status') THEN
    ALTER TABLE public.wallets ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active';
  END IF;
END $$;

-- Enforce strict non-negative check constraints on wallet balances
ALTER TABLE public.wallets DROP CONSTRAINT IF EXISTS chk_available_balance_non_negative;
ALTER TABLE public.wallets ADD CONSTRAINT chk_available_balance_non_negative CHECK (available_balance_kobo >= 0);

ALTER TABLE public.wallets DROP CONSTRAINT IF EXISTS chk_reserved_balance_non_negative;
ALTER TABLE public.wallets ADD CONSTRAINT chk_reserved_balance_non_negative CHECK (reserved_balance_kobo >= 0);

ALTER TABLE public.wallets DROP CONSTRAINT IF EXISTS chk_escrow_balance_non_negative;
ALTER TABLE public.wallets ADD CONSTRAINT chk_escrow_balance_non_negative CHECK (escrow_balance_kobo >= 0);

ALTER TABLE public.wallets DROP CONSTRAINT IF EXISTS chk_locked_balance_non_negative;
ALTER TABLE public.wallets ADD CONSTRAINT chk_locked_balance_non_negative CHECK (locked_balance_kobo >= 0);

CREATE INDEX IF NOT EXISTS idx_wallets_user_entity ON public.wallets(user_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_wallets_virtual_ref ON public.wallets(virtual_account_reference);

-- 2. PAYMENT INTENTS (PERSIST INTENT BEFORE CALLING GATEWAY)
CREATE TABLE IF NOT EXISTS public.payment_intents (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key         VARCHAR(120) NOT NULL UNIQUE,
  wallet_id               UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  user_id                 UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  amount_kobo             BIGINT NOT NULL CHECK (amount_kobo > 0),
  currency                VARCHAR(10) NOT NULL DEFAULT 'NGN',
  payment_method          VARCHAR(40) DEFAULT 'seerbit_checkout',
  reference               VARCHAR(120) NOT NULL UNIQUE,
  seerbit_reference       VARCHAR(120),
  status                  VARCHAR(30) NOT NULL DEFAULT 'INTENT_CREATED'
                          CHECK (status IN ('INTENT_CREATED', 'PENDING_GATEWAY', 'SUCCESS', 'FAILED', 'EXPIRED', 'CANCELLED')),
  metadata                JSONB DEFAULT '{}'::jsonb,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_intents_user ON public.payment_intents(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_intents_ref ON public.payment_intents(reference);
CREATE INDEX IF NOT EXISTS idx_payment_intents_status ON public.payment_intents(status);

-- 3. TRIP LEGS (TWO INDEPENDENT LEGS PER DAILY TRIP)
CREATE TABLE IF NOT EXISTS public.trip_legs (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id              UUID REFERENCES public.vehicle_active_sessions(id) ON DELETE SET NULL,
  student_id              UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  parent_wallet_id        UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  escort_wallet_id        UUID REFERENCES public.wallets(id) ON DELETE SET NULL,
  leg_type                VARCHAR(10) NOT NULL CHECK (leg_type IN ('pickup', 'dropoff')),
  amount_kobo             BIGINT NOT NULL CHECK (amount_kobo > 0),
  status                  VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                          CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXCEPTION')),
  completed_at            TIMESTAMPTZ,
  gps_lat                 DECIMAL(10,7),
  gps_lng                 DECIMAL(10,7),
  verified_by_user_id     UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trip_legs_session ON public.trip_legs(session_id, leg_type);
CREATE INDEX IF NOT EXISTS idx_trip_legs_student ON public.trip_legs(student_id, status);

-- 4. WALLET TRANSACTIONS (IMMUTABLE DOUBLE-ENTRY LEDGER + HASH-CHAINING)
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id               UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  counterpart_wallet_id   UUID REFERENCES public.wallets(id) ON DELETE SET NULL,
  transaction_type        VARCHAR(10) NOT NULL CHECK (transaction_type IN ('CREDIT', 'DEBIT')),
  channel                 VARCHAR(40) NOT NULL,
  amount_kobo             BIGINT NOT NULL CHECK (amount_kobo > 0),
  balance_before_kobo     BIGINT NOT NULL,
  balance_after_kobo      BIGINT NOT NULL,
  reference               VARCHAR(120) NOT NULL UNIQUE,
  payment_intent_id       UUID REFERENCES public.payment_intents(id) ON DELETE SET NULL,
  trip_id                 UUID REFERENCES public.vehicle_active_sessions(id) ON DELETE SET NULL,
  trip_leg_id             UUID REFERENCES public.trip_legs(id) ON DELETE SET NULL,
  student_id              UUID REFERENCES public.students(id) ON DELETE SET NULL,
  status                  VARCHAR(20) NOT NULL DEFAULT 'COMPLETED'
                          CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'REVERSED')),
  description             TEXT NOT NULL,
  metadata                JSONB DEFAULT '{}'::jsonb,
  previous_row_hash       VARCHAR(64),
  row_integrity_hash      VARCHAR(64) NOT NULL DEFAULT '',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_wallet ON public.wallet_transactions(wallet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_ref ON public.wallet_transactions(reference);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_intent ON public.wallet_transactions(payment_intent_id);

-- Cryptographic Row Integrity Hash Trigger
CREATE OR REPLACE FUNCTION public.generate_wallet_transaction_hash()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_prev_hash VARCHAR(64);
  v_payload TEXT;
BEGIN
  SELECT row_integrity_hash INTO v_prev_hash 
  FROM public.wallet_transactions 
  WHERE wallet_id = NEW.wallet_id 
  ORDER BY created_at DESC, id DESC 
  LIMIT 1;

  NEW.previous_row_hash := COALESCE(v_prev_hash, 'GENESIS_ZERO_HASH');

  v_payload := NEW.id::text || '|' || 
               NEW.wallet_id::text || '|' || 
               NEW.transaction_type || '|' || 
               NEW.amount_kobo::text || '|' || 
               NEW.balance_before_kobo::text || '|' || 
               NEW.balance_after_kobo::text || '|' || 
               NEW.reference || '|' || 
               NEW.previous_row_hash || '|' || 
               COALESCE(NEW.created_at, NOW())::text;

  NEW.row_integrity_hash := encode(digest(v_payload, 'sha256'), 'hex');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ledger_hash_chain ON public.wallet_transactions;
CREATE TRIGGER trg_ledger_hash_chain
BEFORE INSERT ON public.wallet_transactions
FOR EACH ROW
EXECUTE FUNCTION public.generate_wallet_transaction_hash();

-- 5. ESCROW HOLDS TABLE
CREATE TABLE IF NOT EXISTS public.escrow_holds (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_wallet_id        UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  escort_wallet_id        UUID REFERENCES public.wallets(id) ON DELETE SET NULL,
  school_id               UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  trip_id                 UUID REFERENCES public.vehicle_active_sessions(id) ON DELETE SET NULL,
  student_id              UUID REFERENCES public.students(id) ON DELETE SET NULL,
  gross_amount_kobo       BIGINT NOT NULL,
  vat_kobo                BIGINT NOT NULL,
  km_charge_kobo          BIGINT NOT NULL,
  myeduride_km_fee_kobo   BIGINT NOT NULL,
  driver_share_kobo       BIGINT NOT NULL,
  myeduride_total_kobo    BIGINT NOT NULL,
  status                  VARCHAR(30) NOT NULL DEFAULT 'HELD'
                          CHECK (status IN ('HELD', 'RELEASED', 'REFUNDED_TO_PARENT', 'DISPUTED', 'PARTIAL_RELEASE')),
  city_manager_approved_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  city_manager_notes      TEXT,
  approved_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escrow_holds_parent ON public.escrow_holds(parent_wallet_id, status);
CREATE INDEX IF NOT EXISTS idx_escrow_holds_trip ON public.escrow_holds(trip_id);

-- 6. PROCESSED WEBHOOKS (REPLAY PROTECTION & IDEMPOTENCY)
CREATE TABLE IF NOT EXISTS public.processed_webhooks (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id                VARCHAR(150) NOT NULL UNIQUE,
  provider                VARCHAR(50) NOT NULL DEFAULT 'seerbit',
  event_type              VARCHAR(100),
  payload_hash            VARCHAR(64),
  status                  VARCHAR(30) NOT NULL DEFAULT 'SUCCESS',
  processed_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processed_webhooks_event ON public.processed_webhooks(event_id);

-- 7. WITHDRAWAL REQUESTS (MAKER-CHECKER WORKFLOW)
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key         VARCHAR(120) NOT NULL UNIQUE,
  wallet_id               UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  user_id                 UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  amount_kobo             BIGINT NOT NULL CHECK (amount_kobo >= 50000), -- Minimum ₦500
  withdrawal_fee_kobo     BIGINT NOT NULL DEFAULT 0,
  bank_code               VARCHAR(10) NOT NULL,
  account_number          VARCHAR(20) NOT NULL,
  account_name            VARCHAR(150) NOT NULL,
  status                  VARCHAR(30) NOT NULL DEFAULT 'PENDING_APPROVAL'
                          CHECK (status IN ('PENDING_APPROVAL', 'APPROVED_PROCESSING', 'COMPLETED', 'FAILED', 'REJECTED')),
  city_manager_approved_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  city_manager_reviewed_at TIMESTAMPTZ,
  city_manager_comment    TEXT,
  seerbit_payout_reference VARCHAR(120),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_req_user ON public.withdrawal_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_withdrawal_req_status ON public.withdrawal_requests(status);

-- 8. ATOMIC STORED PROCEDURES (PESSIMISTIC ROW-LEVEL LOCKS FOR UPDATE)

-- A. Atomic Wallet Credit Procedure
CREATE OR REPLACE FUNCTION public.execute_atomic_wallet_credit(
  p_wallet_id         UUID,
  p_amount_kobo       BIGINT,
  p_channel           VARCHAR(40),
  p_reference         VARCHAR(120),
  p_description       TEXT,
  p_metadata          JSONB DEFAULT '{}'::jsonb,
  p_payment_intent_id UUID DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_wallet            RECORD;
  v_bal_before        BIGINT;
  v_bal_after         BIGINT;
  v_tx_id             UUID;
BEGIN
  IF p_amount_kobo <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  -- Pessimistic row-level lock
  SELECT * INTO v_wallet FROM public.wallets WHERE id = p_wallet_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  v_bal_before := v_wallet.available_balance_kobo;
  v_bal_after := v_bal_before + p_amount_kobo;

  UPDATE public.wallets
  SET available_balance_kobo = v_bal_after,
      updated_at = NOW()
  WHERE id = p_wallet_id;

  INSERT INTO public.wallet_transactions (
    wallet_id,
    transaction_type,
    channel,
    amount_kobo,
    balance_before_kobo,
    balance_after_kobo,
    reference,
    payment_intent_id,
    status,
    description,
    metadata
  ) VALUES (
    p_wallet_id,
    'CREDIT',
    p_channel,
    p_amount_kobo,
    v_bal_before,
    v_bal_after,
    p_reference,
    p_payment_intent_id,
    'COMPLETED',
    p_description,
    p_metadata
  ) RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'success', true,
    'wallet_id', p_wallet_id,
    'transaction_id', v_tx_id,
    'balance_before_kobo', v_bal_before,
    'balance_after_kobo', v_bal_after,
    'reference', p_reference
  );
END;
$$;

-- B. Atomic Wallet Deduction Procedure
CREATE OR REPLACE FUNCTION public.execute_atomic_wallet_deduction(
  p_wallet_id         UUID,
  p_amount_kobo       BIGINT,
  p_channel           VARCHAR(40),
  p_reference         VARCHAR(120),
  p_description       TEXT,
  p_metadata          JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_wallet            RECORD;
  v_bal_before        BIGINT;
  v_bal_after         BIGINT;
  v_tx_id             UUID;
BEGIN
  IF p_amount_kobo <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  SELECT * INTO v_wallet FROM public.wallets WHERE id = p_wallet_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  v_bal_before := v_wallet.available_balance_kobo;
  IF v_bal_before < p_amount_kobo THEN
    RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_FUNDS', 'available_balance_kobo', v_bal_before);
  END IF;

  v_bal_after := v_bal_before - p_amount_kobo;

  UPDATE public.wallets
  SET available_balance_kobo = v_bal_after,
      updated_at = NOW()
  WHERE id = p_wallet_id;

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
    p_wallet_id,
    'DEBIT',
    p_channel,
    p_amount_kobo,
    v_bal_before,
    v_bal_after,
    p_reference,
    'COMPLETED',
    p_description,
    p_metadata
  ) RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'success', true,
    'wallet_id', p_wallet_id,
    'transaction_id', v_tx_id,
    'balance_before_kobo', v_bal_before,
    'balance_after_kobo', v_bal_after,
    'reference', p_reference
  );
END;
$$;

-- C. Atomic Escrow Hold Procedure
CREATE OR REPLACE FUNCTION public.execute_atomic_escrow_hold(
  p_parent_wallet_id  UUID,
  p_gross_kobo        BIGINT,
  p_trip_id           UUID,
  p_student_id        UUID,
  p_school_id         UUID,
  p_escort_wallet_id  UUID,
  p_reference         VARCHAR(120)
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_wallet            RECORD;
  v_vat_kobo          BIGINT;
  v_km_kobo           BIGINT;
  v_myeduride_km_kobo BIGINT;
  v_driver_share_kobo BIGINT;
  v_myeduride_total   BIGINT;
  v_hold_id           UUID;
BEGIN
  SELECT * INTO v_wallet FROM public.wallets WHERE id = p_parent_wallet_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Parent wallet not found');
  END IF;

  IF v_wallet.available_balance_kobo < p_gross_kobo THEN
    RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_FUNDS', 'available_balance_kobo', v_wallet.available_balance_kobo);
  END IF;

  -- Exact Integer Split (VAT 6%, KM remainder: 20% platform, 80% driver)
  v_vat_kobo          := ROUND(p_gross_kobo * 6::NUMERIC / 100);
  v_km_kobo           := p_gross_kobo - v_vat_kobo;
  v_myeduride_km_kobo := ROUND(v_km_kobo * 20::NUMERIC / 100);
  v_driver_share_kobo := v_km_kobo - v_myeduride_km_kobo;
  v_myeduride_total   := v_vat_kobo + v_myeduride_km_kobo;

  -- Transfer from available to escrow
  UPDATE public.wallets
  SET available_balance_kobo = available_balance_kobo - p_gross_kobo,
      escrow_balance_kobo = escrow_balance_kobo + p_gross_kobo,
      updated_at = NOW()
  WHERE id = p_parent_wallet_id;

  -- Log transaction
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
    description
  ) VALUES (
    p_parent_wallet_id,
    'DEBIT',
    'TRIP_RESERVE',
    p_gross_kobo,
    v_wallet.available_balance_kobo,
    v_wallet.available_balance_kobo - p_gross_kobo,
    p_reference,
    p_trip_id,
    p_student_id,
    'COMPLETED',
    'Daily school shuttle fee placed in escrow hold'
  );

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
    p_parent_wallet_id,
    p_escort_wallet_id,
    p_school_id,
    p_trip_id,
    p_student_id,
    p_gross_kobo,
    v_vat_kobo,
    v_km_kobo,
    v_myeduride_km_kobo,
    v_driver_share_kobo,
    v_myeduride_total,
    'HELD'
  ) RETURNING id INTO v_hold_id;

  RETURN jsonb_build_object(
    'success', true,
    'escrow_hold_id', v_hold_id,
    'gross_kobo', p_gross_kobo,
    'vat_kobo', v_vat_kobo,
    'driver_share_kobo', v_driver_share_kobo,
    'platform_share_kobo', v_myeduride_total
  );
END;
$$;

-- 9. ZERO-TRUST ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_legs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escrow_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processed_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Block client direct mutations (Strict Server-Side Only Execution)
DROP POLICY IF EXISTS "wallets_client_readonly" ON public.wallets;
CREATE POLICY "wallets_client_readonly" ON public.wallets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "payment_intents_client_readonly" ON public.payment_intents;
CREATE POLICY "payment_intents_client_readonly" ON public.payment_intents
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "wallet_transactions_client_readonly" ON public.wallet_transactions;
CREATE POLICY "wallet_transactions_client_readonly" ON public.wallet_transactions
  FOR SELECT TO authenticated
  USING (
    wallet_id IN (SELECT id FROM public.wallets WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "withdrawal_requests_client_readonly" ON public.withdrawal_requests;
CREATE POLICY "withdrawal_requests_client_readonly" ON public.withdrawal_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
