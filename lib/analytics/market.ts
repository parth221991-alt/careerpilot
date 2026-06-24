import { prisma } from '@/lib/db/prisma'
import type { MarketIntelligence, SalaryByRole, SkillFrequency, CompanyVelocity, RemoteBySource } from '@/types/agents'

// Static alias map for top tech skill normalization (EDGE-006)
const SKILL_ALIASES: Record<string, string> = {
  'reactjs': 'React',
  'react.js': 'React',
  'react js': 'React',
  'vuejs': 'Vue.js',
  'vue.js': 'Vue.js',
  'nodejs': 'Node.js',
  'node.js': 'Node.js',
  'node js': 'Node.js',
  'expressjs': 'Express.js',
  'express.js': 'Express.js',
  'nextjs': 'Next.js',
  'next.js': 'Next.js',
  'typescript': 'TypeScript',
  'ts': 'TypeScript',
  'javascript': 'JavaScript',
  'js': 'JavaScript',
  'python3': 'Python',
  'python 3': 'Python',
  'postgresql': 'PostgreSQL',
  'postgres': 'PostgreSQL',
  'mongodb': 'MongoDB',
  'mongo': 'MongoDB',
  'mysql': 'MySQL',
  'aws': 'AWS',
  'amazon web services': 'AWS',
  'gcp': 'GCP',
  'google cloud': 'GCP',
  'azure': 'Azure',
  'microsoft azure': 'Azure',
  'docker': 'Docker',
  'kubernetes': 'Kubernetes',
  'k8s': 'Kubernetes',
  'tensorflow': 'TensorFlow',
  'tf': 'TensorFlow',
  'pytorch': 'PyTorch',
  'scikit-learn': 'scikit-learn',
  'sklearn': 'scikit-learn',
  'pandas': 'pandas',
  'numpy': 'NumPy',
  'sql': 'SQL',
  'nosql': 'NoSQL',
  'graphql': 'GraphQL',
  'rest api': 'REST API',
  'restful': 'REST API',
  'java': 'Java',
  'golang': 'Go',
  'rust': 'Rust',
  'c++': 'C++',
  'cpp': 'C++',
  'machine learning': 'Machine Learning',
  'ml': 'Machine Learning',
  'deep learning': 'Deep Learning',
  'dl': 'Deep Learning',
  'nlp': 'NLP',
  'natural language processing': 'NLP',
  'data science': 'Data Science',
  'data analysis': 'Data Analysis',
  'data engineering': 'Data Engineering',
  'spark': 'Apache Spark',
  'apache spark': 'Apache Spark',
  'kafka': 'Apache Kafka',
  'apache kafka': 'Apache Kafka',
}

function normalizeSkill(skill: string): string {
  const lower = skill.toLowerCase().trim()
  return SKILL_ALIASES[lower] ?? skill.trim()
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

function normalizeRoleTitle(title: string): string {
  const lower = title.toLowerCase()
  if (lower.includes('data analyst')) return 'Data Analyst'
  if (lower.includes('data scientist')) return 'Data Scientist'
  if (lower.includes('data engineer')) return 'Data Engineer'
  if (lower.includes('machine learning') || lower.includes('ml engineer')) return 'ML Engineer'
  if (lower.includes('software engineer') || lower.includes('swe')) return 'Software Engineer'
  if (lower.includes('frontend') || lower.includes('front-end')) return 'Frontend Engineer'
  if (lower.includes('backend') || lower.includes('back-end')) return 'Backend Engineer'
  if (lower.includes('full stack') || lower.includes('fullstack')) return 'Full Stack Engineer'
  if (lower.includes('devops')) return 'DevOps Engineer'
  if (lower.includes('product manager')) return 'Product Manager'
  if (lower.includes('ux') || lower.includes('designer')) return 'UX Designer'
  return title // fallback: keep as-is
}

export async function computeMarketIntelligence(userId: string): Promise<MarketIntelligence> {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [allJobs, freshJobsToday] = await Promise.all([
    prisma.job.findMany({
      where: { userId, isActive: true },
      select: {
        title: true,
        company: true,
        salaryMin: true,
        salaryMax: true,
        salaryCurrency: true,
        requiredSkills: true,
        isRemote: true,
        platform: true,
        discoveredAt: true,
      },
    }),
    prisma.job.count({
      where: { userId, isActive: true, discoveredAt: { gte: today } },
    }),
  ])

  const totalJobs = allJobs.length
  const dataQualityWarning = totalJobs < 5
    ? 'Discover more jobs for accurate market data'
    : undefined

  // Salary by role
  const salaryGroups = new Map<string, { mins: number[]; maxs: number[]; currency: string }>()
  for (const job of allJobs) {
    if (job.salaryMin == null || job.salaryMax == null) continue
    const role = normalizeRoleTitle(job.title)
    const existing = salaryGroups.get(role) ?? { mins: [], maxs: [], currency: job.salaryCurrency ?? 'INR' }
    existing.mins.push(job.salaryMin)
    existing.maxs.push(job.salaryMax)
    salaryGroups.set(role, existing)
  }
  const salaryByRole: SalaryByRole[] = Array.from(salaryGroups.entries())
    .filter(([, g]) => g.mins.length >= 2)
    .map(([role, g]) => ({
      role,
      medianMin: Math.round(median(g.mins)),
      medianMax: Math.round(median(g.maxs)),
      currency: g.currency,
      sampleSize: g.mins.length,
    }))
    .sort((a, b) => b.sampleSize - a.sampleSize)
    .slice(0, 10)

  // Top skills
  const skillCounts = new Map<string, number>()
  for (const job of allJobs) {
    for (const raw of job.requiredSkills) {
      const normalized = normalizeSkill(raw)
      skillCounts.set(normalized, (skillCounts.get(normalized) ?? 0) + 1)
    }
  }
  const topSkills: SkillFrequency[] = Array.from(skillCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([skill, count]) => ({ skill, count }))

  // Company hiring velocity (last 30 days)
  const recentJobs = allJobs.filter(j => j.discoveredAt >= thirtyDaysAgo)
  const companyCounts = new Map<string, number>()
  for (const job of recentJobs) {
    companyCounts.set(job.company, (companyCounts.get(job.company) ?? 0) + 1)
  }
  const companyHiringVelocity: CompanyVelocity[] = Array.from(companyCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([company, jobCount]) => ({ company, jobCount }))

  // Remote by source
  const sourceStats = new Map<string, { total: number; remote: number }>()
  for (const job of allJobs) {
    const src = String(job.platform)
    const existing = sourceStats.get(src) ?? { total: 0, remote: 0 }
    existing.total++
    if (job.isRemote) existing.remote++
    sourceStats.set(src, existing)
  }
  const remoteBySource: RemoteBySource[] = Array.from(sourceStats.entries())
    .map(([platform, s]) => ({
      platform,
      totalJobs: s.total,
      remoteJobs: s.remote,
      remotePercent: s.total > 0 ? Math.round((s.remote / s.total) * 100) : 0,
    }))
    .sort((a, b) => b.totalJobs - a.totalJobs)

  return {
    salaryByRole,
    topSkills,
    companyHiringVelocity,
    remoteBySource,
    freshJobsToday,
    dataQualityWarning,
    computedAt: new Date().toISOString(),
  }
}
