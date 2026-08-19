// Daily ingestion orchestrator: fetch → normalize → diff/upsert → expire →
// notify Google → trigger site rebuild. Runs in GitHub Actions (ADR-0003).
import { createClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import { usajobsAdapter, kebab } from './adapters/usajobs.ts'
import { workdayAdapter, type WorkdayCompany } from './adapters/workday.ts'
import { readFileSync } from 'node:fs'
import type { NormalizedJob, SourceAdapter } from './adapters/types.ts'
import { notifyGoogle } from './indexing-api.ts'

const SITE = process.env.SITE_ORIGIN ?? 'https://govremotejobs.com'
const ABSENCE_HOURS = 40 // absent ~2 daily runs → expired (ADR-0005)

const supabase = createClient(
  must('SUPABASE_URL'),
  must('SUPABASE_SERVICE_ROLE_KEY'),
  { auth: { persistSession: false } },
)

function must(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`${name} not set`)
  return v
}

function contentHash(j: NormalizedJob): string {
  const salient = [
    j.title, j.employer, j.department, j.salary_min, j.salary_max, j.salary_interval,
    j.location_policy, j.summary, j.description_html, j.closes_at, j.apply_url,
  ]
  return createHash('sha256').update(JSON.stringify(salient)).digest('hex')
}

async function existingRows(source: string) {
  // Page through everything for this source (supabase caps single reads at 1000)
  const rows: { id: number; source_id: string; slug: string; content_hash: string; status: string }[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('jobs')
      .select('id, source_id, slug, content_hash, status')
      .eq('source', source)
      .range(from, from + 999)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return new Map(rows.map((r) => [r.source_id, r]))
}

async function runSource(adapter: SourceAdapter) {
  const startedAt = new Date().toISOString()
  const stats = { fetched: 0, inserted: 0, updated: 0, closed: 0, errors: 0 }
  const changedSlugs: string[] = []
  const closedSlugs: string[] = []
  let ok = false
  let notes = ''

  try {
    const jobs = await adapter.fetchAll()
    stats.fetched = jobs.length
    const existing = await existingRows(adapter.source)

    const toInsert: any[] = []
    const toUpdate: any[] = []
    const seenIds: number[] = []

    for (const j of jobs) {
      const hash = contentHash(j)
      const prev = existing.get(j.source_id)
      if (!prev) {
        const slug = `${kebab(j.title)}-${kebab(j.employer)}-${j.source_id}`.replace(/--+/g, '-')
        toInsert.push({ ...j, slug, content_hash: hash, status: 'active', last_seen_at: startedAt })
        changedSlugs.push(slug)
      } else {
        seenIds.push(prev.id)
        if (prev.content_hash !== hash || prev.status === 'closed') {
          // A reopened posting (same control number) reactivates its old slug
          toUpdate.push({ id: prev.id, ...j, slug: prev.slug, content_hash: hash, status: 'active', closed_at: null, last_seen_at: startedAt })
          changedSlugs.push(prev.slug)
        }
      }
    }

    for (let i = 0; i < toInsert.length; i += 500) {
      const { error } = await supabase.from('jobs').insert(toInsert.slice(i, i + 500))
      if (error) throw error
    }
    stats.inserted = toInsert.length

    for (const row of toUpdate) {
      const { id, ...fields } = row
      const { error } = await supabase.from('jobs').update(fields).eq('id', id)
      if (error) { stats.errors++; console.error('update failed', row.slug, error.message) }
      else stats.updated++
    }

    // Bump last_seen for unchanged-but-present rows (chunked id lists)
    const unchanged = seenIds.filter((id) => !toUpdate.some((u) => u.id === id))
    for (let i = 0; i < unchanged.length; i += 500) {
      const { error } = await supabase
        .from('jobs')
        .update({ last_seen_at: startedAt })
        .in('id', unchanged.slice(i, i + 500))
      if (error) throw error
    }

    // Expire: close date passed OR absent ~2 runs (ADR-0005)
    const absenceCutoff = new Date(Date.now() - ABSENCE_HOURS * 3600_000).toISOString()
    const today = new Date().toISOString().slice(0, 10)
    const { data: expired, error: expErr } = await supabase
      .from('jobs')
      .update({ status: 'closed', closed_at: new Date().toISOString() })
      .eq('source', adapter.source)
      .eq('status', 'active')
      .or(`closes_at.lt.${today},last_seen_at.lt.${absenceCutoff}`)
      .select('slug')
    if (expErr) throw expErr
    stats.closed = expired?.length ?? 0
    closedSlugs.push(...(expired ?? []).map((r) => r.slug))

    // Purge tombstones older than 90 days (slug becomes plain 404)
    const purgeBefore = new Date(Date.now() - 90 * 86400_000).toISOString()
    await supabase.from('jobs').delete().eq('source', adapter.source).eq('status', 'closed').lt('closed_at', purgeBefore)

    ok = stats.errors === 0
    if (stats.fetched === 0) notes = 'FLAG: zero jobs fetched — source feed may have moved/changed'
  } catch (err: any) {
    stats.errors++
    notes = `FAILED: ${err.message}`
    console.error(`[${adapter.source}]`, err)
  }

  await supabase.from('ingest_runs').insert({
    source: adapter.source, started_at: startedAt, finished_at: new Date().toISOString(), ...stats, ok, notes: notes || null,
  })
  console.log(`[${adapter.source}]`, JSON.stringify({ ...stats, ok, notes }))
  return { changedSlugs, closedSlugs, ok }
}

const registry = JSON.parse(
  readFileSync(new URL('./registry/companies.json', import.meta.url), 'utf8'),
) as { companies: (WorkdayCompany & { ats: string })[] }

const adapters: SourceAdapter[] = [
  usajobsAdapter(),
  ...registry.companies.filter((c) => c.ats === 'workday').map(workdayAdapter),
]

let allOk = true
const allChanged: string[] = []
const allClosed: string[] = []
for (const adapter of adapters) {
  const r = await runSource(adapter)
  allOk &&= r.ok
  allChanged.push(...r.changedSlugs)
  allClosed.push(...r.closedSlugs)
}

const idx = await notifyGoogle(
  allChanged.map((s) => `${SITE}/jobs/${s}`),
  allClosed.map((s) => `${SITE}/jobs/${s}`),
)
console.log('indexing:', JSON.stringify(idx))

if (!process.env.CF_DEPLOY_HOOK_URL) {
  console.log('deploy hook: CF_DEPLOY_HOOK_URL not set — skipping')
} else if (allChanged.length === 0 && allClosed.length === 0) {
  console.log('deploy hook: no changes this run — skipping (secret is set)')
} else {
  const res = await fetch(process.env.CF_DEPLOY_HOOK_URL, { method: 'POST' })
  console.log('deploy hook: called, status', res.status)
}

if (!allOk) process.exit(1)
