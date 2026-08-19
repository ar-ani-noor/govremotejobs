// USAJOBS official API adapter. ToS hard rules (CLAUDE.md): linkback on every
// listing, no redistribution as a feed, real email in User-Agent, ~1 req/s.
import type { NormalizedJob, SourceAdapter } from './types.ts'

const API = 'https://data.usajobs.gov/api/search'
const PER_PAGE = 500

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const kebab = (s: string) =>
  s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!)
}

// Assemble a full description from the structured details the API returns.
// Federal announcements are US government works (public domain), so full
// text is legal — and Google's JobPosting guidance wants complete descriptions.
function buildDescription(d: Record<string, unknown>): string {
  const parts: string[] = []
  const section = (title: string, body: unknown) => {
    if (!body) return
    const text = Array.isArray(body) ? body.join('\n') : String(body)
    if (!text.trim()) return
    const paras = text.split(/\n+/).map((p) => `<p>${esc(p.trim())}</p>`).join('')
    parts.push(`<h2>${title}</h2>${paras}`)
  }
  section('Summary', d.JobSummary)
  section('Duties', d.MajorDuties)
  section('Requirements', d.Requirements)
  section('Qualifications', d.QualificationSummary ?? d.Qualifications)
  section('Education', d.Education)
  section('How you will be evaluated', d.Evaluations)
  return parts.join('')
}

function normalize(item: any, policy: 'remote' | 'telework'): NormalizedJob | null {
  const m = item.MatchedObjectDescriptor
  const details = m?.UserArea?.Details ?? {}
  if (!m?.PositionTitle || !item.MatchedObjectId || !m.PositionURI) return null

  const pay = (m.PositionRemuneration ?? [])[0] ?? {}
  const interval =
    pay.RateIntervalCode === 'PA' ? 'YEAR' : pay.RateIntervalCode === 'PH' ? 'HOUR' : null
  const grades: string[] = [m.UserArea?.Details?.LowGrade, m.UserArea?.Details?.HighGrade]
  const cat = (m.JobCategory ?? [])[0] ?? {}

  const description = buildDescription(details)
  if (!description) return null // never publish an empty job page

  return {
    source: 'usajobs',
    source_id: String(item.MatchedObjectId),
    title: String(m.PositionTitle).trim(),
    employer: String(m.OrganizationName ?? 'US Federal Government').trim(),
    employer_type: 'federal',
    department: m.DepartmentName ? String(m.DepartmentName) : null,
    salary_min: pay.MinimumRange ? Number(pay.MinimumRange) : null,
    salary_max: pay.MaximumRange ? Number(pay.MaximumRange) : null,
    salary_interval: interval,
    pay_scale: m.JobGrade?.[0]?.Code ?? null,
    grade_low: grades[0] ?? null,
    grade_high: grades[1] ?? null,
    location_policy: policy,
    // Remote federal jobs are US-wide unless the announcement restricts them;
    // location parsing refinement is a Phase B follow-up.
    applicant_location: 'US',
    summary: details.JobSummary ? String(details.JobSummary).slice(0, 500) : null,
    description_html: description,
    category_code: cat.Code ? String(cat.Code) : null,
    category_name: cat.Name ? String(cat.Name) : null,
    hiring_paths: Array.isArray(details.HiringPath) ? details.HiringPath.map(String) : [],
    employment_type: m.PositionSchedule?.[0]?.Name ?? null,
    posted_at: String(m.PublicationStartDate ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10),
    closes_at: String(m.ApplicationCloseDate ?? '').slice(0, 10) || null,
    apply_url: String(m.PositionURI).replace(/^http:/, 'https:'),
  }
}

async function fetchPass(
  params: Record<string, string>,
  policy: 'remote' | 'telework',
  headers: Record<string, string>,
): Promise<NormalizedJob[]> {
  const out: NormalizedJob[] = []
  let page = 1
  for (;;) {
    const qs = new URLSearchParams({ ...params, ResultsPerPage: String(PER_PAGE), Page: String(page), Fields: 'Full' })
    let res: Response | null = null
    for (let attempt = 1; attempt <= 4; attempt++) {
      res = await fetch(`${API}?${qs}`, { headers })
      if (res.ok) break
      if (res.status === 429 || res.status >= 500) {
        await sleep(2000 * 2 ** attempt)
        continue
      }
      throw new Error(`USAJOBS ${res.status}: ${await res.text()}`)
    }
    if (!res || !res.ok) throw new Error(`USAJOBS failed after retries (last ${res?.status})`)
    const data = await res.json()
    const items = data?.SearchResult?.SearchResultItems ?? []
    for (const item of items) {
      const job = normalize(item, policy)
      if (job) out.push(job)
    }
    const total = Number(data?.SearchResult?.SearchResultCountAll ?? 0)
    if (page * PER_PAGE >= total || items.length === 0) break
    page++
    await sleep(1000) // ~1 req/s etiquette
  }
  return out
}

export function usajobsAdapter(): SourceAdapter {
  const key = process.env.USAJOBS_API_KEY
  const email = process.env.USAJOBS_USER_AGENT_EMAIL
  if (!key || !email) throw new Error('USAJOBS_API_KEY / USAJOBS_USER_AGENT_EMAIL not set')
  const headers = { Host: 'data.usajobs.gov', 'User-Agent': email, 'Authorization-Key': key }

  return {
    source: 'usajobs',
    async fetchAll() {
      const remote = await fetchPass({ RemoteIndicator: 'True' }, 'remote', headers)
      const jobs = new Map(remote.map((j) => [j.source_id, j]))
      // Telework tier is opt-in until the filter param is verified against the
      // live API during Gate 1 (ADR-0004; an unfiltered pass would pull ALL
      // federal jobs, which we must not do).
      if (process.env.INCLUDE_TELEWORK === 'true') {
        const telework = await fetchPass({ TeleworkEligible: 'True' }, 'telework', headers)
        for (const j of telework) if (!jobs.has(j.source_id)) jobs.set(j.source_id, j)
      }
      return [...jobs.values()]
    },
  }
}

export { kebab }
