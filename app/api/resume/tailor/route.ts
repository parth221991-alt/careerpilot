import { type NextRequest, NextResponse } from 'next/server'
import { getUserId } from '@/lib/utils/tenant'
import { prisma } from '@/lib/db/prisma'
import { runResumeAgent, runATSAnalysis } from '@/lib/claude/agents/ResumeAgent'
import { createLogger } from '@/lib/utils/logger'
import { z } from 'zod'

const logger = createLogger('resume-tailor')

const TailorFromJobSchema = z.object({
  baseResumeId: z.string().uuid(),
  jobId: z.string().uuid(),
  rawJD: z.undefined(),
})

const TailorFromPasteSchema = z.object({
  baseResumeId: z.string().uuid(),
  jobId: z.undefined(),
  rawJD: z.string().min(50),
  jobTitle: z.string().min(1),
  company: z.string().optional().default(''),
})

const TailorSchema = z.union([TailorFromJobSchema, TailorFromPasteSchema])

export async function POST(req: NextRequest) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = TailorSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { baseResumeId } = parsed.data

  const baseResume = await prisma.baseResume.findFirst({ where: { id: baseResumeId, userId } })
  if (!baseResume) return NextResponse.json({ error: 'Base resume not found' }, { status: 404 })
  if (!baseResume.rawText) return NextResponse.json({ error: 'Resume has no text content' }, { status: 400 })

  let jobId: string
  let jd: string
  let jobTitle: string
  let company: string
  let requiredSkills: string[] = []

  if ('jobId' in parsed.data && parsed.data.jobId) {
    const job = await prisma.job.findFirst({ where: { id: parsed.data.jobId, userId } })
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    jobId = job.id
    jd = job.rawDescription ?? job.description ?? ''
    jobTitle = job.title
    company = job.company
    requiredSkills = job.requiredSkills ?? []
  } else {
    const d = parsed.data as z.infer<typeof TailorFromPasteSchema>
    jd = d.rawJD
    jobTitle = d.jobTitle
    company = d.company ?? ''
    // Create a stub job record so we can link the variant
    const stubJob = await prisma.job.create({
      data: {
        userId,
        platform: 'COMPANY',
        platformJobId: `paste_${Date.now()}`,
        url: 'https://example.com',
        title: jobTitle,
        company,
        rawDescription: jd,
        discoveredAt: new Date(),
        isActive: false,
      },
    })
    jobId = stubJob.id
  }

  try {
    logger.info('Running ResumeAgent', { userId, jobId, jobTitle })

    const resumeContent = (baseResume.content as Record<string, unknown>) ?? { rawText: baseResume.rawText }

    const [tailoredOutput, atsOutput] = await Promise.all([
      runResumeAgent(userId, resumeContent, jd, jobTitle, company, requiredSkills),
      runATSAnalysis(baseResume.rawText, jd),
    ])

    const tailored = tailoredOutput.result
    const atsAnalysis = atsOutput.result

    const lastVariant = await prisma.resumeVariant.findFirst({
      where: { baseResumeId, userId },
      orderBy: { version: 'desc' },
    })
    const nextVersion = (lastVariant?.version ?? 0) + 1

    const variant = await prisma.resumeVariant.create({
      data: {
        baseResumeId,
        jobId,
        userId,
        version: nextVersion,
        tailoredJson: tailored as object,
        tailoredContent: tailored as object,
        atsScore: atsAnalysis.score,
        atsBreakdown: atsAnalysis as object,
        injectedKeywords: tailored.injectedKeywords ?? [],
        missingKeywords: atsAnalysis.missing_critical_skills,
        claudeReasoning: tailoredOutput.reasoning ?? null,
        keywordCoverage: atsAnalysis.component_scores.keyword_coverage,
        status: 'DRAFT',
      },
    })

    logger.info('Resume variant created', { userId, variantId: variant.id, atsScore: atsAnalysis.score })

    return NextResponse.json({
      variantId: variant.id,
      atsScore: atsAnalysis.score,
      keywordCoverage: atsAnalysis.component_scores.keyword_coverage,
      injectedKeywords: tailored.injectedKeywords ?? [],
      missingKeywords: atsAnalysis.missing_critical_skills,
      reasoning: tailoredOutput.reasoning,
    })
  } catch (err) {
    logger.error('ResumeAgent failed', { userId, err: String(err) })
    return NextResponse.json({ error: 'AI tailoring failed — please try again' }, { status: 500 })
  }
}
