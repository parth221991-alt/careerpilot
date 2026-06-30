import Groq from 'groq-sdk'

// ── Groq client (singleton) ───────────────────────────────────────────────────

const globalForGroq = globalThis as unknown as { groqClient: Groq }

const groqClient: Groq =
  globalForGroq.groqClient ??
  new Groq({ apiKey: process.env.GROQ_API_KEY })

if (process.env.NODE_ENV !== 'production') globalForGroq.groqClient = groqClient

// ── Model aliases ─────────────────────────────────────────────────────────────

export const REASONING_MODEL = 'llama-3.3-70b-versatile'
export const THROUGHPUT_MODEL = 'llama-3.1-8b-instant'

// ── cachedText: kept for API compatibility (no-op on Groq) ───────────────────

export type CachedTextBlock = {
  type: 'text'
  text: string
  cache_control?: { type: 'ephemeral' }
}

export function cachedText(text: string): CachedTextBlock {
  return { type: 'text', text }
}

// ── Response shape that agents expect ────────────────────────────────────────

type AnthropicCompatResponse = {
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'tool_use'; name: string; input: Record<string, unknown> }
  >
  usage: {
    input_tokens: number
    output_tokens: number
    cache_read_input_tokens: number
  }
}

// ── Tool definitions (Anthropic format → Groq format) ─────────────────────────

type AnthropicTool = {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

type AnthropicToolChoice =
  | { type: 'auto' }
  | { type: 'any' }
  | { type: 'tool'; name: string }

// ── Main create params ────────────────────────────────────────────────────────

type CreateParams = {
  model: string
  max_tokens: number
  system: CachedTextBlock[]
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  tools?: AnthropicTool[]
  tool_choice?: AnthropicToolChoice
}

// ── Anthropic-compatible shim backed by Groq ─────────────────────────────────

async function create(params: CreateParams): Promise<AnthropicCompatResponse> {
  const systemText = params.system.map(b => b.text).join('\n\n')

  const groqMessages: Groq.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemText },
    ...params.messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ]

  // ── Tool-use path ──────────────────────────────────────────────────────────
  if (params.tools && params.tools.length > 0) {
    const groqTools: Groq.Chat.ChatCompletionTool[] = params.tools.map(t => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema as Record<string, unknown>,
      },
    }))

    let toolChoice: Groq.Chat.ChatCompletionToolChoiceOption = 'auto'
    if (params.tool_choice?.type === 'tool') {
      toolChoice = { type: 'function', function: { name: params.tool_choice.name } }
    } else if (params.tool_choice?.type === 'any') {
      toolChoice = 'required'
    }

    const response = await groqClient.chat.completions.create({
      model: params.model,
      max_tokens: params.max_tokens,
      messages: groqMessages,
      tools: groqTools,
      tool_choice: toolChoice,
    })

    const toolCall = response.choices[0]?.message?.tool_calls?.[0]
    if (!toolCall) {
      // Fallback: try to parse text as JSON if no tool call
      const text = response.choices[0]?.message?.content ?? '{}'
      const input = JSON.parse(text) as Record<string, unknown>
      return {
        content: [{ type: 'tool_use', name: params.tools[0].name, input }],
        usage: {
          input_tokens: response.usage?.prompt_tokens ?? 0,
          output_tokens: response.usage?.completion_tokens ?? 0,
          cache_read_input_tokens: 0,
        },
      }
    }

    const input = JSON.parse(toolCall.function.arguments) as Record<string, unknown>
    return {
      content: [{ type: 'tool_use', name: toolCall.function.name, input }],
      usage: {
        input_tokens: response.usage?.prompt_tokens ?? 0,
        output_tokens: response.usage?.completion_tokens ?? 0,
        cache_read_input_tokens: 0,
      },
    }
  }

  // ── Standard text-completion path ─────────────────────────────────────────
  const response = await groqClient.chat.completions.create({
    model: params.model,
    max_tokens: params.max_tokens,
    messages: groqMessages,
  })

  const text = response.choices[0]?.message?.content ?? ''
  return {
    content: [{ type: 'text', text }],
    usage: {
      input_tokens: response.usage?.prompt_tokens ?? 0,
      output_tokens: response.usage?.completion_tokens ?? 0,
      cache_read_input_tokens: 0,
    },
  }
}

// ── Drop-in Anthropic client shim ────────────────────────────────────────────

export const anthropic = {
  messages: { create },
}
