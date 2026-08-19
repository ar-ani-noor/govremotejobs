// Cloudflare Pages Function: serve 410 Gone for expired job pages (ADR-0005).
// Static job pages take precedence automatically; this runs only on misses.
interface Env { ASSETS: { fetch: (req: Request) => Promise<Response> } }

export const onRequest = async (ctx: { request: Request; env: Env; params: { slug?: string[] } }) => {
  const asset = await ctx.env.ASSETS.fetch(ctx.request)
  if (asset.status !== 404) return asset

  const slug = (ctx.params.slug ?? []).join('/')
  try {
    const manifestRes = await ctx.env.ASSETS.fetch(
      new Request(new URL('/expired-slugs.json', ctx.request.url)),
    )
    if (manifestRes.ok) {
      const { slugs } = (await manifestRes.json()) as { slugs: string[] }
      if (slugs.includes(slug)) {
        return new Response(
          `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Job closed — GovRemoteJobs</title></head><body style="font-family:system-ui,sans-serif;max-width:640px;margin:5rem auto;padding:0 1rem;line-height:1.6;"><h1>This job has closed</h1><p>The posting is no longer accepting applications.</p><p>See <a href="/remote">open fully remote jobs</a> or <a href="/telework">telework-eligible jobs</a> — updated daily.</p></body></html>`,
          { status: 410, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
        )
      }
    }
  } catch {
    // fall through to plain 404
  }
  return asset
}
