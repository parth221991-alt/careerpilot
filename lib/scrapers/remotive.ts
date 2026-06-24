import type { RawJob, JobProfileConfig } from './types'
import { createLogger } from '@/lib/utils/logger'

const logger = createLogger('scraper-remotive')

type RemotiveJob = {
  id: number
  url: string
  title: string
  company_name: string
  company_logo?: string
  category?: string
  tags?: string[]
  job_type?: string
  publication_date?: string
  candidate_required_location?: string
  salary?: string
  description?: string
}

type RemotiveResponse = {
  jobs: RemotiveJob[]
}

const CATEGORY_MAP: Record<string, string> = {
  'data analyst': 'data',
  'data scientist': 'data',
  'machine learning': 'data',
  'ml engineer': 'data',
  'data engineer': 'data',
  'software engineer': 'software-dev',
  'frontend': 'software-dev',
  'backend': 'software-dev',
  'full stack': 'software-dev',
  'product manager': 'product',
  'devops': 'devops-sysadmin',
  'qa': 'testing',
  'ux': 'design',
  'designer': 'design',
}

function inferCategory(roles: string[]): string {
  for (const role of roles) {
    for (const [key, cat] of Object.entries(CATEGORY_MAP)) {
      if (role.toLowerCase().includes(key)) return cat
    }
  }
  return 'software-dev'
}

export async function fetchJobs(profile: JobProfileConfig): Promise<RawJob[]> {
  const category = inferCategory(profile.targetRoles)

  try {
    const url = new URL('https://remotive.com/api/remote-jobs')
    url.searchParams.set('category', category)
    url.searchParams.set('limit', '100')

    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'CareerPilot/1.0' },
    })

    if (!res.ok) {
      logger.warn('Remotive non-200', { status: res.status })
      return []
    }

    const data: RemotiveResponse = await res.json()

    return data.jobs.map((j): RawJob => ({
      platformJobId: String(j.id),
      title: j.title,
      company: j.company_name,
      location: j.candidate_required_location ?? 'Worldwide',
      isRemote: true,
      remoteType: 'REMOTE',
      description: j.description ?? '',
      url: j.url,
      salaryMin: null,
      salaryMax: null,
      postedAt: j.publication_date ? new Date(j.publication_date) : null,
      source: 'REMOTIVE',
    }))
  } catch (err) {
    logger.error('Remotive fetch error', { err: String(err) })
    return []
  }
}
