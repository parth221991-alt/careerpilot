import { type NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/utils/tenant'
import { prisma } from '@/lib/db/prisma'
import { getValidAccessToken, fetchGmailThreads, fetchGmailThread } from '@/lib/gmail/client'
import { classifyEmail } from '@/lib/claude/agents/EmailAgent'
import { createLogger } from '@/lib/utils/logger'
import type { AppStatus, EmailClassType } from '@prisma/client'

const logger = createLogger('email-sync')

export const maxDuration = 60

// FSM status ordering — higher index = more advanced (REQ-012: never regress)
const STATUS_ORDER: AppStatus[] = [
  'SAVED', 'APPROVAL_PENDING', 'APPLIED', 'HR_ROUND',
  'TECHNICAL_ROUND', 'MANAGER_ROUND', 'OFFER', 'ACCEPTED', 'REJECTED', 'WITHDRAWN',
]

function statusIndex(s: AppStatus): number {
  return STATUS_ORDER.indexOf(s)
}

// Email classification → target FSM status (REQ-010)
const CLASSIFICATION_TO_STATUS: Partial<Record<EmailClassType, AppStatus>> = {
  INTERVIEW_INVITE: 'HR_ROUND',
  REJECTION:        'REJECTED',
  OFFER:            'OFFER',
}

async function matchToApplication(
  userId: string,
  subject: string,
  body: string,
  classificationCompany: string,
  classificationRole: string,
): Promise<{ applicationId: string; confidence: number } | null> {
  const applications = await prisma.application.findMany({
    where: {
      userId,
      status: { notIn: ['REJECTED', 'WITHDRAWN', 'ACCEPTED'] },
    },
    include: { job: { select: { company: true, title: true, id: true } } },
    orderBy: { appliedAt: 'desc' },
    take: 50,
  })

  if (applications.length === 0) return null

  const searchText = `${subject} ${body}`.toLowerCase()
  let bestMatch: { applicationId: string; confidence: number } | null = null

  for (const app of applications) {
    let confidence = 0

    // Company match (primary signal)
    const company = app.job.company.toLowerCase()
    const classCompany = classificationCompany.toLowerCase()

    if (company && classCompany && company === classCompany) {
      confidence += 0.6
    } else if (company && searchText.includes(company)) {
      confidence += 0.5
    } else if (classCompany && company.includes(classCompany.split(' ')[0])) {
      confidence += 0.3
    }

    // Role match (secondary signal)
    const title = app.job.title.toLowerCase()
    const classRole = classificationRole.toLowerCase()

    if (title && classRole && title.includes(classRole.split(' ')[0])) {
      confidence += 0.2
    } else if (title && searchText.includes(title.split(' ')[0])) {
      confidence += 0.1
    }

    if (confidence > (bestMatch?.confidence ?? 0)) {
      bestMatch = { applicationId: app.id, confidence }
    }
  }

  return bestMatch && bestMatch.confidence >= 0.7 ? bestMatch : null
}

async function advanceFsm(
  applicationId: string,
  userId: string,
  targetStatus: AppStatus,
  note: string,
): Promise<void> {
  const app = await prisma.application.findUnique({ where: { id: applicationId } })
  if (!app) return

  const currentIdx = statusIndex(app.status)
  const targetIdx = statusIndex(targetStatus)

  // Never regress (REQ-012, EDGE-002)
  if (targetIdx <= currentIdx) {
    logger.warn('FSM regress blocked', { applicationId, from: app.status, to: targetStatus })
    return
  }

  await prisma.$transaction([
    prisma.application.update({
      where: { id: applicationId },
      data: {
        status: targetStatus,
        ...(targetStatus === 'APPLIED' ? { appliedAt: new Date() } : {}),
      },
    }),
    prisma.statusHistory.create({
      data: {
        applicationId,
        userId,
        fromStatus: app.status,
        toStatus: targetStatus,
        triggeredBy: 'EMAIL_DETECTION',
        note,
      },
    }),
  ])

  logger.info('FSM advanced via email', { applicationId, from: app.status, to: targetStatus })
}

export async function POST(_req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const accessToken = await getValidAccessToken(userId)

    const jobQuery = 'subject:(interview OR application OR offer OR assessment OR "next steps" OR "moving forward" OR "following up" OR "interested") newer_than:30d'
    const threadIds = await fetchGmailThreads(accessToken, jobQuery, 50)

    let newCount = 0
    let updatedCount = 0
    let fsmAdvanced = 0

    for (const threadId of threadIds) {
      try {
        const existing = await prisma.emailThread.findUnique({
          where: { gmailThreadId: threadId },
        })

        const thread = await fetchGmailThread(accessToken, threadId)
        const classOutput = await classifyEmail(thread.subject, thread.from, thread.body)
        const classification = classOutput.result

        if (classification.classification === 'GENERAL' && classification.confidence < 0.7) continue

        // Attempt application matching (REQ-008)
        const match = await matchToApplication(
          userId,
          thread.subject,
          thread.body,
          classification.company,
          classification.role,
        )

        const data = {
          userId,
          gmailThreadId: threadId,
          gmailMessageId: threadId,
          subject: thread.subject,
          sender: thread.from,
          fromEmail: thread.from.match(/<(.+)>/)?.[1] ?? thread.from,
          snippet: thread.snippet,
          summary: classification.summary,
          classification: classification.classification as EmailClassType,
          confidence: classification.confidence,
          urgency: classification.urgency,
          receivedAt: thread.date,
          lastEmailAt: thread.date,
          isRead: false,
          rawContent: thread.body.slice(0, 4000),
          applicationId: match?.applicationId ?? null,
        }

        if (existing) {
          await prisma.emailThread.update({ where: { gmailThreadId: threadId }, data })
          updatedCount++
        } else {
          await prisma.emailThread.create({ data })
          newCount++
        }

        // FSM auto-advance if matched and classification maps to a status (REQ-010, REQ-011)
        if (match?.applicationId) {
          const targetStatus = CLASSIFICATION_TO_STATUS[classification.classification as EmailClassType]
          if (targetStatus) {
            await advanceFsm(
              match.applicationId,
              userId,
              targetStatus,
              `${thread.subject} [${classification.classification}]`,
            )
            fsmAdvanced++
          }

          // Notifications for non-FSM classifications
          if (['ASSESSMENT', 'FOLLOW_UP', 'FOLLOW_UP_NEEDED'].includes(classification.classification)) {
            await prisma.notification.create({
              data: {
                userId,
                type: classification.classification,
                title: `${classification.classification.replace(/_/g, ' ')}: ${classification.company}`,
                body: classification.summary,
                extra: { applicationId: match.applicationId, urgency: classification.urgency },
              },
            })
          }
        }
      } catch (threadErr) {
        logger.warn('Thread processing failed', { threadId, err: String(threadErr) })
      }
    }

    logger.info('Email sync complete', { userId, newCount, updatedCount, fsmAdvanced })
    return NextResponse.json({ newCount, updatedCount, fsmAdvanced, total: threadIds.length })
  } catch (err) {
    logger.error('Email sync failed', { userId, err: String(err) })
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
