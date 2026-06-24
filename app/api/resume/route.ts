import { NextResponse } from 'next/server'
import { getUserId } from '@/lib/utils/tenant'
import { prisma } from '@/lib/db/prisma'

export async function GET() {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const resumes = await prisma.baseResume.findMany({
    where: { userId },
    include: {
      _count: { select: { variants: true } },
      jobProfile: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Group by profileId (null = "General")
  const grouped: Record<string, typeof resumes> = { general: [] }

  for (const resume of resumes) {
    if (resume.jobProfileId && resume.jobProfile) {
      const key = resume.jobProfileId
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(resume)
    } else {
      grouped.general.push(resume)
    }
  }

  // Build response with group metadata
  const groups = Object.entries(grouped).map(([key, items]) => ({
    profileId: key === 'general' ? null : key,
    profileName: key === 'general'
      ? 'General'
      : items[0]?.jobProfile?.name ?? 'Unknown Profile',
    resumes: items.map(r => ({
      id: r.id,
      label: r.label,
      fileName: r.fileName,
      isActive: r.isActive,
      createdAt: r.createdAt,
      variantsCount: r._count.variants,
    })),
  }))

  return NextResponse.json({ groups })
}
