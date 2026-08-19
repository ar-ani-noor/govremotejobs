// Gate 1 probe: how big is each inventory tier? Prints counts only.
const key = process.env.USAJOBS_API_KEY!
const email = process.env.USAJOBS_USER_AGENT_EMAIL!
const headers = { Host: 'data.usajobs.gov', 'User-Agent': email, 'Authorization-Key': key }

async function count(label: string, params: Record<string, string>) {
  const qs = new URLSearchParams({ ...params, ResultsPerPage: '25' })
  const res = await fetch(`https://data.usajobs.gov/api/search?${qs}`, { headers })
  if (!res.ok) { console.log(`${label}: HTTP ${res.status}`); return }
  const data = await res.json()
  console.log(`${label}: ${data?.SearchResult?.SearchResultCountAll ?? '?'}`)
  await new Promise((r) => setTimeout(r, 1200))
}

await count('ALL federal postings          ', {})
await count('RemoteIndicator=True          ', { RemoteIndicator: 'True' })
await count('TeleworkEligible=True (param?)', { TeleworkEligible: 'True' })
