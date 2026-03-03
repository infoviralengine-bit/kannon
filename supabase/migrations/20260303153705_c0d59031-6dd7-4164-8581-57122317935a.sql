DELETE FROM videos 
WHERE tiktok_account_id IN (
  SELECT ta.id FROM tiktok_accounts ta WHERE ta.campaign_id = 'edfc1aae-3b5d-4556-948d-2d1cc3025cfa'
)
AND published_at < '2026-03-02'