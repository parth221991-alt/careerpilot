import { anthropic, REASONING_MODEL, cachedText } from '@/lib/claude/client'
import { VAULT_AGENT_SYSTEM_PROMPT } from '@/lib/claude/prompts/vault-agent'
import { embedText } from '@/lib/embedding/voyage'
import { upsertPoints } from '@/lib/qdrant/search'
import { prisma } from '@/lib/db/prisma'
import type { CareerVaultExtraction, AgentOutput } from '@/types/agents'

export async function runVaultAgent(
  userId: string,
  resumeText: string,
  requestId: string
): Promise<AgentOutput<CareerVaultExtraction>> {
  const userPrompt = `Extract all career data from this resume/document.

Document:
---
${resumeText.slice(0, 12000)}
---

Return valid JSON matching CareerVaultExtraction schema:
{
  "headline": "current or most recent title",
  "summary": "professional summary paragraph",
  "experiences": [{
    "company": "", "title": "", "location": "",
    "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD or null",
    "isCurrent": false, "description": "",
    "bullets": ["..."], "techStack": ["..."],
    "impactMetrics": {}
  }],
  "projects": [{ "name": "", "description": "", "techStack": [], "outcomes": [], "url": "" }],
  "skills": [{ "name": "", "category": "LANGUAGE|FRAMEWORK|CLOUD|DATABASE|TOOL|METHODOLOGY|SOFT", "proficiency": "BEGINNER|INTERMEDIATE|ADVANCED|EXPERT", "yearsUsed": 0 }],
  "certifications": [{ "name": "", "issuer": "", "issuedAt": "YYYY-MM-DD", "expiresAt": null, "credentialUrl": "" }],
  "achievements": [{ "title": "", "description": "", "impact": "", "date": "YYYY-MM-DD" }]
}`

  const response = await anthropic.messages.create({
    model: REASONING_MODEL,
    max_tokens: 8096,
    system: [cachedText(VAULT_AGENT_SYSTEM_PROMPT)],
    messages: [{ role: 'user', content: userPrompt }],
  })

  const raw = (response.content[0] as { type: string; text: string }).text.trim()
  const jsonStr = raw.startsWith('```') ? raw.split('```')[1].replace(/^json\n?/, '') : raw
  const extracted: CareerVaultExtraction = JSON.parse(jsonStr)

  // Embed into Qdrant — skip silently if Voyage AI key or Qdrant is unavailable
  if (process.env.VOYAGE_API_KEY) {
    try {
      await embedAndStoreVaultEntities(userId, extracted)
    } catch (e) {
      console.warn('[vault] Embedding skipped:', (e as Error).message)
    }
  }

  return {
    result: extracted,
    reasoning: 'Career data extracted and embedded into Career Vault.',
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    model: REASONING_MODEL,
    cachedTokens: response.usage.cache_read_input_tokens ?? 0,
  }
}

async function embedAndStoreVaultEntities(
  userId: string,
  data: CareerVaultExtraction
): Promise<void> {
  const points: { id: string; vector: number[]; payload: Record<string, unknown> }[] = []

  // Embed experience bullets
  for (const exp of data.experiences ?? []) {
    const text = `${exp.title} at ${exp.company}: ${exp.bullets.join(' ')} Tech: ${exp.techStack.join(', ')}`
    const vector = await embedText(text)
    const id = `${userId}_exp_${exp.company}_${exp.title}`.replace(/\s+/g, '_').toLowerCase()
    points.push({ id, vector, payload: { userId, type: 'experience', ...exp } })
  }

  // Embed projects
  for (const proj of data.projects ?? []) {
    const text = `Project: ${proj.name}. ${proj.description}. ${proj.outcomes.join(' ')}`
    const vector = await embedText(text)
    const id = `${userId}_proj_${proj.name}`.replace(/\s+/g, '_').toLowerCase()
    points.push({ id, vector, payload: { userId, type: 'project', ...proj } })
  }

  // Embed achievements
  for (const ach of data.achievements ?? []) {
    const text = `${ach.title}: ${ach.description} ${ach.impact ?? ''}`
    const vector = await embedText(text)
    const id = `${userId}_ach_${ach.title}`.replace(/\s+/g, '_').toLowerCase()
    points.push({ id, vector, payload: { userId, type: 'achievement', ...ach } })
  }

  if (points.length > 0) {
    await upsertPoints('career_vault', points)
  }
}
