import { type NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/utils/tenant'
import { prisma } from '@/lib/db/prisma'
import { enqueueApply } from '@/lib/redis/queue'
import { createLogger } from '@/lib/utils/logger'

const logger = createLogger('approval-gate')

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: applicationId } = await params

  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId },
    include: {
      job: true,
      approvalGates: { where: { status: 'PENDING' }, take: 1 },
      resumeVariant: true,
    },
  })

  if (!application) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const gate = application.approvalGates[0]
  if (!gate) return NextResponse.json({ error: 'No pending approval gate' }, { status: 400 })

  if (gate.expiresAt && gate.expiresAt < new Date()) {
    await prisma.approvalGate.update({ where: { id: gate.id }, data: { status: 'EXPIRED' } })
    return NextResponse.json({ error: 'Approval gate has expired' }, { status: 410 })
  }

  // Update gate and application status
  await prisma.$transaction([
    prisma.approvalGate.update({
      where: { id: gate.id },
      data: { status: 'APPROVED', approvedAt: new Date() },
    }),
    prisma.application.update({
      where: { id: applicationId },
      data: { status: 'APPLIED' },
    }),
    prisma.statusHistory.create({
      data: {
        applicationId,
        userId,
        fromStatus: 'APPROVAL_PENDING',
        toStatus: 'APPLIED',
        triggeredBy: 'USER',
      },
    }),
  ])

  // Enqueue the actual apply action
  if (gate.actionType === 'SUBMIT_APPLICATION' && application.resumeVariant?.pdfPath) {
    await enqueueApply({
      userId,
      applicationId,
      jobUrl: application.job.jobUrl ?? '',
      platform: application.job.platform,
      resumePdfPath: application.resumeVariant.pdfPath,
      applicantData: {},
    })
    logger.info('Apply job enqueued after approval', { userId, applicationId })
  }

  return NextResponse.json({ approved: true })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: applicationId } = await params

  const application = await prisma.application.findFirst({
    where: { id: applicationId, userId },
    include: { approvalGates: { where: { status: 'PENDING' }, take: 1 } },
  })

  if (!application) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const gate = application.approvalGates[0]
  if (!gate) return NextResponse.json({ error: 'No pending gate' }, { status: 400 })

  await prisma.$transaction([
    prisma.approvalGate.update({
      where: { id: gate.id },
      data: { status: 'REJECTED', rejectedAt: new Date() },
    }),
    prisma.application.update({
      where: { id: applicationId },
      data: { status: 'WITHDRAWN' },
    }),
  ])

  return NextResponse.json({ rejected: true })
}
