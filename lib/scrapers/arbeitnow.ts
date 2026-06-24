import type { RawJob, JobProfileConfig } from './types'
import { createLogger } from '@/lib/utils/logger'

const logger = createLogger('scraper-arbeitnow')

type ArbeitnowJob = {
  slug: string
  company_name: string
  title: string
  description?: string
  remote: boolean
  url: string
  tags?: string[]
  job_types?: string[]
  location?: string
  created_at?: number
}

type ArbeitnowResponse = {
  data: ArbeitnowJob[]
}

export async function fetchJobs(profile: JobProfileConfig): Promise<RawJob[]> {
  try {
    const url = new URL('https://www.arbeitnow.com/api/job-board-api')
    url.searchParams.set('remote', 'true')

    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'CareerPilot/1.0' },
    })

    if (!res.ok) {
      logger.warn('Arbeitnow non-200', { status: res.status })
      return []
    }

    const data: ArbeitnowResponse = await res.json()

    const targetRolesLower = profile.targetRoles.map(r => r.toLowerCase())

    return data.data
      .filter(j => {
        if (!j.remote) return false
        if (targetRolesLower.length === 0) return true
        const titleLower = j.title.toLowerCase()
        return targetRolesLower.some(role =>
          role.split(/\s+/).some(word => titleLower.includes(word))
        )
      })
      .map((j): RawJob => ({
        platformJobId: j.slug,
        title: j.title,
        company: j.company_name,
        location: j.location ?? 'Remote',
        isRemote: true,
        remoteType: 'REMOTE',
        description: j.description ?? '',
        url: j.url,
        salaryMin: null,
        salaryMax: null,
        postedAt: j.created_at ? new Date(j.created_at * 1000) : null,
        source: 'ARBEITNOW',
      }))
  } catch (err) {
    logger.error('Arbeitnow fetch error', { err: String(err) })
    return []
  }
}
