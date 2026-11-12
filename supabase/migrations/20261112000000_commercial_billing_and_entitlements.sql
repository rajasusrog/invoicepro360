-- Migration: 20261112000000_commercial_billing_and_entitlements.sql
-- InvoicePro 360: Commercial Billing (Monthly, Annual & Lifetime), Webhook Idempotency & Atomic Quota Ledger
-- Does not drop existing tables; preserves all existing user data and RLS policies.

-- ============================================================================
-- 1. BILLING PLANS CATALOGUE (Authoritative Plan & Variant Store)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.billing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code TEXT NOT NULL CHECK (plan_code IN ('basic', 'standard', 'professional', 'elite', 'ultra')),
  plan_name TEXT NOT NULL,
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'annual', 'lifetime')),
  price_paise BIGINT, -- NULL when price is unset / requires enterprise configuration
  currency TEXT NOT NULL DEFAULT 'INR',
  description TEXT NOT NULL DEFAULT '',
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  invoice_quota INTEGER NOT NULL DEFAULT 10, -- -1 for configurable fair-use unlimited
  ai_quota INTEGER NOT NULL DEFAULT 5,
  customer_quota INTEGER NOT NULL DEFAULT 25,
  team_quota INTEGER NOT NULL DEFAULT 1,
  razorpay_plan_id TEXT, -- Required for monthly/annual recurring Razorpay subscriptions
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_billing_plans_code_cycle UNIQUE (plan_code, billing_cycle)
);

CREATE INDEX IF NOT EXISTS idx_billing_plans_active ON public.billing_plans(is_active, plan_code, billing_cycle);

ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read active billing plans" ON public.billing_plans;
CREATE POLICY "Anyone can read active billing plans"
  ON public.billing_plans FOR SELECT
  USING (is_active = true);

-- Seed authoritative 5 tiers x 3 billing cycles (Basic, Standard, Professional, Elite, Ultra)
-- Prices stored in integer paise (INR * 100). Ultra is NULL (unset/configurable enterprise tier).
INSERT INTO public.billing_plans (
  plan_code, plan_name, billing_cycle, price_paise, currency, description,
  invoice_quota, ai_quota, customer_quota, team_quota, razorpay_plan_id, is_active, features
) VALUES
  -- BASIC (Free Tier)
  (
    'basic', 'Basic', 'monthly', 0, 'INR',
    'Essential GST billing and AI invoice drafting for freelancers and sole proprietors.',
    10, 5, 25, 1, NULL, true,
    '["10 GST invoices per month", "5 AI invoice generations per month", "Up to 25 customer & vendor records", "1 user workspace seat", "Automated CGST, SGST & IGST calculation", "Standard PDF & print-ready exports"]'::jsonb
  ),
  (
    'basic', 'Basic', 'annual', 0, 'INR',
    'Essential GST billing and AI invoice drafting with monthly quota resets.',
    10, 5, 25, 1, NULL, true,
    '["10 GST invoices per month (resets monthly)", "5 AI invoice generations per month", "Up to 25 customer & vendor records", "1 user workspace seat", "Automated CGST, SGST & IGST calculation", "Standard PDF & print-ready exports"]'::jsonb
  ),
  (
    'basic', 'Basic', 'lifetime', 0, 'INR',
    'Permanent access to Basic GST invoicing with monthly resetting quotas.',
    10, 5, 25, 1, NULL, true,
    '["10 GST invoices per month", "5 AI invoice generations per month", "Up to 25 customer & vendor records", "1 user workspace seat", "Automated CGST, SGST & IGST calculation"]'::jsonb
  ),

  -- STANDARD
  (
    'standard', 'Standard', 'monthly', 49900, 'INR',
    'Built for growing businesses needing smart OCR document scanning and recurring billing.',
    50, 25, 100, 1, NULL, true,
    '["50 GST invoices per month", "25 AI invoice generations per month", "Up to 100 customer & vendor records", "1 user workspace seat", "Smart OCR invoice scanning & extraction", "Payment tracking & recurring invoice schedules", "Automated payment reminder templates"]'::jsonb
  ),
  (
    'standard', 'Standard', 'annual', 479000, 'INR',
    'Annual Standard subscription (20% savings) with monthly resetting invoice and AI quotas.',
    50, 25, 100, 1, NULL, true,
    '["50 GST invoices per month (resets monthly)", "25 AI invoice generations per month (resets monthly)", "Up to 100 customer & vendor records", "1 user workspace seat", "Smart OCR invoice scanning & extraction", "Payment tracking & recurring invoice schedules", "20% annual commitment savings"]'::jsonb
  ),
  (
    'standard', 'Standard', 'lifetime', 1499900, 'INR',
    'One-time purchase for perpetual Standard access with monthly resetting fair-use quotas.',
    50, 25, 100, 1, NULL, true,
    '["Perpetual Standard tier access (no recurring renewals)", "50 GST invoices per month (fair-use monthly reset)", "25 AI invoice generations per month (fair-use monthly reset)", "Up to 100 customer & vendor records", "1 user workspace seat", "Smart OCR invoice scanning & recurring billing"]'::jsonb
  ),

  -- PROFESSIONAL
  (
    'professional', 'Professional', 'monthly', 149900, 'INR',
    'Designed for scaling SMBs, agencies, and multi-client accounting teams.',
    300, 150, 500, 3, NULL, true,
    '["300 GST invoices per month", "150 AI invoice generations per month", "Up to 500 customer & vendor records", "3 team member seats", "AI Ledger Copilot conversational analytics", "Batch CSV import & AI auto-tagging", "Compliance audit & HSN validation"]'::jsonb
  ),
  (
    'professional', 'Professional', 'annual', 1439000, 'INR',
    'Annual Professional subscription (20% savings) with monthly resetting invoice and AI allowances.',
    300, 150, 500, 3, NULL, true,
    '["300 GST invoices per month (resets monthly)", "150 AI invoice generations per month (resets monthly)", "Up to 500 customer & vendor records", "3 team member seats", "AI Ledger Copilot conversational analytics", "Batch CSV import & AI auto-tagging", "20% annual commitment savings"]'::jsonb
  ),
  (
    'professional', 'Professional', 'lifetime', 3999900, 'INR',
    'One-time purchase for perpetual Professional access with monthly resetting fair-use quotas.',
    300, 150, 500, 3, NULL, true,
    '["Perpetual Professional tier access (no recurring renewals)", "300 GST invoices per month (fair-use monthly reset)", "150 AI invoice generations per month (fair-use monthly reset)", "Up to 500 customer & vendor records", "3 team member seats", "AI Ledger Copilot & batch auto-tagging"]'::jsonb
  ),

  -- ELITE
  (
    'elite', 'Elite', 'monthly', 399900, 'INR',
    'High-volume commercial operations, wholesale distributors, and multi-branch finance teams.',
    1000, 500, 2000, 10, NULL, true,
    '["1,000 GST invoices per month", "500 AI invoice generations per month", "Up to 2,000 customer & vendor records", "10 team member seats", "Multi-LLM provider routing (Gemini & OpenAI)", "Custom invoice templates & brand identity", "Priority compliance reporting & bulk ZIP exports"]'::jsonb
  ),
  (
    'elite', 'Elite', 'annual', 3839000, 'INR',
    'Annual Elite subscription (20% savings) with monthly resetting invoice and AI allowances.',
    1000, 500, 2000, 10, NULL, true,
    '["1,000 GST invoices per month (resets monthly)", "500 AI invoice generations per month (resets monthly)", "Up to 2,000 customer & vendor records", "10 team member seats", "Multi-LLM provider routing (Gemini & OpenAI)", "Custom invoice templates & brand identity", "20% annual commitment savings"]'::jsonb
  ),
  (
    'elite', 'Elite', 'lifetime', 9999900, 'INR',
    'One-time purchase for perpetual Elite access with monthly resetting fair-use allowances.',
    1000, 500, 2000, 10, NULL, true,
    '["Perpetual Elite tier access (no recurring renewals)", "1,000 GST invoices per month (fair-use monthly reset)", "500 AI invoice generations per month (fair-use monthly reset)", "Up to 2,000 customer & vendor records", "10 team member seats", "Multi-LLM provider routing & custom branding"]'::jsonb
  ),

  -- ULTRA (Configurable Fair-Use Enterprise Tier — price_paise NULL until configured)
  (
    'ultra', 'Ultra', 'monthly', NULL, 'INR',
    'Bespoke enterprise deployment with configurable fair-use throughput and dedicated SLA.',
    -1, 2500, -1, 25, NULL, true,
    '["Configurable fair-use invoice volume", "2,500 AI invoice generations per month (configurable)", "Unlimited customer & vendor directory", "25+ configurable team member seats", "Dedicated account governance & custom integrations", "Enterprise security & audit log retention"]'::jsonb
  ),
  (
    'ultra', 'Ultra', 'annual', NULL, 'INR',
    'Annual enterprise contract with configurable fair-use quotas and dedicated SLA.',
    -1, 2500, -1, 25, NULL, true,
    '["Configurable fair-use invoice volume (resets monthly)", "2,500 AI invoice generations per month (configurable)", "Unlimited customer & vendor directory", "25+ configurable team member seats", "Dedicated account governance & custom integrations"]'::jsonb
  ),
  (
    'ultra', 'Ultra', 'lifetime', NULL, 'INR',
    'Perpetual enterprise license with configurable fair-use monthly allowances.',
    -1, 2500, -1, 25, NULL, true,
    '["Perpetual Ultra enterprise license", "Configurable fair-use monthly invoice & AI limits", "Unlimited customer & vendor directory", "25+ configurable team member seats", "Dedicated onboarding & compliance support"]'::jsonb
  )
ON CONFLICT (plan_code, billing_cycle) DO UPDATE SET
  plan_name = EXCLUDED.plan_name,
  price_paise = COALESCE(public.billing_plans.price_paise, EXCLUDED.price_paise),
  description = EXCLUDED.description,
  invoice_quota = EXCLUDED.invoice_quota,
  ai_quota = EXCLUDED.ai_quota,
  customer_quota = EXCLUDED.customer_quota,
  team_quota = EXCLUDED.team_quota,
  features = EXCLUDED.features,
  updated_at = NOW();

-- ============================================================================
-- 2. USER SUBSCRIPTIONS (Authoritative Entitlement & Quota State)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.billing_plans(id),
  plan_code TEXT NOT NULL DEFAULT 'basic' CHECK (plan_code IN ('basic', 'standard', 'professional', 'elite', 'ultra')),
  billing_model TEXT NOT NULL DEFAULT 'free' CHECK (billing_model IN ('free', 'monthly', 'annual', 'lifetime')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'past_due', 'cancelled', 'expired')),
  razorpay_subscription_id TEXT UNIQUE,
  razorpay_customer_id TEXT,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 month'),
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  cancelled_at TIMESTAMPTZ,
  lifetime_entitlement BOOLEAN NOT NULL DEFAULT false,
  invoices_used INTEGER NOT NULL DEFAULT 0 CHECK (invoices_used >= 0),
  ai_generations_used INTEGER NOT NULL DEFAULT 0 CHECK (ai_generations_used >= 0),
  usage_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  usage_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 month'),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON public.user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_rzp_sub ON public.user_subscriptions(razorpay_subscription_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON public.user_subscriptions(status);

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own user_subscription" ON public.user_subscriptions;
CREATE POLICY "Users can view own user_subscription"
  ON public.user_subscriptions FOR SELECT
  USING (auth.uid() = user_id);
-- Note: Direct client INSERT/UPDATE/DELETE is prohibited by omitting write policies for authenticated role.

-- ============================================================================
-- 3. BILLING PAYMENTS (Orders, Subscriptions & One-Time Captures in Paise)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.billing_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.billing_plans(id),
  plan_code TEXT NOT NULL,
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'annual', 'lifetime')),
  subscription_id UUID REFERENCES public.user_subscriptions(id) ON DELETE SET NULL,
  razorpay_order_id TEXT UNIQUE,
  razorpay_payment_id TEXT UNIQUE,
  razorpay_subscription_id TEXT,
  razorpay_signature TEXT,
  base_amount_paise BIGINT NOT NULL DEFAULT 0,
  tax_amount_paise BIGINT NOT NULL DEFAULT 0,
  amount_paise BIGINT NOT NULL CHECK (amount_paise >= 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'captured', 'failed', 'refunded', 'cancelled')),
  payment_type TEXT NOT NULL CHECK (payment_type IN ('subscription_charge', 'one_time_lifetime', 'manual_admin')),
  failure_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_payments_user_id ON public.billing_payments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_payments_order_id ON public.billing_payments(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_billing_payments_payment_id ON public.billing_payments(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_billing_payments_status ON public.billing_payments(status);

ALTER TABLE public.billing_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own billing_payments" ON public.billing_payments;
CREATE POLICY "Users can view own billing_payments"
  ON public.billing_payments FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================================
-- 4. BILLING WEBHOOK EVENTS (Idempotency Ledger for Gateway Deliveries)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.billing_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  processing_status TEXT NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processed', 'ignored', 'failed')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_billing_webhook_events_event_id ON public.billing_webhook_events(gateway_event_id);

ALTER TABLE public.billing_webhook_events ENABLE ROW LEVEL SECURITY;
-- Service role only; no public/authenticated access policies.

-- ============================================================================
-- 5. USAGE EVENTS (Idempotent Invoice & AI Quota Ledger)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_type TEXT NOT NULL CHECK (usage_type IN ('invoice_created', 'ai_generation')),
  invoice_id TEXT,
  billing_period TEXT NOT NULL, -- e.g. '2026-11'
  idempotency_key TEXT NOT NULL UNIQUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_events_user_period ON public.usage_events(user_id, usage_type, billing_period);

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own usage_events" ON public.usage_events;
CREATE POLICY "Users can view own usage_events"
  ON public.usage_events FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================================
-- 6. ATOMIC ENTITLEMENT & MONTHLY QUOTA RESET HELPER
-- ============================================================================
CREATE OR REPLACE FUNCTION public.ensure_user_subscription_and_reset(p_user_id UUID)
RETURNS public.user_subscriptions AS $$
DECLARE
  v_sub public.user_subscriptions;
  v_basic_plan_id UUID;
BEGIN
  SELECT id INTO v_basic_plan_id
  FROM public.billing_plans
  WHERE plan_code = 'basic' AND billing_cycle = 'monthly'
  LIMIT 1;

  INSERT INTO public.user_subscriptions (
    user_id, plan_id, plan_code, billing_model, status,
    current_period_start, current_period_end,
    usage_period_start, usage_period_end
  ) VALUES (
    p_user_id, v_basic_plan_id, 'basic', 'free', 'active',
    NOW(), NOW() + INTERVAL '1 month',
    NOW(), NOW() + INTERVAL '1 month'
  )
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_sub
  FROM public.user_subscriptions
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- Check if recurring subscription period has expired without lifetime entitlement
  IF v_sub.lifetime_entitlement = false
     AND v_sub.billing_model IN ('monthly', 'annual')
     AND v_sub.current_period_end < NOW()
     AND (v_sub.cancel_at_period_end = true OR v_sub.status IN ('cancelled', 'past_due')) THEN
    UPDATE public.user_subscriptions
    SET
      plan_id = v_basic_plan_id,
      plan_code = 'basic',
      billing_model = 'free',
      status = 'expired',
      cancel_at_period_end = false,
      invoices_used = 0,
      ai_generations_used = 0,
      usage_period_start = NOW(),
      usage_period_end = NOW() + INTERVAL '1 month',
      updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING * INTO v_sub;
  END IF;

  -- Monthly allowance reset for ALL models (Free, Monthly, Annual, and Lifetime reset allowances monthly)
  IF v_sub.usage_period_end <= NOW() THEN
    UPDATE public.user_subscriptions
    SET
      invoices_used = 0,
      ai_generations_used = 0,
      usage_period_start = NOW(),
      usage_period_end = NOW() + INTERVAL '1 month',
      updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING * INTO v_sub;
  END IF;

  RETURN v_sub;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. ATOMIC BATCH & SINGLE INVOICE QUOTA + INSERT RPC
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_and_reserve_invoice_quota(
  p_user_id UUID,
  p_batch_count INTEGER DEFAULT 1,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_sub public.user_subscriptions;
  v_plan public.billing_plans;
  v_effective_code TEXT;
  v_limit INTEGER;
  v_period TEXT;
BEGIN
  IF p_batch_count <= 0 THEN
    RETURN jsonb_build_object('allowed', true, 'code', 'OK', 'used', 0, 'limit', 10);
  END IF;

  -- Idempotency check if key supplied
  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.usage_events WHERE idempotency_key = p_idempotency_key) THEN
      SELECT * INTO v_sub FROM public.user_subscriptions WHERE user_id = p_user_id;
      RETURN jsonb_build_object(
        'allowed', true,
        'code', 'ALREADY_RECORDED',
        'plan_id', COALESCE(v_sub.plan_code, 'basic'),
        'used', COALESCE(v_sub.invoices_used, 0)
      );
    END IF;
  END IF;

  v_sub := public.ensure_user_subscription_and_reset(p_user_id);

  -- Only active or valid lifetime/paid subscriptions get paid tier quotas; pending/expired fallback to basic
  IF v_sub.status = 'active' OR v_sub.lifetime_entitlement = true THEN
    v_effective_code := v_sub.plan_code;
  ELSE
    v_effective_code := 'basic';
  END IF;

  SELECT * INTO v_plan
  FROM public.billing_plans
  WHERE plan_code = v_effective_code
  ORDER BY CASE WHEN id = v_sub.plan_id THEN 0 ELSE 1 END
  LIMIT 1;

  v_limit := COALESCE(v_plan.invoice_quota, 10);

  IF v_limit != -1 AND (v_sub.invoices_used + p_batch_count) > v_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'code', 'INVOICE_QUOTA_EXCEEDED',
      'message', format('Batch of %s invoice(s) exceeds your remaining monthly quota (%s/%s used on %s plan).', p_batch_count, v_sub.invoices_used, v_limit, initcap(v_effective_code)),
      'plan_id', v_effective_code,
      'used', v_sub.invoices_used,
      'limit', v_limit,
      'remaining', GREATEST(0, v_limit - v_sub.invoices_used),
      'reset_date', v_sub.usage_period_end
    );
  END IF;

  UPDATE public.user_subscriptions
  SET
    invoices_used = invoices_used + p_batch_count,
    updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING * INTO v_sub;

  -- Sync legacy subscriptions table if present
  UPDATE public.subscriptions
  SET
    invoices_used = v_sub.invoices_used,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  v_period := to_char(NOW(), 'YYYY-MM');
  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.usage_events (user_id, usage_type, billing_period, idempotency_key, metadata)
    VALUES (p_user_id, 'invoice_created', v_period, p_idempotency_key, jsonb_build_object('batch_count', p_batch_count))
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'code', 'OK',
    'plan_id', v_effective_code,
    'used', v_sub.invoices_used,
    'limit', v_limit,
    'remaining', CASE WHEN v_limit = -1 THEN -1 ELSE GREATEST(0, v_limit - v_sub.invoices_used) END,
    'reset_date', v_sub.usage_period_end
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
