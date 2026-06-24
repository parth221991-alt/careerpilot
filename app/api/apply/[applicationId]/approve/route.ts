import { type NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/utils/tenant'
import { prisma } from '@/lib/db/prisma'
import { enqueueApply } from '@/lib/redis/queue'
import { createLogger } from '@/lib/utils/logger'

const logger = createLogger('apply-approve')

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ applicationId: string }> }
) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { applicationId } = await params

  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId },
    include: {
      job: { select: { url: true, platform: true } },
      approvalGates: {
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })

  if (!application) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const gate = application.approvalGates[0]
  if (!gate) return NextResponse.json({ error: 'No pending approval gate' }, { status: 400 })

  // Check gate not expired
  if (gate.expiresAt < new Date()) {
    await prisma.approvalGate.update({ where: { id: gate.id }, data: { status: 'EXPIRED' } })
    return NextResponse.json({ error: 'Approval gate expired' }, { status: 400 })
  }

  await prisma.approvalGate.update({
    where: { id: gate.id },
    data: { status: 'APPROVED', approvedAt: new Date() },
  })

  const payload = gate.actionPayload as Record<string, string>

  await enqueueApply({
    userId,
    applicationId,
    jobUrl: application.job.url,
    platform: application.job.platform,
    resumePdfPath: '',
    applicantData: payload,
  })

  logger.info('Apply approved and queued', { userId, applicationId })
  return NextResponse.json({ approved: true, queued: true })
}
