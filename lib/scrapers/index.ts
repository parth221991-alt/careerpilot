import type { Platform } from '@prisma/client'
import type { RawJob, JobProfileConfig } from './types'
import { createLogger } from '@/lib/utils/logger'
import { prisma } from '@/lib/db/prisma'
import { scoreJobMatch } from '@/lib/claude/agents/DiscoveryAgent'

const logger = createLogger('scraper-orchestrator')

// Concurrency cap for Claude scoring calls (EDGE-004)
const SCORE_CONCURRENCY = 5

async function withConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<unknown>,
): Promise<void> {
  const queue = [...items]
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift()
      if (item !== undefined) await fn(item)
    }
  })
  await Promise.all(workers)
}

function deduplicateByUrl(jobs: RawJob[]): RawJob[] {
  const seen = new Map<string, RawJob>()
  for (const job of jobs) {
    const existing = seen.get(job.platformJobId)
    if (!existing || (job.description?.length ?? 0) > (existing.description?.length ?? 0)) {
      seen.set(job.platformJobId, job)
    }
  }
  return Array.from(seen.values())
}

async function loadScraper(source: Platform): Promise<{ fetchJobs: (p: JobProfileConfig) => Promise<RawJob[]> } | null> {
  try {
    switch (source) {
      case 'REMOTEOK':     return await import('./remoteok')
      case 'REMOTIVE':     return await import('./remotive')
      case 'ARBEITNOW':    return await import('./arbeitnow')
      case 'WEWORKREMOTELY': return await import('./weworkremotely')
      case 'ADZUNA':       return await import('./adzuna')
      case 'JSEARCH':      return await import('./jsearch')
      case 'NAUKRI':       return await import('./naukri')
      default:             return null
    }
  } catch {
    return null
  }
}

export async function runDiscovery(
  profile: JobProfileConfig,
  userId: string,
  jobProfileId: string,
  candidateProfileText: string,
): Promise<number> {
  // Fan out to all preferred sources in parallel
  const results = await Promise.allSettled(
    profile.preferredSources.map(async source => {
      const scraper = await loadScraper(source)
      if (!scraper) {
        logger.warn('No scraper for source', { source })
        return [] as RawJob[]
      }
      logger.info('Running scraper', { source })
      return scraper.fetchJobs(profile)
    })
  )

  const rawJobs: RawJob[] = []
  for (const result of results) {
    if (result.status === 'fulfilled') {
      rawJobs.push(...result.value)
    } else {
      logger.warn('Scraper failed', { reason: result.reason })
    }
  }

  const deduped = deduplicateByUrl(rawJobs)
  logger.info('Discovery deduplication complete', {
    raw: rawJobs.length,
    deduped: deduped.length,
  })

  let storedCount = 0

  // Score and store with concurrency limit
  await withConcurrency(deduped, SCORE_CONCURRENCY, async (job: RawJob) => {
    try {
      const matchOutput = await scoreJobMatch(
        candidateProfileText,
        job.title,
        job.description,
        profile.targetLocations[0] ?? 'India',
      )
      const match = matchOutput.result

      await prisma.job.upsert({
        where: {
          userId_platform_platformJobId: {
            userId,
            platform: job.source,
            platformJobId: job.platformJobId,
          },
        },
        create: {
          userId,
          jobProfileId,
          platform: job.source,
          platformJobId: job.platformJobId,
          url: job.url,
          title: job.title,
          company: job.company,
          location: job.location,
          isRemote: job.isRemote,
          remoteType: job.remoteType,
          description: job.description,
          rawDescription: job.description,
          salaryMin: job.salaryMin ?? null,
          salaryMax: job.salaryMax ?? null,
          salaryCurrency: job.salaryCurrency ?? 'INR',
          postedAt: job.postedAt,
          matchScore: match.score,
          matchReasoning: match.reasoning,
          matchedKeywords: match.matched_skills,
          missingKeywords: match.missing_critical_skills,
          requiredSkills: match.matched_skills,
        },
        update: {
          matchScore: match.score,
          matchReasoning: match.reasoning,
          matchedKeywords: match.matched_skills,
          isActive: true,
        },
      })

      storedCount++
    } catch (err) {
      logger.error('Failed to score/store job', { job: job.platformJobId, err: String(err) })
    }
  })

  logger.info('Discovery run complete', { jobProfileId, stored: storedCount })
  return storedCount
}
