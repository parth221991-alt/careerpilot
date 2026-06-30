import { NextResponse } from 'next/server'
import { getUserId } from '@/lib/utils/tenant'
import { prisma } from '@/lib/db/prisma'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [threads, supabase] = await Promise.all([
    prisma.emailThread.findMany({
      where: { userId },
      orderBy: { lastEmailAt: 'desc' },
      take: 100,
      select: {
        id: true, subject: true, fromEmail: true, classification: true,
        urgency: true, summary: true, isRead: true, lastEmailAt: true,
        applicationId: true, draftReply: true, followUpSentAt: true, matchAmbiguous: true,
        // REQ-018: include company+role from linked application
        application: {
          select: {
            job: { select: { title: true, company: true } },
          },
        },
      },
    }),
    createClient(),
  ])

  const { data: { user: authUser } } = await supabase.auth.getUser()
  const gmailConnected = authUser?.user_metadata?.gmail_connected === true

  return NextResponse.json({ threads, gmailConnected })
}
