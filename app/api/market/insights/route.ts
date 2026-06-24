import { type NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/utils/tenant'
import { computeMarketIntelligence } from '@/lib/analytics/market'
import { generateMarketInsights } from '@/lib/claude/agents/MarketInsightsAgent'
import { getCareerPilotConfig } from '@/lib/config'
import { prisma } from '@/lib/db/prisma'
import { redis } from '@/lib/redis/client'
import { createLogger } from '@/lib/utils/logger'
import type { MarketSignal } from '@/types/agents'

const logger = createLogger('market-insights-api')

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const bust = req.nextUrl.searchParams.get('bust') === '1'
  const cfg = getCareerPilotConfig().market_intelligence
  const cacheKey = `market:insights:${userId}`

  if (!bust) {
    try {
      const cached = await redis.get(cacheKey)
      if (cached) {
        return NextResponse.json({ insights: JSON.parse(cached) as MarketSignal[], cached: true })
      }
    } catch {
      // Redis unavailable — compute fresh
    }
  }

  try {
    const [analytics, resumes, profiles, sevenDayCount] = await Promise.all([
      computeMarketIntelligence(userId),
      prisma.baseResume.findMany({
        where: { userId, isActive: true },
        select: { rawText: true },
        take: 3,
      }),
      prisma.jobProfile.findMany({
        where: { userId, isActive: true },
        select: { targetRoles: true, salaryMin: true, salaryMax: true },
        take: 1,
      }),
      prisma.job.count({
        where: {
          userId,
          isActive: true,
          discoveredAt: { gte: new Date(Date.now() - cfg.heat_window_days * 24 * 60 * 60 * 1000) },
        },
      }),
    ])

    const resumeText = resumes.map(r => r.rawText ?? '').join('\n')
    const profile = profiles[0]
    const sevenDayAvg = sevenDayCount / cfg.heat_window_days

    const output = await generateMarketInsights({
      analytics,
      resumeText,
      targetRoles: profile?.targetRoles ?? [],
      profileSalaryMin: profile?.salaryMin ?? null,
      profileSalaryMax: profile?.salaryMax ?? null,
      sevenDayAvg,
      thresholdPct: cfg.skill_gap_threshold_pct,
      minJobsForInsights: cfg.min_jobs_for_insights,
    })

    try {
      await redis.setex(cacheKey, cfg.cache_ttl_seconds, JSON.stringify(output.result))
    } catch {
      logger.warn('Failed to cache market insights')
    }

    return NextResponse.json({ insights: output.result, computedAt: new Date().toISOString(), cached: false })
  } catch (err) {
    logger.error('Market insights generation failed', { err: String(err) })
    // REQ-004: graceful degradation — never 500
    return NextResponse.json({ insights: [], computedAt: new Date().toISOString(), error: 'Insights unavailable', cached: false })
  }
}
