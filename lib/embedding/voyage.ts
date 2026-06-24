// voyageai SDK — VoyageAIClient is the constructable export (VoyageAI is a namespace)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const voyageaiModule = require('voyageai')
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const VoyageAICtor: new (opts: { apiKey: string }) => any = voyageaiModule.VoyageAIClient

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type VoyageClient = any

const globalForVoyage = globalThis as unknown as { voyage: VoyageClient }

const voyage: VoyageClient =
  globalForVoyage.voyage ?? new VoyageAICtor({ apiKey: process.env.VOYAGE_API_KEY! })

if (process.env.NODE_ENV !== 'production') globalForVoyage.voyage = voyage

const EMBEDDING_MODEL = 'voyage-3'

export async function embedText(text: string): Promise<number[]> {
  const result = await voyage.embed({
    input: text.slice(0, 8000),
    model: EMBEDDING_MODEL,
  })
  return result.data[0].embedding as number[]
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const results: number[][] = []
  for (let i = 0; i < texts.length; i += 8) {
    const batch = texts.slice(i, i + 8).map((t: string) => t.slice(0, 8000))
    const result = await voyage.embed({ input: batch, model: EMBEDDING_MODEL })
    results.push(...(result.data as { embedding: number[] }[]).map(d => d.embedding))
  }
  return results
}
