import { type NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/utils/tenant'
import { searchVault } from '@/lib/qdrant/search'
import { createLogger } from '@/lib/utils/logger'

const logger = createLogger('vault-search')

export async function GET(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q) return NextResponse.json({ error: 'Missing query' }, { status: 400 })

  try {
    const hits = await searchVault(userId, q, 10)
    logger.info('Vault search', { userId, q, hits: hits.length })

    const results = hits.map(h => ({
      id: String(h.id),
      score: h.score,
      type: (h.payload.type as string) ?? 'experience',
      title: (h.payload.title as string) ?? '',
      subtitle: (h.payload.subtitle as string) ?? '',
      snippet: (h.payload.snippet as string) ?? '',
    }))

    return NextResponse.json({ results, query: q })
  } catch (err) {
    logger.error('Vault search failed', { userId, q, err: String(err) })
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
