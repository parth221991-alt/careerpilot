import type { RawJob, JobProfileConfig } from './types'
import { createLogger } from '@/lib/utils/logger'

const logger = createLogger('scraper-jsearch')

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY

type JSearchJob = {
  job_id: string
  job_title: string
  employer_name: string
  job_city?: string
  job_state?: string
  job_country?: string
  job_is_remote?: boolean
  job_description?: string
  job_apply_link?: string
  job_posted_at_datetime_utc?: string
  job_min_salary?: number
  job_max_salary?: number
  job_salary_currency?: string
  job_employment_type?: string
}

type JSearchResponse = {
  data: JSearchJob[]
}

function buildLocation(j: JSearchJob): string {
  const parts = [j.job_city, j.job_state, j.job_country].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : (j.job_is_remote ? 'Remote' : 'Unknown')
}

export async function fetchJobs(profile: JobProfileConfig): Promise<RawJob[]> {
  if (!RAPIDAPI_KEY) {
    logger.warn('JSearch RapidAPI key not configured — skipping')
    return []
  }

  const allJobs: RawJob[] = []

  for (const role of profile.targetRoles.slice(0, 3)) {
    try {
      const url = new URL('https://jsearch.p.rapidapi.com/search')
      url.searchParams.set('query', `${role} remote`)
      url.searchParams.set('num_pages', '5')
      url.searchParams.set('date_posted', 'week')
      url.searchParams.set('remote_jobs_only', 'true')

      const res = await fetch(url.toString(), {
        headers: {
          'x-rapidapi-key': RAPIDAPI_KEY,
          'x-rapidapi-host': 'jsearch.p.rapidapi.com',
          'User-Agent': 'CareerPilot/1.0',
        },
      })

      if (!res.ok) {
        logger.warn('JSearch non-200', { status: res.status, role })
        continue
      }

      const data: JSearchResponse = await res.json()

      const mapped = data.data.map((j): RawJob => ({
        platformJobId: j.job_id,
        title: j.job_title,
        company: j.employer_name,
        location: buildLocation(j),
        isRemote: j.job_is_remote ?? true,
        remoteType: j.job_is_remote ? 'REMOTE' : 'HYBRID',
        description: j.job_description ?? '',
        url: j.job_apply_link ?? '',
        salaryMin: j.job_min_salary ?? null,
        salaryMax: j.job_max_salary ?? null,
        salaryCurrency: j.job_salary_currency ?? 'USD',
        postedAt: j.job_posted_at_datetime_utc ? new Date(j.job_posted_at_datetime_utc) : null,
        source: 'JSEARCH',
      }))

      allJobs.push(...mapped)
    } catch (err) {
      logger.error('JSearch fetch error', { role, err: String(err) })
    }
  }

  return allJobs
}
