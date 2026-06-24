import { type NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/utils/tenant'
import { prisma } from '@/lib/db/prisma'
import { getValidAccessToken } from '@/lib/gmail/client'
import { createLogger } from '@/lib/utils/logger'
import { z } from 'zod'

const logger = createLogger('email-send')

const SendSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
  applicationId: z.string().uuid().optional(),
  threadId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = SendSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  let accessToken: string
  try {
    accessToken = await getValidAccessToken(userId)
  } catch {
    return NextResponse.json(
      { error: 'Reconnect your Gmail account', reconnect: true },
      { status: 401 }
    )
  }

  const { to, subject, body: emailBody, applicationId, threadId } = parsed.data

  // Build RFC 2822 message
  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: text/plain; charset=utf-8`,
    '',
    emailBody,
  ].join('\r\n')

  const encoded = Buffer.from(message).toString('base64url')

  const gmailUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send'
  const gmailRes = await fetch(gmailUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encoded }),
  })

  if (!gmailRes.ok) {
    logger.error('Gmail send failed', { status: gmailRes.status })
    return NextResponse.json({ error: 'Failed to send email' }, { status: 502 })
  }

  // Mark follow-up sent timestamp on thread
  if (threadId) {
    await prisma.emailThread.updateMany({
      where: { id: threadId, userId },
      data: { followUpSentAt: new Date() },
    })
  }

  logger.info('Follow-up email sent', { userId, applicationId, to })
  return NextResponse.json({ sent: true })
}
