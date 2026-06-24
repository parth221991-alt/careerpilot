export type AgentOutput<T> = {
  result: T
  reasoning: string
  tokensUsed: number
  model: string
  cachedTokens: number
}

// ── Vault Agent ───────────────────────────────────────────────────────────────

export type CareerVaultExtraction = {
  headline: string
  summary: string
  experiences: VaultExperience[]
  projects: VaultProject[]
  skills: VaultSkill[]
  certifications: VaultCertification[]
  achievements: VaultAchievement[]
}

export type VaultExperience = {
  company: string
  title: string
  location: string
  startDate: string
  endDate: string | null
  isCurrent: boolean
  description: string
  bullets: string[]
  techStack: string[]
  impactMetrics: Record<string, unknown>
}

export type VaultProject = {
  name: string
  description: string
  techStack: string[]
  outcomes: string[]
  url?: string
}

export type VaultSkill = {
  name: string
  category: 'LANGUAGE' | 'FRAMEWORK' | 'CLOUD' | 'DATABASE' | 'TOOL' | 'METHODOLOGY' | 'SOFT'
  proficiency: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT'
  yearsUsed?: number
}

export type VaultCertification = {
  name: string
  issuer: string
  issuedAt: string
  expiresAt?: string | null
  credentialUrl?: string
}

export type VaultAchievement = {
  title: string
  description: string
  impact?: string
  date: string
}

// ── Resume Agent ──────────────────────────────────────────────────────────────

export type TailoredResume = {
  summary: string
  skills: string[]
  experience: {
    company: string
    title: string
    location: string
    startDate: string
    endDate: string
    bullets: string[]
  }[]
  education: {
    institution: string
    degree: string
    field: string
    year: string
  }[]
  certifications: { name: string; issuer: string; year: string }[]
  injectedKeywords: string[]
  reasoning: string
}

export type ATSAnalysis = {
  score: number
  component_scores: {
    keyword_coverage: number
    semantic_alignment: number
    seniority_match: number
    format_compliance: number
  }
  matched_skills: string[]
  missing_critical_skills: string[]
  missing_nice_to_have: string[]
  recommendations: string[]
  reasoning: string
}

// ── Email Agent ───────────────────────────────────────────────────────────────

export type EmailClassification = {
  classification: 'INTERVIEW_INVITE' | 'REJECTION' | 'ASSESSMENT' | 'OFFER' | 'FOLLOW_UP' | 'GENERAL' | 'GHOSTED' | 'FOLLOW_UP_NEEDED'
  confidence: number
  company: string
  role: string
  action_required: boolean
  urgency: 'high' | 'medium' | 'low'
  summary: string
}

// ── Discovery Agent ───────────────────────────────────────────────────────────

export type JobMatchResult = {
  score: number
  reasoning: string
  matched_skills: string[]
  missing_critical_skills: string[]
  missing_nice_to_have: string[]
  seniority_fit: 'strong' | 'adequate' | 'stretch' | 'overqualified'
  recommendation: 'apply' | 'consider' | 'skip'
}

export type ParsedJD = {
  required_skills: string[]
  preferred_skills: string[]
  tech_stack: string[]
  min_years_experience: number | null
  seniority_level: 'junior' | 'mid' | 'senior' | 'staff' | 'principal' | 'manager'
  role_type: string
  domain: string
  remote_type: 'remote' | 'hybrid' | 'onsite' | 'flexible'
}

// ── Resume Select Agent ───────────────────────────────────────────────────────

export type ResumeSelectResult = {
  baseResumeId: string
  label: string
  score: number
  reasoning: string
}

// ── Assist Agent (LinkedIn Apply Answers) ─────────────────────────────────────

export type UserProfileContext = {
  name: string
  yearsExperience: number
  expectedSalaryMin: number | null
  expectedSalaryMax: number | null
  currency: string
  noticePeriodDays: number
  location: string
  remotePreference: string
}

export type ApplyAnswers = {
  coverLetter: string
  whyInterested: string
  expectedSalary: string
  noticePeriod: string
  yearsExperience: number
  workAuthorization: string
  screeningAnswers: Record<string, string>
}

// ── Market Intelligence Insights ─────────────────────────────────────────────

export type MarketSignal = {
  type: 'salary_positioning' | 'skill_gap' | 'market_heat' | 'best_source'
  label: string
  value: string
  icon: string
}

// ── Market Intelligence ───────────────────────────────────────────────────────

export type SalaryByRole = {
  role: string
  medianMin: number
  medianMax: number
  currency: string
  sampleSize: number
}

export type SkillFrequency = {
  skill: string
  count: number
}

export type CompanyVelocity = {
  company: string
  jobCount: number
}

export type RemoteBySource = {
  platform: string
  totalJobs: number
  remoteJobs: number
  remotePercent: number
}

export type MarketIntelligence = {
  salaryByRole: SalaryByRole[]
  topSkills: SkillFrequency[]
  companyHiringVelocity: CompanyVelocity[]
  remoteBySource: RemoteBySource[]
  freshJobsToday: number
  dataQualityWarning?: string
  computedAt: string
}

// ── Interview Agent ───────────────────────────────────────────────────────────

export type InterviewPrepResult = {
  company_brief: {
    mission: string
    products: string
    tech_culture: string
    recent_news: string
    interview_style: string
  }
  tech_questions: {
    question: string
    difficulty: 'foundational' | 'intermediate' | 'advanced'
    guidance: string
  }[]
  behavioral_stories: {
    theme: string
    situation: string
    task: string
    action: string
    result: string
    applicable_questions: string[]
  }[]
  salary_strategy: {
    target_range: string
    opening_ask: string
    minimum_acceptable: string
    talking_points: string[]
  }
}
