
INSERT INTO campaign_creators (creator_id, campaign_id)
SELECT DISTINCT ta.creator_id, ta.campaign_id
FROM tiktok_accounts ta
WHERE ta.creator_id IS NOT NULL AND ta.campaign_id IS NOT NULL
ON CONFLICT DO NOTHING;
