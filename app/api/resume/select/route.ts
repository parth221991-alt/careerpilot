import { type NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/utils/tenant'
import { prisma } from '@/lib/db/prisma'
import { selectBestResume } from '@/lib/claude/agents/ResumeSelectAgent'
import { z } from 'zod'

const SelectSchema = z.object({
  jobId: z.string().uuid(),
  profileId: z.string().uuid().optional(),
})

export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = SelectSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { jobId, profileId } = parsed.data

  const job = await prisma.job.findFirst({
    where: { id: jobId, userId },
    select: { description: true, rawDescription: true },
  })

  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  const jd = job.description ?? job.rawDescription ?? ''

  try {
    const output = await selectBestResume(userId, jd, profileId)
    return NextResponse.json({ selection: output.result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Selection failed'
    return NextResponse.json({ error: message }, { status: 422 })
  }
}
