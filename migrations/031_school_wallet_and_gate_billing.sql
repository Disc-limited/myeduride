-- ==============================================================================
-- Migration 031: School Wallet System, Institutional Vault & Unique Indexing
-- Standards: Multi-Entity Ledger, Non-Negative Checks, Idempotent Auto-Provisioning
-- ==============================================================================

-- 1. Unique index: Exactly one active wallet per school
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallets_school_entity_unique 
  ON public.wallets(school_id, entity_type) 
  WHERE entity_type = 'school' AND school_id IS NOT NULL;

-- 2. Add institutional daily gate platform fee column to schools
ALTER TABLE public.schools 
  ADD COLUMN IF NOT EXISTS daily_gate_fee_kobo BIGINT NOT NULL DEFAULT 250000;

-- 3. Stored Procedure: Atomic Get-Or-Create School Wallet
CREATE OR REPLACE FUNCTION public.get_or_create_school_wallet(p_school_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet RECORD;
BEGIN
  -- Verify school exists
  IF NOT EXISTS (SELECT 1 FROM public.schools WHERE id = p_school_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'SCHOOL_NOT_FOUND');
  END IF;

  -- 1. Try to find existing school wallet
  SELECT * INTO v_wallet 
  FROM public.wallets 
  WHERE school_id = p_school_id AND entity_type = 'school'
  LIMIT 1;

  -- 2. If absent, provision active institutional wallet atomically
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

  RETURN jsonb_build_object(
    'success', true,
    'wallet_id', v_wallet.id,
    'school_id', v_wallet.school_id,
    'entity_type', v_wallet.entity_type,
    'available_balance_kobo', v_wallet.available_balance_kobo,
    'available_balance_ngn', (v_wallet.available_balance_kobo::NUMERIC / 100),
    'reserved_balance_kobo', v_wallet.reserved_balance_kobo,
    'reserved_balance_ngn', (v_wallet.reserved_balance_kobo::NUMERIC / 100),
    'currency', v_wallet.currency,
    'status', v_wallet.status
  );
END;
$$;

-- 4. Backfill institutional wallets for all existing schools
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
)
SELECT 
  'school',
  s.id,
  'NGN',
  0,
  0,
  0,
  0,
  0,
  'active'
FROM public.schools s
WHERE NOT EXISTS (
  SELECT 1 FROM public.wallets w 
  WHERE w.school_id = s.id AND w.entity_type = 'school'
)
ON CONFLICT DO NOTHING;
