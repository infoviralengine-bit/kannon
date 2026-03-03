
-- Delete artificial cycle 2 payment
DELETE FROM client_payments WHERE id = '067fe1e0-3814-49dd-928d-1c099415a0f7';
-- Delete artificial cycle 2
DELETE FROM payment_cycles WHERE id = '7f5cb34b-6f6b-449d-9394-90088da5b192';

-- Update cycle 1 payment: set real views and fix due_date to end of cycle
UPDATE client_payments 
SET cpm_views = 2345,
    cpm_amount = 3.52,
    total_amount = 3.52,
    views_paid_cumulative = 2345,
    due_date = '2026-04-01',
    views_snapshot_at = now()
WHERE id = 'bc5ff239-b7c2-47fa-8113-d6911a43d4ac';
