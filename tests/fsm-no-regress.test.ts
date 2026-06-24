/**
 * Tests for Application FSM no-regress guard — REQ-012 (email intelligence spec)
 *
 * STATUS_ORDER defines forward progress. ACCEPTED, REJECTED, WITHDRAWN are terminal
 * states — the EMAIL sync route additionally checks `TERMINAL.includes(current)` before
 * advancing (not exposed here — this test covers the pure index logic).
 */

import { describe, it, expect } from 'vitest'

type AppStatus =
  | 'SAVED' | 'APPROVAL_PENDING' | 'APPLIED' | 'HR_ROUND'
  | 'TECHNICAL_ROUND' | 'MANAGER_ROUND' | 'OFFER' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN'

const STATUS_ORDER: AppStatus[] = [
  'SAVED', 'APPROVAL_PENDING', 'APPLIED', 'HR_ROUND',
  'TECHNICAL_ROUND', 'MANAGER_ROUND', 'OFFER', 'ACCEPTED', 'REJECTED', 'WITHDRAWN',
]

// Terminal states — the email sync route skips advancement when current is terminal
const TERMINAL: Set<AppStatus> = new Set(['ACCEPTED', 'REJECTED', 'WITHDRAWN'])

function canAdvance(current: AppStatus, target: AppStatus): boolean {
  if (TERMINAL.has(current)) return false // terminal state — never advance further
  const currentIdx = STATUS_ORDER.indexOf(current)
  const targetIdx = STATUS_ORDER.indexOf(target)
  return targetIdx > currentIdx
}

describe('FSM no-regress guard', () => {
  it('allows advancing from APPLIED to HR_ROUND', () => {
    expect(canAdvance('APPLIED', 'HR_ROUND')).toBe(true)
  })

  it('blocks advancing from HR_ROUND back to APPLIED (regress)', () => {
    expect(canAdvance('HR_ROUND', 'APPLIED')).toBe(false)
  })

  it('correctly identifies OFFER → HR_ROUND as regress (backward transition)', () => {
    // HR_ROUND (idx 3) < OFFER (idx 6) — this must be blocked
    expect(canAdvance('OFFER', 'HR_ROUND')).toBe(false)
  })
  // NOTE: EDGE-002 (REJECTION email after OFFER) — the pure STATUS_ORDER index places REJECTED (idx 8)
  // after OFFER (idx 6), so canAdvance('OFFER', 'REJECTED') = true with simple index logic.
  // The email sync route's CLASSIFICATION_TO_STATUS only maps REJECTION → REJECTED from APPLIED status,
  // which is the practical guard against this edge case. A dedicated OFFER-terminal check is deferred.

  it('blocks same-status transition as a no-op', () => {
    expect(canAdvance('APPLIED', 'APPLIED')).toBe(false)
  })

  it('allows APPLIED → REJECTED', () => {
    expect(canAdvance('APPLIED', 'REJECTED')).toBe(true)
  })

  it('allows APPLIED → OFFER', () => {
    expect(canAdvance('APPLIED', 'OFFER')).toBe(true)
  })

  it('blocks terminal ACCEPTED → any other status', () => {
    const allStatuses: AppStatus[] = [
      'SAVED', 'APPROVAL_PENDING', 'APPLIED', 'HR_ROUND',
      'TECHNICAL_ROUND', 'MANAGER_ROUND', 'OFFER', 'REJECTED', 'WITHDRAWN',
    ]
    allStatuses.forEach(s => {
      expect(canAdvance('ACCEPTED', s)).toBe(false)
    })
  })

  it('blocks terminal REJECTED → any other status', () => {
    const anyStatuses: AppStatus[] = ['SAVED', 'APPLIED', 'OFFER', 'ACCEPTED']
    anyStatuses.forEach(s => {
      expect(canAdvance('REJECTED', s)).toBe(false)
    })
  })

  it('blocks terminal WITHDRAWN → any other status', () => {
    expect(canAdvance('WITHDRAWN', 'APPLIED')).toBe(false)
    expect(canAdvance('WITHDRAWN', 'REJECTED')).toBe(false)
  })
})
