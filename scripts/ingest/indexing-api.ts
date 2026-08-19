// Google Indexing API — officially scoped to JobPosting pages, which is
// exactly what we publish. No-ops gracefully until GOOGLE_INDEXING_SA_JSON
// is configured (Phase C).
import { JWT } from 'google-auth-library'

const ENDPOINT = 'https://indexing.googleapis.com/v3/urlNotifications:publish'
const DAILY_QUOTA = 190 // default quota is 200/day; keep headroom

export async function notifyGoogle(
  updated: string[],
  deleted: string[],
): Promise<{ sent: number; skipped: number }> {
  const raw = process.env.GOOGLE_INDEXING_SA_JSON
  if (!raw) {
    console.log('indexing-api: GOOGLE_INDEXING_SA_JSON not set — skipping (wire in Phase C)')
    return { sent: 0, skipped: updated.length + deleted.length }
  }
  const creds = JSON.parse(raw)
  const client = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/indexing'],
  })

  // Deletions first (getting stale pages out matters more than getting new
  // ones in), newest-first updates fill the remaining quota.
  const batch = [
    ...deleted.map((url) => ({ url, type: 'URL_DELETED' as const })),
    ...updated.map((url) => ({ url, type: 'URL_UPDATED' as const })),
  ].slice(0, DAILY_QUOTA)

  let sent = 0
  for (const item of batch) {
    try {
      const res = await client.request({
        url: ENDPOINT,
        method: 'POST',
        data: { url: item.url, type: item.type },
      })
      if (res.status === 200) sent++
    } catch (err: any) {
      console.error(`indexing-api: ${item.type} ${item.url} failed:`, err?.response?.status ?? err?.message)
      if (err?.response?.status === 429) break // quota exhausted; rest rolls to tomorrow
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  return { sent, skipped: updated.length + deleted.length - sent }
}
