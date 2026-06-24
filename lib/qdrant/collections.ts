import { qdrant } from './client'

const VECTOR_SIZE = 1024 // voyage-3 dimensions

export async function ensureCollections() {
  const collections = ['career_vault', 'jobs']

  for (const name of collections) {
    const exists = await qdrant
      .getCollection(name)
      .then(() => true)
      .catch(() => false)

    if (!exists) {
      await qdrant.createCollection(name, {
        vectors: { size: VECTOR_SIZE, distance: 'Cosine' },
      })
      await qdrant.createPayloadIndex(name, {
        field_name: 'userId',
        field_schema: 'keyword',
      })
      console.log(`✓ Created collection: ${name}`)
    } else {
      console.log(`  Already exists: ${name}`)
    }
  }
}

// Allow direct execution: npx tsx lib/qdrant/collections.ts
if (process.argv[1]?.endsWith('collections.ts')) {
  ensureCollections()
    .then(() => { console.log('Qdrant collections ready.'); process.exit(0) })
    .catch(err => { console.error('Failed:', err); process.exit(1) })
}
