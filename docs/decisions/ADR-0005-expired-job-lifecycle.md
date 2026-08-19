# ADR-0005: Expired-job lifecycle (first-class)

**Date**: 2026-08-19 · **Status**: Accepted

## Decision
A job is expired when its close date passes OR it is absent from its source feed for **2 consecutive runs** (grace for API hiccups). Then, in the same daily run:
1. Tombstone: `status='closed', closed_at=now()` — never hard-delete young rows (slug reuse prevention, 410 manifest, Indexing API needs).
2. Google Indexing API `URL_DELETED` for the job URL.
3. Rebuild drops the page and its sitemap entry (same day).
4. `functions/jobs/[[slug]].ts` serves **410 Gone** from `expired-slugs.json` with links to similar open roles.
5. Tombstones purge 90 days after closed_at; the URL then becomes a plain 404.

## Rationale
Stale job pages are the classic aggregator death: Google demotes sites indexing expired listings, and users bounce. Nothing stale stays indexed longer than ~a day.
