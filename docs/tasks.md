# GovRemoteJobs — Task Board

> Statuses: `[ ]` todo · `[~]` in progress · `[x]` done · `[-]` deferred
> Decisions in [decisions/](decisions/). Session ritual in CLAUDE.md.

## Phase 0 — Foundations + kill-switch checks (0.5–1 d)

- [x] Domain purchased: govremotejobs.com (Imran, Cloudflare Registrar, 3 yrs, 2026-08-19)
- [x] Repo scaffold + CLAUDE.md + task board + ADR-0001…0006
- [ ] **MANUAL (Imran): request USAJOBS API key** — developer.usajobs.gov/apirequest (email + User-Agent = your email; key arrives by email)
- [x] Supabase project created via CLI: `cvrtvlhdvwqttyzlyhxb` (us-east-1) + linked
- [ ] GitHub repo ar-ani-noor/govremotejobs (public) + push
- [ ] **MANUAL (Imran): Cloudflare Pages project** — connect repo, build `npm run build`, output `dist`; create Deploy Hook "daily-ingest"; attach govremotejobs.com
- [x] **GATE 1 (2026-08-19)**: remote federal = 35 (!), telework ≈10.2% of ≥10K corpus ≈ 1,000+, Workday contractor feeds validated (Leidos 412 / BAH ~2,000 / CACI 224 / GDIT 282 loose matches). Verdict: proceed re-weighted — see ADR-0007.
- [ ] **GATE 2 (Imran)**: Keyword Planner volumes for "remote government jobs" cluster (free Google Ads account — reused later for AdSense). Sanity: ≥ ~10K/mo US.
- [x] Astro hello-world builds locally (127ms); deploys on *.pages.dev

## Phase A — Ingestion + DB, federal (1–2 d)

- [x] Migration: `jobs` + `ingest_runs` (RLS, anon SELECT on active + recently-closed for 410 manifest, service_role grants)
- [x] USAJOBS adapter: remote pass live; telework pass behind INCLUDE_TELEWORK flag until the filter param is verified in Gate 1
- [x] Normalize → immutable slug; diff by content_hash; upsert (reopened postings reactivate their slug)
- [x] Expiry: closes_at passed OR absent ~40h → tombstone; 90-day purge (ADR-0005)
- [~] `.github/workflows/daily-ingest.yml` written; secrets pending (needs USAJOBS key + deploy hook)
- [ ] Verify: 3 green scheduled runs; spot-check salaries/close dates vs USAJOBS; observe one job transition to closed

## Phase B — Site + SEO pages (2–4 d) — SHIPPED 2026-08-19

- [x] Job detail template: facts box, full description, apply-on-origin CTA, JobPosting JSON-LD (TELECOMMUTE + applicantLocationRequirements; omit directApply)
- [x] Hubs: /remote (with every-fully-remote-federal-job flagship section), /telework, /agency/*, /company/*, /agencies, /companies
- [x] Homepage with live counts + disclaimer footer + 404
- [x] Post-build manifests: chunked job sitemaps (real lastmod), hub sitemap, sitemap index, expired-slugs.json, robots.txt
- [x] 410 Pages Function for expired slugs
- [x] LIVE: govremotejobs.com serving 4,077 pages (3,935 jobs); JSON-LD verified in production
- [ ] Verify: Google Rich Results Test on 5 prod URLs (manual, browser)
- [ ] Verify: deploy-hook chain fires on tomorrow's scheduled run (secret was added mid-run today)
- [ ] Verify: first real job expiry → 410 (needs a job to actually close)
- [ ] Later: /category/{x} and /grade/entry-level hubs (deferred — employer + tier hubs shipped first)

## Phase C — Index plumbing — COMPLETE 2026-08-19 ← minimum viable outcome

- [x] Split sitemaps (jobs ≤2,000/chunk, real lastmod) + robots.txt
- [x] Search Console property verified (DNS, auto via Cloudflare authorization) + sitemap-index.xml submitted
- [x] GCP project `govremotejobs` + service account `indexing-bot@govremotejobs.iam.gserviceaccount.com` + Search Console Owner access + Web Search Indexing API enabled
- [x] `GOOGLE_INDEXING_SA_JSON` + `CF_DEPLOY_HOOK_URL` GitHub secrets — verified end-to-end: Indexing API sent 89/89 URLs on a real-change run; deploy hook confirmed HTTP 200 via dedicated test workflow
- [x] Fixed silent-skip logging gap in the orchestrator (no-changes runs now log explicitly, not ambiguously)
- [x] Added `trigger-deploy.yml` — manual "rebuild site now" utility, reusable going forward
- [x] 410 Pages Function + expired-slugs.json (shipped with Phase B)
- [ ] Follow-up: confirm GSC "Indexed" count over the next few days (crawl takes time — this is not a same-day signal)
- [ ] Follow-up: verify a real job expiry → 410 once one naturally closes

## Phase A2 — Contractors + telework (pulled into critical path, ADR-0007) (3–5 d)

- [x] Workday CXS adapter — live run green: CACI 64, GDIT 40, Leidos 39, BAH 5; DB total 183 with dedupe verified
- [ ] FOLLOW-UP: BAH yields only 5/~2,000 — their remote designation likely lives outside locationsText (separate field or description); investigate their posting format to recover inventory
- [ ] registry/companies.json — validated: Leidos, Booz Allen, CACI, GDIT; discover SAIC/MAXIMUS/Peraton/MITRE endpoints; grow to ~15
- [ ] Remote-only filter (locationsText/title match, then detail-fetch for description)
- [x] Telework tier: 198 dept slices → 3,752 jobs inserted, zero errors; dedupe verified across all sources
- [x] /company/{x} hubs (shipped in Phase B — companies.astro + company/[slug].astro)
- [ ] Verify: contractor jobs pass Rich Results; expiry-by-absence proven for one feed; telework slicing enumerates past the 10K cap

## Phase E — Editorial for AdSense (2–4 wk part-time)

- [x] 21 guides shipped 2026-08-19: 8 how-to/reference, 5 category (IT, program analysis, legal, engineering, contracting), 4 agency-specific (National Guard, AFMC, DLA, USCIS), 4 contractor-specific (CACI, GDIT, Leidos, Booz Allen) — all grounded in real live inventory data, not generic assumptions
- [x] privacy / terms / about / contact pages shipped 2026-08-19 (site-wide footer disclaimer already existed since Phase B)
- [x] Interlink guides <-> hubs: every guide links to relevant /agency, /company, or /category pages; verified 0 broken links across all 21 files. Added /category/{x} + /categories hub pages (previously deferred) so guides had real non-broken destinations to link to.

## Phase F — AdSense (0.5 d + review wait)

- [ ] Apply (only after Phase E done + some organic traffic)
- [ ] On approval: 2–3 manual units (under job header, in-guide, hub sidebar); never between facts and Apply; no Auto Ads
- [ ] Verify: no CLS regression

## ⏸ 3-month checkpoint (from Phase C completion)

- [ ] Record decision as ADR: **invest** (states, more contractors/content) if GSC impressions grow w/w, ≥50% job pages indexed, any Jobs-box impressions · **diagnose** if indexed-but-zero-impressions (origin-wins risk → shift to hubs/guides) · **stop/coast** if <10% indexation, flat zero

## Phase G — State feeds (post-checkpoint, 1–2 d each)

- [ ] NY first (data.ny.gov Socrata feed) → adapter → /state/ny
- [ ] Discovery tasks: CA, TX, WA (official feeds only; skip states without)
