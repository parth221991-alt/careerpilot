import { type NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/utils/tenant'
import { prisma } from '@/lib/db/prisma'
import { draftEmailReply } from '@/lib/claude/agents/EmailAgent'
import { z } from 'zod'
import { formatDistanceToNow } from 'date-fns'

const FollowupSchema = z.object({
  applicationId: z.string().uuid(),
})

export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = FollowupSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const application = await prisma.application.findFirst({
    where: { id: parsed.data.applicationId, userId },
    include: {
      job: { select: { title: true, company: true } },
      emailThreads: { orderBy: { lastEmailAt: 'desc' }, take: 1 },
    },
  })

  if (!application) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const context = `Role: ${application.job.title} at ${application.job.company}. Applied ${
    application.appliedAt
      ? formatDistanceToNow(application.appliedAt, { addSuffix: true })
      : 'recently'
  }. No response received.`

  const draftOutput = await draftEmailReply(
    `Following up on ${application.job.title} application`,
    `I applied to the ${application.job.title} position at ${application.job.company} and wanted to follow up.`,
    'FOLLOW_UP',
    context,
  )

  // Store draft in the most recent email thread if one exists (REQ-015)
  if (application.emailThreads[0]) {
    await prisma.emailThread.update({
      where: { id: application.emailThreads[0].id },
      data: { draftReply: draftOutput.result },
    })
  }

  return NextResponse.json({
    draft: draftOutput.result,
    subject: `Following up: ${application.job.title} at ${application.job.company}`,
    applicationId: application.id,
    threadId: application.emailThreads[0]?.id ?? null,
  })
}
