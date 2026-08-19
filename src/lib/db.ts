// Build-time data access. Runs ONLY during `astro build` — the deployed site
// is static and never queries the database. The anon key is public by design
// (RLS exposes only active + recently-closed jobs); env vars can override.
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.SUPABASE_URL ?? 'https://cvrtvlhdvwqttyzlyhxb.supabase.co'
const anonKey =
  import.meta.env.SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2cnR2bGhkdndxdHR5emx5aHhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxNTM4MjMsImV4cCI6MjEwMjcyOTgyM30.47va7QyIEmmiNHgSdJjeuIP1lgaFf34tMx2Ue4xMtJo'

const supabase = createClient(url, anonKey)

export interface Job {
  slug: string
  title: string
  employer: string
  employer_type: 'federal' | 'contractor' | 'state'
  department: string | null
  salary_min: number | null
  salary_max: number | null
  salary_interval: 'YEAR' | 'HOUR' | null
  grade_low: string | null
  grade_high: string | null
  location_policy: 'remote' | 'telework'
  applicant_location: string
  summary: string | null
  description_html: string
  category_name: string | null
  employment_type: string | null
  posted_at: string
  closes_at: string | null
  apply_url: string
  last_seen_at: string
}

let cache: Job[] | null = null

export async function activeJobs(): Promise<Job[]> {
  if (cache) return cache
  const all: Job[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('jobs')
      .select(
        'slug,title,employer,employer_type,department,salary_min,salary_max,salary_interval,grade_low,grade_high,location_policy,applicant_location,summary,description_html,category_name,employment_type,posted_at,closes_at,apply_url,last_seen_at',
      )
      .eq('status', 'active')
      .order('posted_at', { ascending: false })
      .range(from, from + 999)
    if (error) throw error
    all.push(...((data as Job[]) ?? []))
    if (!data || data.length < 1000) break
  }
  cache = all
  return all
}

export async function recentlyClosedSlugs(): Promise<string[]> {
  const { data, error } = await supabase.from('jobs').select('slug').eq('status', 'closed').limit(5000)
  if (error) throw error
  return (data ?? []).map((r) => r.slug)
}

export const kebab = (s: string) =>
  s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
