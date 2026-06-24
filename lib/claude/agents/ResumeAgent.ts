import { anthropic, REASONING_MODEL, cachedText } from '@/lib/claude/client'
import { RESUME_AGENT_SYSTEM_PROMPT, ATS_ANALYSIS_SYSTEM_PROMPT } from '@/lib/claude/prompts/resume-agent'
import { searchVault } from '@/lib/qdrant/search'
import type { TailoredResume, ATSAnalysis, AgentOutput } from '@/types/agents'

export async function runResumeAgent(
  userId: string,
  baseResumeContent: Record<string, unknown>,
  jobDescription: string,
  jobTitle: string,
  company: string,
  profileKeywords: string[],
): Promise<AgentOutput<TailoredResume>> {
  // Retrieve semantically relevant vault context for this JD
  const vaultContext = await searchVault(userId, jobDescription, 8)
  const vaultSummary = vaultContext
    .map(r => `[${r.payload['type']}] ${JSON.stringify(r.payload)}`)
    .join('\n')

  const userPrompt = `Tailor this resume for the role below.

JOB TITLE: ${jobTitle}
COMPANY: ${company}

JOB DESCRIPTION:
${jobDescription.slice(0, 3000)}

CANDIDATE'S PRIORITY KEYWORDS: ${profileKeywords.join(', ')}

RELEVANT CAREER VAULT CONTEXT:
${vaultSummary}

BASE RESUME:
${JSON.stringify(baseResumeContent, null, 2).slice(0, 4000)}

Return valid JSON:
{
  "summary": "tailored professional summary",
  "skills": ["skill1", "skill2"],
  "experience": [{ "company": "", "title": "", "location": "", "startDate": "", "endDate": "", "bullets": [] }],
  "education": [{ "institution": "", "degree": "", "field": "", "year": "" }],
  "certifications": [{ "name": "", "issuer": "", "year": "" }],
  "injectedKeywords": ["keywords added from JD"],
  "reasoning": "explanation of changes made"
}`

  const response = await anthropic.messages.create({
    model: REASONING_MODEL,
    max_tokens: 8096,
    system: [cachedText(RESUME_AGENT_SYSTEM_PROMPT)],
    messages: [{ role: 'user', content: userPrompt }],
  })

  const raw = (response.content[0] as { type: string; text: string }).text.trim()
  const jsonStr = raw.startsWith('```') ? raw.split('```')[1].replace(/^json\n?/, '') : raw
  const tailored: TailoredResume = JSON.parse(jsonStr)

  return {
    result: tailored,
    reasoning: tailored.reasoning,
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    model: REASONING_MODEL,
    cachedTokens: response.usage.cache_read_input_tokens ?? 0,
  }
}

export async function runATSAnalysis(
  resumeText: string,
  jobDescription: string,
): Promise<AgentOutput<ATSAnalysis>> {
  const userPrompt = `Analyze this resume against the job description.

RESUME:
${resumeText.slice(0, 3000)}

JOB DESCRIPTION:
${jobDescription.slice(0, 3000)}

Return valid JSON with: score (0-100), component_scores {keyword_coverage, semantic_alignment, seniority_match, format_compliance}, matched_skills, missing_critical_skills, missing_nice_to_have, recommendations (max 5), reasoning`

  const response = await anthropic.messages.create({
    model: REASONING_MODEL,
    max_tokens: 2048,
    system: [cachedText(ATS_ANALYSIS_SYSTEM_PROMPT)],
    messages: [{ role: 'user', content: userPrompt }],
  })

  const raw = (response.content[0] as { type: string; text: string }).text.trim()
  const jsonStr = raw.startsWith('```') ? raw.split('```')[1].replace(/^json\n?/, '') : raw
  const analysis: ATSAnalysis = JSON.parse(jsonStr)

  return {
    result: analysis,
    reasoning: analysis.reasoning,
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    model: REASONING_MODEL,
    cachedTokens: response.usage.cache_read_input_tokens ?? 0,
  }
}
