import { type NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/utils/tenant'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'
import type { Plan } from '@prisma/client'

const PLAN_PROFILE_LIMITS: Record<Plan, number> = {
  FREE: 1,
  PRO: 3,
  ENTERPRISE: 5,
}

const PLATFORM_VALUES = [
  'LINKEDIN', 'NAUKRI', 'INDEED', 'WELLFOUND', 'REMOTEOK', 'COMPANY',
  'REMOTIVE', 'WEWORKREMOTELY', 'HIMALAYAS', 'ARBEITNOW', 'JSEARCH', 'ADZUNA',
] as const

const CreateProfileSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().optional(),
  targetRoles: z.array(z.string().min(1)).min(1),
  targetLocations: z.array(z.string()).default([]),
  salaryMin: z.number().int().positive().optional(),
  salaryMax: z.number().int().positive().optional(),
  currency: z.string().default('INR'),
  remotePreference: z.enum(['REMOTE_ONLY', 'HYBRID', 'ONSITE', 'ANY']).default('REMOTE_ONLY'),
  preferredSources: z.array(z.enum(PLATFORM_VALUES)).default([
    'REMOTEOK', 'REMOTIVE', 'ARBEITNOW', 'NAUKRI',
  ]),
  minMatchScore: z.number().int().min(50).max(95).default(70),
  autoApplyEnabled: z.boolean().default(false),
  autoApplyPlatforms: z.array(z.enum(PLATFORM_VALUES)).default([]),
  dailyApplyLimit: z.number().int().min(1).max(25).default(10),
})

export async function GET() {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profiles = await prisma.jobProfile.findMany({
    where: { userId, isActive: true },
    include: {
      _count: { select: { jobs: true, baseResumes: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({ profiles })
}

export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = CreateProfileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Enforce plan limits (EDGE-006)
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const activeCount = await prisma.jobProfile.count({
    where: { userId, isActive: true },
  })

  const limit = PLAN_PROFILE_LIMITS[user.plan]
  if (activeCount >= limit) {
    const message = user.plan === 'FREE'
      ? 'Upgrade to Pro to create multiple profiles.'
      : `You have reached the ${user.plan} plan limit of ${limit} profiles.`
    return NextResponse.json({ error: message }, { status: 403 })
  }

  const data = parsed.data
  const profile = await prisma.jobProfile.create({
    data: {
      userId,
      name: data.name,
      description: data.description,
      targetRoles: data.targetRoles,
      targetLocations: data.targetLocations,
      salaryMin: data.salaryMin,
      salaryMax: data.salaryMax,
      currency: data.currency,
      remotePreference: data.remotePreference,
      preferredSources: data.preferredSources,
      minMatchScore: data.minMatchScore,
      autoApplyEnabled: data.autoApplyEnabled,
      autoApplyPlatforms: data.autoApplyPlatforms,
      dailyApplyLimit: data.dailyApplyLimit,
    },
  })

  return NextResponse.json({ profile }, { status: 201 })
}
