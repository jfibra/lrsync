-- Migration 30:
-- 1. Voucher traceability (converted from commission_report, unencoded sales, linked TL/UM share records, team metadata)
-- 2. Commission agent breakdown traceability (unencoded sales, team metadata)
-- 3. Sales optional bank fields (bank_name, bank_account_no, date_deposited)

-- 1. commission_vouchers enhancements
ALTER TABLE public.commission_vouchers
  ADD COLUMN IF NOT EXISTS source_commission_report_uuid uuid,
  ADD COLUMN IF NOT EXISTS source_commission_report_number integer,
  ADD COLUMN IF NOT EXISTS source_agent_breakdown_uuid uuid,
  ADD COLUMN IF NOT EXISTS is_converted_from_report boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_unencoded_sale boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recipient_role text NOT NULL DEFAULT 'agent'
    CHECK (recipient_role IN ('agent', 'team_leader', 'unit_manager')),
  ADD COLUMN IF NOT EXISTS parent_voucher_id uuid REFERENCES public.commission_vouchers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS team_name text,
  ADD COLUMN IF NOT EXISTS team_leader_name text,
  ADD COLUMN IF NOT EXISTS subteam_name text,
  ADD COLUMN IF NOT EXISTS unit_manager_name text;

CREATE INDEX IF NOT EXISTS idx_commission_vouchers_source_report
  ON public.commission_vouchers(source_commission_report_uuid);
CREATE INDEX IF NOT EXISTS idx_commission_vouchers_source_breakdown
  ON public.commission_vouchers(source_agent_breakdown_uuid);
CREATE INDEX IF NOT EXISTS idx_commission_vouchers_parent_voucher
  ON public.commission_vouchers(parent_voucher_id);
CREATE INDEX IF NOT EXISTS idx_commission_vouchers_unencoded
  ON public.commission_vouchers(is_unencoded_sale);
CREATE INDEX IF NOT EXISTS idx_commission_vouchers_converted
  ON public.commission_vouchers(is_converted_from_report);

-- 2. commission_agent_breakdown enhancements
ALTER TABLE public.commission_agent_breakdown
  ADD COLUMN IF NOT EXISTS is_unencoded_sale boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS team_name text,
  ADD COLUMN IF NOT EXISTS team_leader_name text,
  ADD COLUMN IF NOT EXISTS subteam_name text,
  ADD COLUMN IF NOT EXISTS unit_manager_name text;

CREATE INDEX IF NOT EXISTS idx_commission_agent_breakdown_unencoded
  ON public.commission_agent_breakdown(is_unencoded_sale);

-- 3. sales optional bank fields
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_account_no text,
  ADD COLUMN IF NOT EXISTS date_deposited date;

CREATE INDEX IF NOT EXISTS idx_sales_bank_name
  ON public.sales(bank_name);

NOTIFY pgrst, 'reload schema';
