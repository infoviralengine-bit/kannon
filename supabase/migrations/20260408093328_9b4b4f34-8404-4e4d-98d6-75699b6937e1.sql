
ALTER TABLE contracts ADD COLUMN first_period_start date;

UPDATE contracts 
SET first_period_start = '2026-03-02', start_date = '2026-04-08' 
WHERE id = 'ed5040ff-cc40-4786-9f2b-4e4de0f64c4c';
