// Post-build step: sitemaps (jobs chunked ≤2000 with real lastmod, hubs) and
// expired-slugs.json for the 410 Pages Function. Runs after `astro build`.
import { createClient } from '@supabase/supabase-js'
import { writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const SITE = 'https://govremotejobs.com'
const DIST = new URL('../dist', import.meta.url).pathname

const supabase = createClient(
  process.env.SUPABASE_URL ?? 'https://cvrtvlhdvwqttyzlyhxb.supabase.co',
  process.env.SUPABASE_ANON_KEY ??
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2cnR2bGhkdndxdHR5emx5aHhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxNTM4MjMsImV4cCI6MjEwMjcyOTgyM30.47va7QyIEmmiNHgSdJjeuIP1lgaFf34tMx2Ue4xMtJo',
)

const active = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await supabase
    .from('jobs').select('slug,last_seen_at').eq('status', 'active').range(from, from + 999)
  if (error) throw error
  active.push(...(data ?? []))
  if (!data || data.length < 1000) break
}
const { data: closed, error: cErr } = await supabase
  .from('jobs').select('slug').eq('status', 'closed').limit(5000)
if (cErr) throw cErr

// expired-slugs.json → consumed by functions/jobs/[[slug]].ts (410 handler)
writeFileSync(join(DIST, 'expired-slugs.json'),
  JSON.stringify({ slugs: (closed ?? []).map((r) => r.slug) }))

const xmlUrl = (loc, lastmod) =>
  `<url><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod.slice(0, 10)}</lastmod>` : ''}</url>`
const wrap = (urls) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`

// Jobs sitemaps, chunked
const CHUNK = 2000
const jobFiles = []
for (let i = 0; i < active.length; i += CHUNK) {
  const name = `sitemap-jobs-${jobFiles.length + 1}.xml`
  writeFileSync(join(DIST, name),
    wrap(active.slice(i, i + CHUNK).map((j) => xmlUrl(`${SITE}/jobs/${j.slug}`, j.last_seen_at))))
  jobFiles.push(name)
}

// Hub sitemap from what astro actually emitted
const hubUrls = [`${SITE}/`, `${SITE}/remote`, `${SITE}/telework`, `${SITE}/agencies`, `${SITE}/companies`, `${SITE}/categories`, `${SITE}/guides`, `${SITE}/about`, `${SITE}/contact`, `${SITE}/privacy`, `${SITE}/terms`]
for (const dir of ['agency', 'company', 'category', 'guides']) {
  const base = join(DIST, dir)
  if (existsSync(base)) {
    for (const d of readdirSync(base)) hubUrls.push(`${SITE}/${dir}/${d.replace(/\.html$/, '')}`)
  }
}
writeFileSync(join(DIST, 'sitemap-hubs.xml'), wrap(hubUrls.map((u) => xmlUrl(u))))

const files = [...jobFiles, 'sitemap-hubs.xml']
writeFileSync(join(DIST, 'sitemap-index.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${files
    .map((f) => `<sitemap><loc>${SITE}/${f}</loc></sitemap>`).join('')}</sitemapindex>`)

console.log(`manifests: ${active.length} jobs in ${jobFiles.length} sitemap(s), ${(closed ?? []).length} expired slugs, ${hubUrls.length} hub urls`)
