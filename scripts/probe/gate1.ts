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

// Sample 500 postings and measure the telework-eligible fraction empirically
const qs = new URLSearchParams({ ResultsPerPage: '500', Page: '1', Fields: 'Full' })
const res = await fetch(`https://data.usajobs.gov/api/search?${qs}`, { headers })
if (res.ok) {
  const data = await res.json()
  const items = data?.SearchResult?.SearchResultItems ?? []
  let telework = 0, remote = 0
  for (const it of items) {
    const d = it?.MatchedObjectDescriptor?.UserArea?.Details ?? {}
    if (String(d.TeleworkEligible) === 'true' || d.TeleworkEligible === true) telework++
    if (String(d.RemoteIndicator) === 'true' || d.RemoteIndicator === true) remote++
  }
  console.log(`SAMPLE of ${items.length}: telework-eligible=${telework} remote=${remote}`)
}
