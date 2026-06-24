import { qdrant } from './client'
import { embedText } from '@/lib/embedding/voyage'
import { v5 as uuidv5 } from 'uuid'

const UUID_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'

type QdrantPoint = {
  id: string | number
  vector: number[]
  payload: Record<string, unknown>
}

type SearchResult = {
  id: string | number
  score: number
  payload: Record<string, unknown>
}

function toUUID(id: string): string {
  // Qdrant requires valid UUIDs for string IDs
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return id
  return uuidv5(id, UUID_NAMESPACE)
}

export async function upsertPoints(
  collection: string,
  points: QdrantPoint[]
): Promise<void> {
  await qdrant.upsert(collection, {
    wait: true,
    points: points.map(p => ({ ...p, id: toUUID(String(p.id)) })),
  })
}

export async function searchVault(
  userId: string,
  query: string,
  limit = 6,
): Promise<SearchResult[]> {
  const vector = await embedText(query)
  const results = await qdrant.search('career_vault', {
    vector,
    limit,
    filter: { must: [{ key: 'userId', match: { value: userId } }] },
    with_payload: true,
  })
  return results.map(r => ({
    id: r.id,
    score: r.score,
    payload: (r.payload ?? {}) as Record<string, unknown>,
  }))
}

export async function searchJobs(
  userId: string,
  query: string,
  limit = 10,
): Promise<SearchResult[]> {
  const vector = await embedText(query)
  const results = await qdrant.search('jobs', {
    vector,
    limit,
    filter: { must: [{ key: 'userId', match: { value: userId } }] },
    with_payload: true,
  })
  return results.map(r => ({
    id: r.id,
    score: r.score,
    payload: (r.payload ?? {}) as Record<string, unknown>,
  }))
}
