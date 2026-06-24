/**
 * Tests for plan-based profile limits — REQ-015 (multi-profile discovery spec)
 *
 * Verifies that FREE=1, PRO=3, ENTERPRISE=5 limits are enforced correctly.
 */

import { describe, it, expect } from 'vitest'

type Plan = 'FREE' | 'PRO' | 'ENTERPRISE'

const PLAN_PROFILE_LIMITS: Record<Plan, number> = {
  FREE: 1,
  PRO: 3,
  ENTERPRISE: 5,
}

function canCreateProfile(plan: Plan, activeCount: number): { allowed: boolean; message?: string } {
  const limit = PLAN_PROFILE_LIMITS[plan]
  if (activeCount >= limit) {
    return {
      allowed: false,
      message: plan === 'FREE'
        ? 'Upgrade to Pro to create multiple profiles.'
        : `You have reached the ${plan} plan limit of ${limit} profiles.`,
    }
  }
  return { allowed: true }
}

describe('Plan profile limits (EDGE-006)', () => {
  it('FREE plan: allows first profile creation', () => {
    expect(canCreateProfile('FREE', 0).allowed).toBe(true)
  })

  it('FREE plan: blocks second profile with correct upgrade message', () => {
    const result = canCreateProfile('FREE', 1)
    expect(result.allowed).toBe(false)
    expect(result.message).toBe('Upgrade to Pro to create multiple profiles.')
  })

  it('PRO plan: allows up to 3 profiles', () => {
    expect(canCreateProfile('PRO', 0).allowed).toBe(true)
    expect(canCreateProfile('PRO', 1).allowed).toBe(true)
    expect(canCreateProfile('PRO', 2).allowed).toBe(true)
  })

  it('PRO plan: blocks 4th profile with limit message', () => {
    const result = canCreateProfile('PRO', 3)
    expect(result.allowed).toBe(false)
    expect(result.message).toContain('PRO')
    expect(result.message).toContain('3')
  })

  it('ENTERPRISE plan: allows up to 5 profiles', () => {
    for (let i = 0; i < 5; i++) {
      expect(canCreateProfile('ENTERPRISE', i).allowed).toBe(true)
    }
  })

  it('ENTERPRISE plan: blocks 6th profile', () => {
    const result = canCreateProfile('ENTERPRISE', 5)
    expect(result.allowed).toBe(false)
    expect(result.message).toContain('5')
  })
})
