// Rule-based resume/job matcher — no LLM, no server call (ADR-0008).
// extractKeywords runs at BUILD TIME (Node, via Astro frontmatter).
// analyzeResume runs at CLIENT TIME (browser, resume text never leaves the
// device). Pure functions only — no node:* imports — so this file bundles
// identically in both environments.

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'is', 'are',
  'be', 'as', 'this', 'that', 'will', 'shall', 'may', 'must', 'can', 'should',
  'at', 'by', 'from', 'it', 'we', 'you', 'your', 'our', 'their', 'which', 'who',
  'experience', 'position', 'job', 'work', 'duties', 'responsibilities', 'ability',
  'abilities', 'skills', 'skill', 'knowledge', 'years', 'year', 'including',
  'include', 'includes', 'other', 'all', 'any', 'such', 'these', 'those', 'also',
  'well', 'etc', 'per', 'into', 'not', 'but', 'if', 'than', 'then', 'have', 'has',
  'had', 'been', 'being', 'more', 'most', 'less', 'least', 'some', 'each', 'every',
  'one', 'two', 'three', 'required', 'preferred', 'requirement', 'requirements',
  'qualification', 'qualifications', 'applicant', 'applicants', 'candidate',
  'candidates', 'role', 'duty', 'responsible',
])

const CUE_PATTERN =
  /\b(?:experience (?:with|in)|knowledge of|proficien(?:cy|t) (?:with|in)?|familiar(?:ity)? with|skills? (?:in|with)|background in|certifi(?:cation|ed) (?:in|as)?|ability to)\s+([A-Za-z][\w\s,/&.+#'-]{2,45}?)(?=[.,;:()\n]|$)/gi

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
}

function splitSections(html: string): { heading: string; text: string }[] {
  const parts = html.split(/<h2>(.*?)<\/h2>/i)
  if (parts.length === 1) return [{ heading: 'body', text: stripTags(parts[0]) }]
  const sections: { heading: string; text: string }[] = []
  for (let i = 1; i < parts.length; i += 2) {
    sections.push({ heading: parts[i].toLowerCase(), text: stripTags(parts[i + 1] ?? '') })
  }
  return sections
}

function sectionWeight(heading: string): number {
  if (/requirement/.test(heading)) return 3
  if (/qualif/.test(heading)) return 3
  if (/education/.test(heading)) return 2
  if (/duties|summary/.test(heading)) return 1
  return 1
}

function cleanTerm(s: string): string {
  return s.replace(/\s+/g, ' ').replace(/^[,.\s]+|[,.\s]+$/g, '').trim()
}

function splitList(phrase: string): string[] {
  return phrase.split(/,|\band\b|\bor\b|\/|;/i).map(cleanTerm).filter(Boolean)
}

/** Build-time only: pull candidate skill/tool keywords from a job's description. */
export function extractKeywords(descriptionHtml: string, max = 16): string[] {
  const sections = splitSections(descriptionHtml)
  const scores = new Map<string, number>()

  const bump = (term: string, amount: number) => {
    const key = cleanTerm(term)
    if (key.length < 2 || key.length > 40) return
    const lower = key.toLowerCase()
    if (STOPWORDS.has(lower) || /^\d+$/.test(lower)) return
    scores.set(key, (scores.get(key) ?? 0) + amount)
  }

  for (const { heading, text } of sections) {
    const w = sectionWeight(heading)
    let m: RegExpExecArray | null
    const re = new RegExp(CUE_PATTERN)
    while ((m = re.exec(text))) {
      for (const term of splitList(m[1])) bump(term, w * 3)
    }
    for (const m2 of text.matchAll(/\b[A-Z]{2,6}\b/g)) {
      if (['USA', 'PDF', 'FAQ'].includes(m2[0])) continue
      bump(m2[0], w * 2)
    }
  }

  // Frequency fallback for loosely-formatted postings (mainly contractor
  // feeds with no Requirements/Qualifications headings).
  if (scores.size < 8) {
    const words = stripTags(descriptionHtml)
      .split(/\s+/)
      .map((w) => w.replace(/[^\w-]/g, ''))
      .filter((w) => w.length > 3 && !STOPWORDS.has(w.toLowerCase()))
    const freq = new Map<string, number>()
    for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1)
    for (const [term, count] of freq) if (count >= 2) bump(term, count)
  }

  return [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, max).map(([term]) => term)
}

export interface ResumeAnalysis {
  matched: string[]
  missing: string[]
  score: number // 0-100, or -1 when no keywords were available for this job
  tips: string[]
}

const WEAK_OPENERS = [
  'responsible for', 'helped with', 'worked on', 'duties included',
  'in charge of', 'tasked with', 'assisted with',
]
const STRONG_VERBS = [
  'Led', 'Managed', 'Developed', 'Implemented', 'Coordinated', 'Delivered', 'Reduced', 'Increased',
]

/** Client-time only: compare pasted resume text against a job's keywords. Never sent anywhere. */
export function analyzeResume(resumeText: string, keywords: string[], isFederal: boolean): ResumeAnalysis {
  const lower = resumeText.toLowerCase()
  const matched: string[] = []
  const missing: string[] = []
  for (const k of keywords) (lower.includes(k.toLowerCase()) ? matched : missing).push(k)
  const score = keywords.length ? Math.round((matched.length / keywords.length) * 100) : -1

  const tips: string[] = []
  const words = resumeText.trim().split(/\s+/).filter(Boolean)
  if (words.length > 0 && words.length < 150) {
    tips.push('Your resume looks short. Government and technical roles are usually screened on detail — expand on your duties, tools used, and outcomes.')
  }
  if (words.length > 2200) {
    tips.push('Your resume is quite long. Trim to the experience most relevant to this posting, unless applying to a federal role — see the note below.')
  }
  const lines = resumeText.split(/\n+/).filter((l) => l.trim().length > 10)
  const quantified = lines.filter((l) => /\d/.test(l)).length
  if (lines.length >= 4 && quantified / lines.length < 0.25) {
    tips.push('Add numbers where you can — team size, budget, percentage improvement, volume handled. Quantified achievements stand out to human and automated reviewers alike.')
  }
  const weakHit = WEAK_OPENERS.find((p) => lower.includes(p))
  if (weakHit) {
    tips.push(`Replace phrases like "${weakHit}" with a strong action verb: ${STRONG_VERBS.slice(0, 5).join(', ')}…`)
  }
  if (isFederal) {
    tips.push("Federal résumé tip: include month & year for every position, hours worked per week, and your supervisor's name/contact. Federal résumés are typically longer (2–5 pages) than private-sector ones and are screened directly against the qualifications listed above — matching that language matters more here than for a typical private-sector application.")
  }

  return { matched, missing, score, tips }
}
