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

## Phase B — Site + SEO pages (2–4 d)

- [ ] Job detail template: facts box, full description, prominent "Apply on USAJOBS", JobPosting JSON-LD (TELECOMMUTE + applicantLocationRequirements; omit directApply)
- [ ] Hubs: /agency/{x}, /category/{x}, /grade/entry-level-gs-5-7, /remote/ vs /telework/
- [ ] Homepage + internal linking (≤3 clicks to anything) + disclaimer footer
- [ ] Verify: Rich Results Test passes on 5 prod URLs; deploy-hook chain end-to-end; Lighthouse ≥90

## Phase C — Index plumbing (1–2 d) ← minimum viable outcome

- [ ] Split sitemaps (jobs ≤2,000/chunk, real lastmod) + robots.txt
- [ ] Search Console property (DNS-verified) + submit sitemap
- [ ] GCP service account → Search Console Owner → Indexing API in daily run (URL_UPDATED/URL_DELETED, 200/day quota)
- [ ] 410 Pages Function + expired-slugs.json
- [ ] Verify: GSC shows Indexed; Indexing API 200s; closed URL curls 410 and exits sitemap

## Phase A2 — Contractors + telework (pulled into critical path, ADR-0007) (3–5 d)

- [ ] Workday CXS adapter (primary — the primes all use Workday; Greenhouse/Lever deferred per ADR-0007)
- [ ] registry/companies.json — validated: Leidos, Booz Allen, CACI, GDIT; discover SAIC/MAXIMUS/Peraton/MITRE endpoints; grow to ~15
- [ ] Remote-only filter (locationsText/title match, then detail-fetch for description)
- [ ] Telework tier: agency-sliced USAJOBS queries (Code List API for org codes), client-side TeleworkEligible filter
- [ ] /company/{x} hubs
- [ ] Verify: contractor jobs pass Rich Results; expiry-by-absence proven for one feed; telework slicing enumerates past the 10K cap

## Phase E — Editorial for AdSense (2–4 wk part-time)

- [ ] ~20 guides (remote federal how-to, GS pay scale, remote vs telework, federal resume, timeline, agency guides, contractor guides, veterans' preference, benefits value)
- [ ] privacy / terms / about / contact + site-wide disclaimer
- [ ] Interlink guides ↔ hubs

## Phase F — AdSense (0.5 d + review wait)

- [ ] Apply (only after Phase E done + some organic traffic)
- [ ] On approval: 2–3 manual units (under job header, in-guide, hub sidebar); never between facts and Apply; no Auto Ads
- [ ] Verify: no CLS regression

## ⏸ 3-month checkpoint (from Phase C completion)

- [ ] Record decision as ADR: **invest** (states, more contractors/content) if GSC impressions grow w/w, ≥50% job pages indexed, any Jobs-box impressions · **diagnose** if indexed-but-zero-impressions (origin-wins risk → shift to hubs/guides) · **stop/coast** if <10% indexation, flat zero

## Phase G — State feeds (post-checkpoint, 1–2 d each)

- [ ] NY first (data.ny.gov Socrata feed) → adapter → /state/ny
- [ ] Discovery tasks: CA, TX, WA (official feeds only; skip states without)
