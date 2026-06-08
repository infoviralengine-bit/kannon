ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS payment_terms JSONB
DEFAULT '{"type":"standard_lagged","fixedDueDay":1,"cpmLagMonths":1,"finalCpmDelayDays":30}'::jsonb;

UPDATE campaigns
SET payment_terms = '{"type":"standard_lagged","fixedDueDay":1,"cpmLagMonths":1,"finalCpmDelayDays":30}'::jsonb
WHERE payment_terms IS NULL;

ALTER TABLE client_payments
ADD COLUMN IF NOT EXISTS payment_kind TEXT NOT NULL DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS amount_overridden BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_client_payments_campaign_kind
ON client_payments(campaign_id, payment_kind);

ALTER TABLE client_payments
ALTER COLUMN cycle_id DROP NOT NULL;