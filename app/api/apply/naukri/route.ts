import { type NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/utils/tenant'
import { prisma } from '@/lib/db/prisma'
import { enqueueApply } from '@/lib/redis/queue'
import { createLogger } from '@/lib/utils/logger'
import { z } from 'zod'
import { selectBestResume } from '@/lib/claude/agents/ResumeSelectAgent'

const logger = createLogger('apply-naukri')

const NaukriApplySchema = z.object({
  jobId: z.string().uuid(),
  profileId: z.string().uuid(),
})

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = NaukriApplySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { jobId, profileId } = parsed.data

  const [job, profile] = await Promise.all([
    prisma.job.findFirst({
      where: { id: jobId, userId },
      select: { url: true, description: true, rawDescription: true, platform: true },
    }),
    prisma.jobProfile.findFirst({
      where: { id: profileId, userId, isActive: true },
      select: { autoApplyEnabled: true, autoApplyPlatforms: true, dailyApplyLimit: true },
    }),
  ])

  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  // Select best resume
  const jd = job.description ?? job.rawDescription ?? ''
  let baseResumeId: string
  try {
    const selection = await selectBestResume(userId, jd, profileId)
    baseResumeId = selection.result.baseResumeId
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 422 })
  }

  // Create or update application
  const existingApp = await prisma.application.findFirst({ where: { userId, jobId } })
  let applicationId: string

  if (existingApp) {
    applicationId = existingApp.id
  } else {
    const newApp = await prisma.application.create({
      data: { userId, jobId, status: 'APPROVAL_PENDING' },
    })
    applicationId = newApp.id
  }

  // Determine gate status based on profile auto-apply setting
  const isNaukriAutoApply = profile.autoApplyEnabled &&
    profile.autoApplyPlatforms.includes('NAUKRI')

  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + 48)

  const gate = await prisma.approvalGate.create({
    data: {
      userId,
      applicationId,
      actionType: 'SUBMIT_APPLICATION',
      actionPayload: { jobId, jobUrl: job.url, baseResumeId, profileId },
      status: isNaukriAutoApply ? 'APPROVED' : 'PENDING',
      expiresAt,
      ...(isNaukriAutoApply ? { approvedAt: new Date() } : {}),
    },
  })

  if (isNaukriAutoApply) {
    await enqueueApply({
      userId,
      applicationId,
      jobUrl: job.url,
      platform: 'NAUKRI',
      resumePdfPath: '',
      applicantData: { baseResumeId },
    })

    logger.info('Naukri auto-apply queued', { userId, applicationId })
    return NextResponse.json({ status: 'queued', gateId: gate.id })
  }

  logger.info('Naukri apply pending approval', { userId, applicationId })
  return NextResponse.json({ status: 'pending_approval', gateId: gate.id, applicationId })
}
