/**
 * Naukri.com scraper — uses their internal JSON API (no browser automation needed).
 * Rate limit: ~1 req/s. The worker applies delays.
 */

import type { ScrapeJob } from '../../lib/redis/queue'
import { createLogger } from '../../lib/utils/logger'

const logger = createLogger('scraper-naukri')

export type RawJob = {
  platformJobId: string
  title: string
  company: string
  location: string | null
  remoteType: 'REMOTE' | 'HYBRID' | 'ONSITE' | 'FLEXIBLE' | null
  jobUrl: string
  rawDescription: string
  salaryMin: number | null
  salaryMax: number | null
  salaryCurrency: string | null
}

type NaukriJobListing = {
  jobId: string
  title: string
  companyName: string
  placeholders?: { label: string; wLabel?: string }[]
  footerPlaceholderLabel?: string
  staticUrl?: string
  jobDescription?: string
  tagsAndSkills?: string
  salary?: string
}

type NaukriSearchResponse = {
  jobDetails?: NaukriJobListing[]
}

const BASE_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://www.naukri.com/jobs',
  appid: '109',
  systemid: 'Naukri',
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

function parseSalary(salaryStr?: string): { min: number | null; max: number | null } {
  if (!salaryStr) return { min: null, max: null }
  // Naukri format: "4-8 Lacs PA" or "Not Disclosed"
  const m = salaryStr.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*Lac/i)
  if (!m) return { min: null, max: null }
  return {
    min: Math.round(parseFloat(m[1]) * 100_000),
    max: Math.round(parseFloat(m[2]) * 100_000),
  }
}

function parseRemote(text: string): RawJob['remoteType'] {
  const t = text.toLowerCase()
  if (t.includes('work from home') || t.includes('remote')) return 'REMOTE'
  if (t.includes('hybrid')) return 'HYBRID'
  return null
}

async function fetchNaukriJobs(
  query: string,
  page: number,
): Promise<NaukriJobListing[]> {
  const url = new URL('https://www.naukri.com/jobapi/v3/search')
  url.searchParams.set('noOfResults', '20')
  url.searchParams.set('urlType', 'search_by_keyword')
  url.searchParams.set('searchType', 'adv')
  url.searchParams.set('keyword', query)
  url.searchParams.set('pageNo', String(page))
  url.searchParams.set('seoKey', query.replace(/\s+/g, '-').toLowerCase())
  url.searchParams.set('src', 'jobsearchDesk')
  url.searchParams.set('latLong', '')

  try {
    const res = await fetch(url.toString(), { headers: BASE_HEADERS })
    if (!res.ok) {
      logger.warn('Naukri API non-200', { status: res.status, query, page })
      return []
    }
    const data: NaukriSearchResponse = await res.json()
    return data.jobDetails ?? []
  } catch (err) {
    logger.warn('Naukri fetch error', { query, page, err: String(err) })
    return []
  }
}

async function fetchJobDescription(jobId: string): Promise<string> {
  try {
    const url = `https://www.naukri.com/jobapi/v4/job/${jobId}`
    const res = await fetch(url, { headers: BASE_HEADERS })
    if (!res.ok) return ''
    const data = await res.json()
    return data.jobDescription ?? data.job_description ?? ''
  } catch {
    return ''
  }
}

export async function scrapeNaukri(job: ScrapeJob): Promise<RawJob[]> {
  const collected: RawJob[] = []
  const perQueryMax = Math.ceil(job.maxJobs / job.queries.length)

  for (const query of job.queries) {
    let page = 1
    const queryJobs: RawJob[] = []

    while (queryJobs.length < perQueryMax && page <= 5) {
      const listings = await fetchNaukriJobs(query, page)
      if (listings.length === 0) break

      for (const listing of listings) {
        if (queryJobs.length >= perQueryMax) break

        const location =
          listing.placeholders?.find(p => p.label === 'location')?.wLabel ?? null
        const salaryStr =
          listing.placeholders?.find(p => p.label === 'salary')?.wLabel
        const { min, max } = parseSalary(salaryStr)

        const description =
          listing.jobDescription ?? (await fetchJobDescription(listing.jobId))

        queryJobs.push({
          platformJobId: listing.jobId,
          title: listing.title,
          company: listing.companyName,
          location,
          remoteType: parseRemote(location ?? listing.footerPlaceholderLabel ?? ''),
          jobUrl: listing.staticUrl
            ? `https://www.naukri.com${listing.staticUrl}`
            : `https://www.naukri.com/job-listings-${listing.jobId}`,
          rawDescription: description || listing.tagsAndSkills || listing.title,
          salaryMin: min,
          salaryMax: max,
          salaryCurrency: 'INR',
        })

        await sleep(400) // polite crawl delay
      }

      page++
      await sleep(1000)
    }

    collected.push(...queryJobs)
    logger.info('Naukri query done', { query, count: queryJobs.length })
    await sleep(2000)
  }

  return Array.from(new Map(collected.map(j => [j.platformJobId, j])).values())
}
