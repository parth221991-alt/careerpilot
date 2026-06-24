import Anthropic from '@anthropic-ai/sdk'

const globalForAnthropic = globalThis as unknown as { anthropic: Anthropic }

export const anthropic =
  globalForAnthropic.anthropic ??
  new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

if (process.env.NODE_ENV !== 'production') globalForAnthropic.anthropic = anthropic

export const REASONING_MODEL = 'claude-sonnet-4-6'
export const THROUGHPUT_MODEL = 'claude-haiku-4-5-20251001'

export type CachedTextBlock = {
  type: 'text'
  text: string
  cache_control: { type: 'ephemeral' }
}

export function cachedText(text: string): CachedTextBlock {
  return { type: 'text', text, cache_control: { type: 'ephemeral' } }
}
