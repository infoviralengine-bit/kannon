
-- Reset the Finanz cycle 1 payment to unpaid so it gets live recalculation
UPDATE client_payments 
SET is_paid = false, paid_at = NULL 
WHERE id = 'bc5ff239-b7c2-47fa-8113-d6911a43d4ac';
