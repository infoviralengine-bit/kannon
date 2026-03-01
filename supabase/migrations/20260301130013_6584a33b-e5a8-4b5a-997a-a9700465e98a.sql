
-- Delete all videos linked to creator accounts
DELETE FROM videos WHERE tiktok_account_id IN (SELECT id FROM tiktok_accounts WHERE creator_id IS NOT NULL);

-- Delete creator payments
DELETE FROM creator_payments;

-- Delete campaign_creators links
DELETE FROM campaign_creators;

-- Delete tiktok accounts linked to creators
DELETE FROM tiktok_accounts WHERE creator_id IS NOT NULL;

-- Delete all creators
DELETE FROM creators;
