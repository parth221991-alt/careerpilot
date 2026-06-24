import { type NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/utils/tenant'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'
import type { AppStatus } from '@prisma/client'

const VALID_TRANSITIONS: Record<AppStatus, AppStatus[]> = {
  SAVED:            ['APPROVAL_PENDING', 'APPLIED', 'WITHDRAWN'],  // SAVED → APPLIED for LinkedIn manual submit
  APPROVAL_PENDING: ['APPLIED', 'WITHDRAWN'],
  APPLIED:          ['HR_ROUND', 'REJECTED', 'WITHDRAWN'],
  HR_ROUND:         ['TECHNICAL_ROUND', 'REJECTED', 'WITHDRAWN'],
  TECHNICAL_ROUND:  ['MANAGER_ROUND', 'REJECTED', 'WITHDRAWN'],
  MANAGER_ROUND:    ['OFFER', 'REJECTED', 'WITHDRAWN'],
  OFFER:            ['ACCEPTED', 'REJECTED'],
  ACCEPTED:         [],
  REJECTED:         [],
  WITHDRAWN:        [],
}

const PatchSchema = z.object({
  status: z.enum([
    'SAVED', 'APPROVAL_PENDING', 'APPLIED', 'HR_ROUND',
    'TECHNICAL_ROUND', 'MANAGER_ROUND', 'OFFER', 'ACCEPTED', 'REJECTED', 'WITHDRAWN',
  ] as const).optional(),
  notes: z.string().optional(),
  // REQ-006: LinkedIn confirmation sends isAutoApplied: false
  isAutoApplied: z.boolean().optional(),
})

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const application = await prisma.application.findFirst({
    where: { id, userId },
    include: {
      job: true,
      resumeVariant: true,
      statusHistory: { orderBy: { createdAt: 'asc' } },
      approvalGates: { orderBy: { createdAt: 'desc' }, take: 3 },
      emailThreads: { orderBy: { lastEmailAt: 'desc' }, take: 10 },
      interviewPrep: true,
      offer: true,
    },
  })

  if (!application) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ application })
}

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

  const application = await prisma.application.findFirst({ where: { id, userId } })
  if (!application) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { status: newStatus, notes, isAutoApplied } = parsed.data

  if (newStatus && newStatus !== application.status) {
    const allowed = VALID_TRANSITIONS[application.status]
    if (!allowed.includes(newStatus)) {
      return NextResponse.json({
        error: `Cannot transition from ${application.status} to ${newStatus}`,
      }, { status: 400 })
    }

    await prisma.$transaction([
      prisma.application.update({
        where: { id },
        data: {
          status: newStatus,
          notes: notes ?? application.notes,
          ...(newStatus === 'APPLIED' ? { appliedAt: new Date() } : {}),
          ...(isAutoApplied !== undefined ? { isAutoApplied } : {}),
        },
      }),
      prisma.statusHistory.create({
        data: {
          applicationId: id,
          userId,
          fromStatus: application.status,
          toStatus: newStatus,
          triggeredBy: 'USER',
          note: notes ?? null,
        },
      }),
    ])
  } else {
    const updateData: Record<string, unknown> = {}
    if (notes !== undefined) updateData.notes = notes
    if (isAutoApplied !== undefined) updateData.isAutoApplied = isAutoApplied
    if (Object.keys(updateData).length > 0) {
      await prisma.application.update({ where: { id }, data: updateData })
    }
  }

  const updated = await prisma.application.findUnique({
    where: { id },
    include: { job: true, statusHistory: { orderBy: { createdAt: 'asc' } } },
  })

  return NextResponse.json({ application: updated })
}
