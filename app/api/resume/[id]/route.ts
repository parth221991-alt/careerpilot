import { type NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/utils/tenant'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

const PatchSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
  jobProfileId: z.string().uuid().nullable().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const resume = await prisma.baseResume.findFirst({
    where: { id, userId },
  })
  if (!resume) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Enforce max 10 active resumes when reactivating (REQ-010)
  if (parsed.data.isActive === true && !resume.isActive) {
    const activeCount = await prisma.baseResume.count({ where: { userId, isActive: true } })
    if (activeCount >= 10) {
      return NextResponse.json(
        { error: 'Maximum 10 active resumes allowed. Deactivate one first.' },
        { status: 422 }
      )
    }
  }

  const updated = await prisma.baseResume.update({
    where: { id },
    data: parsed.data,
  })

  return NextResponse.json({ resume: updated })
}
