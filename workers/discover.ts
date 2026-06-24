/**
 * BullMQ worker for profile-based job discovery.
 * Start with: npx tsx workers/discover.ts
 */

import { Worker, type Job as BullJob } from 'bullmq'
import { prisma } from '../lib/db/prisma'
import { createLogger } from '../lib/utils/logger'
import { runDiscovery } from '../lib/scrapers/index'
import type { DiscoverJob } from '../lib/redis/queue'

const logger = createLogger('discover-worker')

const worker = new Worker<DiscoverJob>(
  'discover',
  async (job: BullJob<DiscoverJob>) => {
    const { userId, jobProfileId, candidateProfileText } = job.data
    logger.info('Discovery started', { userId, jobProfileId })

    const profile = await prisma.jobProfile.findFirst({
      where: { id: jobProfileId, userId, isActive: true },
    })

    if (!profile) {
      logger.warn('Profile not found or inactive', { jobProfileId })
      return
    }

    const profileConfig = {
      id: profile.id,
      userId,
      targetRoles: profile.targetRoles,
      targetLocations: profile.targetLocations,
      salaryMin: profile.salaryMin,
      salaryMax: profile.salaryMax,
      currency: profile.currency,
      preferredSources: profile.preferredSources,
    }

    const count = await runDiscovery(profileConfig, userId, jobProfileId, candidateProfileText)
    logger.info('Discovery complete', { userId, jobProfileId, jobsFound: count })
  },
  {
    connection: { host: 'localhost', port: 6379 },
    concurrency: 3,
  }
)

worker.on('failed', (job, err) => {
  logger.error('Discovery job failed', { jobId: job?.id, err: err.message })
})

logger.info('Discover worker started')
