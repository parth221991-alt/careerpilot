import { type NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/utils/tenant'
import { enqueueDiscover, enqueueScrape } from '@/lib/redis/queue'
import { createLogger } from '@/lib/utils/logger'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

const logger = createLogger('job-discover')

const DiscoverSchema = z.object({
  profileId: z.string().uuid().optional(),
  // Legacy fields (kept for backward compat)
  platform: z.enum(['LINKEDIN', 'NAUKRI', 'INDEED', 'WELLFOUND']).optional(),
  queries: z.array(z.string().min(1)).max(5).optional(),
  maxJobs: z.number().min(10).max(100).default(50),
  lookbackDays: z.number().min(1).max(30).default(7),
})

export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = DiscoverSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { profileId, platform, queries, maxJobs, lookbackDays } = parsed.data

  // New profile-based discovery path
  if (profileId) {
    const profile = await prisma.jobProfile.findFirst({
      where: { id: profileId, userId, isActive: true },
      select: { targetRoles: true, targetLocations: true, salaryMin: true, salaryMax: true, currency: true, preferredSources: true },
    })

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    const careerProfile = await prisma.careerProfile.findUnique({
      where: { userId },
      select: { rawResumeText: true, headline: true, summary: true },
    })

    const candidateProfileText = careerProfile?.rawResumeText ??
      `${careerProfile?.headline ?? ''} ${careerProfile?.summary ?? ''}`.trim()

    const job = await enqueueDiscover({ userId, jobProfileId: profileId, candidateProfileText })

    logger.info('Profile-based discover enqueued', { userId, profileId, jobId: job.id })
    return NextResponse.json({ jobId: job.id, queued: true, profileId })
  }

  // Legacy scrape path
  if (!platform || !queries) {
    return NextResponse.json({ error: 'Provide profileId or platform+queries' }, { status: 400 })
  }

  const job = await enqueueScrape({ userId, platform, queries, maxJobs, lookbackDays })
  return NextResponse.json({ jobId: job.id, queued: true })
}
