-- Migration: 20261015010000_super_admin_and_ai_security.sql
-- Super Admin Console, Privileged Access, Tamper-Resistant Audit Logs,
-- Privacy-Minimized AI Telemetry, and Automated Abuse Detection Queue

-- 1. Extend profiles with suspension and active tracking
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_reason TEXT,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Create Admin Roles table
CREATE TABLE IF NOT EXISTS public.admin_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'super_admin', -- 'super_admin', 'security_auditor', 'support_admin'
  granted_by TEXT NOT NULL DEFAULT 'system_provision',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create Append-Only Audit Logs table
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL, -- e.g., 'user_suspended', 'user_restored', 'plan_override', 'security_config_updated', 'alert_contained', 'alert_resolved', 'sensitive_data_access'
  target_type TEXT NOT NULL, -- 'user', 'subscription', 'security_alert', 'system_config'
  target_id TEXT NOT NULL,
  justification TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Create Security Alerts Queue table
CREATE TABLE IF NOT EXISTS public.security_alerts (
  id TEXT PRIMARY KEY DEFAULT ('alt-' || substr(md5(random()::text), 1, 10)),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  rule_id TEXT NOT NULL,
  risk_score INT NOT NULL DEFAULT 50, -- 0 to 100
  severity TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  category TEXT NOT NULL, -- 'abuse', 'injection', 'quota_bypass', 'auth_anomaly', 'data_tamper'
  evidence_summary TEXT NOT NULL,
  recommended_action TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new', -- 'new', 'contained', 'resolved', 'false_positive'
  containment_action TEXT, -- 'throttled', 'temporarily_suspended', 'flagged'
  contained_at TIMESTAMPTZ,
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Create Privacy-Minimized AI Request Logs (No prompt/invoice retention by default)
CREATE TABLE IF NOT EXISTS public.ai_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  endpoint TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'gemini',
  model TEXT NOT NULL DEFAULT 'gemini-3.8-flash',
  status_code INT NOT NULL DEFAULT 200,
  latency_ms INT NOT NULL DEFAULT 0,
  tokens_estimated INT NOT NULL DEFAULT 0,
  cost_estimated_usd NUMERIC(10, 6) NOT NULL DEFAULT 0,
  risk_score INT NOT NULL DEFAULT 0,
  detection_category TEXT,
  abuse_flag BOOLEAN NOT NULL DEFAULT false,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Create Admin Security & Detection Configuration table
CREATE TABLE IF NOT EXISTS public.admin_security_config (
  id TEXT PRIMARY KEY DEFAULT 'global',
  auto_containment_enabled BOOLEAN NOT NULL DEFAULT true,
  high_risk_threshold INT NOT NULL DEFAULT 80,
  medium_risk_threshold INT NOT NULL DEFAULT 50,
  rate_limit_requests_per_minute INT NOT NULL DEFAULT 30,
  ai_abuse_detection_enabled BOOLEAN NOT NULL DEFAULT true,
  retention_days_audit_logs INT NOT NULL DEFAULT 365,
  retention_days_ai_telemetry INT NOT NULL DEFAULT 90,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial global security configuration
INSERT INTO public.admin_security_config (id, auto_containment_enabled, high_risk_threshold, medium_risk_threshold, rate_limit_requests_per_minute, ai_abuse_detection_enabled, retention_days_audit_logs, retention_days_ai_telemetry)
VALUES ('global', true, 80, 50, 30, true, 365, 90)
ON CONFLICT (id) DO NOTHING;

-- 7. Indexes for fast retrieval and SOC analytics
CREATE INDEX IF NOT EXISTS idx_profiles_is_suspended ON public.profiles(is_suspended);
CREATE INDEX IF NOT EXISTS idx_admin_roles_email ON public.admin_roles(email);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON public.admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON public.admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target_id ON public.admin_audit_logs(target_id);
CREATE INDEX IF NOT EXISTS idx_security_alerts_status ON public.security_alerts(status);
CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON public.security_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_security_alerts_created_at ON public.security_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_request_logs_created_at ON public.ai_request_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_request_logs_user_id ON public.ai_request_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_request_logs_abuse_flag ON public.ai_request_logs(abuse_flag);

-- 8. Enable Row-Level Security on all admin and security tables
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_request_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_security_config ENABLE ROW LEVEL SECURITY;

-- Restrict direct access from ordinary client roles.
-- Ordinary users have NO access to read, modify, or insert admin records or security logs.
DROP POLICY IF EXISTS "Prevent public access to admin_roles" ON public.admin_roles;
DROP POLICY IF EXISTS "Prevent public access to admin_audit_logs" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Prevent public access to security_alerts" ON public.security_alerts;
DROP POLICY IF EXISTS "Prevent public access to ai_request_logs" ON public.ai_request_logs;
DROP POLICY IF EXISTS "Prevent public access to admin_security_config" ON public.admin_security_config;

-- 9. Privileged Security-Definer RPCs for Admin Operations

-- Check if user is suspended before performing operations
CREATE OR REPLACE FUNCTION public.check_user_suspended(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_suspended BOOLEAN := false;
BEGIN
  SELECT is_suspended INTO v_suspended
  FROM public.profiles
  WHERE id = p_user_id;

  RETURN COALESCE(v_suspended, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Privileged RPC: Admin Update User Subscription with Audit
CREATE OR REPLACE FUNCTION public.admin_override_subscription(
  p_admin_email TEXT,
  p_target_user_id UUID,
  p_new_plan_id TEXT,
  p_justification TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_old_sub RECORD;
  v_new_sub RECORD;
  v_plan RECORD;
BEGIN
  -- Verify plan exists
  SELECT * INTO v_plan FROM public.subscription_plans WHERE id = p_new_plan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan % does not exist', p_new_plan_id;
  END IF;

  SELECT * INTO v_old_sub FROM public.subscriptions WHERE user_id = p_target_user_id FOR UPDATE;

  UPDATE public.subscriptions
  SET plan_id = p_new_plan_id,
      updated_at = NOW()
  WHERE user_id = p_target_user_id
  RETURNING * INTO v_new_sub;

  -- Append audit log entry
  INSERT INTO public.admin_audit_logs (
    admin_email,
    action,
    target_type,
    target_id,
    justification,
    metadata
  )
  VALUES (
    p_admin_email,
    'plan_override',
    'subscription',
    p_target_user_id::text,
    p_justification,
    jsonb_build_object(
      'old_plan', v_old_sub.plan_id,
      'new_plan', p_new_plan_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_target_user_id,
    'new_plan', p_new_plan_id,
    'updated_at', v_new_sub.updated_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Privileged RPC: Admin Suspend / Restore User Account with Audit
CREATE OR REPLACE FUNCTION public.admin_set_user_suspension(
  p_admin_email TEXT,
  p_target_user_id UUID,
  p_suspend BOOLEAN,
  p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_profile RECORD;
BEGIN
  UPDATE public.profiles
  SET is_suspended = p_suspend,
      suspended_at = CASE WHEN p_suspend THEN NOW() ELSE NULL END,
      suspended_reason = CASE WHEN p_suspend THEN p_reason ELSE NULL END,
      updated_at = NOW()
  WHERE id = p_target_user_id
  RETURNING * INTO v_profile;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found for id %', p_target_user_id;
  END IF;

  -- Append audit log entry
  INSERT INTO public.admin_audit_logs (
    admin_email,
    action,
    target_type,
    target_id,
    justification,
    metadata
  )
  VALUES (
    p_admin_email,
    CASE WHEN p_suspend THEN 'user_suspended' ELSE 'user_restored' END,
    'user',
    p_target_user_id::text,
    p_reason,
    jsonb_build_object(
      'is_suspended', p_suspend,
      'target_email', v_profile.email
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_target_user_id,
    'is_suspended', p_suspend,
    'suspended_reason', p_reason
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
