// Re-export Prisma types + extend with joined/computed fields

export type {
  User,
  CareerProfile,
  Experience,
  Project,
  Skill,
  Certification,
  Achievement,
  CareerGoal,
  BaseResume,
  ResumeVariant,
  Job,
  Application,
  StatusHistory,
  ApprovalGate,
  EmailThread,
  Recruiter,
  RecruiterInteraction,
  InterviewPrep,
  Offer,
  Notification,
} from '@prisma/client'

export type {
  Plan,
  RemotePref,
  SkillCat,
  Proficiency,
  Platform,
  AppStatus,
  TriggerType,
  ActionType,
  GateStatus,
  EmailClassType,
  InteractChannel,
  Direction,
  OfferOutcome,
} from '@prisma/client'

// ── Extended types with joins ─────────────────────────────────────────────────

import type { Job, Application, ApprovalGate } from '@prisma/client'

export type JobWithScore = Job & {
  _isApplied?: boolean
  _isSaved?: boolean
}

export type ApplicationWithJob = Application & {
  job: Job
}

export type PendingApproval = ApprovalGate & {
  application: Application & { job: Job } | null
}

// ── Pipeline stats ────────────────────────────────────────────────────────────

export type PipelineStats = {
  SAVED: number
  APPROVAL_PENDING: number
  APPLIED: number
  HR_ROUND: number
  TECHNICAL_ROUND: number
  MANAGER_ROUND: number
  OFFER: number
  ACCEPTED: number
  REJECTED: number
  WITHDRAWN: number
}

export type AnalyticsSummary = {
  totalApplications: number
  responseRate: number
  interviewRate: number
  offerRate: number
  avgAtsScore: number
  avgDaysToResponse: number
  topPlatform: string
  pipeline: PipelineStats
}
