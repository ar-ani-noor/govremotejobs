// Google for Jobs JobPosting structured data (the whole SEO ballgame).
// jobLocationType TELECOMMUTE + applicantLocationRequirements replace
// jobLocation for remote roles. directApply is deliberately omitted:
// applying happens on the origin site.
import type { Job } from './db.ts'

const EMPLOYMENT_MAP: Record<string, string> = {
  'full-time': 'FULL_TIME', 'part-time': 'PART_TIME', 'multiple schedules': 'OTHER',
  intermittent: 'OTHER', seasonal: 'OTHER',
}

export function jobPostingJsonLd(job: Job, site: string): string {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org/',
    '@type': 'JobPosting',
    title: job.title,
    description: job.description_html,
    datePosted: job.posted_at,
    hiringOrganization: { '@type': 'Organization', name: job.employer },
    jobLocationType: 'TELECOMMUTE',
    applicantLocationRequirements: { '@type': 'Country', name: 'USA' },
    identifier: { '@type': 'PropertyValue', name: job.employer, value: job.slug },
    url: `${site}/jobs/${job.slug}`,
  }
  if (job.closes_at) data.validThrough = `${job.closes_at}T23:59:59Z`
  const emp = EMPLOYMENT_MAP[(job.employment_type ?? '').toLowerCase()]
  if (emp) data.employmentType = emp
  if (job.salary_min || job.salary_max) {
    data.baseSalary = {
      '@type': 'MonetaryAmount', currency: 'USD',
      value: {
        '@type': 'QuantitativeValue',
        minValue: job.salary_min ?? undefined, maxValue: job.salary_max ?? undefined,
        unitText: job.salary_interval ?? 'YEAR',
      },
    }
  }
  return JSON.stringify(data)
}
