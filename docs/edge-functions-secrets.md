# Edge Function Secrets

Secrets required by the Supabase Edge Functions. Set them in
**Supabase Dashboard → Project → Edge Functions → Secrets** (never commit them).

| Secret | Used by | Notes |
|---|---|---|
| `APIFY_API_KEY` | `scrape-tiktok` | Apify token. Also resolvable from the `settings` table (`key='apify_api_key'`), which takes precedence. |
| `APIFY_WEBHOOK_SECRET` | `scrape-tiktok` | Optional. Only used to validate the legacy webhook fallback path. The primary flow is background polling and does not require it. |
| `ANTHROPIC_API_KEY` | `parse-briefs-from-text` | **Required for the "Importa da Google Doc" feature (SP#5 Part B).** Generate at https://console.anthropic.com/settings/keys. Until set, the AI import returns `500 ANTHROPIC_API_KEY not configured`. |

## ANTHROPIC_API_KEY setup (SP#5 Part B)

1. Supabase Dashboard → Project → Edge Functions → Secrets
2. Name: `ANTHROPIC_API_KEY`
3. Value: an API key from the Anthropic console.

The function uses model `claude-3-5-haiku-latest` (low cost, ~3s latency). Cost per
import is roughly $0.001-0.005.
