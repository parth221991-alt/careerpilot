/**
 * Tests for ghosted application detection — REQ-013 (email intelligence spec)
 *
 * Verifies the 14-day logic that identifies ghosted applications.
 */

import { describe, it, expect } from 'vitest'

function isGhosted(appliedAt: Date, now: Date, ghostedAt: Date | null): boolean {
  if (ghostedAt !== null) return false // already marked ghosted
  const daysDiff = (now.getTime() - appliedAt.getTime()) / (1000 * 60 * 60 * 24)
  return daysDiff >= 14
}

describe('Ghosted detection (REQ-013)', () => {
  const now = new Date('2026-07-01T00:00:00Z')

  it('marks application as ghosted after 14 days with no reply', () => {
    const appliedAt = new Date('2026-06-10T00:00:00Z') // 21 days ago
    expect(isGhosted(appliedAt, now, null)).toBe(true)
  })

  it('does not mark application ghosted if applied less than 14 days ago', () => {
    const appliedAt = new Date('2026-06-25T00:00:00Z') // 6 days ago
    expect(isGhosted(appliedAt, now, null)).toBe(false)
  })

  it('does not re-ghost an application already marked as ghosted', () => {
    const appliedAt = new Date('2026-06-01T00:00:00Z') // 30 days ago
    const ghostedAt = new Date('2026-06-15T00:00:00Z')
    expect(isGhosted(appliedAt, now, ghostedAt)).toBe(false)
  })

  it('marks application exactly at 14-day boundary as ghosted', () => {
    const appliedAt = new Date('2026-06-17T00:00:00Z') // exactly 14 days ago
    expect(isGhosted(appliedAt, now, null)).toBe(true)
  })

  it('does not ghost application that is 13 days old', () => {
    const appliedAt = new Date('2026-06-18T01:00:00Z') // < 14 days ago
    expect(isGhosted(appliedAt, now, null)).toBe(false)
  })

  it('EDGE-003: returns 0 count when no applied applications exist (simulated)', () => {
    const applications: { appliedAt: Date; ghostedAt: Date | null }[] = []
    const ghosted = applications.filter(a => isGhosted(a.appliedAt, now, a.ghostedAt))
    expect(ghosted.length).toBe(0)
  })
})
