/**
 * Unit tests for MarketInsightsAgent pure computation functions
 * REQ-001 to REQ-007 (market-intelligence-claude-insights spec)
 */

import { describe, it, expect } from 'vitest'
import {
  computeSkillGap,
  computeSalaryPositioning,
  computeMarketHeat,
} from '@/lib/claude/agents/MarketInsightsAgent'
import type { SkillFrequency, SalaryByRole } from '@/types/agents'

// ── computeSkillGap ────────────────────────────────────────────────────────────

describe('computeSkillGap', () => {
  it('returns skills in market not found in resume text', () => {
    const skills: SkillFrequency[] = [
      { skill: 'Kubernetes', count: 15 },
      { skill: 'React', count: 20 },
    ]
    const result = computeSkillGap(skills, 'Proficient in React and TypeScript', 100, 10)
    expect(result).toContain('Kubernetes')
    expect(result).not.toContain('React')
  })

  it('returns empty array when all top skills are in the resume', () => {
    const skills: SkillFrequency[] = [{ skill: 'React', count: 15 }]
    const result = computeSkillGap(skills, 'React developer with 5 years React', 100, 10)
    expect(result).toHaveLength(0)
  })

  it('filters out skills below the threshold', () => {
    const skills: SkillFrequency[] = [
      { skill: 'Go', count: 5 },  // 5/100 = 5% — below 10% threshold
      { skill: 'Rust', count: 15 }, // 15/100 = 15% — above threshold
    ]
    const result = computeSkillGap(skills, '', 100, 10)
    expect(result).not.toContain('Go')
    expect(result).toContain('Rust')
  })

  it('returns at most 5 skills', () => {
    const skills: SkillFrequency[] = Array.from({ length: 10 }, (_, i) => ({
      skill: `Skill${i}`,
      count: 20,
    }))
    const result = computeSkillGap(skills, '', 100, 10)
    expect(result.length).toBeLessThanOrEqual(5)
  })

  it('returns empty array when totalJobs is 0 (EDGE-005: no divide by zero)', () => {
    const skills: SkillFrequency[] = [{ skill: 'Go', count: 5 }]
    const result = computeSkillGap(skills, '', 0, 10)
    expect(result).toHaveLength(0)
  })
})

// ── computeSalaryPositioning ──────────────────────────────────────────────────

describe('computeSalaryPositioning', () => {
  const salaryData: SalaryByRole[] = [
    { role: 'Data Scientist', medianMin: 800_000, medianMax: 1_200_000, currency: 'INR', sampleSize: 5 },
  ]

  it('identifies above-market positioning', () => {
    const result = computeSalaryPositioning(salaryData, ['Data Scientist'], 1_500_000, 2_000_000)
    expect(result.direction).toBe('above')
    expect(result.role).toBe('Data Scientist')
  })

  it('identifies below-market positioning', () => {
    const result = computeSalaryPositioning(salaryData, ['Data Scientist'], 400_000, 600_000)
    expect(result.direction).toBe('below')
  })

  it('identifies at-market positioning (within 10% tolerance)', () => {
    const result = computeSalaryPositioning(salaryData, ['Data Scientist'], 850_000, 1_150_000)
    expect(result.direction).toBe('at')
  })

  it('returns unknown when profile has no salary set (EDGE-002)', () => {
    const result = computeSalaryPositioning(salaryData, ['Data Scientist'], null, null)
    expect(result.direction).toBe('unknown')
  })

  it('falls back to first salary record when no role matches', () => {
    const result = computeSalaryPositioning(salaryData, ['Frontend Engineer'], 1_500_000, 2_000_000)
    expect(result.direction).toBe('above')
    expect(result.role).toBe('Data Scientist')
  })
})

// ── computeMarketHeat ─────────────────────────────────────────────────────────

describe('computeMarketHeat', () => {
  it('detects accelerating market (today > avg * 1.2)', () => {
    const result = computeMarketHeat(10, 5)
    expect(result.direction).toBe('up')
    expect(result.today).toBe(10)
  })

  it('detects cooling market (today < avg * 0.8)', () => {
    const result = computeMarketHeat(2, 8)
    expect(result.direction).toBe('down')
  })

  it('detects stable market (within 20% band)', () => {
    const result = computeMarketHeat(5, 5)
    expect(result.direction).toBe('stable')
  })

  it('returns stable when sevenDayAvg is 0 (EDGE-005: no division errors)', () => {
    const result = computeMarketHeat(3, 0)
    expect(result.direction).toBe('stable')
  })

  it('rounds sevenDayAvg to 1 decimal place', () => {
    const result = computeMarketHeat(4, 3.333)
    expect(result.sevenDayAvg).toBe(3.3)
  })
})
