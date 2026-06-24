/**
 * Tests for ResumeSelectAgent — REQ-011 (multi-profile discovery spec)
 *
 * These are unit tests that mock Prisma and Claude calls so they run
 * without a database connection.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Prisma mock ---
const mockFindMany = vi.fn()
vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    baseResume: {
      findMany: mockFindMany,
    },
  },
}))

// --- Claude mock ---
const mockCreate = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: mockCreate }
  },
}))

// Import after mocking
const { selectBestResume } = await import('@/lib/claude/agents/ResumeSelectAgent')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('selectBestResume', () => {
  it('returns the single resume immediately without a Claude call when only one resume exists', async () => {
    // EDGE-002: when only 1 resume, skip scoring
    mockFindMany.mockResolvedValueOnce([
      { id: 'resume-1', label: 'Backend Resume', rawText: 'Go developer 5 years', content: {} },
    ])

    const result = await selectBestResume('user-1', 'Looking for a Go developer')
    expect(result.result.baseResumeId).toBe('resume-1')
    // No Claude call should have been made
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('throws 422 when user has no active resumes', async () => {
    // EDGE-007: 0 resumes → throw
    mockFindMany.mockResolvedValueOnce([])

    await expect(selectBestResume('user-2', 'Any JD')).rejects.toThrow(
      'No active resume found. Upload a resume first.'
    )
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('calls Claude and returns the highest-scored resume when multiple resumes exist', async () => {
    mockFindMany.mockResolvedValueOnce([
      { id: 'resume-1', label: 'Frontend', rawText: 'React developer', content: {} },
      { id: 'resume-2', label: 'Backend', rawText: 'Go + Postgres', content: {} },
    ])

    // scoreResumeAgainstJd reads response.content[0].text (JSON string) — one call per resume
    const textResponse = (score: number, reasoning: string) => ({
      content: [{ type: 'text', text: JSON.stringify({ score, reasoning }) }],
    })
    mockCreate
      .mockResolvedValueOnce(textResponse(60, 'Partial match — React not relevant'))
      .mockResolvedValueOnce(textResponse(85, 'Strong match on backend stack'))

    const result = await selectBestResume('user-3', 'Looking for a Go backend developer')
    expect(result.result.baseResumeId).toBe('resume-2')
    expect(result.result.score).toBe(85)
    // 2 resumes → 2 Claude calls (concurrency=3, both run in parallel)
    expect(mockCreate).toHaveBeenCalledTimes(2)
  })
})
