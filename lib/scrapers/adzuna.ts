import type { RawJob, JobProfileConfig } from './types'
import { createLogger } from '@/lib/utils/logger'

const logger = createLogger('scraper-adzuna')

const APP_ID = process.env.ADZUNA_APP_ID
const APP_KEY = process.env.ADZUNA_APP_KEY

type AdzunaJob = {
  id: string
  title: string
  company: { display_name: string }
  location: { display_name: string }
  description?: string
  redirect_url: string
  salary_min?: number
  salary_max?: number
  created?: string
  contract_type?: string
  contract_time?: string
}

type AdzunaResponse = {
  results: AdzunaJob[]
}

function isRemoteJob(j: AdzunaJob): boolean {
  const text = `${j.title} ${j.description ?? ''} ${j.location?.display_name ?? ''}`.toLowerCase()
  return text.includes('remote') || text.includes('work from home') || text.includes('wfh')
}

export async function fetchJobs(profile: JobProfileConfig): Promise<RawJob[]> {
  if (!APP_ID || !APP_KEY) {
    logger.warn('Adzuna API credentials not configured — skipping')
    return []
  }

  const allJobs: RawJob[] = []

  for (const role of profile.targetRoles.slice(0, 3)) {
    try {
      const url = new URL('https://api.adzuna.com/v1/api/jobs/in/search/1')
      url.searchParams.set('app_id', APP_ID)
      url.searchParams.set('app_key', APP_KEY)
      url.searchParams.set('what', role)
      url.searchParams.set('where', profile.targetLocations[0] ?? 'India')
      url.searchParams.set('max_days_old', '7')
      url.searchParams.set('results_per_page', '50')
      url.searchParams.set('content-type', 'application/json')

      const res = await fetch(url.toString(), {
        headers: { 'User-Agent': 'CareerPilot/1.0' },
      })

      if (!res.ok) {
        logger.warn('Adzuna non-200', { status: res.status, role })
        continue
      }

      const data: AdzunaResponse = await res.json()

      const mapped = data.results.map((j): RawJob => ({
        platformJobId: j.id,
        title: j.title,
        company: j.company.display_name,
        location: j.location.display_name,
        isRemote: isRemoteJob(j),
        remoteType: isRemoteJob(j) ? 'REMOTE' : 'ONSITE',
        description: j.description ?? '',
        url: j.redirect_url,
        salaryMin: j.salary_min ?? null,
        salaryMax: j.salary_max ?? null,
        salaryCurrency: 'INR',
        postedAt: j.created ? new Date(j.created) : null,
        source: 'ADZUNA',
      }))

      allJobs.push(...mapped)
    } catch (err) {
      logger.error('Adzuna fetch error', { role, err: String(err) })
    }
  }

  return allJobs
}
