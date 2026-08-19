# ADR-0006: Contractor ingestion via ATS platform adapters + company registry

**Date**: 2026-08-19 · **Status**: Accepted

## Decision
Integrate with hiring PLATFORMS, not companies: one adapter each for Greenhouse (`boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true`), Lever (`api.lever.co/v0/postings/{slug}?mode=json`), then SmartRecruiters and Workday. A config registry `scripts/ingest/registry/companies.json` (`{name, ats, slug}`) lists companies — adding one is one line, no code. Launch with ~15 majors (Booz Allen, Leidos, MITRE, SAIC, CACI, GDIT, Deloitte GPS…), grow to ~30.

## Rules
- Ingest remote-only roles (skip hybrid/onsite); per-adapter location normalization.
- These are public, no-auth feeds intended for embedding; every listing links to the company's own posting/apply page with attribution.
- A feed returning zero jobs raises a flag in the run log (company likely switched ATS → one-line registry fix).
- Contractor postings may lack close dates → `closes_at` nullable; expiry relies on feed-absence (ADR-0005) and JSON-LD omits validThrough.
