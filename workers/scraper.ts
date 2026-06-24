/**
 * BullMQ worker — runs as a separate Node.js process (not in Next.js request threads)
 * Start with: npx tsx workers/scraper.ts
 */

import { Worker, type Job as BullJob } from 'bullmq'
import { prisma } from '../lib/db/prisma'
import { scoreJobMatch, parseJobDescription } from '../lib/claude/agents/DiscoveryAgent'
import { isJobSeen, markJobSeen } from '../lib/redis/queue'
import { upsertPoints } from '../lib/qdrant/search'
import { embedBatch } from '../lib/embedding/voyage'
import { createLogger } from '../lib/utils/logger'
import type { ScrapeJob } from '../lib/redis/queue'

const logger = createLogger('scraper-worker')

const PLATFORM_SCRAPERS: Record<string, (job: ScrapeJob) => Promise<RawJob[]>> = {
  LINKEDIN: scrapeLinkedin,
  NAUKRI: scrapeNaukri,
  INDEED: scrapeIndeed,
  WELLFOUND: scrapeWellfound,
}

type RawJob = {
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

const worker = new Worker<ScrapeJob>(
  'scraper',
  async (job: BullJob<ScrapeJob>) => {
    const { userId, platform, queries, maxJobs } = job.data
    logger.info('Scrape job started', { userId, platform, queries })

    const scraper = PLATFORM_SCRAPERS[platform]
    if (!scraper) throw new Error(`No scraper for platform ${platform}`)

    const rawJobs = await scraper(job.data)
    logger.info('Scraper returned jobs', { count: rawJobs.length, platform })

    // Dedup and persist
    const newJobs: RawJob[] = []
    for (const raw of rawJobs.slice(0, maxJobs)) {
      if (await isJobSeen(userId, raw.platformJobId)) continue
      await markJobSeen(userId, raw.platformJobId)
      newJobs.push(raw)
    }

    if (newJobs.length === 0) {
      logger.info('No new jobs after dedup', { userId, platform })
      return
    }

    // Get user vault context for scoring
    const profile = await prisma.careerProfile.findUnique({
      where: { userId },
      select: { headline: true, summary: true, rawResumeText: true },
    })
    const vaultContext = profile?.rawResumeText?.slice(0, 4000) ?? ''

    // Score and persist in batches
    const BATCH = 5
    for (let i = 0; i < newJobs.length; i += BATCH) {
      const batch = newJobs.slice(i, i + BATCH)

      const scored = await Promise.all(
        batch.map(async raw => {
          try {
            const parsedOutput = await parseJobDescription(raw.rawDescription)
            const matchOutput = await scoreJobMatch(
              vaultContext,
              raw.title,
              raw.rawDescription,
              raw.location ?? 'India',
            )
            return { raw, parsed: parsedOutput.result, matchResult: matchOutput.result }
          } catch {
            return { raw, parsed: null, matchResult: null }
          }
        })
      )

      // Upsert to PostgreSQL
      const created = await Promise.all(
        scored.map(({ raw, parsed, matchResult }) =>
          prisma.job.upsert({
            where: {
              userId_platform_platformJobId: {
                userId,
                platform: platform as 'LINKEDIN',
                platformJobId: raw.platformJobId,
              },
            },
            create: {
              userId,
              platform: platform as 'LINKEDIN',
              platformJobId: raw.platformJobId,
              url: raw.jobUrl,
              jobUrl: raw.jobUrl,
              title: raw.title,
              company: raw.company,
              location: raw.location,
              remoteType: raw.remoteType,
              rawDescription: raw.rawDescription,
              salaryMin: raw.salaryMin,
              salaryMax: raw.salaryMax,
              salaryCurrency: raw.salaryCurrency ?? 'INR',
              matchScore: matchResult?.score ?? null,
              matchReasoning: matchResult?.reasoning ?? null,
              requiredSkills: parsed?.required_skills ?? [],
              preferredSkills: parsed?.preferred_skills ?? [],
              discoveredAt: new Date(),
              isActive: true,
            },
            update: {
              matchScore: matchResult?.score ?? undefined,
              matchReasoning: matchResult?.reasoning ?? undefined,
              isActive: true,
            },
          })
        )
      )

      // Embed and store in Qdrant for semantic search
      const texts = created.map(j => `${j.title} at ${j.company}\n${j.rawDescription?.slice(0, 1000) ?? ''}`)
      const vectors = await embedBatch(texts)

      await upsertPoints('jobs', created.map((j, idx) => ({
        id: j.id,
        vector: vectors[idx],
        payload: { userId, jobId: j.id, title: j.title, company: j.company, platform },
      })))

      logger.info('Batch persisted', { batch: i / BATCH + 1, count: created.length })
    }

    logger.info('Scrape job complete', { userId, platform, newJobs: newJobs.length })
  },
  {
    connection: { host: 'localhost', port: 6379 },
    concurrency: 2,
  }
)

worker.on('failed', (job, err) => {
  logger.error('Scrape job failed', { jobId: job?.id, err: err.message })
})

logger.info('Scraper worker started')

// ── Platform scraper implementations ──────────────────────────────────────────

async function scrapeLinkedin(job: ScrapeJob): Promise<RawJob[]> {
  const { scrapeLinkedin: run } = await import('./scrapers/linkedin')
  return run(job)
}

async function scrapeNaukri(job: ScrapeJob): Promise<RawJob[]> {
  const { scrapeNaukri: run } = await import('./scrapers/naukri')
  return run(job)
}

async function scrapeIndeed(job: ScrapeJob): Promise<RawJob[]> {
  logger.warn('Indeed scraper not yet implemented', { queries: job.queries })
  return []
}

async function scrapeWellfound(job: ScrapeJob): Promise<RawJob[]> {
  logger.warn('Wellfound scraper not yet implemented', { queries: job.queries })
  return []
}
