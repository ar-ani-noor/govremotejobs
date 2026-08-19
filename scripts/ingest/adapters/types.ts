// Shared shape every source adapter must produce. Matches the jobs table.
export interface NormalizedJob {
  source: string
  source_id: string
  title: string
  employer: string
  employer_type: 'federal' | 'contractor' | 'state'
  department: string | null
  salary_min: number | null
  salary_max: number | null
  salary_interval: 'YEAR' | 'HOUR' | null
  pay_scale: string | null
  grade_low: string | null
  grade_high: string | null
  location_policy: 'remote' | 'telework'
  applicant_location: string
  summary: string | null
  description_html: string
  category_code: string | null
  category_name: string | null
  hiring_paths: string[]
  employment_type: string | null
  posted_at: string   // YYYY-MM-DD
  closes_at: string | null
  apply_url: string
}

export interface SourceAdapter {
  source: string
  fetchAll(): Promise<NormalizedJob[]>
}
