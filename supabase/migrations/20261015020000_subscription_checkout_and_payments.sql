-- Migration: 20261015020000_subscription_checkout_and_payments.sql
-- InvoicePro 360: Checkout, Payment Orders, Idempotent Activation & Billing History

-- 1. Extend subscriptions table with billing cycle and expiration tracking
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS billing_cycle TEXT NOT NULL DEFAULT 'monthly', -- 'monthly' or 'annual'
  ADD COLUMN IF NOT EXISTS payment_reference TEXT,
  ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 month');

-- 2. Create Subscription Payments Ledger table
CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES public.subscription_plans(id),
  billing_cycle TEXT NOT NULL DEFAULT 'monthly', -- 'monthly' or 'annual'
  amount_inr NUMERIC NOT NULL,
  tax_inr NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'failed', 'refunded'
  gateway TEXT NOT NULL DEFAULT 'razorpay',
  gateway_order_id TEXT UNIQUE,
  gateway_payment_id TEXT UNIQUE,
  gateway_signature TEXT,
  manual_admin_granted BOOLEAN NOT NULL DEFAULT false,
  granted_by TEXT,
  justification TEXT,
  receipt_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_sub_payments_user_id ON public.subscription_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_sub_payments_order_id ON public.subscription_payments(gateway_order_id);
CREATE INDEX IF NOT EXISTS idx_sub_payments_status ON public.subscription_payments(status);
CREATE INDEX IF NOT EXISTS idx_sub_payments_created_at ON public.subscription_payments(created_at DESC);

-- Enable RLS
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

-- Users can view their own payment records
DROP POLICY IF EXISTS "Users can view own subscription payments" ON public.subscription_payments;
CREATE POLICY "Users can view own subscription payments"
  ON public.subscription_payments FOR SELECT
  USING (auth.uid() = user_id);

-- Restrict INSERT, UPDATE, DELETE to server-side service role
-- Clients cannot insert fake paid payment rows from browser

-- 3. Idempotent Subscription Activation Stored Procedure
CREATE OR REPLACE FUNCTION public.activate_subscription_payment(
  p_payment_id UUID,
  p_gateway_payment_id TEXT,
  p_gateway_signature TEXT,
  p_status TEXT DEFAULT 'paid'
)
RETURNS JSONB AS $$
DECLARE
  v_payment RECORD;
  v_period_interval INTERVAL;
  v_new_end TIMESTAMPTZ;
  v_current_end TIMESTAMPTZ;
BEGIN
  -- Lock payment row to prevent race conditions / duplicate activations
  SELECT * INTO v_payment
  FROM public.subscription_payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'PAYMENT_NOT_FOUND',
      'message', 'Payment record does not exist'
    );
  END IF;

  -- Idempotency check: if already activated as paid, return existing state
  IF v_payment.status = 'paid' THEN
    RETURN jsonb_build_object(
      'success', true,
      'code', 'ALREADY_ACTIVATED',
      'message', 'Payment already processed and subscription activated',
      'plan_id', v_payment.plan_id
    );
  END IF;

  -- Update payment status to paid
  UPDATE public.subscription_payments
  SET 
    status = p_status,
    gateway_payment_id = COALESCE(p_gateway_payment_id, gateway_payment_id),
    gateway_signature = COALESCE(p_gateway_signature, gateway_signature),
    paid_at = NOW()
  WHERE id = p_payment_id;

  -- Calculate billing interval (monthly = 1 month, annual = 1 year)
  IF v_payment.billing_cycle = 'annual' THEN
    v_period_interval := INTERVAL '1 year';
  ELSE
    v_period_interval := INTERVAL '1 month';
  END IF;

  -- Calculate new expiry date
  SELECT current_period_end INTO v_current_end
  FROM public.subscriptions
  WHERE user_id = v_payment.user_id;

  IF v_current_end IS NOT NULL AND v_current_end > NOW() THEN
    -- If extending an active plan of same tier, append interval; otherwise start fresh from NOW
    v_new_end := NOW() + v_period_interval;
  ELSE
    v_new_end := NOW() + v_period_interval;
  END IF;

  -- Atomically activate user subscription and reset monthly quotas
  INSERT INTO public.subscriptions (
    user_id,
    plan_id,
    status,
    billing_cycle,
    payment_reference,
    current_period_start,
    current_period_end,
    expires_at,
    invoices_used,
    ai_generations_used,
    updated_at
  )
  VALUES (
    v_payment.user_id,
    v_payment.plan_id,
    'active',
    v_payment.billing_cycle,
    p_gateway_payment_id,
    NOW(),
    v_new_end,
    v_new_end,
    0,
    0,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    plan_id = EXCLUDED.plan_id,
    status = 'active',
    billing_cycle = EXCLUDED.billing_cycle,
    payment_reference = EXCLUDED.payment_reference,
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    expires_at = EXCLUDED.expires_at,
    invoices_used = 0,
    ai_generations_used = 0,
    updated_at = NOW();

  -- Record usage audit log
  INSERT INTO public.usage_history (user_id, action_type, metadata)
  VALUES (
    v_payment.user_id,
    'subscription_activated',
    jsonb_build_object(
      'payment_id', v_payment.id,
      'plan_id', v_payment.plan_id,
      'amount_inr', v_payment.amount_inr,
      'billing_cycle', v_payment.billing_cycle,
      'gateway_payment_id', p_gateway_payment_id,
      'expires_at', v_new_end
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'code', 'ACTIVATED',
    'plan_id', v_payment.plan_id,
    'billing_cycle', v_payment.billing_cycle,
    'expires_at', v_new_end
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
