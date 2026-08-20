# ADR-0009: Phenom People adapter rejected — no reliable remote signal

**Date**: 2026-08-20 · **Status**: Rejected (not building)

## Decision
Do not build a Phenom People adapter to expand `registry/companies.json`, despite Phenom fronting 4 candidate contractors (MITRE, ICF, Parsons, RTX) found during a broader scan for companies to add. Registry stays at 5 (Leidos, Booz Allen, CACI, GDIT, Guidehouse — all Workday), Guidehouse added same day as this investigation.

## Investigation
Unlike Workday's clean, uniform public CXS JSON API, Phenom career sites server-render job data as JSON embedded in page HTML (confirmed working parse path: `GET {host}/us/en/search-results?keywords=...&from={offset}` for listings, `GET {host}/us/en/job/{jobId}` for full description — both verified live on `careers.mitre.org` and `careers.icf.com`).

The blocker: neither company exposes a reliable "this job is actually remote" signal.
- **MITRE**: confirmed via the site's own "Work Location Type" facet counts (embedded in the same SSR HTML as `{"field":"workLocationType","value":{"Onsite":179,"Hybrid":23}}`) that MITRE has **zero remote positions** — only Hybrid/Onsite exist as categories. A `keywords=remote` text search returned 24 "matches," but 10/10 sampled were real on-site jobs (McLean VA, Stuttgart Germany, etc.) matching unrelated text ("remote sensing," telework mentions) — the same false-positive trap Workday's adapter solved via location-field filtering (see ADR-0006), except Workday's jobs *do* carry a real `"Remote"` location value to filter on and MITRE's structurally don't.
- **ICF**: site's `enabledFacets` config doesn't include `workLocationType` at all (`category, country, state, city, type` only) — no structured remote/onsite signal exists to filter on. A 10-job sample of its 375 "remote"-keyword matches found zero with "Remote" literally in the location text.
- **Parsons / RTX**: never reached this stage — Parsons' assumed URL pattern 404'd, RTX's careers site returned 403 (bot-blocked). Not investigated further once MITRE/ICF made the underlying approach look unpromising.

## Rationale
Building the scraper (HTML parsing, pagination, 2 fetches/job) is real ongoing-maintenance surface for a payoff that shrank mid-investigation from "4 companies at once" to "maybe some ICF jobs, unverifiable without exhaustively scraping all 375 and text-matching location strings." Shipping a feed with an unresolved false-positive risk (mislabeling on-site jobs as remote) would actively damage site credibility, not just cost engineering time. Guidehouse (confirmed same day, 199 real remote jobs, clean Workday fit) is the actual win from this session.

## Revisit if
A future candidate company is confirmed to (a) run Phenom AND (b) actually expose `workLocationType` including a `Remote` value with nonzero count in its facet config — check via `curl {host}/us/en/search-results` and grep for `"workLocationType"` before investing adapter-build time again.
