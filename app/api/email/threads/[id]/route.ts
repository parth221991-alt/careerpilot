import { type NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/utils/tenant'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

const PatchSchema = z.object({
  isRead: z.boolean().optional(),
})

// REQ-018: PATCH /api/email/threads/[id] — mark thread as read
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const thread = await prisma.emailThread.findFirst({ where: { id, userId } })
  if (!thread) return NextResponse.json({ error: 'Thread not found' }, { status: 404 })

  const updated = await prisma.emailThread.update({
    where: { id },
    data: { isRead: parsed.data.isRead ?? true },
  })

  return NextResponse.json({ thread: updated })
}
