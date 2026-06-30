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
    const windowStart = new Date(Date.now() - cfg.heat_window_days * 24 * 60 * 60 * 1000)

    const [analytics, resumes, profiles, sevenDayCount, firstJobInWindow] = await Promise.all([
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
        where: { userId, isActive: true, discoveredAt: { gte: windowStart } },
      }),
      // EDGE-005: find earliest job in window to compute actual days of data
      prisma.job.findFirst({
        where: { userId, isActive: true, discoveredAt: { gte: windowStart } },
        orderBy: { discoveredAt: 'asc' },
        select: { discoveredAt: true },
      }),
    ])

    const resumeText = resumes.map(r => r.rawText ?? '').join('\n')
    const profile = profiles[0]

    // EDGE-005: use actual days of data (not always 7) to avoid inflated averages; never divide by zero
    const daysWithData = firstJobInWindow
      ? Math.max(1, Math.ceil((Date.now() - firstJobInWindow.discoveredAt.getTime()) / 86_400_000))
      : 1
    const actualDays = Math.min(cfg.heat_window_days, daysWithData)
    const sevenDayAvg = sevenDayCount / actualDays

    const output = await generateMarketInsights({
      analytics,
      resumeText,
      hasResume: resumes.length > 0,        // EDGE-001
      hasProfile: profiles.length > 0,       // EDGE-002
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
