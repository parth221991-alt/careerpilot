import { anthropic, REASONING_MODEL, cachedText } from '@/lib/claude/client'
import { INTERVIEW_PREP_SYSTEM_PROMPT } from '@/lib/claude/prompts/interview-agent'
import { searchVault } from '@/lib/qdrant/search'
import type { InterviewPrepResult, AgentOutput } from '@/types/agents'

export async function generateInterviewPrep(
  userId: string,
  jobTitle: string,
  company: string,
  jobDescription: string,
  yearsOfExperience: number,
  targetSalaryMin: number | null,
  targetSalaryMax: number | null,
  location: string,
): Promise<AgentOutput<InterviewPrepResult>> {
  // Pull relevant career vault context
  const vaultContext = await searchVault(userId, `${jobTitle} ${jobDescription}`, 10)
  const vaultSummary = vaultContext
    .map(r => `[${r.payload['type']}] ${JSON.stringify(r.payload)}`)
    .join('\n')

  const salaryContext = targetSalaryMin
    ? `Target: ₹${targetSalaryMin.toLocaleString()}–₹${targetSalaryMax?.toLocaleString()} per year`
    : 'Salary target not specified'

  const userPrompt = `Generate comprehensive interview preparation for this candidate and role.

ROLE: ${jobTitle} at ${company}
LOCATION: ${location}
CANDIDATE EXPERIENCE: ${yearsOfExperience} years
SALARY: ${salaryContext}

JOB DESCRIPTION:
${jobDescription.slice(0, 3000)}

CANDIDATE'S RELEVANT CAREER VAULT:
${vaultSummary}

Return valid JSON with sections: company_brief, tech_questions, behavioral_stories, salary_strategy`

  const response = await anthropic.messages.create({
    model: REASONING_MODEL,
    max_tokens: 8096,
    system: [cachedText(INTERVIEW_PREP_SYSTEM_PROMPT)],
    messages: [{ role: 'user', content: userPrompt }],
  })

  const raw = (response.content[0] as { type: string; text: string }).text.trim()
  const jsonStr = raw.startsWith('```') ? raw.split('```')[1].replace(/^json\n?/, '') : raw
  const prep: InterviewPrepResult = JSON.parse(jsonStr)

  return {
    result: prep,
    reasoning: `Generated ${(prep.tech_questions as unknown[])?.length ?? 0} tech questions and ${(prep.behavioral_stories as unknown[])?.length ?? 0} STAR stories from your Career Vault.`,
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    model: REASONING_MODEL,
    cachedTokens: response.usage.cache_read_input_tokens ?? 0,
  }
}
