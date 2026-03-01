
DELETE FROM videos
WHERE id IN (
  SELECT v.id
  FROM videos v
  JOIN tiktok_accounts ta ON ta.id = v.tiktok_account_id
  JOIN campaigns c ON c.id = ta.campaign_id
  WHERE v.published_at < c.start_date::timestamptz
);
