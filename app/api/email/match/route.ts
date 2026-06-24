import { type NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/utils/tenant'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'
import type { AppStatus, EmailClassType } from '@prisma/client'

const MatchSchema = z.object({
  threadId: z.string(),
  applicationId: z.string().uuid(),
})

const CLASSIFICATION_TO_STATUS: Partial<Record<EmailClassType, AppStatus>> = {
  INTERVIEW_INVITE: 'HR_ROUND',
  REJECTION:        'REJECTED',
  OFFER:            'OFFER',
}

const STATUS_ORDER: AppStatus[] = [
  'SAVED', 'APPROVAL_PENDING', 'APPLIED', 'HR_ROUND',
  'TECHNICAL_ROUND', 'MANAGER_ROUND', 'OFFER', 'ACCEPTED', 'REJECTED', 'WITHDRAWN',
]

export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = MatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { threadId, applicationId } = parsed.data

  const [thread, application] = await Promise.all([
    prisma.emailThread.findFirst({ where: { id: threadId, userId } }),
    prisma.application.findFirst({ where: { id: applicationId, userId } }),
  ])

  if (!thread) return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
  if (!application) return NextResponse.json({ error: 'Application not found' }, { status: 404 })

  await prisma.emailThread.update({
    where: { id: threadId },
    data: { applicationId },
  })

  // Re-run status update logic for this thread
  const targetStatus = CLASSIFICATION_TO_STATUS[thread.classification]
  if (targetStatus) {
    const currentIdx = STATUS_ORDER.indexOf(application.status)
    const targetIdx = STATUS_ORDER.indexOf(targetStatus)

    if (targetIdx > currentIdx) {
      await prisma.$transaction([
        prisma.application.update({ where: { id: applicationId }, data: { status: targetStatus } }),
        prisma.statusHistory.create({
          data: {
            applicationId,
            userId,
            fromStatus: application.status,
            toStatus: targetStatus,
            triggeredBy: 'EMAIL_DETECTION',
            note: `Manual match: ${thread.subject ?? ''} [${thread.classification}]`,
          },
        }),
      ])
    }
  }

  return NextResponse.json({ matched: true, threadId, applicationId })
}
