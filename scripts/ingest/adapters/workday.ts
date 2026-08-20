// Workday CXS adapter — the public careers API behind {tenant}.wdN.myworkdayjobs.com.
// No auth required; feeds exist for public display. Every listing links back to
// the company's own posting (ToS hard rule). Remote detection: the list item's
// locationsText/title must say remote; details are fetched only for matches.
import type { NormalizedJob, SourceAdapter } from './types.ts'

export interface WorkdayCompany {
  name: string
  tenant: string
  instance: string
  site: string
}

const PAGE = 20 // CXS max page size
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Title text is unreliable: "Remote Sensing" (imagery/GEOINT work) and
// "Secure Remote Access" (VPN/cybersecurity infra) both contain the word
// "remote" but describe on-site jobs, not remote work. Location fields are
// the only trustworthy signal.
const isRemote = (s: string) => /\bremote\b/i.test(s) && !/hybrid/i.test(s)
// "7 Locations" (a count, not place names) appears for postings valid at
// multiple offices — Workday shows the real names only on the detail page,
// so a stub with this text must still be checked, not skipped.
const isMultiLocationStub = (s: string) => /^\d+\s+Locations?$/i.test(s.trim())

export function workdayAdapter(c: WorkdayCompany): SourceAdapter {
  const base = `https://${c.tenant}.${c.instance}.myworkdayjobs.com`
  const cxs = `${base}/wday/cxs/${c.tenant}/${c.site}`

  return {
    source: `workday:${c.tenant}`,
    async fetchAll() {
      // 1. List everything matching "remote" (server-side text search narrows
      //    the corpus), paginating the CXS jobs endpoint.
      const stubs: { title: string; externalPath: string; locationsText: string; postedOnDate?: string }[] = []
      for (let offset = 0; ; offset += PAGE) {
        const res = await fetch(`${cxs}/jobs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ limit: PAGE, offset, searchText: 'remote', appliedFacets: {} }),
        })
        if (!res.ok) throw new Error(`workday:${c.tenant} list ${res.status}`)
        const data = await res.json()
        const items = data?.jobPostings ?? []
        for (const it of items) {
          if (!it?.externalPath || !it?.title) continue
          stubs.push({
            title: String(it.title),
            externalPath: String(it.externalPath),
            locationsText: String(it.locationsText ?? ''),
            postedOnDate: it.postedOnDate ? String(it.postedOnDate) : undefined,
          })
        }
        const total = Number(data?.total ?? 0)
        if (offset + PAGE >= total || items.length === 0) break
        await sleep(500)
      }

      // 2. Keep only listings whose LOCATION (or title) is actually remote —
      //    the text search also matches descriptions mentioning "remote".
      // Worth a detail fetch: locationsText itself says remote, OR it's a
      // location-count stub we can't evaluate without opening it. Title text
      // is deliberately NOT used as a signal (see isRemote comment above).
      const remoteStubs = stubs.filter(
        (s) => isRemote(s.locationsText) || isMultiLocationStub(s.locationsText),
      )

      // 3. Fetch details for matches only (description, req id, posted date).
      const out: NormalizedJob[] = []
      for (const stub of remoteStubs) {
        try {
          const res = await fetch(`${cxs}${stub.externalPath}`)
          if (!res.ok) continue
          const info = (await res.json())?.jobPostingInfo
          if (!info?.jobDescription) continue
          // Job must still be remote per the detail record when present
          // Check the primary location AND every additional location this
          // requisition is posted against — a multi-location posting only
          // needs ONE of them to be "Remote" to qualify.
          const loc = String(info.location ?? stub.locationsText)
          const additional: string[] = Array.isArray(info.additionalLocations) ? info.additionalLocations : []
          if (!isRemote(loc) && !additional.some(isRemote)) continue

          out.push({
            source: `workday:${c.tenant}`,
            source_id: String(info.jobReqId ?? stub.externalPath),
            title: stub.title.trim(),
            employer: c.name,
            employer_type: 'contractor',
            department: null,
            salary_min: null,
            salary_max: null,
            salary_interval: null,
            pay_scale: null,
            grade_low: null,
            grade_high: null,
            location_policy: 'remote',
            applicant_location: 'US',
            summary: null,
            description_html: String(info.jobDescription),
            category_code: null,
            category_name: null,
            hiring_paths: [],
            employment_type: info.timeType ? String(info.timeType) : null,
            posted_at:
              (info.startDate && String(info.startDate).slice(0, 10)) ||
              new Date().toISOString().slice(0, 10),
            closes_at: info.endDate ? String(info.endDate).slice(0, 10) : null,
            apply_url: `${base}/en-US/${c.site}${stub.externalPath}`,
          })
        } catch {
          // one bad posting must not sink the company's run
        }
        await sleep(350)
      }
      return out
    },
  }
}
