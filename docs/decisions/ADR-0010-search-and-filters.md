# ADR-0010: Site-wide search + filters via Pagefind

**Date**: 2026-08-20 · **Status**: Proposed

## Decision
Add a search bar (site-wide header) and a `/search` results page with filters, powered by **Pagefind** — a static-site search library that indexes the built HTML at build time and runs entirely client-side (WASM) at request time. No new server, no runtime database access — preserves the existing hard rule that runtime never touches Supabase.

## Why Pagefind over alternatives
- **Hand-rolled JSON index + Fuse.js**: more control, but reimplements filtering/ranking/pagination Pagefind already solves. Real ongoing code to maintain for no clear benefit at this scale.
- **Live search API (Cloudflare Pages Function + Supabase)**: would break the "runtime never touches the DB" hard rule, adds operational surface (rate limiting, exposed runtime credentials, cold-start latency) for a corpus (thousands, not millions, of jobs) that doesn't need it.
- **Pagefind**: purpose-built for exactly this (SSG, zero backend), scales to tens of thousands of pages, native metadata-based filtering, zero server cost. Chosen.

## Architecture

**Build step** (`package.json` `build` script, appended after the existing `astro build && node scripts/build-manifests.mjs`):
```
astro build && node scripts/build-manifests.mjs && npx pagefind --site dist
```
Pagefind scans `dist/` post-build, emits its index + runtime JS/WASM into `dist/pagefind/`. Purely additive — doesn't touch existing sitemap/manifest generation.

**Indexed metadata** — `src/pages/jobs/[slug].astro` gets `data-pagefind-filter` attributes added to existing elements (no new DOM, just attributes) so Pagefind's filter UI has categorical dimensions to work with:
- `data-pagefind-filter="location:{job.location_policy}"` (remote / telework)
- `data-pagefind-filter="type:{job.employer_type}"` (federal / contractor / state)
- `data-pagefind-filter="category:{job.category_name}"` (when present)
- `data-pagefind-filter="employer:{job.employer}"` (agency or company name)

Salary is numeric, not categorical, so it's handled differently: `data-pagefind-meta="salary_min:{job.salary_min}"` and `salary_max` are attached (only when present), retrievable per-result via Pagefind's API but **not** used as a Pagefind filter. The `/search` page applies salary range as a client-side post-filter over Pagefind's returned results. Jobs with no salary data are never excluded by this filter — the filter only narrows within jobs that have salary populated, matching the earlier decision to accept sparse salary data as a known trade-off (Imran's choice, this session) rather than degrade to a filter that silently drops most of the corpus.

**New/changed files:**
- `src/layouts/Base.astro` — add a `<SearchBar>` in the header (one file, applies to all 17 page templates that use this layout).
- `src/components/SearchBar.astro` (new) — small input, submits to `/search?q=...`.
- `src/pages/search/index.astro` (new) — loads Pagefind's JS bundle, renders results + filter checkboxes (location, type, category, employer) + salary min/max number inputs, reads `?q=` from the URL for deep-linkability.
- `src/pages/jobs/[slug].astro` — add the `data-pagefind-filter`/`data-pagefind-meta` attributes described above (no visual change).
- `package.json` — append `npx pagefind --site dist` to the `build` script; add `pagefind` as a devDependency.

## Data flow
1. Daily ingestion updates Supabase → triggers the existing Cloudflare deploy hook (unchanged).
2. `astro build` renders all pages from Supabase (build-time read, existing pattern) → `build-manifests.mjs` writes sitemaps/expired-slugs (existing, unchanged) → `pagefind --site dist` scans the rendered HTML and builds the search index (new).
3. Browser: visiting any page loads the lightweight `SearchBar` (no index download until search is used). Submitting a query navigates to `/search?q=...`, which lazy-loads Pagefind's JS/WASM, runs the query + any active filters client-side, and renders results with title/employer/location badge, linking to each job's existing detail page.
4. No request ever reaches Supabase or any server function for search — everything after the initial page load is static asset fetches + in-browser computation.

## Testing / verification
- Local: `npm run build`, confirm `dist/pagefind/` is generated and existing sitemap/manifest output is unaffected (same files, same content, byte-identical apart from timestamps).
- `npm run preview`, manually verify: search returns relevant results for a few real job titles/agencies; each filter (location, type, category, employer, salary range) narrows results correctly and combines with others (AND semantics); a job with no salary data still appears when salary filter is untouched; `/search?q=...` deep link works from a fresh page load.
- Confirm zero regression to existing pages — `data-pagefind-filter`/`data-pagefind-meta` are non-visual attributes, existing job page rendering/JSON-LD/CSS untouched.
- No SEO impact expected: `/search` is a new, low-priority page (not added to sitemap — search results are dynamance, not canonical content); all existing job/hub/guide pages remain the primary crawl targets, unchanged.

## Rollout
Ships in the normal deploy flow — no GitHub Actions secrets, no new environment variables, no Cloudflare configuration changes. Next `npm run build` (local or CI) picks it up automatically.
