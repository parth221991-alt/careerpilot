import { type NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/utils/tenant'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'
import type { Platform } from '@prisma/client'

const PLATFORM_VALUES = [
  'LINKEDIN', 'NAUKRI', 'INDEED', 'WELLFOUND', 'REMOTEOK', 'COMPANY',
  'REMOTIVE', 'WEWORKREMOTELY', 'HIMALAYAS', 'ARBEITNOW', 'JSEARCH', 'ADZUNA',
] as const

const PatchProfileSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().optional(),
  targetRoles: z.array(z.string().min(1)).optional(),
  targetLocations: z.array(z.string()).optional(),
  salaryMin: z.number().int().positive().nullable().optional(),
  salaryMax: z.number().int().positive().nullable().optional(),
  currency: z.string().optional(),
  remotePreference: z.enum(['REMOTE_ONLY', 'HYBRID', 'ONSITE', 'ANY']).optional(),
  preferredSources: z.array(z.enum(PLATFORM_VALUES)).optional(),
  minMatchScore: z.number().int().min(50).max(95).optional(),
  autoApplyEnabled: z.boolean().optional(),
  autoApplyPlatforms: z.array(z.enum(PLATFORM_VALUES)).optional(),
  dailyApplyLimit: z.number().int().min(1).max(25).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = PatchProfileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const profile = await prisma.jobProfile.findFirst({ where: { id, userId } })
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const d = parsed.data
  const updated = await prisma.jobProfile.update({
    where: { id },
    data: {
      ...(d.name !== undefined ? { name: d.name } : {}),
      ...(d.description !== undefined ? { description: d.description } : {}),
      ...(d.targetRoles !== undefined ? { targetRoles: d.targetRoles } : {}),
      ...(d.targetLocations !== undefined ? { targetLocations: d.targetLocations } : {}),
      ...(d.salaryMin !== undefined ? { salaryMin: d.salaryMin } : {}),
      ...(d.salaryMax !== undefined ? { salaryMax: d.salaryMax } : {}),
      ...(d.currency !== undefined ? { currency: d.currency } : {}),
      ...(d.remotePreference !== undefined ? { remotePreference: d.remotePreference } : {}),
      ...(d.preferredSources !== undefined ? { preferredSources: d.preferredSources as Platform[] } : {}),
      ...(d.minMatchScore !== undefined ? { minMatchScore: d.minMatchScore } : {}),
      ...(d.autoApplyEnabled !== undefined ? { autoApplyEnabled: d.autoApplyEnabled } : {}),
      ...(d.autoApplyPlatforms !== undefined ? { autoApplyPlatforms: d.autoApplyPlatforms as Platform[] } : {}),
      ...(d.dailyApplyLimit !== undefined ? { dailyApplyLimit: d.dailyApplyLimit } : {}),
    },
  })

  return NextResponse.json({ profile: updated })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const profile = await prisma.jobProfile.findFirst({ where: { id, userId } })
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Soft delete — do not cascade to jobs/applications (EDGE-001)
  await prisma.jobProfile.update({
    where: { id },
    data: { isActive: false },
  })

  return NextResponse.json({ deleted: true })
}
