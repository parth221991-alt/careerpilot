import { type NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/utils/tenant'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

const SaveJobSchema = z.object({
  jobId: z.string().uuid(),
  notes: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const status = req.nextUrl.searchParams.get('status')
  const filter = req.nextUrl.searchParams.get('filter')

  const where = {
    userId,
    ...(status ? { status: status as 'SAVED' | 'APPLIED' } : {}),
  }

  const applications = await prisma.application.findMany({
    where,
    include: {
      job: true,
      approvalGates: { where: { status: 'PENDING' }, take: 1 },
      statusHistory: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
    orderBy: { updatedAt: 'desc' },
  })

  if (filter === 'approvals') {
    return NextResponse.json({
      applications: applications.filter(a => a.approvalGates.length > 0),
    })
  }

  return NextResponse.json({ applications })
}

export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = SaveJobSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { jobId, notes } = parsed.data

  // Ensure job belongs to user
  const job = await prisma.job.findFirst({ where: { id: jobId, userId } })
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  const application = await prisma.application.upsert({
    where: { jobId },
    create: {
      userId,
      jobId,
      status: 'SAVED',
      notes: notes ?? null,
    },
    update: {},
  })

  await prisma.statusHistory.create({
    data: {
      applicationId: application.id,
      userId,
      fromStatus: null,
      toStatus: 'SAVED',
      triggeredBy: 'USER',
    },
  })

  return NextResponse.json({ application })
}
