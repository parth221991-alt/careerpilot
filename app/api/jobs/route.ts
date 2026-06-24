import { type NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/utils/tenant'
import { prisma } from '@/lib/db/prisma'

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const page      = Number(sp.get('page') ?? 1)
  const limit     = Math.min(Number(sp.get('limit') ?? 20), 50)
  const minScore  = Number(sp.get('minScore') ?? 0)
  const platform  = sp.get('platform') ?? undefined
  const remote    = sp.get('remote') === 'true'
  const profileId = sp.get('profileId') ?? undefined

  const where = {
    userId,
    isActive: true,
    ...(minScore > 0 ? { matchScore: { gte: minScore } } : {}),
    ...(platform ? { platform: platform as 'LINKEDIN' | 'NAUKRI' | 'INDEED' | 'WELLFOUND' } : {}),
    ...(remote ? { remoteType: { in: ['REMOTE', 'HYBRID'] } } : {}),
    ...(profileId ? { jobProfileId: profileId } : {}),
  }

  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where,
      orderBy: [{ matchScore: 'desc' }, { discoveredAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.job.count({ where }),
  ])

  return NextResponse.json({ jobs, total, page, pages: Math.ceil(total / limit) })
}
