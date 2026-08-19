# ADR-0002: Supabase Postgres as the datastore

**Date**: 2026-08-19 · **Status**: Accepted

## Decision
New Supabase free-tier project (separate from Middle Path USA). The Astro build reads it at build time with the anon key; ingestion writes with service_role from GitHub Actions. Runtime traffic never touches the DB.

## Rationale
- Ingestion logic is relational: upsert on (source, source_id), diff by content hash, absence detection, tombstone purge — a few SQL statements.
- Familiar tooling and migration discipline carried over from Middle Path (CLI-only migrations, explicit grants incl. service_role — that gotcha bit twice there).
- Free-tier pause-on-inactivity is neutralized: the daily cron writes an ingest_runs row every day.
- D1/KV would relocate the same logic into app code for no benefit, since there are no runtime reads.

## Escape hatch
Schema is portable to Cloudflare D1 with modest effort if Supabase free-tier terms worsen; nothing at runtime depends on Postgres.
