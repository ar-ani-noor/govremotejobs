# ADR-0012: Phase G (state feeds) parked — no candidate state passes the source-quality bar

**Date**: 2026-08-20 · **Status**: Accepted (parked, with reopen criteria)

## Decision
Park Phase G. All four planned candidate states were investigated on 2026-08-20 and none currently offers what the project's hard rules require: an official feed (API/dataset/ATS feed — no HTML scraping) carrying a **structured** remote/telework signal (the lesson of ADR-0009: keyword matching on "remote" is a false-positive trap; only a structured field or facet is trustworthy).

## Findings per state

- **NY (was "first" in the plan)** — the plan's premise is stale. data.ny.gov no longer hosts a current-vacancies dataset: the Socrata catalog was searched under job postings / vacancies / civil service / employment opportunities / StateJobsNY (plus more), and historical dataset IDs 404. StateJobsNY (statejobs.ny.gov) is server-rendered ColdFusion HTML with no XML/RSS/export endpoints (candidates probed, all 404; no feed links in the vacancy table page; no robots.txt). Ingesting NY would require scraping → prohibited.
- **CA** — no jobs dataset on data.ca.gov (CKAN searched); CalCareers is a closed custom portal.
- **TX** — no jobs dataset on data.texas.gov (Socrata searched).
- **WA** — closest, but fails on both axes. careers.wa.gov is a marketing page funneling into NEOGOV (governmentjobs.com/careers/washington). The NEOGOV tenant: (a) serves listings as server-rendered HTML — the SPA-era `.json` endpoints are retired, and the live search endpoint (`/careers/home/index?agency=washington&keyword=…`, captured from real browser traffic) returns **HTML fragments**, not JSON; (b) exposes **no remote/telework filter facet** on the WA tenant (some NEOGOV tenants have a "Remote Employment" facet; WA's does not); (c) job-detail pages on the tenant are skeletal ("View Job Posting for Location…"), deferring to per-agency postings.

## Reopen criteria (check these before re-investigating, in order of cheapness)
1. A state publishes a real open-data vacancies dataset again (check the Socrata/CKAN catalogs — one API call each).
2. A state's NEOGOV tenant shows the "Remote Employment" facet on its governmentjobs.com careers page (view the filter sidebar; if present, the facet is also a structured per-job field, and NEOGOV then merits the deeper adapter investigation — with the HTML-fragment transport still needing a ruling against the no-scraping rule).
3. A state moves to Workday — then it's a one-line `companies.json`-style addition to the existing adapter pattern (with `employer_type: 'state'`, which the schema already supports).

## Notes
- **Ohio and Georgia probed same day (2026-08-20), both rejected.** Ohio: still on Taleo (`dasstateoh.taleo.net`), not Workday — the Workday lead was stale. Georgia: genuinely on Workday (`georgia.wd5.myworkdayjobs.com`, site `TGC`, 1,070 jobs, clean CXS API) but a search of the entire facet tree found **zero** remote/telework/hybrid values — every location is a physical office, Job Type is employment status only, and the 60 "remote" keyword matches were description-text false positives. No structured remote signal → nothing a remote-jobs site can honestly ingest, exactly the ADR-0009 failure mode. If another state is probed later, run the facet-tree check FIRST (one API call) before anything else.
- The `state` employer type, tier display, and slug scheme (ADR-0004) all remain ready; nothing in the codebase blocks Phase G when a qualifying source appears.
