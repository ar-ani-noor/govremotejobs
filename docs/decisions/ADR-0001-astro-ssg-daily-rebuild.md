# ADR-0001: Astro SSG on Cloudflare Pages, rebuilt daily

**Date**: 2026-08-19 · **Status**: Accepted

## Decision
Static site generation with Astro, deployed on Cloudflare Pages. A full rebuild is triggered by a Deploy Hook at the end of each daily ingestion run. The only dynamic code is `functions/jobs/[[slug]].ts`, which serves **HTTP 410** for expired job slugs (read from build-generated `expired-slugs.json`) with a "job closed — similar open roles" page.

## Rationale
- Data changes once per day (our ingestion cadence) — a daily rebuild matches exactly; edge SSR buys nothing.
- Static HTML = best possible crawl speed/TTFB for the SEO-critical pages.
- Failure mode is graceful: a failed build leaves yesterday's site up. SSR's failure mode (DB down → site down) is worse.
- Free-tier math: ~3–8K pages builds in minutes (20-min limit); ~40 builds/mo vs 500 allowed; static assets unlimited. Workers free tier (100K req/day) could be eaten by a crawl spike under SSR.

## Revisit when
Inventory exceeds ~30K pages or builds exceed ~10 minutes.
