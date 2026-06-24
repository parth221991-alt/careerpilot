import { type NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/utils/tenant'
import { prisma } from '@/lib/db/prisma'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const job = await prisma.job.findFirst({
    where: { id, userId },
    include: { application: true },
  })

  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ job })
}
