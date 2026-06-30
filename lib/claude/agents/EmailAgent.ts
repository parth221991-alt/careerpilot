import { anthropic, THROUGHPUT_MODEL, REASONING_MODEL, cachedText } from '@/lib/claude/client'
import { EMAIL_CLASSIFIER_SYSTEM_PROMPT, EMAIL_DRAFT_SYSTEM_PROMPT } from '@/lib/claude/prompts/email-agent'
import type { EmailClassification, AgentOutput } from '@/types/agents'

export async function classifyEmail(
  subject: string,
  sender: string,
  body: string,
): Promise<AgentOutput<EmailClassification>> {
  const userPrompt = `Classify this email.

Subject: ${subject}
From: ${sender}
Body: ${body.slice(0, 1500)}

Return JSON: { "classification": "INTERVIEW_INVITE|REJECTION|ASSESSMENT|OFFER|FOLLOW_UP|FOLLOW_UP_NEEDED|GHOSTED|GENERAL", "confidence": 0.0-1.0, "company": "", "role": "", "action_required": true|false, "urgency": "high|medium|low", "summary": "one sentence" }`

  const response = await anthropic.messages.create({
    model: THROUGHPUT_MODEL,
    max_tokens: 512,
    system: [cachedText(EMAIL_CLASSIFIER_SYSTEM_PROMPT)],
    messages: [{ role: 'user', content: userPrompt }],
  })

  const raw = (response.content[0] as { type: string; text: string }).text.trim()
  const jsonStr = raw.startsWith('```') ? raw.split('```')[1].replace(/^json\n?/, '') : raw
  const classification: EmailClassification = JSON.parse(jsonStr)

  return {
    result: classification,
    reasoning: classification.summary,
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    model: THROUGHPUT_MODEL,
    cachedTokens: response.usage.cache_read_input_tokens ?? 0,
  }
}

export async function draftEmailReply(
  subject: string,
  emailBody: string,
  classification: string,
  context: string,
): Promise<AgentOutput<string>> {
  const userPrompt = `Draft a reply to this ${classification.toLowerCase().replace('_', ' ')} email.

Original email subject: ${subject}
Original email body: ${emailBody.slice(0, 1000)}

Context about the candidate: ${context}

Write the email body only. No subject. No signature.`

  const response = await anthropic.messages.create({
    model: REASONING_MODEL,
    max_tokens: 1024,
    system: [cachedText(EMAIL_DRAFT_SYSTEM_PROMPT)],
    messages: [{ role: 'user', content: userPrompt }],
  })

  const draft = (response.content[0] as { type: string; text: string }).text.trim()

  return {
    result: draft,
    reasoning: 'Draft generated. Requires your approval before sending.',
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    model: REASONING_MODEL,
    cachedTokens: response.usage.cache_read_input_tokens ?? 0,
  }
}
