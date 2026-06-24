import { type NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/utils/tenant'
import { prisma } from '@/lib/db/prisma'
import { redis } from '@/lib/redis/client'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { applicationId } = await params

  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId },
    include: {
      approvalGates: { orderBy: { createdAt: 'desc' }, take: 1 },
      job: { select: { jobProfileId: true } },
    },
  })

  if (!application) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const gate = application.approvalGates[0]

  const screenshotUrl = application.screenshotPath ?? null

  // REQ-020: daily quota indicator from Redis + profile limit
  const today = new Date().toISOString().slice(0, 10)
  const dailyKey = `naukri:daily:${userId}:${today}`
  const dailyCountRaw = await redis.get(dailyKey).catch(() => null)
  const dailyCount = Number(dailyCountRaw ?? 0)

  let dailyLimit = 10
  if (application.job.jobProfileId) {
    const profile = await prisma.jobProfile.findUnique({
      where: { id: application.job.jobProfileId },
      select: { dailyApplyLimit: true },
    })
    dailyLimit = profile?.dailyApplyLimit ?? 10
  }

  return NextResponse.json({
    status: application.status,
    isAutoApplied: application.isAutoApplied,
    gateStatus: gate?.status ?? null,
    gateExpiresAt: gate?.expiresAt ?? null,
    screenshotUrl,
    appliedAt: application.appliedAt,
    dailyCount,
    dailyLimit,
    workerStatus: application.status === 'APPLIED' ? 'complete' : gate?.status === 'APPROVED' ? 'queued' : null,
  })
}
