import { anthropic, THROUGHPUT_MODEL, cachedText } from '@/lib/claude/client'
import { prisma } from '@/lib/db/prisma'
import type { AgentOutput, ResumeSelectResult } from '@/types/agents'

const RESUME_SCORE_SYSTEM_PROMPT = `You are a resume-job fit evaluator. Given a resume and a job description, score the resume's relevance on a 0-100 scale.

SCORING:
- Skill overlap (40pts): Required skills present in resume
- Experience relevance (35pts): Role and domain match
- Seniority match (25pts): Years of experience vs requirement

OUTPUT: Valid JSON only: {"score": number, "reasoning": "one sentence"}`

async function scoreResumeAgainstJd(
  resumeText: string,
  jd: string,
): Promise<{ score: number; reasoning: string }> {
  const response = await anthropic.messages.create({
    model: THROUGHPUT_MODEL,
    max_tokens: 256,
    system: [cachedText(RESUME_SCORE_SYSTEM_PROMPT)],
    messages: [{
      role: 'user',
      content: `RESUME:\n${resumeText.slice(0, 1500)}\n\nJOB DESCRIPTION:\n${jd.slice(0, 1500)}`,
    }],
  })

  const raw = (response.content[0] as { type: string; text: string }).text.trim()
  const jsonStr = raw.startsWith('```') ? raw.split('```')[1].replace(/^json\n?/, '') : raw
  return JSON.parse(jsonStr) as { score: number; reasoning: string }
}

export async function selectBestResume(
  userId: string,
  jd: string,
  profileId?: string,
): Promise<AgentOutput<ResumeSelectResult>> {
  const whereClause = profileId
    ? {
        userId,
        isActive: true,
        OR: [{ jobProfileId: profileId }, { jobProfileId: null }],
      }
    : { userId, isActive: true }

  const resumes = await prisma.baseResume.findMany({ where: whereClause })

  if (resumes.length === 0) {
    throw new Error('No active resume found. Upload a resume first.')
  }

  // Short-circuit: only one resume, no Claude call needed (EDGE-002 / spec REQ-011)
  if (resumes.length === 1) {
    const r = resumes[0]
    return {
      result: {
        baseResumeId: r.id,
        label: r.label ?? 'Base Resume',
        score: 100,
        reasoning: 'Only one resume available — selected automatically.',
      },
      reasoning: 'Single resume — no scoring needed.',
      tokensUsed: 0,
      model: THROUGHPUT_MODEL,
      cachedTokens: 0,
    }
  }

  // Score all resumes concurrently (max 3 at once per spec REQ-011)
  const CONCURRENCY = 3
  const scored: { resume: typeof resumes[0]; score: number; reasoning: string }[] = []
  const queue = [...resumes]
  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    while (queue.length > 0) {
      const resume = queue.shift()
      if (!resume) continue
      const text = resume.rawText ?? JSON.stringify(resume.content ?? {})
      const result = await scoreResumeAgainstJd(text, jd)
      scored.push({ resume, score: result.score, reasoning: result.reasoning })
    }
  })

  await Promise.all(workers)

  const best = scored.reduce((a, b) => (a.score >= b.score ? a : b))

  return {
    result: {
      baseResumeId: best.resume.id,
      label: best.resume.label ?? 'Base Resume',
      score: best.score,
      reasoning: best.reasoning,
    },
    reasoning: best.reasoning,
    tokensUsed: 0,
    model: THROUGHPUT_MODEL,
    cachedTokens: 0,
  }
}
