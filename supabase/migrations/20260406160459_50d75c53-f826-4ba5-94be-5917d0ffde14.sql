
-- Add start_date to contracts table
ALTER TABLE public.contracts
ADD COLUMN start_date date NOT NULL DEFAULT CURRENT_DATE;

-- Add period_start and period_end to creator_payments
ALTER TABLE public.creator_payments
ADD COLUMN period_start date,
ADD COLUMN period_end date;
