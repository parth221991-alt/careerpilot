import type { RawJob, JobProfileConfig } from './types'
import { createLogger } from '@/lib/utils/logger'

const logger = createLogger('scraper-remoteok')

type RemoteOkJob = {
  id?: string
  slug?: string
  position?: string
  company?: string
  location?: string
  description?: string
  url?: string
  apply_url?: string
  tags?: string[]
  salary_min?: number
  salary_max?: number
  date?: string
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

function matchesRoles(tags: string[], targetRoles: string[]): boolean {
  const normalizedTags = tags.map(t => t.toLowerCase())
  return targetRoles.some(role =>
    role.toLowerCase().split(/\s+/).some(word =>
      normalizedTags.some(tag => tag.includes(word))
    )
  )
}

export async function fetchJobs(profile: JobProfileConfig): Promise<RawJob[]> {
  await sleep(10_000) // 1 req/10s rate limit as specified

  try {
    const res = await fetch('https://remoteok.com/api', {
      headers: {
        'User-Agent': 'CareerPilot/1.0 (job discovery; contact: admin@careerpilot.in)',
      },
    })

    if (!res.ok) {
      logger.warn('RemoteOK non-200', { status: res.status })
      return []
    }

    const data: RemoteOkJob[] = await res.json()
    // First element is metadata, skip it
    const jobs = data.slice(1)

    return jobs
      .filter(j => {
        if (!j.id || !j.position || !j.company) return false
        if (profile.targetRoles.length > 0 && j.tags) {
          return matchesRoles(j.tags, profile.targetRoles)
        }
        return true
      })
      .map((j): RawJob => ({
        platformJobId: String(j.id ?? j.slug),
        title: j.position ?? '',
        company: j.company ?? '',
        location: j.location ?? 'Remote',
        isRemote: true,
        remoteType: 'REMOTE',
        description: j.description ?? '',
        url: j.url ?? j.apply_url ?? `https://remoteok.com/l/${j.slug}`,
        salaryMin: j.salary_min ?? null,
        salaryMax: j.salary_max ?? null,
        salaryCurrency: 'USD',
        postedAt: j.date ? new Date(j.date) : null,
        source: 'REMOTEOK',
      }))
  } catch (err) {
    logger.error('RemoteOK fetch error', { err: String(err) })
    return []
  }
}
