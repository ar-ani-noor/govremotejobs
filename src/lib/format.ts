export function salaryText(min: number | null, max: number | null, interval: string | null): string | null {
  if (!min && !max) return null
  const fmt = (n: number) => '$' + Math.round(n).toLocaleString('en-US')
  const range = min && max && min !== max ? `${fmt(min)}–${fmt(max)}` : fmt((min ?? max)!)
  return interval === 'HOUR' ? `${range}/hour` : `${range}/year`
}

export function dateText(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
  })
}

export const tierLabel = (p: string) => (p === 'remote' ? 'Fully remote' : 'Telework eligible')
export const typeLabel = (t: string) =>
  t === 'federal' ? 'Federal' : t === 'contractor' ? 'Contractor' : t === 'state' ? 'State' : t
export const applyLabel = (t: string) => (t === 'federal' ? 'Apply on USAJOBS' : 'Apply on the employer site')
export const sourceLabel = (t: string, employer: string) => (t === 'federal' ? 'USAJOBS' : employer)
