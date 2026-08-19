# GovRemoteJobs.com

Aggregator of remote + telework-eligible US government jobs (federal via USAJOBS API, federal contractors via public ATS feeds, state feeds later). Static Astro site on Cloudflare Pages, rebuilt daily after ingestion. Monetization: AdSense (after editorial phase). This is a patient side project — see docs/tasks.md for the 3-month checkpoint.

## Start here every session

1. **`docs/tasks.md`** — living task board. Update statuses as you work.
2. **`docs/decisions/`** — ADR-0001…0006. Read before proposing architecture changes; new decisions get new ADRs.

## Stack

- **Site**: Astro SSG → Cloudflare Pages (build `npm run build`, output `dist/`). Daily rebuild via Deploy Hook called at the end of ingestion. One Pages Function: `functions/jobs/[[slug]].ts` serves 410 for expired jobs.
- **Data**: Supabase Postgres (build-time reads with anon key ONLY; runtime never touches the DB).
- **Ingestion**: `.github/workflows/daily-ingest.yml` (GH Actions cron) runs `scripts/ingest/index.ts` — fetch → normalize → diff/upsert → expire → Google Indexing API → deploy hook.

## Hard rules

- **Source ToS (never violate)**: every listing links prominently to the ORIGINAL posting; "Source: USAJOBS" / company attribution shown; NEVER expose our aggregated data as a feed/API/export; real contact email in User-Agent; ~1 req/s with backoff. No scraping — official APIs and public ATS feeds only.
- **The expiry flow is sacred** (ADR-0005): tombstone → Indexing API URL_DELETED → same-day rebuild drops page+sitemap → 410. Never let an expired job stay indexed; never hard-delete tombstones younger than 90 days.
- **Migrations**: Supabase CLI only (`supabase migration new` → `db push`); RLS + grants (incl. explicit service_role grants) in the same migration that creates each table.
- **Secrets**: anon key only in build env; service_role + API keys only in GitHub Actions secrets. Nothing secret in this repo (it is public).
- Site-wide footer disclaimer: not affiliated with the US government or USAJOBS.

## Key facts

- Domain: govremotejobs.com (Cloudflare Registrar, 3 years). GitHub: ar-ani-noor/govremotejobs (public — unlimited Actions minutes).
- `location_policy`: 'remote' (fully remote) vs 'telework' (hybrid-eligible) — displayed as distinct tiers, never blurred.
- `employer_type`: 'federal' | 'contractor' | 'state'.
- Slugs are immutable once created: `kebab(title)-kebab(employer)-{sourceId}`.
