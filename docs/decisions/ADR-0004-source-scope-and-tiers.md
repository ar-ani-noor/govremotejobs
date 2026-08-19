# ADR-0004: Source scope and remote/telework tiers

**Date**: 2026-08-19 · **Status**: Accepted

## Decision
- Sources: USAJOBS official API (federal), public ATS feeds for federal contractors (ADR-0006), state open-data feeds post-checkpoint. **No scraping, ever.** No general private-sector remote jobs (rejected: fighting FlexJobs/LinkedIn/Indeed with fragmented data and no differentiation).
- `location_policy` = 'remote' (RemoteIndicator=True) vs 'telework' (TeleworkEligible=True, not remote) — presented as clearly distinct tiers; the "fully remote" promise is never diluted.
- `employer_type` = 'federal' | 'contractor' | 'state'.

## Context recorded honestly
Post-Jan-2025 RTO order, remote federal inventory shrank ~5x (~4,800 remote postings at planning time) with policy risk of further cuts. Contractors + states hedge this. Google for Jobs may prefer origin sites (USAJOBS emits its own markup); mitigation = per-page value-add (GS salary decode, remote-vs-telework explainer, employer guides) + hub/guide SEO that works regardless. The 3-month checkpoint exists because of these risks.
