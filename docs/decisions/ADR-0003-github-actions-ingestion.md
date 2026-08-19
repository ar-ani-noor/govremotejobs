# ADR-0003: GitHub Actions scheduled workflow for daily ingestion

**Date**: 2026-08-19 · **Status**: Accepted

## Decision
The daily pipeline runs as `.github/workflows/daily-ingest.yml` (cron ~09:00 UTC) executing `scripts/ingest/index.ts`: fetch all sources → normalize → diff/upsert → expire → Google Indexing API calls → POST the Cloudflare Pages deploy hook.

## Rationale
- Free (public repo = unlimited minutes) and generous even if private (~90 min/mo used of 2,000).
- Visible logs, retry button, secrets UI, and email-on-failure a solo dev actually sees.
- One sequential job naturally chains ingest → indexing → deploy; a Worker cron would orchestrate across systems.

## Caveats
GitHub disables scheduled workflows after ~60 days without repo activity; regular content commits reset this, and email-on-failure makes silence noticeable. Secrets: USAJOBS_API_KEY, USAJOBS_USER_AGENT_EMAIL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_INDEXING_SA_JSON, CF_DEPLOY_HOOK_URL.
