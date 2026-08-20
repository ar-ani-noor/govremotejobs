# ADR-0006: Contractor ingestion via ATS platform adapters + company registry

**Date**: 2026-08-19 · **Status**: Accepted

## Decision
Integrate with hiring PLATFORMS, not companies: one adapter each for Greenhouse (`boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true`), Lever (`api.lever.co/v0/postings/{slug}?mode=json`), then SmartRecruiters and Workday. A config registry `scripts/ingest/registry/companies.json` (`{name, ats, slug}`) lists companies — adding one is one line, no code. Launch with ~15 majors (Booz Allen, Leidos, MITRE, SAIC, CACI, GDIT, Deloitte GPS…), grow to ~30.

## Rules
- Ingest remote-only roles (skip hybrid/onsite); per-adapter location normalization.
- These are public, no-auth feeds intended for embedding; every listing links to the company's own posting/apply page with attribution.
- A feed returning zero jobs raises a flag in the run log (company likely switched ATS → one-line registry fix).
- Contractor postings may lack close dates → `closes_at` nullable; expiry relies on feed-absence (ADR-0005) and JSON-LD omits validThrough.

## Update 2026-08-19: title-matching removed, multi-location blind spot fixed

Investigated the BAH low-yield issue (task board flagged it after Phase A2). Findings, from direct inspection of Workday's raw API responses:

1. **Title-based remote detection was actively wrong, not just imprecise.** All 5 "confirmed remote" BAH jobs in the database were false positives — matched only because their titles contained "Remote Sensing" (a real BAH business line: satellite/imagery intelligence work) or "Secure Remote Access" (a cybersecurity/VPN role), neither of which describes the employee's own work location. Both are physically sited (Dayton OH, McLean VA).
2. **BAH's Workday location taxonomy has no "Remote" value at all** — confirmed by pulling their full 232-entry location facet list. An unfiltered 300-posting sample independently confirmed 0/300 single-location postings say "Remote." The correct current count for BAH is genuinely **0**, not a pipeline failure to find true positives — we were overcounting, not undercounting.
3. **Separately, real inventory was being silently skipped at all four companies**: multi-location postings show as a bare count ("7 Locations") in the list view, not the actual place names — our filter dropped these before ever checking whether "Remote" was one of the valid locations, via the detail page's `additionalLocations` array.

**Fix**: removed all title-based matching (list-stage and confirm-stage); added `additionalLocations` checking for multi-location postings, which previously were never fetched at all.

**Result after fix**: BAH 5→0 (corrected, not regressed — the 5 were wrong), CACI 64→94 (+30 genuine remote jobs recovered from the multi-location blind spot), Leidos 39→40, GDIT unchanged at 40. All four companies combined run in <4 minutes — no workflow timeout risk.

**Lesson for future adapters** (Greenhouse/Lever, when added): never use free-text or title matching as a remote signal on its own — verify against a structured location field, and check every location a multi-location posting is valid for, not just the first one shown in a list view.
