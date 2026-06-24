import { QdrantClient } from '@qdrant/js-client-rest'

const globalForQdrant = globalThis as unknown as { qdrant: QdrantClient }

export const qdrant =
  globalForQdrant.qdrant ??
  new QdrantClient({
    url: process.env.QDRANT_URL ?? 'http://localhost:6333',
    apiKey: process.env.QDRANT_API_KEY || undefined,
  })

if (process.env.NODE_ENV !== 'production') globalForQdrant.qdrant = qdrant
