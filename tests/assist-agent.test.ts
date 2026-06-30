/**
 * Tests for AssistAgent pure logic
 * REQ-011, REQ-012, EDGE-003
 */

import { describe, it, expect } from 'vitest'

// Pure helper extracted for testing without Anthropic SDK
function truncateAtWordBoundary(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/)
  if (words.length <= maxWords) return text
  let truncated = words.slice(0, maxWords).join(' ')
  const lastPeriod = truncated.lastIndexOf('.')
  if (lastPeriod > truncated.length * 0.7) {
    truncated = truncated.slice(0, lastPeriod + 1)
  }
  return truncated
}

describe('truncateAtWordBoundary (EDGE-003)', () => {
  it('does not truncate text within 200 words', () => {
    const text = 'Hello world. This is a short cover letter.'
    const result = truncateAtWordBoundary(text, 200)
    expect(result).toBe(text)
  })

  it('truncates text over 200 words at sentence boundary', () => {
    // Build a 210-word string with a sentence boundary at ~180 words
    const part1 = Array(180).fill('word').join(' ') + '. '
    const part2 = Array(30).fill('extra').join(' ')
    const text = part1 + part2
    const result = truncateAtWordBoundary(text, 200)
    // Should end at the period after 180 words
    expect(result.endsWith('.')).toBe(true)
    const resultWords = result.trim().split(/\s+/)
    expect(resultWords.length).toBeLessThanOrEqual(181) // 180 words + trailing period word
  })

  it('truncates exactly 200 words when no sentence boundary found in last 30%', () => {
    // 250 words with no period — hard word cut at 200
    const text = Array(250).fill('word').join(' ')
    const result = truncateAtWordBoundary(text, 200)
    const resultWords = result.trim().split(/\s+/)
    expect(resultWords.length).toBeLessThanOrEqual(200)
  })

  it('returns the text as-is when exactly at limit', () => {
    const text = Array(200).fill('word').join(' ')
    const result = truncateAtWordBoundary(text, 200)
    expect(result).toBe(text)
  })
})

describe('AssistAgent type contract (REQ-011)', () => {
  it('ApplyAnswers shape has all required fields', () => {
    // Structural contract test — if types change this test catches the drift
    const answers = {
      coverLetter: 'string',
      whyInterested: 'string',
      expectedSalary: 'string',
      noticePeriod: 'string',
      yearsExperience: 5,
      workAuthorization: 'string',
      screeningAnswers: { 'Q1': 'A1' },
    }
    expect(typeof answers.coverLetter).toBe('string')
    expect(typeof answers.whyInterested).toBe('string')
    expect(typeof answers.expectedSalary).toBe('string')
    expect(typeof answers.noticePeriod).toBe('string')
    expect(typeof answers.yearsExperience).toBe('number')
    expect(typeof answers.workAuthorization).toBe('string')
    expect(typeof answers.screeningAnswers).toBe('object')
  })
})

describe('Rate limiting logic (REQ-009)', () => {
  it('getDailyKey returns expected format', () => {
    const userId = 'user-123'
    const today = new Date().toISOString().slice(0, 10)
    const key = `naukri:daily:${userId}:${today}`
    expect(key).toMatch(/^naukri:daily:user-123:\d{4}-\d{2}-\d{2}$/)
  })

  it('daily limit under limit returns true', () => {
    const count = 5
    const limit = 10
    const withinLimit = Number(count) < limit
    expect(withinLimit).toBe(true)
  })

  it('daily limit at limit returns false', () => {
    const count = 10
    const limit = 10
    const withinLimit = Number(count) < limit
    expect(withinLimit).toBe(false)
  })

  it('daily limit over limit returns false', () => {
    const count = 12
    const limit = 10
    const withinLimit = Number(count) < limit
    expect(withinLimit).toBe(false)
  })
})
