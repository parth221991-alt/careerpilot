import { z } from 'zod'
import { anthropic, THROUGHPUT_MODEL, cachedText } from '@/lib/claude/client'
import type { AgentOutput, MarketSignal, MarketIntelligence, SkillFrequency, SalaryByRole } from '@/types/agents'

const MARKET_INSIGHTS_SYSTEM = `You are a concise job market analyst. Given pre-computed market signals, write a clear one-line value for each signal that helps a job seeker take immediate action.

Rules:
- Each value must be ≤ 15 words
- Be specific: include numbers, platform names, skill names
- No filler phrases like "It appears" or "Please note"
- Use ₹ for INR, format lakhs as ₹XL (e.g. ₹12L = 1,200,000 INR)`

const MarketSignalSchema = z.object({
  type: z.enum(['salary_positioning', 'skill_gap', 'market_heat', 'best_source']),
  label: z.string(),
  value: z.string(),
  icon: z.string(),
})

const InsightsToolSchema = z.object({
  signals: z.array(MarketSignalSchema).length(4),
})

// ── Pure computation helpers (exported for unit tests) ─────────────────────────

export type SalaryPositioningRaw = {
  direction: 'above' | 'below' | 'at' | 'unknown'
  role: string | null
  profileMin: number | null
  profileMax: number | null
  marketMin: number | null
  marketMax: number | null
  currency: string
}

export type MarketHeatRaw = {
  today: number
  sevenDayAvg: number
  direction: 'up' | 'down' | 'stable'
}

export function computeSkillGap(
  topSkills: SkillFrequency[],
  resumeText: string,
  totalJobs: number,
  thresholdPct: number,
): string[] {
  if (totalJobs === 0 || topSkills.length === 0) return []
  const resumeLower = resumeText.toLowerCase()
  const threshold = totalJobs * (thresholdPct / 100)
  return topSkills
    .filter(s => s.count >= threshold)
    .filter(s => !resumeLower.includes(s.skill.toLowerCase()))
    .slice(0, 5)
    .map(s => s.skill)
}

export function computeSalaryPositioning(
  salaryByRole: SalaryByRole[],
  targetRoles: string[],
  profileMin: number | null,
  profileMax: number | null,
): SalaryPositioningRaw {
  if (!profileMin && !profileMax) {
    return { direction: 'unknown', role: null, profileMin, profileMax, marketMin: null, marketMax: null, currency: 'INR' }
  }
  const targetLower = targetRoles.map(r => r.toLowerCase())
  const match = salaryByRole.find(r => targetLower.some(t => r.role.toLowerCase().includes(t) || t.includes(r.role.toLowerCase()))) ?? salaryByRole[0]
  if (!match) {
    return { direction: 'unknown', role: null, profileMin, profileMax, marketMin: null, marketMax: null, currency: 'INR' }
  }
  const profileMid = ((profileMin ?? 0) + (profileMax ?? profileMin ?? 0)) / 2
  const marketMid = (match.medianMin + match.medianMax) / 2
  const tolerance = 0.1
  let direction: 'above' | 'below' | 'at'
  if (profileMid > marketMid * (1 + tolerance)) direction = 'above'
  else if (profileMid < marketMid * (1 - tolerance)) direction = 'below'
  else direction = 'at'
  return { direction, role: match.role, profileMin, profileMax, marketMin: match.medianMin, marketMax: match.medianMax, currency: match.currency }
}

export function computeMarketHeat(today: number, sevenDayAvg: number): MarketHeatRaw {
  const direction: 'up' | 'down' | 'stable' =
    sevenDayAvg === 0
      ? 'stable'
      : today > sevenDayAvg * 1.2
        ? 'up'
        : today < sevenDayAvg * 0.8
          ? 'down'
          : 'stable'
  return { today, sevenDayAvg: Math.round(sevenDayAvg * 10) / 10, direction }
}

// ── Main agent ─────────────────────────────────────────────────────────────────

type InsightContext = {
  analytics: MarketIntelligence
  resumeText: string
  hasResume: boolean   // EDGE-001: false when user has no active resumes
  hasProfile: boolean  // EDGE-002: false when user has no active job profile
  targetRoles: string[]
  profileSalaryMin: number | null
  profileSalaryMax: number | null
  sevenDayAvg: number
  thresholdPct: number
  minJobsForInsights: number
}

const PLACEHOLDER_SIGNAL = (type: MarketSignal['type'], label: string, icon: string): MarketSignal => ({
  type, label, value: 'Not enough data yet — discover more jobs.', icon,
})

export async function generateMarketInsights(
  ctx: InsightContext,
): Promise<AgentOutput<MarketSignal[]>> {
  const totalJobs = ctx.analytics.remoteBySource.reduce((sum, r) => sum + r.totalJobs, 0)

  if (totalJobs < ctx.minJobsForInsights) {
    return {
      result: [
        PLACEHOLDER_SIGNAL('salary_positioning', 'Salary Positioning', 'TrendingUp'),
        PLACEHOLDER_SIGNAL('skill_gap', 'Skill Gap', 'AlertTriangle'),
        PLACEHOLDER_SIGNAL('market_heat', 'Market Heat', 'Activity'),
        PLACEHOLDER_SIGNAL('best_source', 'Best Source', 'Globe'),
      ],
      reasoning: 'Insufficient data — returned placeholder signals.',
      tokensUsed: 0,
      model: THROUGHPUT_MODEL,
      cachedTokens: 0,
    }
  }

  const skillGap = computeSkillGap(ctx.analytics.topSkills, ctx.resumeText, totalJobs, ctx.thresholdPct)
  const salaryRaw = computeSalaryPositioning(ctx.analytics.salaryByRole, ctx.targetRoles, ctx.profileSalaryMin, ctx.profileSalaryMax)
  const heatRaw = computeMarketHeat(ctx.analytics.freshJobsToday, ctx.sevenDayAvg)
  const bestSrc = [...ctx.analytics.remoteBySource].sort((a, b) => b.totalJobs - a.totalJobs)[0]

  const userMessage = [
    `SALARY: ${salaryRaw.direction === 'unknown'
      ? 'No salary target set in job profile'
      : `Profile ₹${Math.round((salaryRaw.profileMin ?? 0) / 100000)}L–₹${Math.round((salaryRaw.profileMax ?? 0) / 100000)}L vs market ₹${Math.round((salaryRaw.marketMin ?? 0) / 100000)}L–₹${Math.round((salaryRaw.marketMax ?? 0) / 100000)}L for ${salaryRaw.role ?? 'target role'} (${salaryRaw.direction} market)`
    }`,
    `SKILLS_MISSING: ${skillGap.length > 0 ? skillGap.join(', ') : 'None — all top skills found in resume'}`,
    `HEAT: ${heatRaw.today} jobs today vs ${heatRaw.sevenDayAvg}/day avg this week (${heatRaw.direction})`,
    `SOURCE: ${bestSrc ? `${bestSrc.platform} has most jobs (${bestSrc.totalJobs} total, ${bestSrc.remotePercent}% remote)` : 'No source data yet'}`,
    '',
    'Write 4 signals. Icons must be one of: TrendingUp, AlertTriangle, Activity, Globe',
  ].join('\n')

  const response = await anthropic.messages.create({
    model: THROUGHPUT_MODEL,
    max_tokens: 512,
    system: [cachedText(MARKET_INSIGHTS_SYSTEM)],
    tools: [
      {
        name: 'report_market_signals',
        description: 'Report the 4 formatted market signal cards.',
        input_schema: {
          type: 'object' as const,
          properties: {
            signals: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['salary_positioning', 'skill_gap', 'market_heat', 'best_source'] },
                  label: { type: 'string' },
                  value: { type: 'string' },
                  icon: { type: 'string' },
                },
                required: ['type', 'label', 'value', 'icon'],
              },
              minItems: 4,
              maxItems: 4,
            },
          },
          required: ['signals'],
        },
      },
    ],
    tool_choice: { type: 'tool' as const, name: 'report_market_signals' },
    messages: [{ role: 'user', content: userMessage }],
  })

  const toolBlock = response.content.find(b => b.type === 'tool_use')
  if (!toolBlock || toolBlock.type !== 'tool_use') {
    throw new Error('Claude did not return tool_use block')
  }

  const parsed = InsightsToolSchema.safeParse(toolBlock.input)
  if (!parsed.success) {
    throw new Error(`Claude response failed validation: ${parsed.error.message}`)
  }

  const signals = parsed.data.signals

  // EDGE-001: no resume — override skill_gap with exact spec string
  if (!ctx.hasResume) {
    const s = signals.find(sig => sig.type === 'skill_gap')
    if (s) s.value = 'Upload a resume to detect skill gaps.'
  }

  // EDGE-002: no job profile — override salary_positioning with exact spec string
  if (!ctx.hasProfile) {
    const s = signals.find(sig => sig.type === 'salary_positioning')
    if (s) s.value = 'Create a Job Profile to see salary positioning.'
  }

  return {
    result: signals,
    reasoning: 'Market insights generated from discovered job data.',
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    model: THROUGHPUT_MODEL,
    cachedTokens: response.usage.cache_read_input_tokens ?? 0,
  }
}
