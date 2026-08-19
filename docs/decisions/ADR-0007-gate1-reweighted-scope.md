# ADR-0007: Gate 1 results — scope re-weighted toward contractors + telework

**Date**: 2026-08-19 · **Status**: Accepted

## Findings (empirical, from the live API and feeds)
- Fully-remote federal postings: **35 total** (RemoteIndicator=True). The 2025 RTO order + hiring freeze did their work; the ~4,800 figure seen on aggregators conflated telework/hybrid/contractor listings.
- `TeleworkEligible` is NOT a server-side search parameter (returns the same 10K cap as unfiltered). Telework must be filtered client-side; sampling 500 postings measured **10.2% telework-eligible** → ~1,000+ jobs across the ≥10K corpus. Enumeration past the API's 10K display cap requires sliced queries (per top-level agency via the Code List API).
- Major federal contractors are NOT on Greenhouse/Lever — they use **Workday**, whose public CXS careers API needs no auth. Validated live: Leidos 412, Booz Allen ~2,000, CACI 224, GDIT 282 "remote" text matches. Real remote-only counts lower after filtering, but ~30 companies ≈ 1,000–3,000 roles.

## Decision
1. Contractors (Workday adapter + company registry) move INTO the critical path — the site launches with thousands of listings, not 35.
2. Telework ingestion via agency-sliced queries also lands before launch.
3. The 35 fully-remote federal jobs become a flagship editorial section ("every fully-remote federal job, all N of them") — scarcity is a linkable story.
4. Greenhouse/Lever adapters deferred until a registry company actually uses them.

## Revisit
If a future administration reverses federal RTO policy, remote-federal inventory may 10x; the tier structure already accommodates that.
