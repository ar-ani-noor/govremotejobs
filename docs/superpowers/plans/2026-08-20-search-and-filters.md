# Site Search & Filters (Pagefind) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a site-wide search bar with filters (work location, employer type, category, agency/company, salary range) to govremotejobs.com, so users can find relevant jobs as the corpus grows past thousands of listings.

**Architecture:** Pagefind indexes the built static site after `astro build`, runs entirely client-side (WASM) in the browser — zero new server, zero runtime database access, preserving the project's existing "runtime never touches Supabase" rule. A search bar in the shared header links to a new `/search` page that loads Pagefind's JS API, applies categorical filters natively, and applies salary range as a client-side post-filter.

**Tech Stack:** Astro 7 (existing), Pagefind (new devDependency, static search index generator + client runtime), vanilla TypeScript in `<script>` blocks (existing pattern, see `src/pages/jobs/[slug].astro`'s resume-check script).

**Spec:** `docs/decisions/ADR-0010-search-and-filters.md`

## Global Constraints

- **No runtime database access** — search must never call Supabase or any server function at request time (ADR-0010, matches project-wide CLAUDE.md hard rule).
- **No new environment variables or GitHub Actions secrets** — this ships via the existing `npm run build` flow with no CI/deploy changes needed.
- **`/search` is not added to any sitemap** — it's a UX utility page, not canonical content (ADR-0010).
- **Salary filter never excludes jobs with no salary data** — it only narrows within jobs that have salary populated (ADR-0010, per Imran's explicit choice given sparse salary data across the corpus).
- **No new testing framework** — this project has no test runner (`package.json` has no test script, no jest/vitest present). Verification steps in this plan use the project's existing pattern: local build + `astro preview` + manual/browser verification, matching how every other feature in this repo has been verified this session (Rich Results Test, live ingestion runs, etc.). Do not introduce Jest/Vitest/etc. as part of this plan.

---

### Task 1: Add Pagefind to the build pipeline

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: `dist/pagefind/` directory (Pagefind's index + runtime JS/WASM) after every `npm run build`, consumed by Task 4's `/search` page via `import('/pagefind/pagefind.js')`.

- [ ] **Step 1: Install Pagefind as a devDependency**

Run: `cd ~/MyApps/govremotejobs && npm install --save-dev pagefind`

Expected: `package.json`'s `devDependencies` gains a `"pagefind"` entry; `package-lock.json` updates.

- [ ] **Step 2: Update the build script**

In `package.json`, change:
```json
"build": "astro build && node scripts/build-manifests.mjs",
```
to:
```json
"build": "astro build && node scripts/build-manifests.mjs && npx pagefind --site dist",
```

- [ ] **Step 3: Run the build and verify Pagefind's index is generated**

Run: `npm run build`

Expected: build completes without error, and `ls dist/pagefind/` shows files including `pagefind.js` and at least one `.pf_index` / fragment file. Confirm with:
```bash
ls dist/pagefind/
test -f dist/pagefind/pagefind.js && echo "pagefind.js present"
```

- [ ] **Step 4: Confirm existing build outputs are unaffected**

Run:
```bash
ls dist/sitemap-index.xml dist/robots.txt dist/expired-slugs.json
```
Expected: all three still present (Pagefind only adds files, doesn't touch existing manifest generation).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add Pagefind static search index generation"
```

---

### Task 2: Add Pagefind filter/meta attributes to the job detail template

**Files:**
- Modify: `src/pages/jobs/[slug].astro`

**Interfaces:**
- Consumes: `job.location_policy` ('remote' | 'telework'), `job.employer_type` ('federal' | 'contractor' | 'state'), `job.category_name` (string | null), `job.employer` (string), `job.salary_min`/`job.salary_max` (number | null) — all already available as existing props on this page (see current lines 12-17).
- Produces: `data-pagefind-filter` and `data-pagefind-meta` attributes in the rendered HTML, consumed by Pagefind's indexer (Task 1) and read back via `item.meta` in Task 4's search results rendering.

- [ ] **Step 1: Add filter/meta attributes to the existing badge/meta markup**

In `src/pages/jobs/[slug].astro`, the current markup (lines 21-28) is:
```astro
  <p class="meta" style="margin-bottom:0.4rem;">
    <span class={`badge ${job.location_policy}`}>{tierLabel(job.location_policy)}</span>
    <span class={`badge ${job.employer_type}`}>{job.employer_type === 'federal' ? 'Federal' : 'Contractor'}</span>
  </p>
  <h1>{job.title}</h1>
  <p class="meta" style="margin-bottom:1.2rem;">
    <a href={employerHub}>{job.employer}</a>{job.department && ` · ${job.department}`}
  </p>
```

Replace it with (HTML doesn't allow two `data-pagefind-filter` attributes on one element, so `location` and `type` each go on their own existing `<span class="badge">`; `employer` goes on the `<h1>`; `category`/salary get small hidden elements since there's no existing tag to attach them to — `data-*` attributes and `display:none` elements add zero visual change):
```astro
  <p class="meta" style="margin-bottom:0.4rem;">
    <span class={`badge ${job.location_policy}`} data-pagefind-filter={`location:${job.location_policy}`}>{tierLabel(job.location_policy)}</span>
    <span class={`badge ${job.employer_type}`} data-pagefind-filter={`type:${job.employer_type}`}>{job.employer_type === 'federal' ? 'Federal' : 'Contractor'}</span>
  </p>
  <h1 data-pagefind-filter={`employer:${job.employer}`}>{job.title}</h1>
  <p class="meta" style="margin-bottom:1.2rem;">
    <a href={employerHub}>{job.employer}</a>{job.department && ` · ${job.department}`}
  </p>
  {job.category_name && <p data-pagefind-filter={`category:${job.category_name}`} style="display:none;">{job.category_name}</p>}
  {job.salary_min && <p data-pagefind-meta={`salary_min:${job.salary_min}`} style="display:none;"></p>}
  {job.salary_max && <p data-pagefind-meta={`salary_max:${job.salary_max}`} style="display:none;"></p>}
```

- [ ] **Step 2: Rebuild and verify attributes are present in output**

Run: `npm run build`

Then pick any built job page and check the attributes rendered:
```bash
JOB_FILE=$(find dist/jobs -name "*.html" | head -1)
grep -o 'data-pagefind-filter="[^"]*"' "$JOB_FILE"
grep -o 'data-pagefind-meta="[^"]*"' "$JOB_FILE"
```
Expected: output shows `location:remote` (or `telework`), `type:federal` (or `contractor`/`state`), `employer:...`, and (if that job has category/salary data) `category:...`, `salary_min:...`, `salary_max:...`.

- [ ] **Step 3: Confirm the Pagefind index picks up the new filters**

Run: `npx pagefind --site dist` (already runs as part of `npm run build`, but re-run standalone to confirm no errors), then:
```bash
grep -rl "location" dist/pagefind/ | head -3
```
Expected: at least one file in the index references the filter data (Pagefind stores filters in its index fragments).

- [ ] **Step 4: Commit**

```bash
git add src/pages/jobs/\[slug\].astro
git commit -m "feat: add Pagefind filter/meta attributes to job detail pages"
```

---

### Task 3: Build the header search bar

**Files:**
- Create: `src/components/SearchBar.astro`
- Modify: `src/layouts/Base.astro`

**Interfaces:**
- Produces: a `<form action="/search" method="get">` visible in the header of every page using `Base.astro` (all 17 page templates), submitting to `/search?q=<value>` — consumed by Task 4's `/search` page, which reads the `q` query param.

- [ ] **Step 1: Create the SearchBar component**

Create `src/components/SearchBar.astro`:
```astro
---
const q = Astro.url.searchParams.get('q') ?? ''
---
<form action="/search" method="get" class="header-search" role="search">
  <input type="search" name="q" value={q} placeholder="Search jobs…" aria-label="Search jobs" />
  <button type="submit" aria-label="Search">Search</button>
</form>
```

- [ ] **Step 2: Wire it into the shared header**

In `src/layouts/Base.astro`, add the import at the top of the frontmatter (after line 1, before the `Props` interface):
```astro
---
import SearchBar from '../components/SearchBar.astro'
interface Props {
```

Then in the header markup, change (current lines 72-83):
```astro
    <header class="site">
      <div class="wrap">
        <a class="logo" href="/">GovRemote<span>Jobs</span></a>
        <nav class="site">
          <a href="/remote">Fully Remote</a>
          <a href="/telework">Telework</a>
          <a href="/agencies">Agencies</a>
          <a href="/companies">Contractors</a>
          <a href="/guides">Guides</a>
        </nav>
      </div>
    </header>
```
to:
```astro
    <header class="site">
      <div class="wrap">
        <a class="logo" href="/">GovRemote<span>Jobs</span></a>
        <nav class="site">
          <a href="/remote">Fully Remote</a>
          <a href="/telework">Telework</a>
          <a href="/agencies">Agencies</a>
          <a href="/companies">Contractors</a>
          <a href="/guides">Guides</a>
        </nav>
        <SearchBar />
      </div>
    </header>
```

- [ ] **Step 3: Add header-search styling**

In `src/layouts/Base.astro`'s existing `<style is:global>` block, add these rules right after the existing `nav.site a:hover { color: #fff; }` line (currently line 35):
```css
      .header-search { display: flex; gap: 0.4rem; }
      .header-search input[type="search"] { padding: 0.4rem 0.6rem; border-radius: 6px; border: 1px solid transparent; font-size: 0.9rem; min-width: 160px; }
      .header-search button { padding: 0.4rem 0.8rem; border-radius: 6px; border: none; background: var(--teal); color: #fff; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
      .header-search button:hover { background: var(--teal-dark); }
```

- [ ] **Step 4: Build and verify the search bar appears site-wide**

Run: `npm run build`

Then check it's present on both a hub page and a job detail page (proving it's coming from the shared layout, not duplicated per-page):
```bash
grep -c 'class="header-search"' dist/index.html
grep -c 'class="header-search"' "$(find dist/jobs -name '*.html' | head -1)"
```
Expected: both output `1`.

- [ ] **Step 5: Commit**

```bash
git add src/components/SearchBar.astro src/layouts/Base.astro
git commit -m "feat: add site-wide header search bar"
```

---

### Task 4: Build the /search results page with filters

**Files:**
- Create: `src/pages/search/index.astro`

**Interfaces:**
- Consumes: `tierLabel` from `src/lib/format.ts` (existing, signature `(p: string) => string`); Pagefind's client runtime at `/pagefind/pagefind.js` (produced by Task 1), exposing `init()`, `search(query, {filters})`, `filters()` per Pagefind's documented API; the `data-pagefind-filter`/`data-pagefind-meta` attributes from Task 2 (keys: `location`, `type`, `employer`, `category`, `salary_min`, `salary_max`).
- Produces: the `/search` route, linked from `SearchBar` (Task 3).

- [ ] **Step 1: Create the search page**

Create `src/pages/search/index.astro`:
```astro
---
import Base from '../../layouts/Base.astro'
---
<Base title="Search Jobs — GovRemoteJobs" description="Search and filter remote and telework-eligible US government and federal contractor jobs." noindex={true}>
  <h1>Search Jobs</h1>
  <p class="meta" style="margin-bottom:1.5rem;">Search by title, agency, or company, then narrow with filters.</p>

  <div class="search-layout">
    <aside class="search-filters">
      <div class="filter-group">
        <h3>Work Location</h3>
        <div id="filter-location"></div>
      </div>
      <div class="filter-group">
        <h3>Employer Type</h3>
        <div id="filter-type"></div>
      </div>
      <div class="filter-group">
        <h3>Category</h3>
        <div id="filter-category"></div>
      </div>
      <div class="filter-group">
        <h3>Agency / Company</h3>
        <div id="filter-employer"></div>
      </div>
      <div class="filter-group">
        <h3>Salary</h3>
        <label class="salary-label">Min <input type="number" id="salary-min" min="0" step="1000" placeholder="0" /></label>
        <label class="salary-label">Max <input type="number" id="salary-max" min="0" step="1000" placeholder="No max" /></label>
      </div>
    </aside>
    <div class="search-results" id="results">
      <p class="meta">Enter a search term or apply filters to see jobs.</p>
    </div>
  </div>

  <style>
    .search-layout { display: grid; grid-template-columns: 220px 1fr; gap: 1.5rem; margin-top: 1rem; }
    .filter-group { margin-bottom: 1.25rem; }
    .filter-group h3 { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.03em; color: var(--muted); margin-bottom: 0.5rem; }
    .filter-option { display: block; font-size: 0.9rem; margin-bottom: 0.35rem; cursor: pointer; }
    .filter-option input { margin-right: 0.4rem; }
    .salary-label { display: block; font-size: 0.85rem; margin-bottom: 0.4rem; }
    .salary-label input { width: 100%; padding: 0.3rem 0.5rem; border: 1px solid var(--border); border-radius: 6px; margin-top: 0.2rem; }
    @media (max-width: 640px) { .search-layout { grid-template-columns: 1fr; } }
  </style>

  <script>
    import { tierLabel } from '../../lib/format.ts'

    type PagefindFilters = Record<string, string[]>

    let pagefind: any
    const activeFilters: PagefindFilters = {}
    let salaryMin: number | null = null
    let salaryMax: number | null = null

    async function loadPagefind() {
      if (pagefind) return pagefind
      // @ts-ignore -- generated at build time by `npx pagefind`, not present in dev
      pagefind = await import(/* @vite-ignore */ '/pagefind/pagefind.js')
      await pagefind.init()
      return pagefind
    }

    function renderFilterGroup(containerId: string, filterKey: string, values: Record<string, number>) {
      const container = document.getElementById(containerId)
      if (!container) return
      container.innerHTML = ''
      for (const [value, count] of Object.entries(values)) {
        const label = document.createElement('label')
        label.className = 'filter-option'
        const checkbox = document.createElement('input')
        checkbox.type = 'checkbox'
        checkbox.checked = (activeFilters[filterKey] ?? []).includes(value)
        checkbox.addEventListener('change', () => {
          const current = new Set(activeFilters[filterKey] ?? [])
          if (checkbox.checked) current.add(value)
          else current.delete(value)
          activeFilters[filterKey] = [...current]
          runSearch()
        })
        label.appendChild(checkbox)
        const text = filterKey === 'location' ? tierLabel(value) : value
        label.appendChild(document.createTextNode(` ${text} (${count})`))
        container.appendChild(label)
      }
    }

    async function renderResults(results: any[]) {
      const container = document.getElementById('results')
      if (!container) return
      if (results.length === 0) {
        container.innerHTML = '<p class="meta">No jobs match your search and filters.</p>'
        return
      }
      const items = await Promise.all(results.map((r: any) => r.data()))
      const filtered = items.filter((item: any) => {
        const min = item.meta?.salary_min ? Number(item.meta.salary_min) : null
        const max = item.meta?.salary_max ? Number(item.meta.salary_max) : null
        if (salaryMin !== null && max !== null && max < salaryMin) return false
        if (salaryMax !== null && min !== null && min > salaryMax) return false
        return true
      })
      if (filtered.length === 0) {
        container.innerHTML = '<p class="meta">No jobs match your search, filters, and salary range.</p>'
        return
      }
      container.innerHTML = filtered
        .map(
          (item: any) => `
        <a class="job-row card" href="${item.url}">
          <h3>${item.meta?.title ?? item.url}</h3>
          <p class="meta">${item.excerpt}</p>
        </a>
      `,
        )
        .join('')
    }

    async function runSearch() {
      const pf = await loadPagefind()
      const input = document.getElementById('search-input-page') as HTMLInputElement | null
      const query = input?.value ?? ''

      const filterOptions = await pf.filters()
      renderFilterGroup('filter-location', 'location', filterOptions.location ?? {})
      renderFilterGroup('filter-type', 'type', filterOptions.type ?? {})
      renderFilterGroup('filter-category', 'category', filterOptions.category ?? {})
      renderFilterGroup('filter-employer', 'employer', filterOptions.employer ?? {})

      const search = await pf.search(query || undefined, { filters: activeFilters })
      await renderResults(search.results)
    }

    document.addEventListener('DOMContentLoaded', () => {
      const params = new URLSearchParams(window.location.search)
      const q = params.get('q') ?? ''

      // The header SearchBar already navigated here with ?q=..., but this
      // page has no visible input of its own beyond the header's — reuse it.
      const headerInput = document.querySelector('.header-search input[type="search"]') as HTMLInputElement | null
      if (headerInput) {
        headerInput.id = 'search-input-page'
        headerInput.closest('form')?.addEventListener('submit', (e) => {
          e.preventDefault()
          runSearch()
        })
        headerInput.addEventListener('input', () => runSearch())
      }

      const minInput = document.getElementById('salary-min') as HTMLInputElement
      const maxInput = document.getElementById('salary-max') as HTMLInputElement
      minInput?.addEventListener('input', () => {
        salaryMin = minInput.value ? Number(minInput.value) : null
        runSearch()
      })
      maxInput?.addEventListener('input', () => {
        salaryMax = maxInput.value ? Number(maxInput.value) : null
        runSearch()
      })

      if (q) runSearch()
      else {
        loadPagefind().then(async (pf) => {
          const filterOptions = await pf.filters()
          renderFilterGroup('filter-location', 'location', filterOptions.location ?? {})
          renderFilterGroup('filter-type', 'type', filterOptions.type ?? {})
          renderFilterGroup('filter-category', 'category', filterOptions.category ?? {})
          renderFilterGroup('filter-employer', 'employer', filterOptions.employer ?? {})
        })
      }
    })
  </script>
</Base>
```

- [ ] **Step 2: Build and verify the page renders**

Run: `npm run build`

```bash
test -f dist/search/index.html && echo "search page built"
grep -o '<meta name="robots"[^>]*>' dist/search/index.html
grep -rl "/search" dist/sitemap*.xml || echo "confirmed: /search not in any sitemap"
```
Expected: `search page built`, the robots meta tag shows `noindex`, and the sitemap grep finds nothing (prints the "confirmed" message) — both together satisfy ADR-0010's "not added to sitemap" requirement.

- [ ] **Step 3: Commit**

```bash
git add src/pages/search/index.astro
git commit -m "feat: add /search results page with Pagefind-powered filters"
```

---

### Task 5: End-to-end functional verification in a live browser

**Files:** none (verification only)

- [ ] **Step 1: Start a local preview server**

Run in background: `cd ~/MyApps/govremotejobs && npm run preview -- --port 4321`

Wait for it to report a local URL (typically `http://localhost:4321`).

- [ ] **Step 2: Load claude-in-chrome and open the search page**

Load the `claude-in-chrome` skill, then navigate to `http://localhost:4321/search`.

- [ ] **Step 3: Verify the header search bar is present and functional**

On the homepage (`http://localhost:4321/`), confirm the search input + button are visible in the header. Type a real job-related term (e.g., a known agency name or "engineer") into it and submit. Confirm it navigates to `/search?q=<term>` and results appear.

- [ ] **Step 4: Verify each filter narrows results correctly**

On `/search`, with no query (browse-all mode):
- Confirm filter checkboxes render under each of the 4 groups (Work Location, Employer Type, Category, Agency/Company), each showing a real value + count (not empty).
- Check one "Work Location" checkbox (e.g. Fully Remote) — confirm the results list updates and every visible result plausibly matches (spot-check by clicking through to 1-2 results and confirming the badge on the job page matches).
- Add a second filter (e.g. Employer Type = Federal) while the first is still checked — confirm results narrow further (AND semantics), not reset.
- Uncheck both — confirm results return to the unfiltered set.

- [ ] **Step 5: Verify the salary range filter**

- Enter a Min salary value well above most listings (e.g. 200000) — confirm the results list shrinks and no job without salary data is silently excluded from the *unfiltered* baseline (i.e., before entering a value, jobs without salary data are present in results; only entering a value narrows them out per the ADR-0010 rule).
- Clear the Min field — confirm results return to the previous (unfiltered-by-salary) set.

- [ ] **Step 6: Verify empty-state and edge cases**

- Search for a nonsense string (e.g. "zzzznojobsmatchthis") — confirm the "No jobs match your search and filters." message renders, no JS error in the console.
- Open the browser console (via claude-in-chrome) and confirm no uncaught errors occurred during steps 3-6.

- [ ] **Step 7: Verify no regression on an existing job page**

Open any job detail page directly (e.g. `http://localhost:4321/jobs/<a-real-slug>`) and confirm it renders exactly as before — badges, facts box, description, apply button, resume-check widget all still present and functional (the Task 2 changes only add invisible `data-*` attributes).

- [ ] **Step 8: Stop the preview server**

Kill the background `npm run preview` process.

- [ ] **Step 9: Report results**

Summarize what was verified and any issues found. If any step failed, fix the relevant Task's code before considering this plan complete — do not report success without having actually driven the browser through steps 3-7.
