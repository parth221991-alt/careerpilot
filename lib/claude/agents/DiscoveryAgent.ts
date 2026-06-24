import { anthropic, THROUGHPUT_MODEL, REASONING_MODEL, cachedText } from '@/lib/claude/client'
import { JOB_MATCH_SYSTEM_PROMPT, JD_PARSER_SYSTEM_PROMPT } from '@/lib/claude/prompts/discovery-agent'
import type { JobMatchResult, ParsedJD, AgentOutput } from '@/types/agents'

export async function scoreJobMatch(
  candidateProfile: string,
  jobTitle: string,
  jobDescription: string,
  targetLocation: string,
): Promise<AgentOutput<JobMatchResult>> {
  const userPrompt = `Score this candidate's fit for the job.

CANDIDATE PROFILE:
${candidateProfile.slice(0, 2000)}

JOB: ${jobTitle}
LOCATION FIT: ${targetLocation}
JOB DESCRIPTION:
${jobDescription.slice(0, 2000)}

Return JSON with: score (0-100), reasoning, matched_skills, missing_critical_skills, missing_nice_to_have, seniority_fit, recommendation`

  const response = await anthropic.messages.create({
    model: THROUGHPUT_MODEL,
    max_tokens: 1024,
    system: [cachedText(JOB_MATCH_SYSTEM_PROMPT)],
    messages: [{ role: 'user', content: userPrompt }],
  })

  const raw = (response.content[0] as { type: string; text: string }).text.trim()
  const jsonStr = raw.startsWith('```') ? raw.split('```')[1].replace(/^json\n?/, '') : raw
  const result: JobMatchResult = JSON.parse(jsonStr)

  return {
    result,
    reasoning: result.reasoning,
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    model: THROUGHPUT_MODEL,
    cachedTokens: response.usage.cache_read_input_tokens ?? 0,
  }
}

export async function parseJobDescription(jd: string): Promise<AgentOutput<ParsedJD>> {
  const userPrompt = `Parse this job description and extract structured requirements.

JOB DESCRIPTION:
${jd.slice(0, 3000)}

Return JSON with: required_skills, preferred_skills, tech_stack, min_years_experience, seniority_level, role_type, domain, remote_type`

  const response = await anthropic.messages.create({
    model: THROUGHPUT_MODEL,
    max_tokens: 1024,
    system: [cachedText(JD_PARSER_SYSTEM_PROMPT)],
    messages: [{ role: 'user', content: userPrompt }],
  })

  const raw = (response.content[0] as { type: string; text: string }).text.trim()
  const jsonStr = raw.startsWith('```') ? raw.split('```')[1].replace(/^json\n?/, '') : raw
  const parsed: ParsedJD = JSON.parse(jsonStr)

  return {
    result: parsed,
    reasoning: 'JD parsed successfully',
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    model: THROUGHPUT_MODEL,
    cachedTokens: response.usage.cache_read_input_tokens ?? 0,
  }
}
