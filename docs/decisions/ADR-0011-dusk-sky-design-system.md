# ADR-0011: "Dusk Sky" design system

**Date**: 2026-08-20 · **Status**: Accepted

## Decision
Replace the launch styling (navy/teal, system-ui, rounded cards) with the "Dusk Sky" system, chosen by Imran from a 15-artboard design exploration (Claude Design canvas, rounds 1–4). The thesis: the U.S. government has its own graphic heritage — WPA posters, park-service brochures — and a site whose promise is "serve your country from your own house" should speak in that voice, modernized.

## Tokens (all defined in `src/layouts/Base.astro` — the single source of color in `src/`)
- Ground `--dusk #24384f` · deep band `--dusk-deep #101c2e` · secondary dark `--sky #2e4560` · panel `--panel #1d3049`
- Ink `--ink #16243a` (borders, dark fills, text on paper) · paper `--paper #f2eee2` (cards)
- Gold `--gold #e0b64f` · action `--coral #cf5b3f` / hover `#b0452c`
- Muted: `--muted-paper #5c5a4c` (on paper) · `--light #a9b8c9` (on ground)
- Legacy names (`--navy --teal --bg --card --muted --border` …) are kept as aliases so per-page inline styles keep working.

## Type
- Display: **Staatliches** (uppercase, h1/h2, tiles, filter headers). Fallback `'Arial Narrow', sans-serif`.
- Body: **Public Sans** — the federal government's own open-source face (USWDS).
- Data (salary, dates, imprint lines, job-card meta): **Spline Sans Mono**.
- Loaded from Google Fonts with `display=swap`.

## System rules
- Square corners everywhere (`border-radius: 0`); cards are paper with a 2px ink border; the homepage poster gets the double frame (3px border + inset box-shadow rule).
- Long-form reading (`.description` — job descriptions AND guide bodies) sits on paper.
- Badges: remote = ink fill, telework = gold fill, federal/contractor = outlined; uppercase via CSS (`text-transform`), template text unchanged. On the dark ground, wrap in `.on-ground` for the paper-outline variants.
- One action color: coral, reserved for Search/Apply buttons. Links are gold on the ground, coral on paper.
- Homepage signature: the framed poster hero ("SERVE FROM ANYWHERE.") with the SVG sunset-homestead scene and the disclaimer set as a printer's imprint line. The poster stays ad-free.
- Favicon: `public/favicon.svg` (gold sun on ink) — matches the scene; keep stable.

## Ad containers (Phase F, pre-wired)
`src/components/AdSlot.astro` renders **nothing** until `PUBLIC_ADS_ENABLED=true` at build time, so pages carry no empty boxes before AdSense approval. Slots placed per the approved design: homepage `leaderboard` (after stat tiles), job page `job-header` (below title/employer, above facts) and `job-footer` (after description, before resume checker), search `sidebar` (below filters). Hard rules preserved: never between the facts box and Apply; fixed slot heights in CSS so enabling ads causes no layout shift; at most 2 units per page.

## Gotchas encoded in the CSS (do not undo silently)
- `.card a` (0,1,1) outranks `.btn` (0,1,0): button rules are written as `.btn, .card a.btn, .description a.btn` — a bare `.btn` restyle will regress the Apply button to invisible coral-on-coral.
- The search page's JS-created nodes (`.filter-option`, `.load-more`, `.result-count`, result cards) only match `:global()` rules in `search/index.astro` — Astro's scoped selectors never hit `createElement`'d nodes.
- `data-pagefind-*` attributes on the job template are load-bearing for search; restyling must not remove them (verified intact in this change: 3,900 pages, 4 filters).
