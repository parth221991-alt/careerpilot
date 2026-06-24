import { NextResponse } from 'next/server'
import { getUserId } from '@/lib/utils/tenant'
import { computeMarketIntelligence } from '@/lib/analytics/market'
import { redis } from '@/lib/redis/client'
import { createLogger } from '@/lib/utils/logger'

const logger = createLogger('market-api')
const CACHE_TTL = 3600 // 1 hour

export async function GET() {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cacheKey = `market:intelligence:${userId}`

  try {
    const cached = await redis.get(cacheKey)
    if (cached) {
      return NextResponse.json({ intelligence: JSON.parse(cached), cached: true })
    }
  } catch {
    // Redis unavailable — compute fresh
  }

  try {
    const intelligence = await computeMarketIntelligence(userId)

    try {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(intelligence))
    } catch {
      logger.warn('Failed to cache market intelligence')
    }

    return NextResponse.json({ intelligence, cached: false })
  } catch (err) {
    logger.error('Market intelligence computation failed', { err: String(err) })
    return NextResponse.json({ error: 'Computation failed' }, { status: 500 })
  }
}
