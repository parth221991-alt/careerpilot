import { prisma } from '@/lib/db/prisma'
import { createLogger } from '@/lib/utils/logger'

const logger = createLogger('ghosted-detector')

const GHOST_THRESHOLD_DAYS = 14

export async function detectGhostedApplications(userId: string): Promise<number> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - GHOST_THRESHOLD_DAYS)

  const candidates = await prisma.application.findMany({
    where: {
      userId,
      status: 'APPLIED',
      appliedAt: { lt: cutoff },
      ghostedAt: null,
    },
    include: {
      job: { select: { title: true, company: true } },
      emailThreads: { orderBy: { lastEmailAt: 'desc' }, take: 1 },
    },
  })

  if (candidates.length === 0) return 0

  let ghostedCount = 0

  for (const app of candidates) {
    try {
      const updates: { ghostedAt: Date } = { ghostedAt: new Date() }

      await prisma.$transaction([
        prisma.application.update({
          where: { id: app.id },
          data: updates,
        }),
        // Update linked thread classification if exists
        ...(app.emailThreads[0]
          ? [prisma.emailThread.update({
              where: { id: app.emailThreads[0].id },
              data: { classification: 'GHOSTED' },
            })]
          : []),
        prisma.notification.create({
          data: {
            userId,
            type: 'GHOSTED_ALERT',
            title: `No reply from ${app.job.company}`,
            body: `You applied to ${app.job.title} at ${app.job.company} ${GHOST_THRESHOLD_DAYS}+ days ago with no response. Send a follow-up?`,
            extra: { applicationId: app.id, jobTitle: app.job.title, company: app.job.company },
          },
        }),
      ])

      ghostedCount++
      logger.info('Application marked ghosted', { applicationId: app.id, company: app.job.company })
    } catch (err) {
      logger.error('Failed to mark ghosted', { applicationId: app.id, err: String(err) })
    }
  }

  return ghostedCount
}
