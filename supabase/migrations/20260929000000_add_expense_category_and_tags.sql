-- Migration: Add expense_category and tags columns to public.invoices
-- Description: Supports granular expense categorization and JSON array tags for invoices.
-- Safe upgrade: Uses IF NOT EXISTS, does not drop tables, and preserves existing records and RLS policies.

BEGIN;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS expense_category TEXT;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMIT;

NOTIFY pgrst, 'reload schema';
