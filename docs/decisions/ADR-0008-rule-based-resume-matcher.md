# ADR-0008: Rule-based resume matcher — no LLM, no server call

**Date**: 2026-08-19 · **Status**: Accepted

## Decision
Add a "check your resume against this job" widget to every job page, built entirely as rule-based logic with zero LLM/API dependency and zero server round-trip:

- **Build time** (`extractKeywords`, Node/Astro frontmatter): pulls candidate skill/tool keywords from each job's own description — prioritizing the "Requirements"/"Qualifications" sections when present (structured headings the USAJOBS adapter already produces), via cue-phrase patterns ("experience with X", "knowledge of Y") and acronym detection, with a frequency-based fallback for unstructured contractor postings. Result is embedded per-page as inert JSON.
- **Client time** (`analyzeResume`, browser): the user pastes resume text into a textarea; pure JavaScript checks which keywords are present/missing and runs general rules (word count, quantified-achievement ratio, weak-opener detection, a federal-résumé-specific tip). **No fetch/XHR call exists in the bundled script** — verified by grepping the built output. Resume text never leaves the browser, is never transmitted, and is never stored.

Shared logic lives in one pure module (`src/lib/resume-match.ts`, no `node:*` imports) so build-time and client-time code paths are identical, not reimplemented twice.

## Rationale
- Considered an LLM-powered version (Claude/OpenAI API): meaningfully better suggestion quality, but introduces a real per-request cost (~$0.006–0.011/use) with no natural rate limit against abuse, before the site has any revenue. Deferred — revisit if the 3-month traffic checkpoint justifies a metered budget.
- The rule-based version is strictly better on two axes that matter more at this stage: **$0 marginal cost** (fits the free-tier-only budget) and **stronger privacy story** (a genuine differentiator: "your resume never leaves your browser" is a real, verifiable claim, not marketing copy — resumes are sensitive documents).
- Federal résumés are known to differ substantially from private-sector ones (month+year dates, hours/week, supervisor contact, longer length, direct keyword screening against the posted qualifications). Surfacing this specifically ties into the site's niche and reinforces the planned Phase E "federal résumé guide" content.

## Known limitations (accepted for MVP)
- Substring matching, no stemming — "manage" won't match "managing." Acceptable false-negative rate for a "consider adding, if applicable" suggestion tool, not a pass/fail screener.
- Extraction quality is lower on contractor postings (no structured Requirements/Qualifications headings in Workday feeds) — frequency fallback is a reasonable but blunter substitute.
- UI copy hedges accordingly ("if applicable," "not a substitute for professional resume review") rather than overclaiming precision.
