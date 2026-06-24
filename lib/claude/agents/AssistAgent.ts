import { anthropic, REASONING_MODEL, cachedText } from '@/lib/claude/client'
import { ASSIST_AGENT_SYSTEM_PROMPT } from '@/lib/claude/prompts/assist-agent'
import type { AgentOutput, ApplyAnswers, UserProfileContext } from '@/types/agents'

function truncateAtWordBoundary(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/)
  if (words.length <= maxWords) return text
  let truncated = words.slice(0, maxWords).join(' ')
  // Find last sentence boundary
  const lastPeriod = truncated.lastIndexOf('.')
  if (lastPeriod > truncated.length * 0.7) {
    truncated = truncated.slice(0, lastPeriod + 1)
  }
  return truncated
}

export async function generateApplyAnswers(
  resumeVariantContent: string,
  jd: string,
  userProfile: UserProfileContext,
): Promise<AgentOutput<ApplyAnswers>> {
  const salaryText = userProfile.expectedSalaryMin && userProfile.expectedSalaryMax
    ? `${userProfile.currency} ${userProfile.expectedSalaryMin}–${userProfile.expectedSalaryMax}`
    : 'To be discussed'

  const noticePeriodText = userProfile.noticePeriodDays === 0
    ? 'Immediately available'
    : `${userProfile.noticePeriodDays} days`

  const userPrompt = `Generate application answers for this candidate.

CANDIDATE RESUME:
${resumeVariantContent.slice(0, 2500)}

JOB DESCRIPTION:
${jd.slice(0, 2000)}

CANDIDATE CONTEXT:
Name: ${userProfile.name}
Years of Experience: ${userProfile.yearsExperience}
Expected Salary: ${salaryText}
Notice Period: ${noticePeriodText}
Location: ${userProfile.location}
Remote Preference: ${userProfile.remotePreference}

Return JSON matching this exact shape:
{
  "coverLetter": "string (max 200 words)",
  "whyInterested": "string (2-3 sentences)",
  "expectedSalary": "string",
  "noticePeriod": "string",
  "yearsExperience": number,
  "workAuthorization": "string",
  "screeningAnswers": { "question text": "answer" }
}`

  const response = await anthropic.messages.create({
    model: REASONING_MODEL,
    max_tokens: 2048,
    system: [cachedText(ASSIST_AGENT_SYSTEM_PROMPT)],
    messages: [{ role: 'user', content: userPrompt }],
  })

  const raw = (response.content[0] as { type: string; text: string }).text.trim()
  const jsonStr = raw.startsWith('```') ? raw.split('```')[1].replace(/^json\n?/, '') : raw
  const answers: ApplyAnswers = JSON.parse(jsonStr)

  // Enforce 200-word cover letter limit (EDGE-003)
  if (answers.coverLetter) {
    answers.coverLetter = truncateAtWordBoundary(answers.coverLetter, 200)
  }

  return {
    result: answers,
    reasoning: 'Apply answers generated from resume content only.',
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    model: REASONING_MODEL,
    cachedTokens: response.usage.cache_read_input_tokens ?? 0,
  }
}
