import { type NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/utils/tenant'
import { prisma } from '@/lib/db/prisma'

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const page      = Number(sp.get('page') ?? 1)
  const limit     = Math.min(Number(sp.get('limit') ?? 20), 50)
  const platform  = sp.get('platform') ?? undefined
  const remote    = sp.get('remote') === 'true'
  const profileId = sp.get('profileId') ?? undefined

  // REQ-029: default minScore to profile's minMatchScore when filtering by profile
  let minScore = sp.has('minScore') ? Number(sp.get('minScore')) : 0
  if (profileId && !sp.has('minScore')) {
    const profile = await prisma.jobProfile.findFirst({
      where: { id: profileId, userId },
      select: { minMatchScore: true },
    })
    if (profile) minScore = profile.minMatchScore
  }

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
