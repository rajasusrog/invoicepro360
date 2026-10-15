-- Migration: 20261015000000_subscription_plans_and_quotas.sql
-- InvoicePro 360 Subscription Tiers, Invoice Quotas & Concurrency-Safe Usage Enforcement

-- 1. Create Subscription Plans table
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_inr NUMERIC NOT NULL DEFAULT 0,
  invoice_quota INT NOT NULL, -- -1 represents unlimited
  ai_generation_quota INT NOT NULL, -- -1 represents unlimited
  customer_quota INT NOT NULL, -- -1 represents unlimited
  team_member_quota INT NOT NULL,
  is_contact_us BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed central subscription tiers
INSERT INTO public.subscription_plans (id, name, price_inr, invoice_quota, ai_generation_quota, customer_quota, team_member_quota, is_contact_us, description, features)
VALUES
  (
    'basic', 
    'Basic', 
    0, 
    10, 
    5, 
    25, 
    1, 
    false, 
    'Essential billing tools for solopreneurs & early freelance starters.',
    '["10 successful invoices / mo", "5 AI invoice generations / mo", "25 customers & vendors", "1 team member", "GST CGST/SGST/IGST calculations", "Standard PDF & CSV exports"]'::jsonb
  ),
  (
    'standard', 
    'Standard', 
    499, 
    50, 
    25, 
    100, 
    1, 
    false, 
    'For growing freelancers, independent consultants, and small shops.',
    '["50 successful invoices / mo", "25 AI invoice generations / mo", "100 customers & vendors", "1 team member", "Smart OCR scan extraction", "Automated payment tracking"]'::jsonb
  ),
  (
    'professional', 
    'Professional', 
    1499, 
    300, 
    150, 
    500, 
    3, 
    false, 
    'For scaling SMBs, service agencies, and multi-client practices.',
    '["300 successful invoices / mo", "150 AI invoice generations / mo", "500 customers & vendors", "3 team members", "AI Ledger Copilot conversational analytics", "Recurring invoice automation"]'::jsonb
  ),
  (
    'elite', 
    'Elite', 
    3999, 
    1000, 
    500, 
    2000, 
    10, 
    false, 
    'High-volume enterprises and multi-department organizations.',
    '["1,000 successful invoices / mo", "500 AI invoice generations / mo", "2,000 customers & vendors", "10 team members", "Multi-LLM provider failover (Gemini + OpenAI)", "Priority compliance auditing"]'::jsonb
  ),
  (
    'ultra', 
    'Ultra', 
    0, 
    -1, 
    2500, 
    -1, 
    25, 
    true, 
    'Custom tailored high-throughput billing infrastructure with custom SLAs.',
    '["Unlimited invoices (fair use)", "2,500 AI invoice generations / mo", "Unlimited customers & vendors", "Configurable team seats", "Dedicated account engineer & custom integrations", "Custom GST & ERP pipelines"]'::jsonb
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price_inr = EXCLUDED.price_inr,
  invoice_quota = EXCLUDED.invoice_quota,
  ai_generation_quota = EXCLUDED.ai_generation_quota,
  customer_quota = EXCLUDED.customer_quota,
  team_member_quota = EXCLUDED.team_member_quota,
  is_contact_us = EXCLUDED.is_contact_us,
  description = EXCLUDED.description,
  features = EXCLUDED.features;

-- 2. Create User Subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  plan_id TEXT NOT NULL REFERENCES public.subscription_plans(id) DEFAULT 'basic',
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'trialing', 'past_due', 'canceled'
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 month'),
  invoices_used INT NOT NULL DEFAULT 0,
  ai_generations_used INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create Usage Audit History table
CREATE TABLE IF NOT EXISTS public.usage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- 'invoice_created', 'ai_generation'
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id ON public.subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_usage_history_user_id ON public.usage_history(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_history_created_at ON public.usage_history(created_at DESC);

-- Enable RLS
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Allow authenticated read subscription_plans" ON public.subscription_plans;
CREATE POLICY "Allow authenticated read subscription_plans"
  ON public.subscription_plans FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Allow public read subscription_plans" ON public.subscription_plans;
CREATE POLICY "Allow public read subscription_plans"
  ON public.subscription_plans FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
CREATE POLICY "Users can view own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Explicitly DO NOT create INSERT/UPDATE/DELETE policies for clients on subscriptions.
-- Users cannot modify their plan, usage counters, or dates via direct Supabase client calls.

DROP POLICY IF EXISTS "Users can view own usage history" ON public.usage_history;
CREATE POLICY "Users can view own usage history"
  ON public.usage_history FOR SELECT
  USING (auth.uid() = user_id);

-- 4. Server-Side Account Initialization Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  )
  ON CONFLICT (id) DO NOTHING;

  -- Default to 'basic' subscription without overwriting existing
  INSERT INTO public.subscriptions (
    user_id,
    plan_id,
    status,
    current_period_start,
    current_period_end,
    invoices_used,
    ai_generations_used
  )
  VALUES (
    NEW.id,
    'basic',
    'active',
    NOW(),
    NOW() + INTERVAL '1 month',
    0,
    0
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Atomic RPC: Check & Increment AI Quota
CREATE OR REPLACE FUNCTION public.check_and_increment_ai_quota(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_sub RECORD;
  v_plan RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_new_end TIMESTAMPTZ;
BEGIN
  -- Lock subscription row for update to ensure concurrency safety
  SELECT * INTO v_sub
  FROM public.subscriptions
  WHERE user_id = p_user_id
  FOR UPDATE;

  -- If subscription does not exist, initialize with basic
  IF NOT FOUND THEN
    INSERT INTO public.subscriptions (user_id, plan_id, status, current_period_start, current_period_end, invoices_used, ai_generations_used)
    VALUES (p_user_id, 'basic', 'active', v_now, v_now + INTERVAL '1 month', 0, 0)
    RETURNING * INTO v_sub;
  END IF;

  -- Check if billing period has ended. If so, roll over period and reset usage counters
  IF v_now >= v_sub.current_period_end THEN
    v_new_end := v_sub.current_period_end;
    WHILE v_new_end <= v_now LOOP
      v_new_end := v_new_end + INTERVAL '1 month';
    END LOOP;

    UPDATE public.subscriptions
    SET current_period_start = v_sub.current_period_end,
        current_period_end = v_new_end,
        invoices_used = 0,
        ai_generations_used = 0,
        updated_at = v_now
    WHERE user_id = p_user_id
    RETURNING * INTO v_sub;
  END IF;

  -- Get plan limits
  SELECT * INTO v_plan
  FROM public.subscription_plans
  WHERE id = v_sub.plan_id;

  -- Check quota
  IF v_plan.ai_generation_quota >= 0 AND v_sub.ai_generations_used >= v_plan.ai_generation_quota THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'code', 'AI_QUOTA_EXCEEDED',
      'message', 'You have reached your monthly AI invoice generation quota (' || v_plan.ai_generation_quota || '). Upgrade your plan for more generations.',
      'plan_id', v_sub.plan_id,
      'used', v_sub.ai_generations_used,
      'limit', v_plan.ai_generation_quota,
      'remaining', 0,
      'reset_date', v_sub.current_period_end
    );
  END IF;

  -- Increment usage atomically
  UPDATE public.subscriptions
  SET ai_generations_used = ai_generations_used + 1,
      updated_at = v_now
  WHERE user_id = p_user_id
  RETURNING * INTO v_sub;

  -- Record audit
  INSERT INTO public.usage_history (user_id, action_type, metadata)
  VALUES (p_user_id, 'ai_generation', jsonb_build_object('plan_id', v_sub.plan_id, 'used_after', v_sub.ai_generations_used));

  RETURN jsonb_build_object(
    'allowed', true,
    'code', 'OK',
    'plan_id', v_sub.plan_id,
    'used', v_sub.ai_generations_used,
    'limit', v_plan.ai_generation_quota,
    'remaining', CASE WHEN v_plan.ai_generation_quota >= 0 THEN v_plan.ai_generation_quota - v_sub.ai_generations_used ELSE -1 END,
    'reset_date', v_sub.current_period_end
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Atomic RPC: Refund AI Quota (Used if downstream provider fails after quota checked)
CREATE OR REPLACE FUNCTION public.refund_ai_quota(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.subscriptions
  SET ai_generations_used = GREATEST(0, ai_generations_used - 1),
      updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Atomic RPC: Check & Increment Invoice Quota
CREATE OR REPLACE FUNCTION public.check_and_increment_invoice_quota(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_sub RECORD;
  v_plan RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_new_end TIMESTAMPTZ;
BEGIN
  -- Lock subscription row for update
  SELECT * INTO v_sub
  FROM public.subscriptions
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.subscriptions (user_id, plan_id, status, current_period_start, current_period_end, invoices_used, ai_generations_used)
    VALUES (p_user_id, 'basic', 'active', v_now, v_now + INTERVAL '1 month', 0, 0)
    RETURNING * INTO v_sub;
  END IF;

  -- Period rollover
  IF v_now >= v_sub.current_period_end THEN
    v_new_end := v_sub.current_period_end;
    WHILE v_new_end <= v_now LOOP
      v_new_end := v_new_end + INTERVAL '1 month';
    END LOOP;

    UPDATE public.subscriptions
    SET current_period_start = v_sub.current_period_end,
        current_period_end = v_new_end,
        invoices_used = 0,
        ai_generations_used = 0,
        updated_at = v_now
    WHERE user_id = p_user_id
    RETURNING * INTO v_sub;
  END IF;

  -- Get plan limits
  SELECT * INTO v_plan
  FROM public.subscription_plans
  WHERE id = v_sub.plan_id;

  -- Check quota
  IF v_plan.invoice_quota >= 0 AND v_sub.invoices_used >= v_plan.invoice_quota THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'code', 'INVOICE_QUOTA_EXCEEDED',
      'message', 'You have reached your monthly successful invoices limit (' || v_plan.invoice_quota || '). Upgrade your plan to create more invoices.',
      'plan_id', v_sub.plan_id,
      'used', v_sub.invoices_used,
      'limit', v_plan.invoice_quota,
      'remaining', 0,
      'reset_date', v_sub.current_period_end
    );
  END IF;

  -- Increment invoices_used atomically
  UPDATE public.subscriptions
  SET invoices_used = invoices_used + 1,
      updated_at = v_now
  WHERE user_id = p_user_id
  RETURNING * INTO v_sub;

  -- Record audit
  INSERT INTO public.usage_history (user_id, action_type, metadata)
  VALUES (p_user_id, 'invoice_created', jsonb_build_object('plan_id', v_sub.plan_id, 'used_after', v_sub.invoices_used));

  RETURN jsonb_build_object(
    'allowed', true,
    'code', 'OK',
    'plan_id', v_sub.plan_id,
    'used', v_sub.invoices_used,
    'limit', v_plan.invoice_quota,
    'remaining', CASE WHEN v_plan.invoice_quota >= 0 THEN v_plan.invoice_quota - v_sub.invoices_used ELSE -1 END,
    'reset_date', v_sub.current_period_end
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. RPC: Get User Subscription & Usage Info
CREATE OR REPLACE FUNCTION public.get_user_subscription_info(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_sub RECORD;
  v_plan RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_new_end TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_sub
  FROM public.subscriptions
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.subscriptions (user_id, plan_id, status, current_period_start, current_period_end, invoices_used, ai_generations_used)
    VALUES (p_user_id, 'basic', 'active', v_now, v_now + INTERVAL '1 month', 0, 0)
    RETURNING * INTO v_sub;
  END IF;

  -- Rollover check
  IF v_now >= v_sub.current_period_end THEN
    v_new_end := v_sub.current_period_end;
    WHILE v_new_end <= v_now LOOP
      v_new_end := v_new_end + INTERVAL '1 month';
    END LOOP;

    UPDATE public.subscriptions
    SET current_period_start = v_sub.current_period_end,
        current_period_end = v_new_end,
        invoices_used = 0,
        ai_generations_used = 0,
        updated_at = v_now
    WHERE user_id = p_user_id
    RETURNING * INTO v_sub;
  END IF;

  SELECT * INTO v_plan
  FROM public.subscription_plans
  WHERE id = v_sub.plan_id;

  RETURN jsonb_build_object(
    'plan_id', v_sub.plan_id,
    'plan_name', v_plan.name,
    'status', v_sub.status,
    'price_inr', v_plan.price_inr,
    'is_contact_us', v_plan.is_contact_us,
    'invoices_used', v_sub.invoices_used,
    'invoice_quota', v_plan.invoice_quota,
    'invoices_remaining', CASE WHEN v_plan.invoice_quota >= 0 THEN GREATEST(0, v_plan.invoice_quota - v_sub.invoices_used) ELSE -1 END,
    'ai_generations_used', v_sub.ai_generations_used,
    'ai_generation_quota', v_plan.ai_generation_quota,
    'ai_generations_remaining', CASE WHEN v_plan.ai_generation_quota >= 0 THEN GREATEST(0, v_plan.ai_generation_quota - v_sub.ai_generations_used) ELSE -1 END,
    'customer_quota', v_plan.customer_quota,
    'team_member_quota', v_plan.team_member_quota,
    'current_period_start', v_sub.current_period_start,
    'current_period_end', v_sub.current_period_end,
    'features', v_plan.features
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
