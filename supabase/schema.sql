-- InvoicePro AI - Supabase PostgreSQL Schema & Security Rules

-- 1. Create Profiles Table (Scoped to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  company_settings JSONB DEFAULT '{
    "name": "Unikorn360 AI Solutions",
    "address": "Suite 101, Tech Park Alpha, Nagpur, Maharashtra, 440028",
    "gstin": "27AABCU1234A1Z8",
    "logoType": "url",
    "logoIcon": "Sparkles",
    "logoColor": "indigo",
    "logoUrl": "/logo.svg",
    "logoInitials": "U360"
  }'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create Invoices Table
CREATE TABLE IF NOT EXISTS public.invoices (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  supplier_gstin TEXT,
  supplier_address TEXT,
  customer_name TEXT NOT NULL,
  customer_gstin TEXT,
  customer_address TEXT,
  date TEXT NOT NULL,
  due_date TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  cgst NUMERIC NOT NULL DEFAULT 0,
  sgst NUMERIC NOT NULL DEFAULT 0,
  igst NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unpaid',
  payment_status TEXT DEFAULT 'due',
  amount_paid NUMERIC DEFAULT 0,
  balance_due NUMERIC DEFAULT 0,
  payments JSONB DEFAULT '[]'::jsonb,
  category TEXT DEFAULT 'Sales',
  expense_category TEXT,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  ocr_source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Indexes for fast retrieval
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON public.invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for Profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- 6. RLS Policies for Invoices
DROP POLICY IF EXISTS "Users can select own invoices" ON public.invoices;
CREATE POLICY "Users can select own invoices"
  ON public.invoices
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own invoices" ON public.invoices;
CREATE POLICY "Users can insert own invoices"
  ON public.invoices
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own invoices" ON public.invoices;
CREATE POLICY "Users can update own invoices"
  ON public.invoices
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own invoices" ON public.invoices;
CREATE POLICY "Users can delete own invoices"
  ON public.invoices
  FOR DELETE
  USING (auth.uid() = user_id);

-- 7. Trigger to automatically create a profile entry when a new user signs up via Google OAuth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. Subscription Plans & Quotas
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_inr NUMERIC NOT NULL DEFAULT 0,
  invoice_quota INT NOT NULL,
  ai_generation_quota INT NOT NULL,
  customer_quota INT NOT NULL,
  team_member_quota INT NOT NULL,
  is_contact_us BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.subscription_plans (id, name, price_inr, invoice_quota, ai_generation_quota, customer_quota, team_member_quota, is_contact_us, description, features)
VALUES
  ('basic', 'Basic', 0, 10, 5, 25, 1, false, 'Essential billing tools for solopreneurs & early freelance starters.', '["10 successful invoices / mo", "5 AI invoice generations / mo", "25 customers & vendors", "1 team member", "GST CGST/SGST/IGST calculations", "Standard PDF & CSV exports"]'::jsonb),
  ('standard', 'Standard', 499, 50, 25, 100, 1, false, 'For growing freelancers, independent consultants, and small shops.', '["50 successful invoices / mo", "25 AI invoice generations / mo", "100 customers & vendors", "1 team member", "Smart OCR scan extraction", "Automated payment tracking"]'::jsonb),
  ('professional', 'Professional', 1499, 300, 150, 500, 3, false, 'For scaling SMBs, service agencies, and multi-client practices.', '["300 successful invoices / mo", "150 AI invoice generations / mo", "500 customers & vendors", "3 team members", "AI Ledger Copilot conversational analytics", "Recurring invoice automation"]'::jsonb),
  ('elite', 'Elite', 3999, 1000, 500, 2000, 10, false, 'High-volume enterprises and multi-department organizations.', '["1,000 successful invoices / mo", "500 AI invoice generations / mo", "2,000 customers & vendors", "10 team members", "Multi-LLM provider failover (Gemini + OpenAI)", "Priority compliance auditing"]'::jsonb),
  ('ultra', 'Ultra', 0, -1, 2500, -1, 25, true, 'Custom tailored high-throughput billing infrastructure with custom SLAs.', '["Unlimited invoices (fair use)", "2,500 AI invoice generations / mo", "Unlimited customers & vendors", "Configurable team seats", "Dedicated account engineer & custom integrations", "Custom GST & ERP pipelines"]'::jsonb)
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

-- 9. User Subscriptions & Usage
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  plan_id TEXT NOT NULL REFERENCES public.subscription_plans(id) DEFAULT 'basic',
  status TEXT NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 month'),
  invoices_used INT NOT NULL DEFAULT 0,
  ai_generations_used INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.usage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id ON public.subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_usage_history_user_id ON public.usage_history(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_history_created_at ON public.usage_history(created_at DESC);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_history ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS "Users can view own usage history" ON public.usage_history;
CREATE POLICY "Users can view own usage history"
  ON public.usage_history FOR SELECT
  USING (auth.uid() = user_id);

